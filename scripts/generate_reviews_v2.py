#!/usr/bin/env python3
"""Genera contingut editorial (analisis, veredicto, pros, contras, paraQuien)
per cada producte usant reviews REALS classificades.

Estratègia honesta + conversion-friendly (estil Wirecutter):
  · 4-5 PROS — només afirmacions que apareixen en MÚLTIPLES reviews positives.
  · 2-3 CONTRAS — prioritza Tipo A (fit) i D (subjectiu) sobre C (defecte).
  · paraQuien — qui SÍ + qui NO (filtra el comprador equivocat).
  · Zero al·lucinacions: tot ha d'estar groundejat en reviews reals.

Filtre de qualitat ja aplicat (≥3.7★) → la majoria de contras seran A/D,
no C. Els productes amb defect_rate > 15% es salten per defecte (canvia
amb --include-flagged si vols revisar-los manualment).

Ús:
    python scripts/generate_reviews_v2.py
    python scripts/generate_reviews_v2.py --only=slug1
    python scripts/generate_reviews_v2.py --limit=3
    python scripts/generate_reviews_v2.py --force          # sobreescriu existent
    python scripts/generate_reviews_v2.py --include-flagged
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

SYSTEM_PROMPT = """Eres editor jefe de Solución Canina, web española de afiliados.
SOLO incluimos productos con valoración real ≥3.7 estrellas — filtro de calidad
ya aplicado. Tu trabajo es escribir una reseña editorial honesta y útil al
estilo Wirecutter en español: profesional, sereno, concreto, sin hype.

ESTRUCTURA: el análisis se divide en DOS secciones cortas con ángulos
distintos. NO repitas la misma idea entre las dos secciones.

  · `analisis` (80-100 palabras): Cómo funciona y para qué destaca.
    Mecanismo del producto + en qué contexto sobresale, basado en lo que
    coinciden las reseñas POSITIVAS.

  · `experienciaReal` (80-100 palabras): Qué dicen los dueños.
    Detalles concretos del uso diario: plazos, adaptación, particularidades.
    Mezcla de reseñas positivas + adaptación (B) + subjetivas (D). Aquí van
    las cosas que un comprador agradece saber antes de comprar.

## REGLAS NO NEGOCIABLES

### Longitudes obligatorias (cuenta antes de devolver)
- `veredicto`: 1-2 frases, MÁXIMO 35 palabras. Concreto, diferenciador.
- `analisis`: ENTRE 70 y 120 palabras. 1 párrafo.
- `experienciaReal`: ENTRE 70 y 120 palabras. 1 párrafo.
- `pros`: EXACTAMENTE 4 o 5 ítems. Ni 3, ni 6.
- `contras`: EXACTAMENTE 2 o 3 ítems. Mínimo 2.
- `paraQuien`: 2 frases. Primera = quién SÍ. Segunda = quién NO.

### FRASES PROHIBIDAS (rechazo automático)
NUNCA escribas ninguna de estas, ni variantes:
- "ideal para todos los perros" / "todas las edades" / "todas las razas"
- "para todo tipo de perro" / "cualquier perro" / "todo tipo de mascota"
- "revolucionario" / "imprescindible" / "el mejor del mercado" / "milagroso"
- "altamente recomendable" / "muy recomendado" / "increíble" / "excepcional"
- "100 % natural" / "sin contraindicaciones" / "sin efectos secundarios"
- "funciona bien" sin contexto / "varios propósitos" / "muchos beneficios"

### Especificidad obligatoria
- `analisis` debe incluir AL MENOS 1 detalle concreto extraído de reseñas
  reales (plazo de efecto, raza/talla mencionada, textura, etc.). NO inventes.
- `experienciaReal` debe incluir AL MENOS 2 detalles concretos (números,
  plazos, razas, particularidades del uso). Es el bloque MÁS concreto.
- Las dos secciones deben hablar de cosas DISTINTAS. No repitas la misma idea.
- Cada `pro` debe ser concreto. Mal: "Muy cómodo". Bien: "Mantiene la firmeza
  más de 6 meses según reseñas con uso continuado".
- Cada `contra` debe estar respaldada por una reseña real específica del input.

### Estructura del `paraQuien` (CRÍTICO)
Patrón OBLIGATORIO:
"Encaja para [perfil específico con criterio concreto]. NO encaja para
[perfil específico a excluir]."

EJEMPLO CORRECTO:
"Encaja para perros senior con rigidez articular cuyo dueño esté dispuesto a
esperar 4-6 semanas para ver efectos. NO encaja para casos agudos donde se
busca alivio inmediato."

EJEMPLO INCORRECTO (rechazo):
"Es ideal para perros de todas las edades. Puede no funcionar en algunos casos."

### Tratamiento de contras (filtro de honestidad calibrado)
Priorización: TIPO A (fit) > TIPO D (subjetivo) > TIPO C (defecto). Solo
incluir defectos tipo C si aparecen en reseñas reales del input.
Encuadre: "puede no ser ideal para X" o "algunos dueños notan Y" en lugar de
"no funciona" o "es un mal producto".

### Tono
Sereno, profesional. Cero exclamaciones, cero emojis, cero markdown dentro
de los strings. Habla del producto y del perro, no de la marca como héroe.
Castellano de España.

## EJEMPLO COMPLETO (sigue este patrón)

INPUT EJEMPLO:
- Producto: Cama ortopédica viscoelástica XL para perros senior, 112x81 cm
- Marca: EHEYCIGA · Rating: 4.6/5 (47 valoraciones)
- POSITIVAS recurrentes: alivio en perros senior con artrosis, mantiene firmeza 6+ meses, funda lavable cumple
- TIPO A: demasiado grande para razas pequeñas, perros muy mayores tardan en aceptarla
- TIPO D: olor inicial a espuma los primeros días

OUTPUT EJEMPLO (sigue ESTE patrón):
{
  "veredicto": "Una de las pocas camas viscoelásticas a su precio que mantiene la firmeza más allá del año; especialmente útil para perros senior de razas grandes con artrosis.",
  "analisis": "La espuma viscoelástica está pensada para distribuir el peso de perros grandes, y eso es lo que destacan los dueños de razas senior con artrosis o displasia: el perro tarda menos en encontrar postura cómoda y duerme tirones más largos. Varias reseñas mencionan que la cama mantiene la forma original tras seis meses de uso continuo con perros de 30+ kg, algo que en camas más baratas suele fallar antes.",
  "experienciaReal": "Los dueños coinciden en dos detalles prácticos: la cama trae un olor inicial a espuma los primeros días que se va con la primera aireación o lavado de funda, así que conviene aireada antes de ponerla. Y algunos perros con artrosis severa tardan dos o tres días en aceptar el bordillo lateral; el truco que mencionan varias reseñas es poner una manta encima los primeros días para que reconozcan el tacto. Pasada la primera semana, ningún dueño reporta problemas de adaptación.",
  "pros": [
    "La espuma viscoelástica mantiene la firmeza más de 6 meses según reseñas con uso continuado",
    "Funda lavable que aguanta múltiples ciclos sin perder forma ni color",
    "Aporta alivio perceptible a perros senior con artrosis o displasia",
    "Tamaño realista para perros de 30+ kg, no se hunde con el peso"
  ],
  "contras": [
    "Olor a espuma los primeros días (desaparece con aireación o lavado de funda)",
    "Perros con artrosis severa pueden tardar 2-3 días en aceptar el bordillo lateral",
    "Demasiado grande para razas pequeñas o medianas"
  ],
  "paraQuien": "Encaja para perros senior de razas grandes (≥25 kg) con rigidez articular o artrosis cuyo dueño quiera una cama que dure más de un año. NO encaja para razas pequeñas ni para perros sin problemas articulares que solo necesiten una cama estándar."
}

## SALIDA FINAL

Devuelve EXCLUSIVAMENTE el JSON con las claves: veredicto, analisis, experienciaReal, pros, contras, paraQuien.
Nada de texto antes ni después. Nada de markdown. Verifica las longitudes antes de devolver."""


def group_reviews(payload: dict, max_per_group: int = 8) -> dict:
    """Agrupa reviews per tono+tipus per al prompt."""
    grupos: dict[str, list[str]] = {
        "positivas": [],
        "tipo_A": [],
        "tipo_B": [],
        "tipo_C": [],
        "tipo_D": [],
    }
    for rv in payload.get("reviews", []):
        body = (rv.get("body") or "").replace("\n", " ").strip()[:280]
        if not body:
            continue
        tono = rv.get("tono")
        tipo = rv.get("tipo")
        if tono == "positiva":
            grupos["positivas"].append(body)
        elif tono == "negativa" and tipo in ("A", "B", "C", "D"):
            grupos[f"tipo_{tipo}"].append(body)
        # neutra i tipo E → ignorades intencionadament
    for k in grupos:
        grupos[k] = grupos[k][:max_per_group]
    return grupos


def _block(label: str, items: list[str]) -> list[str]:
    if not items:
        return [label, "- (cap)"]
    return [label] + [f"- {p}" for p in items]


def build_user_msg(data: dict, grupos: dict) -> str:
    nombre = data.get("nombre", "")
    marca = data.get("marca") or "(sin marca)"
    descripcion = data.get("descripcion") or "(sin descripción oficial)"
    val = data.get("valoracion", "?")
    vcount = data.get("valoracionesCount", "?")
    cat = data.get("categoria", "")

    parts = [
        f"PRODUCTO: {nombre}",
        f"MARCA: {marca}",
        f"CATEGORIA: {cat}",
        f"RATING REAL: {val}/5 ({vcount} valoraciones)",
        f"DESCRIPCION OFICIAL: {descripcion}",
        "",
        "=== RESEÑAS REALES CLASIFICADAS ===",
        "",
    ]
    parts += _block("POSITIVAS (temas recurrentes en reseñas 4-5★):", grupos["positivas"])
    parts += [""] + _block("LIMITACIONES DE FIT (tipo A — no encaja para SU caso):", grupos["tipo_A"])
    parts += [""] + _block("ADAPTACION (tipo B — requería paciencia):", grupos["tipo_B"])
    parts += [""] + _block("SUBJETIVAS (tipo D — gusto personal):", grupos["tipo_D"])
    parts += [""] + _block("DEFECTOS RECURRENTES (tipo C — incluir si vale la pena):", grupos["tipo_C"])
    parts += [
        "",
        "=== INSTRUCCIONES FINALES ===",
        "Devuelve JSON con: veredicto, analisis, pros[], contras[], paraQuien.",
        "Recuerda: 4-5 pros, 2-3 contras (OBLIGATORIO mínimo 2), tono Wirecutter.",
        "Prioriza contras de tipo A y D. Cero al·lucinacions. Cero superlativos.",
    ]
    return "\n".join(parts)


FORBIDDEN_PHRASES = [
    "ideal para todos",
    "ideal para todas",
    "todas las edades",
    "todas las razas",
    "todo tipo de perro",
    "cualquier perro",
    "todo tipo de mascota",
    "revolucionario",
    "imprescindible",
    "el mejor del mercado",
    "milagroso",
    "altamente recomendable",
    "muy recomendado",
    "increíble",
    "excepcional",
    "100 % natural",
    "100% natural",
    "sin contraindicaciones",
    "sin efectos secundarios",
]


def _word_count(text: str) -> int:
    return len([w for w in text.split() if w.strip()])


def _has_forbidden(text: str) -> str | None:
    t = text.lower()
    for ph in FORBIDDEN_PHRASES:
        if ph in t:
            return ph
    return None


def validate_output(out: dict) -> tuple[bool, str]:
    """Retorna (ok, motiu)."""
    # Camps obligatoris
    for k in ("veredicto", "analisis", "experienciaReal", "pros", "contras", "paraQuien"):
        if k not in out or not out[k]:
            return False, f"falta o és buit: '{k}'"
    # Longitud blocs editorials
    a_words = _word_count(out["analisis"])
    if a_words < 60:
        return False, f"analisis massa curt ({a_words} paraules, mín 60)"
    if a_words > 140:
        return False, f"analisis massa llarg ({a_words} paraules, max 140)"
    e_words = _word_count(out["experienciaReal"])
    if e_words < 60:
        return False, f"experienciaReal massa curt ({e_words} paraules, mín 60)"
    if e_words > 140:
        return False, f"experienciaReal massa llarg ({e_words} paraules, max 140)"
    v_words = _word_count(out["veredicto"])
    if v_words > 45:
        return False, f"veredicto massa llarg ({v_words} paraules)"
    # Pros/contras
    if not isinstance(out["pros"], list) or not (3 <= len(out["pros"]) <= 6):
        return False, f"pros count invàlid ({len(out.get('pros', []))})"
    if not isinstance(out["contras"], list) or not (2 <= len(out["contras"]) <= 4):
        return False, f"contras count invàlid ({len(out.get('contras', []))})"
    # Frases prohibides
    full_text = " ".join([
        out["veredicto"], out["analisis"], out["experienciaReal"],
        " ".join(out["pros"]), " ".join(out["contras"]), out["paraQuien"],
    ])
    forbidden = _has_forbidden(full_text)
    if forbidden:
        return False, f"frase prohibida detectada: '{forbidden}'"
    # paraQuien ha de tenir "NO" (filtre del comprador equivocat)
    pq = out["paraQuien"].lower()
    if " no " not in pq and "no encaja" not in pq and "no es para" not in pq:
        return False, "paraQuien no filtra (sense 'NO encaja...')"
    return True, "ok"


def generate_for_product(d: Path, force: bool, include_flagged: bool) -> str:
    """Retorna status: ok | skipped_existing | flagged | no_reviews |
    no_classified | poor_material | fail."""
    jf = d / "index.json"
    rf = d / "reviews.json"
    data = json.loads(jf.read_text(encoding="utf-8"))

    if not force and data.get("analisis") and data.get("experienciaReal") and data.get("veredicto"):
        return "skipped_existing"
    if not rf.exists():
        return "no_reviews"

    payload = json.loads(rf.read_text(encoding="utf-8"))
    if "classified_at" not in payload:
        return "no_classified"
    if (payload.get("defect_rate", 0) > 0.15) and not include_flagged:
        return "flagged"

    grupos = group_reviews(payload)
    if len(grupos["positivas"]) < 3:
        # Sense prou material positiu, no es pot construir editorial honest.
        return "poor_material"

    user_msg = build_user_msg(data, grupos)
    out: dict | None = None
    last_reason = ""
    for attempt in range(3):
        try:
            candidate = generate_json(
                system=SYSTEM_PROMPT, user=user_msg,
                num_ctx=8192, temperature=0.4 + attempt * 0.1,
            )
        except LLMError as e:
            last_reason = f"LLM error: {e}"
            continue
        ok, reason = validate_output(candidate)
        if ok:
            out = candidate
            break
        last_reason = reason
        # Reforça la regla violada a la següent crida
        user_msg = (
            user_msg + f"\n\nRECORDATORIO: el output anterior NO se acepta porque "
            f"{reason}. Corrige y devuelve un NUEVO JSON cumpliendo TODAS las reglas."
        )

    if out is None:
        print(f"\n    ⚠ rebutjat 3 cops, últim motiu: {last_reason}")
        return "fail"

    data["veredicto"] = str(out["veredicto"]).strip()
    data["analisis"] = str(out["analisis"]).strip()
    data["experienciaReal"] = str(out["experienciaReal"]).strip()
    data["pros"] = [str(p).strip() for p in out["pros"] if str(p).strip()]
    data["contras"] = [str(c).strip() for c in out["contras"] if str(c).strip()]
    data["paraQuien"] = str(out["paraQuien"]).strip()
    data["_generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    data["_generated_with"] = MODEL

    jf.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "ok"


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--only", default=None)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--force", action="store_true",
                   help="Regenera encara que el producte ja tingui analisis/veredicto.")
    p.add_argument("--include-flagged", action="store_true",
                   help="Inclou productes amb defect_rate > 15% (per defecte es salten).")
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
        items.append(d)
    if args.limit:
        items = items[: args.limit]

    print(f"Productes a generar: {len(items)}  ·  model: {MODEL}")
    stats = {
        "ok": 0, "skipped_existing": 0, "flagged": 0,
        "no_reviews": 0, "no_classified": 0, "poor_material": 0, "fail": 0,
    }
    emoji = {
        "ok": "✓", "skipped_existing": "⏭", "flagged": "🚩",
        "no_reviews": "⚠", "no_classified": "⚠", "poor_material": "⚠", "fail": "❌",
    }
    for idx, d in enumerate(items, 1):
        print(f"[{idx}/{len(items)}] {d.name} ...", end=" ", flush=True)
        t0 = time.time()
        status = generate_for_product(d, args.force, args.include_flagged)
        stats[status] = stats.get(status, 0) + 1
        print(f"{emoji[status]} {status} ({time.time()-t0:.0f}s)")

    print("\n=== Resum ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main(sys.argv[1:])
