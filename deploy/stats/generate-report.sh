#!/usr/bin/env bash
# Genera los informes HTML de GoAccess a partir de los logs de este vhost.
# Pensado para cron diario en el VPS. No usar --real-time-html (deja el
# dataset en RAM). Sin GeoIP.
#   index.html    → todo el tráfico (bots incluidos)
#   humanos.html  → sin crawlers declarados, sin UA desconocidos y sin 404
#                   (los escáneres de .env / wp-* inflan el informe completo)
set -euo pipefail

LOGDIR=/var/log/solucioncanina
OUTDIR=/var/www/stats
TMP=""

cleanup() {
  [[ -n "$TMP" && -f "$TMP" ]] && rm -f "$TMP"
}
trap cleanup EXIT

if ! command -v goaccess >/dev/null 2>&1; then
  echo "goaccess no está instalado" >&2
  exit 1
fi

shopt -s nullglob
logs=("$LOGDIR"/access.log*)
if ((${#logs[@]} == 0)); then
  echo "No hay logs aún en $LOGDIR" >&2
  exit 0
fi

mkdir -p "$OUTDIR"

# Flags que no existen en versiones antiguas de GoAccess: solo si están.
GOACCESS_HELP=$(goaccess --help 2>&1 || true)
optional_flag() {
  if grep -q -- "${1%%=*}" <<<"$GOACCESS_HELP"; then
    printf '%s\n' "$1"
  else
    echo "aviso: esta versión de goaccess no tiene ${1%%=*}; se omite" >&2
  fi
}

# report <fichero> <título> [flags extra...]
report() {
  local out="$OUTDIR/$1" title="$2"
  shift 2
  TMP=$(mktemp --suffix=.html "${out}.XXXXXX")
  # zcat -f deja pasar los .log sin comprimir y descomprime los .gz.
  # nice/ionice: este VPS tiene ~300 MB libres; no pelear con gunicorn/Node.
  nice -n 10 ionice -c3 zcat -f "${logs[@]}" \
    | goaccess - \
        --log-format=COMBINED \
        -q \
        --anonymize-ip \
        --ignore-panel=GEO_LOCATION \
        --no-parsing-spinner \
        --html-report-title="$title" \
        "$@" \
        --output="$TMP"
  chmod 644 "$TMP"
  mv -f "$TMP" "$out"
  TMP=""
  echo "Informe escrito en $out"
}

report index.html "Solución Canina · logs nginx"

mapfile -t HUMAN_FLAGS < <(
  echo "--ignore-crawlers"
  optional_flag "--unknowns-as-crawlers"
  optional_flag "--ignore-status=404"
)
report humanos.html "Solución Canina · solo humanos" "${HUMAN_FLAGS[@]}"
