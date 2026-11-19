#!/usr/bin/env bash
# Hook pre-commit: si el commit inclou canvis a src/ o a escenaris/, comprova
# que els fitxers generats del commit (src/Escenaris.js i dist/Replica.gs) són
# els que genera "npm run build". Si no ho són, els regenera i atura el commit
# perquè els afegiu.
#
# Es construeix a partir del que hi ha preparat per al commit (l'índex), no
# dels fitxers de treball, i dins de Docker (no cal Node.js a l'ordinador).
#
# Instal·lació (una vegada, des de l'arrel del repositori):
#   ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
set -euo pipefail

arrel="$(git rev-parse --show-toplevel)"
cd "$arrel"

if ! git diff --cached --name-only | grep -qE '^(src|escenaris)/'; then
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "pre-commit: cal Docker per generar src/Escenaris.js i dist/Replica.gs." >&2
  exit 1
fi

temporal="$(mktemp -d)"
trap 'rm -rf "$temporal"' EXIT
git checkout-index --all --prefix="$temporal/"

docker run --rm --network none -u "$(id -u):$(id -g)" -v "$temporal":/app -w /app \
  node:22-alpine node scripts/build.js >/dev/null

desfasats=()
for f in src/Escenaris.js dist/Replica.gs; do
  if ! git cat-file -e ":$f" 2>/dev/null || ! cmp -s "$temporal/$f" <(git show ":$f"); then
    desfasats+=("$f")
  fi
done
[ ${#desfasats[@]} -eq 0 ] && exit 0

# Només es toquen els fitxers de treball que no tenen canvis propis sense preparar.
for f in "${desfasats[@]}"; do
  if git diff --quiet -- "$f" 2>/dev/null; then
    cp "$temporal/$f" "$f"
    echo "pre-commit: $f no estava al dia i s'ha regenerat. Afegiu-lo:  git add $f" >&2
  else
    echo "pre-commit: $f no està al dia i té canvis sense preparar. Executeu npm run build i afegiu-lo." >&2
  fi
done
echo "            Després, torneu a fer el commit." >&2
exit 1
