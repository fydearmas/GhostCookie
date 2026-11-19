#!/usr/bin/env bash
set -euo pipefail
umask 022

usage() {
  printf 'Usage: bash packaging/macos/build.sh [--unsigned] official-extension-ids.json\n' >&2
  exit 2
}

mode="signed"
if [[ "${1:-}" == "--unsigned" ]]; then
  mode="unsigned"
  shift
fi
[[ $# == 1 && -f "$1" ]] || usage
if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'The macOS package must be built on macOS.\n' >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/../.." && pwd)"
python="${PYTHON:-python3}"
app_name="Ghost Cookie Assistant"
bundle_id="com.ghostcookie.assistant.setup"
arch="$(uname -m)"
case "$arch" in
  arm64|x86_64) ;;
  *) printf 'Unsupported macOS architecture.\n' >&2; exit 1 ;;
esac

build_options=(--noupx)
if [[ "$mode" == "signed" ]]; then
  : "${MACOS_APPLICATION_IDENTITY:?Set the Developer ID Application identity.}"
  : "${MACOS_INSTALLER_IDENTITY:?Set the Developer ID Installer identity.}"
  : "${MACOS_NOTARY_PROFILE:?Set the notarytool keychain profile.}"
  if [[ "$MACOS_APPLICATION_IDENTITY" != "Developer ID Application: "* ||
        "$MACOS_INSTALLER_IDENTITY" != "Developer ID Installer: "* ]]; then
    printf 'Use Apple-issued Developer ID Application and Installer identities.\n' >&2
    exit 1
  fi
  build_options+=(--codesign-identity "$MACOS_APPLICATION_IDENTITY")
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/ghostcookie-macos.XXXXXX")"
trap 'rm -rf "$work"' EXIT
ids="$work/official-extension-ids.json"
version="$("$python" - "$root" "$1" "$ids" "$arch" <<'PY'
import json
import platform
import re
import sys
from pathlib import Path

import tkinter

root, source, destination = map(Path, sys.argv[1:4])
architecture = sys.argv[4]
if platform.machine() != architecture:
    raise SystemExit("Use a Python interpreter matching the build architecture.")

contents = json.loads(source.read_text(encoding="utf-8"))
if (
    not isinstance(contents, dict)
    or set(contents) != {"chrome", "edge"}
    or any(not isinstance(value, str) or not re.fullmatch("[a-p]{32}", value)
           for value in contents.values())
):
    raise SystemExit("Supply official Chrome Web Store and Edge Add-ons extension IDs.")

version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version) or manifest["version"] != version:
    raise SystemExit("package.json and manifest.json must have matching release versions.")

destination.write_text(json.dumps(contents, sort_keys=True) + "\n", encoding="utf-8")
print(version)
PY
)"

mkdir -p "$work/spec" "$work/payload"
iconset="$work/GhostCookie.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$root/icons/icon128.png" \
    --out "$iconset/icon_${size}x${size}.png" >/dev/null
  doubled="$((size * 2))"
  sips -z "$doubled" "$doubled" "$root/icons/icon128.png" \
    --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns --output "$work/GhostCookie.icns" "$iconset"
common=(
  --noconfirm
  --target-arch "$arch"
  --specpath "$work/spec"
  --distpath "$work/dist"
  --add-data "$ids:."
  --hidden-import keyring.backends.macOS
  --copy-metadata keyring
)
"$python" -m PyInstaller "${common[@]}" "${build_options[@]}" \
  --workpath "$work/host-build" --onefile --console --name ghostcookie-host \
  "$root/native/assistant.py"
"$python" -m PyInstaller "${common[@]}" "${build_options[@]}" \
  --workpath "$work/gui-build" --onedir --windowed --name "$app_name" \
  --icon "$work/GhostCookie.icns" \
  --osx-bundle-identifier "$bundle_id" "$root/native/setup_app.py"

app="$work/payload/$app_name.app"
helper="$app/Contents/MacOS/ghostcookie-host"
ditto "$work/dist/$app_name.app" "$app"
install -m 755 "$work/dist/ghostcookie-host" "$helper"
install -m 644 "$root/LICENSE" "$app/Contents/Resources/License.txt"
"$python" "$root/packaging/collect-runtime-notices.py" \
  "$app/Contents/Resources/Third Party Notices.txt"
"$python" - "$app/Contents/Info.plist" "$version" <<'PY'
import plistlib
import sys
from pathlib import Path

path = Path(sys.argv[1])
with path.open("rb") as stream:
    info = plistlib.load(stream)
info["CFBundleShortVersionString"] = sys.argv[2]
info["CFBundleVersion"] = sys.argv[2]
with path.open("wb") as stream:
    plistlib.dump(info, stream)
PY

if [[ "$mode" == "signed" ]]; then
  signing_options=(--timestamp --options runtime --sign "$MACOS_APPLICATION_IDENTITY")
else
  signing_options=(--sign -)
fi
# PyInstaller signs the inner binaries during collection. Sign the added helper
# and seal the final bundle after writing package resources and Info.plist.
codesign --force "${signing_options[@]}" "$helper"
codesign --force "${signing_options[@]}" "$app"
codesign --verify --strict --deep --verbose=2 "$app"
lipo -verify_arch "$arch" "$app/Contents/MacOS/$app_name"
lipo -verify_arch "$arch" "$helper"
# Exercise the frozen command line without touching the browser or keychain.
"$helper" --help >/dev/null

components="$work/components.plist"
pkgbuild --analyze --root "$work/payload" "$components"
"$python" - "$components" "$app_name.app" <<'PY'
import plistlib
import sys
from pathlib import Path

path = Path(sys.argv[1])
with path.open("rb") as stream:
    components = plistlib.load(stream)
matches = [component for component in components
           if component.get("RootRelativeBundlePath") == sys.argv[2]]
if len(matches) != 1:
    raise SystemExit("The installer must contain one Ghost Cookie application bundle.")
matches[0]["BundleIsRelocatable"] = False
matches[0]["BundleOverwriteAction"] = "upgrade"
with path.open("wb") as stream:
    plistlib.dump(components, stream)
PY

pkg_options=(
  --root "$work/payload"
  --component-plist "$components"
  --install-location /Applications
  --identifier com.ghostcookie.assistant.pkg
  --version "$version"
)
pkg="$work/ghostcookie.pkg"
name="ghost-cookie-assistant-v$version-macos-$arch"
if [[ "$mode" == "signed" ]]; then
  pkgbuild "${pkg_options[@]}" --sign "$MACOS_INSTALLER_IDENTITY" "$pkg"
  pkgutil --check-signature "$pkg"
  notary_args=(--keychain-profile "$MACOS_NOTARY_PROFILE")
  if [[ -n "${MACOS_NOTARY_KEYCHAIN:-}" ]]; then
    notary_args+=(--keychain "$MACOS_NOTARY_KEYCHAIN")
  fi
  report="$work/notary-report.json"
  xcrun notarytool submit "$pkg" "${notary_args[@]}" --wait --output-format json > "$report"
  "$python" - "$report" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if report.get("status") != "Accepted":
    raise SystemExit(
        f"Apple notarization status: {report.get('status', 'unknown')}. "
        f"Submission ID: {report.get('id', 'unavailable')}."
    )
PY
  xcrun stapler staple "$pkg"
  xcrun stapler validate "$pkg"
else
  name+="-unsigned"
  pkgbuild "${pkg_options[@]}" "$pkg"
fi

mkdir -p "$root/dist"
mv "$pkg" "$root/dist/$name.pkg"
printf '%s\n' "$root/dist/$name.pkg"
