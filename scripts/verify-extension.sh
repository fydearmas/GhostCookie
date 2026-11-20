#!/usr/bin/env bash
set -euo pipefail

npm test
npm run build
version=$(node -p "require('./manifest.json').version")
qa_dir=$(mktemp -d)
trap 'rm -rf -- "$qa_dir"' EXIT

if [[ ${GITHUB_ACTIONS:-false} == true ]]; then
  # The hosted runner needs to restore the permissions of Edge's sandbox helper.
  sudo chown root:root /opt/microsoft/msedge/msedge-sandbox
  sudo chmod 4755 /opt/microsoft/msedge/msedge-sandbox
fi

for browser in google-chrome microsoft-edge; do
  browser_path=$(command -v "$browser")
  python3 -m zipfile -e "dist/ghost-cookie-v$version.zip" "$qa_dir/$browser"
  XDG_CONFIG_HOME="$qa_dir/$browser-config" XDG_DATA_HOME="$qa_dir/$browser-data" \
    dbus-run-session -- node tests/browser-smoke.mjs "$browser_path" "$qa_dir/$browser"
done
