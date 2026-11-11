#!/usr/bin/env bash
# Actualització automàtica del catàleg, sense preguntes (per al timer de systemd:
# deploy/systemd/). Pas a pas:
#   1. Només actua si el repo és a `main` i sense canvis pendents: no trepitja
#      mai feina a mig fer (si no, surt sense fer res).
#   2. git pull --ff-only.
#   3. scripts/update_prices.py: no elimina res; informe a scratch/productos/.
#   4. pnpm build com a porta: si falla, NO es fa commit i els canvis es queden
#      al disc perquè algú els miri (les execucions següents se saltaran).
#   5. Commit només dels fitxers del catàleg.
#   6. Push i deploy només amb AUTO_PUSH=1 / AUTO_DEPLOY=1 (per defecte, no).
#
# Codis de sortida: 0 = fet o res a fer · 3 = Amazon ha bloquejat (es tornarà a
# provar a la propera execució) · altres = error.
#
# Ús manual:  scripts/productos_auto.sh
#             AUTO_PUSH=1 AUTO_DEPLOY=1 DEPLOY_HOST=jan@<ip> scripts/productos_auto.sh

set -euo pipefail
cd "$(dirname "$0")/.."

LOG_DIR=scratch/productos
mkdir -p "$LOG_DIR"

avisa() {
  echo "$1"
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "Solución Canina · productos" "$1" >/dev/null 2>&1 || true
  fi
}

exec 9>"$LOG_DIR/.auto.lock"
if ! flock -n 9; then
  echo "Ja hi ha una actualització en marxa."
  exit 0
fi

branca=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branca" != "main" ]]; then
  echo "El repo és a la branca «$branca», no a main: no faig res."
  exit 0
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Hi ha canvis sense commit al repo: no faig res."
  exit 0
fi

git pull --ff-only --quiet

PY=.venv/bin/python
if [[ ! -x "$PY" ]]; then
  avisa "No hi ha .venv al repo (vegeu deploy/README.md): actualització no feta."
  exit 1
fi

set +e
"$PY" scripts/update_prices.py
rc=$?
set -e
if (( rc == 3 )); then
  avisa "Amazon ha bloquejat les peticions (CAPTCHA). Es tornarà a provar a la propera execució."
  exit 3
elif (( rc != 0 )); then
  avisa "update_prices.py ha fallat (codi $rc)."
  exit "$rc"
fi

CATALEG=(src/content/articulos src/data/precios-consultados.json public/images/articulos)
if [[ -z "$(git status --porcelain -- "${CATALEG[@]}")" ]]; then
  echo "Sense canvis al catàleg."
  exit 0
fi

if ! pnpm build >"$LOG_DIR/build-auto.log" 2>&1; then
  avisa "El build ha fallat després d'actualitzar productes: canvis sense commit ($LOG_DIR/build-auto.log)."
  exit 1
fi

git add -A -- "${CATALEG[@]}"
git commit --quiet -m "chore: actualización automática de productos ($(date +%F))"

if [[ "${AUTO_PUSH:-0}" == 1 ]]; then
  git push --quiet
fi
if [[ "${AUTO_DEPLOY:-0}" == 1 ]]; then
  ./deploy/deploy.sh
fi

avisa "Productes actualitzats i commit fet. Informe: $LOG_DIR/ultimo.md"
