#!/usr/bin/env sh
# Executa clasp dins d'un contenidor Docker, sense instal·lar Node.js a l'ordinador.
# Les credencials de "clasp login" es desen a ~/.config/replica-poc-clasp
# (fora del projecte, i per tant mai al repositori).
#
# Exemples:
#   ./scripts/clasp.sh login --no-localhost
#   ./scripts/clasp.sh push
set -eu
CLASP_VERSION="3.4.1"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/replica-poc-clasp"
mkdir -p "$CONFIG_DIR"
cd "$(dirname "$0")/.."
exec docker run --rm -it \
  -u "$(id -u):$(id -g)" \
  -e HOME=/clasp-home \
  -v "$CONFIG_DIR":/clasp-home \
  -v "$PWD":/app -w /app \
  node:22-alpine \
  npx --yes "@google/clasp@${CLASP_VERSION}" "$@"
