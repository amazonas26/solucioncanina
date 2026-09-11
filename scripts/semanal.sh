#!/usr/bin/env bash
# Actualización semanal de precios (local): pull → deps → update_prices →
# resumen → confirmación → commit + push + deploy.
#
# Uso:  scripts/semanal.sh
#
# Si se eliminan más de 5 productos, exige escribir CONFIRMAR (no basta y/s).
# El log de update_prices queda en scratch/ (*.log ya está en .gitignore).

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p scratch
LOG="scratch/update_prices-$(date +%Y%m%d-%H%M%S).log"

echo "== semanal.sh =="
echo

echo "▶ 1/6 — git pull"
git pull

echo
echo "▶ 2/6 — pip install -r requirements.txt"
pip install -r requirements.txt --quiet

echo
echo "▶ 3/6 — python scripts/update_prices.py"
echo "   log → $LOG"
python scripts/update_prices.py 2>&1 | tee "$LOG"

echo
echo "▶ 4/6 — Resumen"
echo "────────────────────────────────────────"

n_updated=$(grep -c '-> ACTUALITZAT' "$LOG" || true)
n_removed=$(grep -c '-> ELIMINAT' "$LOG" || true)
n_failed=$(grep -c '-> NO TROBAT' "$LOG" || true)

echo "  Actualizados:  $n_updated"
echo "  Eliminados:    $n_removed"
echo "  No encontrados:$n_failed"
echo

if [ "$n_removed" -gt 0 ]; then
  echo "  Productos eliminados:"
  grep '-> ELIMINAT' "$LOG" | sed 's/^/   /' || true
  echo
fi

echo "  Diff del catálogo:"
if git status --porcelain -- src/content/articulos public/images/articulos | grep -q .; then
  git status --short -- src/content/articulos public/images/articulos
  echo
  git diff --stat -- src/content/articulos public/images/articulos || true
else
  echo "   (sin cambios en disco)"
fi
echo "────────────────────────────────────────"
echo "  Log completo: $LOG"
echo

if ! git status --porcelain -- src/content/articulos public/images/articulos | grep -q .; then
  echo "✓ Sin cambios en el catálogo. Nada que committear ni desplegar."
  exit 0
fi

echo "▶ 5/6 — Confirmación antes de commit + push + deploy"
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
echo "▶ 6/6 — commit + push + deploy"
git add -A -- src/content/articulos public/images/articulos
git commit -m "$(cat <<'EOF'
chore: actualización semanal de precios

EOF
)"
git push
./deploy/deploy.sh

echo
echo "✓ Semanal completado."
