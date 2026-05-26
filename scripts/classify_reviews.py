#!/usr/bin/env python3
"""Classifica les reviews d'un producte per tono i tipus.

Per cada `reviews.json` generat per `fetch_reviews.py`, demana al model LLM
que classifiqui cada review com:

  Tono: "positiva" | "neutra" | "negativa"
  Si és negativa, també un tipus (A-E):
    A — Fit / cas d'ús (no encaja per al seu cas, però funciona)
    B — Adaptació (requereix paciència)
    C — Defecte real (problema del producte en si)
    D — Subjectiu (gust personal)
    E — Error d'usuari / fora d'abast

Sortida: enriqueix `reviews.json` amb camps `tono`, `tipo`, `tema` per cada
review, més camps a nivell payload: `classified_at`, `classified_with`,
`defect_rate` (% de Type C).

Ús:
    python scripts/classify_reviews.py
    python scripts/classify_reviews.py --only=slug1
    python scripts/classify_reviews.py --limit=5
    python scripts/classify_reviews.py --force   # re-classifica
    python scripts/classify_reviews.py --batch=10  # reviews per crida (default 10)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _llm import generate_json, LLMError, MODEL, health_check  # noqa: E402

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"

SYSTEM_PROMPT = """Eres un analista experto en reseñas de productos para mascotas.
Tu tarea: clasificar cada reseña según TONO y, si es negativa, un TIPO (A-E).

TONO:
- "positiva": el usuario está satisfecho (4-5 estrellas o cuerpo claramente positivo).
- "neutra": opinión mixta sin queja clara.
- "negativa": el usuario expresa una queja o limitación.

SI TONO ES NEGATIVA, asigna TIPO (A-E):
- A = Fit / caso de uso. El producto no encaja para SU caso particular,
  pero el producto en sí funciona. Ejemplos: "demasiado grande para mi mini caniche",
  "no apto para perros pequeños", "ruidoso para mi piso", "para mi caso necesitaba otro tamaño".
- B = Adaptación o aprendizaje. Requería tiempo o paciencia.
  Ejemplos: "los primeros días no lo aceptaba", "tarda unas semanas en notarse",
  "hay que insistir varios días".
- C = Defecto real del producto. Problema técnico/calidad.
  Ejemplos: "se rompió en 2 semanas", "no funciona", "llegó dañado",
  "calidad pésima", "se descose", "se descalibró".
- D = Subjetivo / gusto personal. No es un defecto.
  Ejemplos: "el olor es fuerte", "el color no me gusta", "estética rara",
  "el sabor no le entusiasma".
- E = Error de usuario, expectativa equivocada o fuera de alcance.
  Ejemplos: "mi perro se lo comió entero de golpe", "no leí las instrucciones",
  "esperaba que hiciera otra cosa".

TEMA: 1-3 palabras en minúscula que resumen el punto.
Ejemplos: "tamaño", "olor", "duracion_efecto", "rotura", "sabor", "instrucciones".

SALIDA: JSON estricto con clave "items": array de objetos con:
  - i: índice (entero, 0-based)
  - tono: "positiva" | "neutra" | "negativa"
  - tipo: "A" | "B" | "C" | "D" | "E" | null
  - tema: string corto

REGLA CRÍTICA: sé CONSERVADOR con Tipo C. Si dudas entre A y C, prefiere A.
Solo marca C cuando el problema es claramente del producto, no de fit.
"""


def build_user_msg(reviews: list[dict]) -> str:
    lines = ["Reseñas a clasificar:"]
    for i, rv in enumerate(reviews):
        body = (rv.get("body") or "").replace("\n", " ")[:400]
        title = (rv.get("title") or "").replace("\n", " ")[:120]
        stars = rv.get("stars") or 0
        lines.append(f"[{i}] {stars}★ · {title} · {body}")
    lines.append('\nDevuelve JSON: {"items": [{"i":0, "tono":"...", "tipo":"...", "tema":"..."}, ...]}')
    return "\n".join(lines)


def classify_batch(reviews: list[dict]) -> list[dict]:
    user_msg = build_user_msg(reviews)
    out = generate_json(system=SYSTEM_PROMPT, user=user_msg)
    return out.get("items", [])


def classify_product(payload: dict, batch_size: int) -> dict:
    reviews = payload.get("reviews", [])
    if not reviews:
        return payload
    all_items: list[dict] = []
    for start in range(0, len(reviews), batch_size):
        chunk = reviews[start : start + batch_size]
        try:
            items = classify_batch(chunk)
        except LLMError as e:
            print(f"    LLM error en batch {start}: {e}")
            continue
        # Reindexar relatiu a `start`
        for it in items:
            if not isinstance(it, dict):
                continue
            try:
                it["i"] = int(it["i"]) + start
            except Exception:
                continue
            all_items.append(it)

    by_idx = {it["i"]: it for it in all_items if "i" in it}
    type_c = 0
    for i, rv in enumerate(reviews):
        cls = by_idx.get(i, {})
        rv["tono"] = cls.get("tono")
        rv["tipo"] = cls.get("tipo")
        rv["tema"] = cls.get("tema")
        if rv.get("tipo") == "C":
            type_c += 1
    payload["classified_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload["classified_with"] = MODEL
    payload["defect_rate"] = round(type_c / max(1, len(reviews)), 3)
    return payload


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--only", default=None)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--force", action="store_true")
    p.add_argument("--batch", type=int, default=10, help="Reviews per crida LLM (default 10)")
    return p.parse_args(argv)


def main(argv):
    args = parse_args(argv)
    if not health_check():
        print(f"⚠ Ollama no respon o el model '{MODEL}' no està disponible.")
        sys.exit(1)
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    items = []
    for d in sorted(ARTICULOS_DIR.iterdir()):
        if not d.is_dir():
            continue
        if only and d.name not in only:
            continue
        if not (d / "reviews.json").exists():
            continue
        items.append(d)
    if args.limit:
        items = items[: args.limit]

    print(f"Productes amb reviews.json: {len(items)}  ·  model: {MODEL}")
    flagged: list[tuple[str, float]] = []
    for idx, d in enumerate(items, 1):
        rf = d / "reviews.json"
        payload = json.loads(rf.read_text(encoding="utf-8"))
        if "classified_at" in payload and not args.force:
            print(f"[{idx}/{len(items)}] {d.name} · ⏭ ja classificat")
            continue
        n = payload.get("count", 0) or len(payload.get("reviews", []))
        print(f"[{idx}/{len(items)}] {d.name} · {n} reviews ...", end=" ", flush=True)
        t0 = time.time()
        new_payload = classify_product(payload, batch_size=args.batch)
        rf.write_text(json.dumps(new_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        rate = new_payload.get("defect_rate", 0)
        flag = " 🚩" if rate > 0.15 else ""
        print(f"✓ defect_rate={rate:.0%}{flag} ({time.time()-t0:.0f}s)")
        if rate > 0.15:
            flagged.append((d.name, rate))

    print("\n=== Resum ===")
    if flagged:
        print(f"⚠ {len(flagged)} producte(s) amb defect_rate > 15%:")
        for n, r in sorted(flagged, key=lambda x: -x[1]):
            print(f"  · {n} · {r:.0%}")
    else:
        print("✓ Cap producte amb defect_rate alt.")


if __name__ == "__main__":
    main(sys.argv[1:])
