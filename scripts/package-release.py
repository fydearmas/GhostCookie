import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
VERSION = MANIFEST["version"]
DIST = ROOT / "dist"
GUARANTEED_STATIC_RULES = 30_000
EXTENSION = {
    "manifest.json", "_locales/es/messages.json", "LICENSE",
    "background/service-worker.js", "background/protection.js",
    "background/reputation.js", "background/site-cookies.js",
    "popup/popup.html", "popup/popup.js", "popup/popup.css", "popup/theme.css",
    "options/options.html", "options/options.js", "options/options.css",
    "content/content.js", "content/youtube-adblocker.js",
    "utils/cookie-classifier.js", "reputation/warning.html",
    "reputation/PHISHDESTROY-LICENSE.txt", "reputation/source.json",
    "rules/THIRD_PARTY_NOTICES.md", "rules/easylist.lock.json",
    "rules/adguard-es-pt/README.md", "rules/adguard-es-pt/LICENSE.txt", "rules/adguard-es-pt/source.txt",
    "rules/adguard-es-pt/source.json", "rules/adguard-es-pt/cosmetic.json",
    "scripts/compile-regional.mjs", "scripts/filter-compiler.mjs",
    *MANIFEST["icons"].values(),
    *(rule["path"] for rule in MANIFEST["declarative_net_request"]["rule_resources"]),
    *(path for entry in MANIFEST["content_scripts"] for path in entry["js"]),
}


def create_zip(dest, entries):
    temporary = dest.with_suffix(".zip.tmp")
    try:
        with ZipFile(temporary, "w") as archive:
            for name in sorted(entries):
                info = ZipInfo(name)
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, (ROOT / name).read_bytes(),
                                 compress_type=ZIP_DEFLATED, compresslevel=9)
        temporary.replace(dest)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if package["version"] != VERSION:
        raise SystemExit("La versión de package.json debe coincidir con manifest.json.")
    rulesets = MANIFEST["declarative_net_request"]["rule_resources"]
    static_count = sum(len(json.loads((ROOT / rule["path"]).read_text(encoding="utf-8"))) for rule in rulesets)
    if static_count > GUARANTEED_STATIC_RULES:
        raise SystemExit("Las listas empaquetadas superan el mínimo de reglas estáticas garantizado por Chromium.")
    DIST.mkdir(exist_ok=True)
    package_path = DIST / f"ghost-cookie-v{VERSION}.zip"
    create_zip(package_path, EXTENSION)
    print(package_path.relative_to(ROOT))
    checksums = f"{hashlib.sha256(package_path.read_bytes()).hexdigest()}  {package_path.name}\n"
    (DIST / f"ghost-cookie-v{VERSION}-SHA256SUMS.txt").write_text(
        checksums, encoding="ascii", newline="\n"
    )


if __name__ == "__main__":
    main()
