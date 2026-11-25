#!/usr/bin/env bash
set -euo pipefail

REPO="nattapoltongsom/VibePet"
ASSET_NAME="VibePet-arm64.zip"
APP_NAME="VibePet.app"
INSTALL_DIR="/Applications"
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: VibePet currently supports macOS only."
  exit 1
fi

if [ "$(uname -m)" != "arm64" ]; then
  echo "Error: VibePet currently supports Apple Silicon (arm64) Macs."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading latest VibePet..."
curl -fL --progress-bar "$DOWNLOAD_URL" -o "${TMP_DIR}/${ASSET_NAME}"

if pgrep -x "VibePet" >/dev/null 2>&1; then
  echo "Closing running VibePet..."
  osascript -e 'quit app "VibePet"' >/dev/null 2>&1 || true
  sleep 1
fi

echo "Installing to ${INSTALL_DIR}/${APP_NAME}..."
ditto -xk "${TMP_DIR}/${ASSET_NAME}" "${TMP_DIR}/extracted"

if [ ! -d "${TMP_DIR}/extracted/${APP_NAME}" ]; then
  echo "Error: ${APP_NAME} not found in archive."
  exit 1
fi

rm -rf "${INSTALL_DIR}/${APP_NAME}"
mv "${TMP_DIR}/extracted/${APP_NAME}" "${INSTALL_DIR}/${APP_NAME}"
xattr -cr "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || true

echo "Launching VibePet..."
open -a "${INSTALL_DIR}/${APP_NAME}"
echo "Done! VibePet is installed in ${INSTALL_DIR}/${APP_NAME}."
