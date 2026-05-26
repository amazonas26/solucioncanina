#!/usr/bin/env python3
"""Informe de qualitat post-generació.

Llegeix els `index.json` i `reviews.json` del catàleg i detecta:
  · Productes amb `defect_rate > 15%` (Tipus C recurrent) — candidates a treure.
  · Pros repetits literalment entre productes (signe de templating de l'LLM).
  · Possibles contradiccions: una mateixa paraula clau a `pros` i `contras`.
  · Productes sense contingut editorial.

Sortida: imprimeix per pantalla + guarda `scripts/review_quality_report.md`.

Ús:
    python scripts/quality_check.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"
REPORT = ROOT / "scripts" / "review_quality_report.md"

STOPWORDS = {
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas",
    "y", "o", "u", "que", "qué", "en", "con", "sin", "para", "por",
    "del", "al", "se", "es", "son", "ha", "han", "le", "les", "lo",
    "su", "sus", "muy", "más", "menos", "como", "pero", "si", "ya",
    "perro", "perros", "producto", "productos",
}


def main() -> None:
    flagged_defects: list[tuple[str, float, int]] = []
    pros_counter: Counter[str] = Counter()
    items_ok = 0
    items_no_content = 0
    contradictions: list[tuple[str, str, str]] = []
    no_reviews: list[str] = []
    no_classified: list[str] = []

    for d in sorted(ARTICULOS_DIR.iterdir()):
        if not d.is_dir():
            continue
        jf = d / "index.json"
        if not jf.exists():
            continue
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            continue

        pros = data.get("pros") or []
        contras = data.get("contras") or []
        has_content = bool(data.get("analisis") and data.get("veredicto") and pros)
        if has_content:
            items_ok += 1
            pros_lower = " ".join(p.lower() for p in pros)
            for p in pros:
                pros_counter[p.strip().lower()] += 1
            for c in contras:
                words = {w.strip(".,;:!¿?¡()\"'") for w in c.lower().split()}
                words = {w for w in words if len(w) > 5 and w not in STOPWORDS}
                for w in words:
                    if w in pros_lower:
                        contradictions.append((d.name, c, w))
                        break
        else:
            items_no_content += 1

        rf = d / "reviews.json"
        if rf.exists():
            try:
                rp = json.loads(rf.read_text(encoding="utf-8"))
            except Exception:
                continue
            if "classified_at" not in rp:
                no_classified.append(d.name)
                continue
            rate = rp.get("defect_rate", 0) or 0
            if rate > 0.15:
                flagged_defects.append((d.name, rate, rp.get("count", 0)))
        else:
            no_reviews.append(d.name)

    repeated_pros = [(p, n) for p, n in pros_counter.most_common(20) if n >= 3]

    lines: list[str] = []
    lines.append("# Informe de qualitat de ressenyes\n\n")
    lines.append(f"- Productes amb contingut editorial complet: **{items_ok}**\n")
    lines.append(f"- Productes pendents (sense editorial): **{items_no_content}**\n")
    lines.append(f"- Productes sense `reviews.json`: **{len(no_reviews)}**\n")
    lines.append(f"- Productes amb reviews però sense classificar: **{len(no_classified)}**\n\n")

    lines.append("## Productes amb defectes recurrents (defect_rate > 15%)\n\n")
    if flagged_defects:
        lines.append("Recomanació: revisar manualment. Si el problema és real, **considerar treure'l del catàleg** o marcar `noindex`.\n\n")
        for n, r, c in sorted(flagged_defects, key=lambda x: -x[1]):
            lines.append(f"- `{n}` · defect_rate **{r:.0%}** ({c} reviews)\n")
    else:
        lines.append("(cap)\n")

    lines.append("\n## Pros repetits literalment entre productes\n\n")
    if repeated_pros:
        lines.append("Si apareix ≥3 cops, és senyal que l'LLM està templatejant. Considera ajustar el prompt.\n\n")
        for p, n in repeated_pros:
            lines.append(f"- ×{n} · {p}\n")
    else:
        lines.append("(cap repetit ≥3 cops — bé)\n")

    lines.append("\n## Possibles contradiccions pro/contra\n\n")
    if contradictions:
        lines.append("Una mateixa paraula clau apareix a pros i contras del mateix producte.\n\n")
        for slug, contra, word in contradictions[:40]:
            lines.append(f"- `{slug}` · paraula '**{word}**' · contra: \"{contra}\"\n")
    else:
        lines.append("(cap)\n")

    if no_reviews:
        lines.append("\n## Productes sense reviews scrappejades\n\n")
        for n in no_reviews[:40]:
            lines.append(f"- `{n}`\n")
        if len(no_reviews) > 40:
            lines.append(f"- ... i {len(no_reviews)-40} més\n")

    REPORT.write_text("".join(lines), encoding="utf-8")
    print(f"Informe escrit a {REPORT.relative_to(ROOT)}")
    print(f"  · Amb editorial:        {items_ok}")
    print(f"  · Pendents:             {items_no_content}")
    print(f"  · Sense reviews.json:   {len(no_reviews)}")
    print(f"  · Sense classificar:    {len(no_classified)}")
    print(f"  · Defect_rate alt:      {len(flagged_defects)}")
    print(f"  · Pros repetits ≥3:     {len(repeated_pros)}")
    print(f"  · Contradiccions:       {len(contradictions)}")


if __name__ == "__main__":
    main()
