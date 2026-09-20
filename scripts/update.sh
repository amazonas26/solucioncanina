#!/usr/bin/env bash
# Orquestrador d'actualització del catàleg — solucioncanina.
#
# Encadena els scripts existents per etapes, en l'ordre correcte, SENSE tocar-los.
# Pensat per estalviar temps sense barrejar coses de naturalesa diferent:
#   · barat/freqüent (preus)  vs  car/LLM (ressenyes)  vs  destructiu (poda de productes).
#
# ───────────────────────────────────────────────────────────────────────────
# ETAPES (en pots encadenar diverses):
#   prices         Refresca preus/valoracions i poda productes no disponibles. (destructiu)
#                  Amb --refill també substitueix els eliminats (update_prices --refill-deleted).
#   new            Descobreix nous productes a Amazon + n'omple imatge i descripció.
#   images         Descarrega/actualitza imatges de producte (--skip-ok).
#   descriptions   Omple el camp `descripcion` des d'Amazon.
#   content        Pipeline editorial de ressenyes (reviews->classify->generate->quality). (LLM, cost)
#   maintenance    Enllaços d'afiliat + seccions + secció primària (deterministes).
#   build          Compila amb Astro: el comprovador d'enllaços valida tot el lloc. (gate)
#   all            Tot, en l'ordre correcte, amb confirmació pel destructiu/car.
#
# OPCIONS:
#   -n, --dry-run  Passa --dry-run als scripts (lectura d'Amazon, però sense escriure res).
#       --plan     Només IMPRIMEIX què s'executaria; no executa res. (Ideal per revisar.)
#   -y, --yes      No demana confirmacions (per a les etapes destructives/cares).
#       --refill   A l'etapa de preus, afegeix --refill-deleted (substitueix els eliminats).
#       --no-build No executa el build final.
#       --only=X   --limit=N   Es reenvien als scripts que els accepten.
#
# EXEMPLES:
#   scripts/update.sh prices                 # el cas habitual (refresca preus)
#   scripts/update.sh prices --refill -y     # preus + poda + substitució, sense preguntar
#   scripts/update.sh all --plan             # veure tot el que faria el cicle complet
#   scripts/update.sh new --only="Rampas"    # descobrir noves rampes i omplir-ne dades
#   scripts/update.sh content --limit=3      # editorial dels 3 primers (LLM)
# ───────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

PLAN=0; DRYRUN=0; ASSUME_YES=0; REFILL=""; DO_BUILD=1
STAGES=(); PASS_ARGS=()

for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRYRUN=1 ;;
    --plan)       PLAN=1 ;;
    -y|--yes)     ASSUME_YES=1 ;;
    --refill)     REFILL=1 ;;
    --no-build)   DO_BUILD=0 ;;
    --only=*|--limit=*) PASS_ARGS+=("$arg") ;;
    prices|new|images|descriptions|content|maintenance|build|all) STAGES+=("$arg") ;;
    -h|--help) sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argument desconegut: $arg (prova --help)"; exit 2 ;;
  esac
done

if [ "${#STAGES[@]}" -eq 0 ]; then
  echo "Cap etapa indicada. Ús: scripts/update.sh <prices|new|images|descriptions|content|maintenance|build|all> [opcions]"
  echo "Prova: scripts/update.sh --help"
  exit 2
fi

# --dry-run com a array per propagar net
DRY=(); [ "$DRYRUN" = 1 ] && DRY=(--dry-run)

run() {                       # imprimeix i (si no és --plan) executa
  echo "   \$ $*"
  [ "$PLAN" = 1 ] && return 0
  "$@"
}

confirm() {                   # confirmació per a etapes destructives/cares
  if [ "$ASSUME_YES" = 1 ] || [ "$PLAN" = 1 ] || [ "$DRYRUN" = 1 ]; then
    return 0
  fi
  if [ ! -t 0 ]; then
    echo "⚠️  $1 — cal confirmació però no hi ha terminal interactiu. Afegeix --yes." >&2
    exit 2
  fi
  read -r -p "⚠️  $1 Continuar? [y/N] " ans
  case "$ans" in [yYsS]) return 0 ;; *) echo "Avortat."; exit 1 ;; esac
}

stage_header() { echo; echo "▶ $1"; }

s_prices() {
  local extra=(); [ -n "$REFILL" ] && extra=(--refill-deleted)
  stage_header "PREUS  (refresca + poda${REFILL:+ + substitueix})  [destructiu]"
  if [ "$DRYRUN" = 0 ]; then confirm "L'etapa 'prices' pot ELIMINAR productes (valoració baixa / no disponibles)."; fi
  run python3 scripts/update_prices.py "${DRY[@]}" "${extra[@]}" "${PASS_ARGS[@]}"
}
s_images()       { stage_header "IMATGES";       run node scripts/fetch-amazon-images.mjs --skip-ok "${DRY[@]}"; }
s_descriptions() { stage_header "DESCRIPCIONS";  run python3 scripts/fetch_descriptions.py "${DRY[@]}" "${PASS_ARGS[@]}"; }
s_discover() {
  stage_header "NOUS PRODUCTES  (descobrir)"
  run python3 scripts/find_new_products.py "${DRY[@]}" "${PASS_ARGS[@]}"
}
s_new() {                     # descobrir + omplir-ne dades (imatge + descripció)
  s_discover
  s_images
  s_descriptions
}
s_content() {
  stage_header "CONTINGUT EDITORIAL  (LLM, cost)"
  if [ "$PLAN" = 1 ]; then run scripts/run_review_pipeline.sh "${PASS_ARGS[@]}"; return 0; fi
  if [ "$DRYRUN" = 1 ]; then echo "   (dry-run: el pipeline LLM no té mode dry-run; saltat)"; return 0; fi
  confirm "L'etapa 'content' fa crides a l'LLM i té cost."
  run scripts/run_review_pipeline.sh "${PASS_ARGS[@]}"
}
s_maintenance() {
  stage_header "MANTENIMENT  (afiliats + seccions)"
  run python3 scripts/update_affiliate_links.py "${DRY[@]}"
  run python3 scripts/update_secciones.py "${DRY[@]}"
  if [ "$DRYRUN" = 1 ]; then run node scripts/assign-primary-section.mjs
  else run node scripts/assign-primary-section.mjs --write; fi
}
s_build() {
  stage_header "BUILD  (gate: comprovador d'enllaços + redirects)"
  run pnpm build
  BUILT=1
}

run_stage() {
  case "$1" in
    prices) s_prices ;; new) s_new ;; images) s_images ;;
    descriptions) s_descriptions ;; content) s_content ;;
    maintenance) s_maintenance ;; build) s_build ;;
    all) s_discover; s_prices; s_images; s_descriptions; s_maintenance; s_content ;;
  esac
}

echo "== update.sh ==  etapes: ${STAGES[*]}  |  mode: $([ "$PLAN" = 1 ] && echo PLAN || { [ "$DRYRUN" = 1 ] && echo dry-run || echo REAL; })${REFILL:+  |  refill}"

BUILT=0
for st in "${STAGES[@]}"; do run_stage "$st"; done

# Build final com a xarxa de seguretat (si alguna etapa ha pogut modificar fitxers).
if [ "$DO_BUILD" = 1 ] && [ "$BUILT" = 0 ]; then s_build; fi

echo
if [ "$PLAN" = 1 ]; then
  echo "✓ (plan) No s'ha executat res. Treu --plan per fer-ho de debò."
else
  echo "✓ Fet. Si hi ha canvis:  git add -A && git commit  → ./deploy/deploy.sh"
fi
