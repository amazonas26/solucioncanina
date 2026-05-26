#!/usr/bin/env bash
# Orchestrador del pipeline de ressenyes editorials.
#
# Ús:
#   scripts/run_review_pipeline.sh                   # tot el catàleg
#   scripts/run_review_pipeline.sh --limit=3         # primers 3 productes
#   scripts/run_review_pipeline.sh --only=slug1
#
# Cada flag es passa als 3 primers passos. El pas final (quality_check)
# no accepta flags i fa el seu propi escaneig sencer.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/4 — fetch_reviews.py (scraping Amazon)"
python3 scripts/fetch_reviews.py "$@"

echo
echo "▶ 2/4 — classify_reviews.py (LLM classificació)"
python3 scripts/classify_reviews.py "$@"

echo
echo "▶ 3/4 — generate_reviews_v2.py (LLM generació editorial)"
python3 scripts/generate_reviews_v2.py "$@"

echo
echo "▶ 4/4 — quality_check.py (informe de qualitat)"
python3 scripts/quality_check.py

echo
echo "✓ Pipeline complet. Revisa scripts/review_quality_report.md"
