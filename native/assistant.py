#!/usr/bin/env python3
"""Ghost Cookie's per-user Gemini companion and Native Messaging installer."""

import argparse
import getpass
import json
import os
import re
import shlex
import struct
import sys
import tempfile
import warnings
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

HOST_NAME = "com.ghostcookie.assistant"
KEY_ACCOUNT = "gemini"
DEFAULT_MODEL = "gemini-3.6-flash"
ORIGIN_PREFIX = "chrome-extension://"
OFFICIAL_IDS_PATH = Path(__file__).with_name("official-extension-ids.json")
OFFICIAL_BROWSERS = ("chrome", "edge")
BROWSERS = (*OFFICIAL_BROWSERS, "chromium", "chrome-for-testing")
SOURCE_CONFIG = "host-config.json"
PUBLISHED_CONFIG = "official-host-config.json"
EXTENSION_ID = re.compile(r"[a-p]{32}", re.ASCII)
MODEL_ID = re.compile(r"gemini-[a-z0-9][a-z0-9.-]{0,63}", re.ASCII)
API_KEY = re.compile(r"[A-Za-z0-9._~-]{20,512}", re.ASCII)
MESSAGE_HEADER = struct.Struct("=I")
MAX_REQUEST_BYTES = 2048
MAX_PROVIDER_BYTES = 128 * 1024
MAX_ANALYSIS_CHARS = 1000
INDICATORS = {
    "lookalike-domain",
    "internationalized-domain",
    "insecure-http",
    "known-threat",
}
ERRORS = {
    "invalid-message": "La solicitud del navegador no es válida.",
    "invalid-origin": "El origen de la extensión no coincide con la instalación.",
    "host-configuration": "Vuelve a instalar el asistente local.",
    "official-ids-unavailable": "Este instalador no contiene los identificadores oficiales de Chrome y Edge.",
    "keyring-unavailable": "Abre el llavero del sistema e intenta de nuevo.",
    "missing-key": "Configura tu clave en el asistente local.",
    "credentials-rejected": "Gemini rechazó la solicitud. Revisa tu clave o la configuración del modelo.",
    "model-unavailable": "Selecciona un modelo de Gemini disponible en el asistente local.",
    "quota": "Gemini alcanzó el límite de uso de tu proyecto. Intenta más tarde.",
    "connection": "El asistente no pudo conectarse a Gemini.",
    "provider-response": "Gemini no devolvió un análisis utilizable.",
}


class CompanionError(Exception):
    def __init__(self, code):
        super().__init__(ERRORS[code])
        self.code = code


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def secure_keyring():
    # Select an OS vault explicitly. User-configured Python keyring plugins
    # can include file-backed alternatives that are inappropriate for this host.
    try:
        if sys.platform == "linux":
            from keyring.backends.SecretService import Keyring
        elif sys.platform == "darwin":
            from keyring.backends.macOS import Keyring
        elif sys.platform == "win32":
            from keyring.backends.Windows import WinVaultKeyring as Keyring
        else:
            raise ImportError
        if Keyring.priority <= 0:
            raise RuntimeError
        return Keyring()
    except Exception as exc:
        raise CompanionError("keyring-unavailable") from exc


def load_key():
    try:
        key = secure_keyring().get_password(HOST_NAME, KEY_ACCOUNT)
    except Exception as exc:
        raise CompanionError("keyring-unavailable") from exc
    if key is not None and not API_KEY.fullmatch(key):
        raise CompanionError("credentials-rejected")
    return key


def read_message(stream):
    header = stream.read(MESSAGE_HEADER.size)
    if len(header) != MESSAGE_HEADER.size:
        raise CompanionError("invalid-message")
    size, = MESSAGE_HEADER.unpack(header)
    if not 0 < size <= MAX_REQUEST_BYTES:
        raise CompanionError("invalid-message")
    payload = stream.read(size)
    if len(payload) != size:
        raise CompanionError("invalid-message")
    try:
        return json.loads(payload.decode("utf-8"))
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise CompanionError("invalid-message") from exc


def write_message(stream, message):
    payload = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    stream.write(MESSAGE_HEADER.pack(len(payload)))
    stream.write(payload)
    stream.flush()


def validate_signals(signals):
    expected_fields = {"blocked", "detected", "cookies", "threat", "indicators"}
    if not isinstance(signals, dict) or signals.keys() != expected_fields:
        raise CompanionError("invalid-message")
    for field in ("blocked", "detected", "cookies"):
        value = signals[field]
        if field == "blocked" and value is None:
            continue
        if type(value) is not int or not 0 <= value <= 1_000_000:
            raise CompanionError("invalid-message")
    if signals["threat"] not in ("known", "none", "unavailable"):
        raise CompanionError("invalid-message")
    indicators = signals["indicators"]
    if not isinstance(indicators, list) or len(indicators) > len(INDICATORS):
        raise CompanionError("invalid-message")
    if any(not isinstance(value, str) or value not in INDICATORS for value in indicators):
        raise CompanionError("invalid-message")
    if len(set(indicators)) != len(indicators):
        raise CompanionError("invalid-message")
    return signals


def create_provider_request(api_key, model, signals):
    prompt = (
        "Explica en español y con un máximo de tres oraciones estas señales de "
        "privacidad del navegador. blocked son solicitudes bloqueadas y null "
        "indica que ese conteo no está disponible. detected son rastreadores "
        "detectados y cookies es un conteo. threat es el resultado "
        "de una verificación independiente de reputación: known indica una coincidencia "
        "confirmada, none indica ausencia de coincidencias conocidas y unavailable "
        "indica que no se pudo verificar. Los indicadores son observaciones heurísticas. "
        "No inventes un dominio, una amenaza ni una garantía de seguridad. "
        "Responde solo con texto sencillo. Señales: "
        + json.dumps(signals, separators=(",", ":"), sort_keys=True)
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1024},
    }
    return Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )


def extract_analysis(raw, credential=None):
    if len(raw) > MAX_PROVIDER_BYTES:
        raise CompanionError("provider-response")
    try:
        parts = json.loads(raw)["candidates"][0]["content"]["parts"]
        text = " ".join(
            part["text"] for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str) and not part.get("thought")
        ).strip()
    except (KeyError, IndexError, TypeError, ValueError, RecursionError) as exc:
        raise CompanionError("provider-response") from exc
    if not text:
        raise CompanionError("provider-response")
    if credential:
        text = text.replace(credential, "[credencial omitida]")
    # Replace unpaired Unicode surrogates before framing the reply.
    return text[:MAX_ANALYSIS_CHARS].encode("utf-8", errors="replace").decode("utf-8")


def analyze(api_key, model, signals):
    request = create_provider_request(api_key, model, signals)
    # Avoid forwarding a credential to a redirected URL or using an inherited HTTP proxy.
    client = build_opener(ProxyHandler({}), NoRedirect())
    try:
        with client.open(request, timeout=25) as response:
            raw = response.read(MAX_PROVIDER_BYTES + 1)
            return extract_analysis(raw, credential=api_key)
    except HTTPError as exc:
        code = {
            400: "credentials-rejected",
            401: "credentials-rejected",
            403: "credentials-rejected",
            404: "model-unavailable",
            429: "quota",
        }.get(exc.code, "connection")
        exc.close()
        raise CompanionError(code) from exc
    except (URLError, OSError) as exc:
        raise CompanionError("connection") from exc


def handle_message(message, config):
    if not isinstance(message, dict):
        raise CompanionError("invalid-message")
    if message == {"action": "status"}:
        return {"ok": True, "configured": load_key() is not None}
    if message.keys() != {"action", "signals"} or message["action"] != "analyze":
        raise CompanionError("invalid-message")
    signals = validate_signals(message["signals"])
    key = load_key()
    if key is None:
        raise CompanionError("missing-key")
    return {"ok": True, "text": analyze(key, config["model"], signals)}


def valid_extension_id(value):
    return isinstance(value, str) and EXTENSION_ID.fullmatch(value) is not None


def valid_registrations(value):
    return (
        isinstance(value, dict)
        and value.keys() <= set(BROWSERS)
        and all(valid_extension_id(item) for item in value.values())
    )


def read_official_ids(path=None):
    try:
        ids = json.loads((path or OFFICIAL_IDS_PATH).read_text(encoding="utf-8"))
        if valid_registrations(ids) and ids.keys() == set(OFFICIAL_BROWSERS):
            return ids
    except (OSError, ValueError, RecursionError):
        pass
    raise CompanionError("official-ids-unavailable")


def read_config(path):
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
        model = config["model"]
        registrations = config.get("registrations")
        if registrations is None and "extension_id" in config:
            registrations = {"chrome": config["extension_id"]}
        if valid_registrations(registrations) and MODEL_ID.fullmatch(model):
            return {"registrations": registrations, "model": model}
    except (OSError, ValueError, RecursionError, KeyError, TypeError):
        pass
    raise CompanionError("host-configuration")


def allowed_origins(extension_ids):
    return [ORIGIN_PREFIX + extension_id + "/" for extension_id in sorted(set(extension_ids))]


def run_host(origin, config_path, source, target, pinned_ids=None):
    try:
        config = read_config(config_path)
        registrations = config["registrations"]
        if pinned_ids is not None and any(pinned_ids.get(browser) != extension_id for browser, extension_id in registrations.items()):
            raise CompanionError("host-configuration")
        origins = allowed_origins(registrations.values())
        if origin not in origins and origin + "/" not in origins:
            raise CompanionError("invalid-origin")
        response = handle_message(read_message(source), config)
    except CompanionError as exc:
        response = {"ok": False, "code": exc.code, "error": str(exc)}
    except Exception:
        response = {"ok": False, "code": "provider-response", "error": ERRORS["provider-response"]}
    write_message(target, response)


def data_dir():
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "GhostCookie"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "GhostCookie"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "ghostcookie"


def manifest_file(browser, directory, user_data_dir=None):
    if sys.platform == "win32":
        return directory / f"{HOST_NAME}.{browser}.json"
    if user_data_dir:
        base = user_data_dir
    elif sys.platform == "darwin":
        entries = {
            "chrome": "Google/Chrome",
            "edge": "Microsoft Edge",
            "chrome-for-testing": "Google/Chrome for Testing",
            "chromium": "Chromium",
        }
        base = Path.home() / "Library" / "Application Support" / entries[browser]
    else:
        entries = {
            "chrome": "google-chrome",
            "edge": "microsoft-edge",
            "chrome-for-testing": "google-chrome-for-testing",
            "chromium": "chromium",
        }
        config = os.environ.get("XDG_CONFIG_HOME")
        if browser != "edge":
            config = os.environ.get("CHROME_CONFIG_HOME") or config
        base = Path(config or Path.home() / ".config") / entries[browser]
    return base.expanduser().absolute() / "NativeMessagingHosts" / f"{HOST_NAME}.json"


def windows_registry(browser, manifest, remove=False):
    import winreg
    vendors = {"chromium": "Chromium", "edge": r"Microsoft\Edge"}
    vendor = vendors.get(browser, r"Google\Chrome")
    subkey = rf"SOFTWARE\{vendor}\NativeMessagingHosts\{HOST_NAME}"
    views = (winreg.KEY_WOW64_32KEY, winreg.KEY_WOW64_64KEY)
    if not remove:
        for view in views:
            with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, subkey, 0, winreg.KEY_SET_VALUE | view) as key:
                winreg.SetValueEx(key, None, 0, winreg.REG_SZ, str(manifest))
        return
    for view in views:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey, 0, winreg.KEY_QUERY_VALUE | view) as key:
                value, _ = winreg.QueryValueEx(key, None)
            if Path(value) == manifest:
                winreg.DeleteKeyEx(winreg.HKEY_CURRENT_USER, subkey, view)
        except FileNotFoundError:
            pass


def write_file(path, content, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary_name = tempfile.mkstemp(dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_host_config(path, registrations, model):
    write_file(path, json.dumps({"registrations": registrations, "model": model}).encode("utf-8"))


def register_browser(browser, directory, launcher, extension_ids, user_data_dir=None):
    manifest = manifest_file(browser, directory, user_data_dir)
    host_manifest = {
        "name": HOST_NAME,
        "description": "Ghost Cookie Gemini Companion",
        "path": str(launcher),
        "type": "stdio",
        "allowed_origins": allowed_origins(extension_ids),
    }
    write_file(manifest, (json.dumps(host_manifest, indent=2) + "\n").encode("utf-8"))
    if sys.platform == "win32":
        windows_registry(browser, manifest)


def unregister_browser(browser, directory, launcher, user_data_dir=None, legacy=False):
    manifest = manifest_file(browser, directory, user_data_dir)
    candidates = [manifest]
    if legacy and sys.platform == "win32":
        candidates.append(directory / f"{HOST_NAME}.json")
    for candidate in candidates:
        try:
            current = json.loads(candidate.read_text(encoding="utf-8"))
            if current.get("name") != HOST_NAME or Path(current.get("path", "")) != launcher:
                continue
        except (FileNotFoundError, ValueError, TypeError, AttributeError):
            continue
        if sys.platform == "win32":
            windows_registry(browser, candidate, remove=True)
        candidate.unlink(missing_ok=True)


def source_launcher(directory):
    return directory / ("ghostcookie-host.cmd" if sys.platform == "win32" else "ghostcookie-host")


def install_source_launcher(directory):
    installed = directory / "assistant.py"
    launcher = source_launcher(directory)
    if sys.platform == "win32":
        interpreter = sys.executable.replace("%", "%%")
        local_script = str(installed).replace("%", "%%")
        command = (
            '@echo off\r\nsetlocal DisableDelayedExpansion\r\nchcp 65001 >nul 2>&1\r\n'
            f'"{interpreter}" -I -B "{local_script}" --native-host "%~1"\r\n'
        )
    else:
        interpreter = shlex.quote(sys.executable)
        local_script = shlex.quote(str(installed))
        command = f'#!/bin/sh\nexec {interpreter} -I -B {local_script} --native-host "$1"\n'
    write_file(installed, Path(__file__).read_bytes())
    write_file(launcher, command.encode("utf-8"), 0o700)
    return launcher


def install(args):
    if not valid_extension_id(args.extension_id) or not MODEL_ID.fullmatch(args.model):
        raise ValueError("Indica el ID de Ghost Cookie y un identificador de modelo válido.")
    directory = data_dir().expanduser().absolute()
    packaged = getattr(sys, "frozen", False)
    if packaged and read_official_ids().get(args.browser) != args.extension_id:
        raise ValueError("Este asistente solo admite los identificadores oficiales incluidos en el instalador.")
    config_path = directory / (PUBLISHED_CONFIG if packaged else SOURCE_CONFIG)
    registrations = read_config(config_path)["registrations"] if config_path.exists() else {}
    registrations[args.browser] = args.extension_id
    launcher = Path(sys.executable).absolute() if packaged else install_source_launcher(directory)
    write_host_config(config_path, registrations, args.model)
    register_browser(args.browser, directory, launcher, [args.extension_id], args.chrome_user_data_dir)
    print(f"Asistente registrado para {args.extension_id} ({args.model}).")


def register_published(launcher):
    ids = read_official_ids()
    launcher = launcher.absolute()
    if not launcher.is_file():
        raise CompanionError("host-configuration")
    directory = data_dir().expanduser().absolute()
    path = directory / PUBLISHED_CONFIG
    legacy = directory / SOURCE_CONFIG
    previous_config = path if path.exists() else legacy
    try:
        model = read_config(previous_config)["model"] if previous_config.exists() else DEFAULT_MODEL
    except CompanionError:
        model = DEFAULT_MODEL
    write_host_config(path, ids, model)
    for browser in OFFICIAL_BROWSERS:
        register_browser(browser, directory, launcher, ids.values())


def unregister_published(launcher):
    directory = data_dir().expanduser().absolute()
    for browser in OFFICIAL_BROWSERS:
        unregister_browser(browser, directory, launcher.absolute())
    (directory / PUBLISHED_CONFIG).unlink(missing_ok=True)


def read_key_from_terminal():
    if not sys.stdin.isatty():
        raise ValueError("Abre una terminal interactiva para introducir la clave.")
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        try:
            key = getpass.getpass("Clave de Gemini: ").strip()
        except getpass.GetPassWarning as exc:
            raise ValueError("La terminal no puede ocultar la clave.") from exc
    return key


def store_key(key):
    if not isinstance(key, str) or not API_KEY.fullmatch(key):
        raise ValueError("La clave tiene un formato inesperado.")
    try:
        secure_keyring().set_password(HOST_NAME, KEY_ACCOUNT, key)
    except Exception as exc:
        raise CompanionError("keyring-unavailable") from exc


def remove_key():
    try:
        keyring = secure_keyring()
        if keyring.get_password(HOST_NAME, KEY_ACCOUNT) is not None:
            keyring.delete_password(HOST_NAME, KEY_ACCOUNT)
    except Exception as exc:
        raise CompanionError("keyring-unavailable") from exc


def setup_key_command(source, target):
    # This interface uses a private pipe from the native GUI. The separate
    # browser protocol never handles credentials or key-management commands.
    try:
        message = read_message(source)
        if message == {"action": "status"}:
            response = {"ok": True, "configured": load_key() is not None}
        elif message == {"action": "remove"}:
            remove_key()
            response = {"ok": True, "configured": False}
        elif isinstance(message, dict) and message.keys() == {"action", "key"} and message["action"] == "save":
            store_key(message["key"])
            response = {"ok": True, "configured": True}
        else:
            raise CompanionError("invalid-message")
    except (CompanionError, ValueError) as exc:
        response = {"ok": False, "error": str(exc)}
    write_message(target, response)


def binary_stdio():
    if sys.platform == "win32":
        import msvcrt
        for stream in (sys.stdin, sys.stdout):
            msvcrt.setmode(stream.fileno(), os.O_BINARY)
    return sys.stdin.buffer, sys.stdout.buffer


def launch_native(origin):
    source, target = binary_stdio()
    try:
        if getattr(sys, "frozen", False):
            pinned = read_official_ids()
            config = data_dir() / PUBLISHED_CONFIG
        else:
            pinned = None
            config = Path(__file__).with_name(SOURCE_CONFIG)
    except CompanionError as exc:
        write_message(target, {"ok": False, "code": exc.code, "error": str(exc)})
        return
    run_host(origin, config, source, target, pinned)


def main():
    parser = argparse.ArgumentParser(description="Asistente local de Ghost Cookie")
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("install", help="registrar el asistente para tu extensión")
    setup.add_argument("extension_id")
    setup.add_argument("--model", default=DEFAULT_MODEL)
    unsetup = commands.add_parser("uninstall", help="quitar el registro del asistente")
    for command in (setup, unsetup):
        command.add_argument("--browser", choices=BROWSERS, default="chrome")
        command.add_argument("--browser-user-data-dir", "--chrome-user-data-dir", dest="chrome_user_data_dir", type=Path)
    commands.add_parser("set-key", help="guardar tu propia clave desde la terminal")
    commands.add_parser("remove-key", help="borrar tu clave del llavero")
    commands.add_parser("status", help="consultar si el llavero contiene tu clave")
    commands.add_parser("unregister-published", help="retirar el registro del instalador para Chrome y Edge")
    args = parser.parse_args()
    try:
        if args.command == "install":
            install(args)
        elif args.command == "uninstall":
            directory = data_dir().expanduser().absolute()
            packaged = getattr(sys, "frozen", False)
            launcher = Path(sys.executable).absolute() if packaged else source_launcher(directory)
            unregister_browser(args.browser, directory, launcher, args.chrome_user_data_dir, legacy=not packaged)
            print("Registro del asistente eliminado.")
        elif args.command == "set-key":
            store_key(read_key_from_terminal())
            print("Clave guardada en el llavero del sistema.")
        elif args.command == "remove-key":
            remove_key()
            print("El asistente ya no tiene una clave guardada.")
        elif args.command == "status":
            print("Clave configurada." if load_key() is not None else "Falta configurar tu clave.")
        elif args.command == "unregister-published" and getattr(sys, "frozen", False):
            unregister_published(Path(sys.executable))
    except (CompanionError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except (OSError, KeyboardInterrupt):
        print("La operación del asistente no se completó.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    first_arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if first_arg.startswith(ORIGIN_PREFIX):
        launch_native(first_arg)
    elif len(sys.argv) == 3 and first_arg == "--native-host":
        launch_native(sys.argv[2])
    elif sys.argv[1:] == ["setup-command"]:
        setup_key_command(*binary_stdio())
    else:
        sys.exit(main())
