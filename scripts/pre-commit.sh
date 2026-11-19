#!/usr/bin/env bash
# Hook pre-commit: si el commit inclou canvis a src/, comprova que el
# dist/Replica.gs del commit és el que genera "npm run build" a partir del
# src/ del commit. Si no ho és, el regenera i atura el commit perquè
# l'afegiu.
#
# Es construeix a partir del que hi ha preparat per al commit (l'índex), no
# dels fitxers de treball, i dins de Docker (no cal Node.js a l'ordinador).
#
# Instal·lació (una vegada, des de l'arrel del repositori):
#   ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
set -euo pipefail

arrel="$(git rev-parse --show-toplevel)"
cd "$arrel"

if ! git diff --cached --name-only | grep -q '^src/'; then
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "pre-commit: cal Docker per generar dist/Replica.gs." >&2
  exit 1
fi

temporal="$(mktemp -d)"
trap 'rm -rf "$temporal"' EXIT
git checkout-index --all --prefix="$temporal/"

docker run --rm --network none -u "$(id -u):$(id -g)" -v "$temporal":/app -w /app \
  node:22-alpine node scripts/build.js >/dev/null

if git cat-file -e :dist/Replica.gs 2>/dev/null &&
   cmp -s "$temporal/dist/Replica.gs" <(git show :dist/Replica.gs); then
  exit 0
fi

# Només es toca el fitxer de treball si no té canvis propis sense preparar.
if git diff --quiet -- dist/Replica.gs 2>/dev/null; then
  cp "$temporal/dist/Replica.gs" dist/Replica.gs
  echo "pre-commit: dist/Replica.gs no estava al dia amb src/ i s'ha regenerat." >&2
  echo "            Afegiu-lo i torneu a fer el commit:  git add dist/Replica.gs" >&2
else
  echo "pre-commit: dist/Replica.gs no està al dia amb src/, i té canvis sense preparar." >&2
  echo "            Executeu npm run build, afegiu dist/Replica.gs i torneu a fer el commit." >&2
fi
exit 1
