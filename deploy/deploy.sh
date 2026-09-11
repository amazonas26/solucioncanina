#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source deploy/config.sh

DRY=""
[[ "${1:-}" == "--dry-run" ]] && DRY="--dry-run" && echo "MODO DRY-RUN"

echo "→ Build"
pnpm build

echo "→ Verificando enlaces internos"
node scripts/astro-internal-link-check.mjs dist

[[ -f dist/index.html ]] || { echo "ERROR: dist/index.html no existe"; exit 1; }

echo "→ Sincronizando con $DEPLOY_HOST"
rsync -avz --delete $DRY dist/ "$DEPLOY_HOST:$DEPLOY_PATH/"

echo "→ Comprobando"
curl -sI -H "Host: www.solucioncanina.es" "http://${DEPLOY_HOST#*@}/" | head -1

echo "✓ Listo"