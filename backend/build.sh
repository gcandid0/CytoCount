#!/usr/bin/env bash
# Compila main.py como um binário standalone (via PyInstaller) e o renomeia
# seguindo a convenção que o Tauri exige para "external binaries" (sidecars):
#   <nome>-<target-triple>[.exe]
#
# No Windows você pode rodar build.ps1 diretamente no PowerShell!
set -euo pipefail

cd "$(dirname "$0")"

pip install -r requirements.txt --break-system-packages 2>/dev/null || pip install -r requirements.txt

pyinstaller --noconfirm viacell-backend.spec

# Descobre o target triple do Rust instalado (o mesmo que o Tauri vai usar).
TRIPLE=$(rustc -Vv | grep host | cut -f2 -d' ')

mkdir -p ../src-tauri/binaries
EXT=""
if [[ "$TRIPLE" == *windows* ]]; then EXT=".exe"; fi

cp "dist/viacell-backend${EXT}" "../src-tauri/binaries/viacell-backend-${TRIPLE}${EXT}"

echo "Sidecar pronto em src-tauri/binaries/viacell-backend-${TRIPLE}${EXT}"
