#!/usr/bin/env bash
# Actualización semanal (local): pull → deps → informe GSC → update_prices →
# resumen → confirmación → commit + push + deploy.
#
# Uso:  scripts/semanal.sh
#       SKIP_GSC=1 scripts/semanal.sh    # sin Search Console (p. ej. aún no hay clave)
#
# Si se eliminan más de 5 productos, exige escribir CONFIRMAR (no basta y/s).
# El log de update_prices queda en scratch/ (*.log ya está en .gitignore).
# El informe GSC queda en scratch/informe-gsc.md (histórico: scratch/gsc/).
# Requiere el venv del repo (`.venv/`). Si no está, aborta con las instrucciones.

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "⚠️  No hay entorno virtual en .venv/" >&2
  echo "    Los scripts Python no deben usar el Python del sistema." >&2
  echo >&2
  echo "    Créalo una vez:" >&2
  echo >&2
  echo "      python3 -m venv .venv" >&2
  echo "      source .venv/bin/activate" >&2
  echo "      pip install -r requirements.txt" >&2
  echo >&2
  echo "    Después vuelve a lanzar: $0" >&2
  exit 1
fi

mkdir -p scratch
LOG="scratch/update_prices-$(date +%Y%m%d-%H%M%S).log"

echo "== semanal.sh =="
echo "   venv: $(command -v python) ($(python -V 2>&1))"
echo

echo "▶ 1/7 — git pull"
git pull

echo
echo "▶ 2/7 — pip install -r requirements.txt"
python -m pip install -r requirements.txt --quiet

echo
echo "▶ 3/7 — informe Search Console"
if [ "${SKIP_GSC:-0}" = "1" ]; then
  echo "   SKIP_GSC=1 — saltando (python scripts/gsc_weekly_report.py --setup)"
else
  set +e
  python scripts/gsc_weekly_report.py
  gsc_rc=$?
  set -e
  if [ "$gsc_rc" -eq 2 ]; then
    echo
    echo "⚠️  Sin credenciales GSC — sigo con precios."
    echo "    Guía: python scripts/gsc_weekly_report.py --setup"
  elif [ "$gsc_rc" -ne 0 ]; then
    echo "Informe GSC falló (código $gsc_rc). Para saltarlo: SKIP_GSC=1 $0" >&2
    exit "$gsc_rc"
  fi
fi

echo
echo "▶ 4/7 — python scripts/update_prices.py"
echo "   log → $LOG"
set +e
python scripts/update_prices.py 2>&1 | tee "$LOG"
rc=${PIPESTATUS[0]}
set -e
if [ "$rc" -eq 3 ]; then
  echo
  echo "⛔ Amazon ha bloqueado las peticiones (CAPTCHA). Lo leído hasta ahí está guardado;"
  echo "   no se hace commit ni deploy. Vuelve a lanzarlo dentro de unas horas."
  exit 3
elif [ "$rc" -ne 0 ]; then
  echo "update_prices.py ha fallado (código $rc)." >&2
  exit "$rc"
fi

echo
echo "▶ 5/7 — Resumen"
echo "────────────────────────────────────────"

n_updated=$(grep -c '-> ACTUALITZAT' "$LOG" || true)
n_removed=$(grep -c '-> ELIMINAT' "$LOG" || true)
n_failed=$(grep -c '-> NO TROBAT' "$LOG" || true)
n_unavailable=$(grep -c 'NO DISPONIBLE a Amazon' "$LOG" || true)

echo "  Actualizados:  $n_updated"
echo "  Eliminados:    $n_removed"
echo "  No disponibles:$n_unavailable (sin precio en la web)"
echo "  Informe:       scratch/productos/ultimo.md"
echo "  No encontrados:$n_failed"
echo

if [ "$n_removed" -gt 0 ]; then
  echo "  Productos eliminados:"
  grep '-> ELIMINAT' "$LOG" | sed 's/^/   /' || true
  echo
fi

CATALOG_PATHS=(src/content/articulos src/data/precios-consultados.json public/images/articulos vercel.json deploy/nginx/redirects.conf)

echo "  Diff del catálogo:"
if git status --porcelain -- "${CATALOG_PATHS[@]}" | grep -q .; then
  git status --short -- "${CATALOG_PATHS[@]}"
  echo
  git diff --stat -- "${CATALOG_PATHS[@]}" || true
else
  echo "   (sin cambios en disco)"
fi
echo "────────────────────────────────────────"
echo "  Log completo: $LOG"
echo

if ! git status --porcelain -- "${CATALOG_PATHS[@]}" | grep -q .; then
  echo "✓ Sin cambios en el catálogo. Nada que committear ni desplegar."
  exit 0
fi

echo "▶ 6/7 — Confirmación antes de commit + push + deploy"
if [ "$n_removed" -gt 5 ]; then
  echo "⚠️  Se eliminaron $n_removed productos (umbral: 5)."
  echo "    Sin confirmación explícita se aborta (los cambios locales se mantienen)."
  read -r -p "Escribe CONFIRMAR para continuar: " ans
  if [ "$ans" != "CONFIRMAR" ]; then
    echo "Abortado (sin commit/deploy)."
    exit 1
  fi
else
  read -r -p "¿Commit, push y desplegar? [y/N] " ans
  case "$ans" in
    [yYsS]) ;;
    *)
      echo "Abortado (sin commit/deploy)."
      exit 0
      ;;
  esac
fi

echo
echo "▶ 7/7 — commit + push + deploy"
git add -A -- "${CATALOG_PATHS[@]}"
git commit -m "$(cat <<'EOF'
chore: actualización semanal de precios

EOF
)"
git push
./deploy/deploy.sh

echo
echo "✓ Semanal completado."
