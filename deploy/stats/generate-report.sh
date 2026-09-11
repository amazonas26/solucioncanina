#!/usr/bin/env bash
# Genera el informe HTML de GoAccess a partir de los logs de este vhost.
# Pensado para cron diario en el VPS. No usar --real-time-html (deja el
# dataset en RAM). Sin GeoIP.
set -euo pipefail

LOGDIR=/var/log/solucioncanina
OUT=/var/www/stats/solucioncanina.html
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

mkdir -p "$(dirname "$OUT")"
TMP=$(mktemp "${OUT}.XXXXXX")

# zcat -f deja pasar los .log sin comprimir y descomprime los .gz.
# nice/ionice: este VPS tiene ~300 MB libres; no pelear con gunicorn/Node.
nice -n 10 ionice -c3 zcat -f "${logs[@]}" \
  | goaccess - \
      --log-format=COMBINED \
      --keep-last=30 \
      -q \
      --anonymize-ip \
      --ignore-panel=GEO_LOCATION \
      --no-parsing-spinner \
      --html-report-title="Solución Canina · logs nginx" \
      --output="$TMP"

chmod 644 "$TMP"
mv -f "$TMP" "$OUT"
TMP=""
echo "Informe escrito en $OUT"
