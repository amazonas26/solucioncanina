"""Utilitats compartides entre scripts de manteniment del catàleg.

Conté:
  - slugify(text): genera l'slug curt usat a les URLs.
  - strip_brand_prefix(title, brand): treu la marca quan apareix al principi
    del títol del producte, perquè el catàleg mostri només el nom comercial
    (la marca ja es mostra com a "chip" al costat al detalle del producte).
"""

from __future__ import annotations

import re
import unicodedata


# Separadors típics després de la marca al títol d'Amazon:
#   ',', ' -', ' –', ' —', ':', '|', '·', '•'
_AFTER_BRAND_SEP_RX = re.compile(r"^[\s,;:\-–—|·•]+")


def slugify(text: str) -> str:
    """Versió equivalent a `src/utils/slugify.ts` (Astro la usa al runtime)."""
    if not text:
        return ""
    s = unicodedata.normalize("NFD", text)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^\w-]+", "", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def strip_brand_prefix(title: str, brand: str | None) -> str:
    """Treu la marca del títol quan hi apareix al principi.

    Exemples:
        "Edipets, Correa Perro Larga…"   → "Correa Perro Larga…"
        "FARMINA Vet Life Dog RENAL 12KG" → "Vet Life Dog RENAL 12KG"
        "ADAPTIL Calm - Antiestrés…"     → "Calm - Antiestrés…"
        "Royal Canin Veterinary Renal…"  → "Veterinary Renal…"
        "OHCOZZY Bozal Talla 2"          → "Bozal Talla 2"

    Comportament defensiu:
      - Si `brand` o `title` són buits, retorna `title` sense canvis.
      - Si el títol NO comença per la marca (case-insensitive), retorna `title`.
      - Si treure la marca deixaria una resta < 5 chars, retorna `title` sense
        canvis (evita títols absurds com "Talla 2" sols).
      - També contempla marques multi-paraula ("Royal Canin", "Pro Plan") i
        marques amb separadors interns ("Co-Z", "JJW", etc.).
    """
    if not brand or not title:
        return title

    t = title.strip()
    b = brand.strip()
    if len(b) < 2:
        return t

    # Match case-insensitive només al principi del títol.
    if t.lower().startswith(b.lower()):
        rest = t[len(b):]
    else:
        # Provem variants amb espais normalitzats (ex: "Royal  Canin" al títol
        # vs "Royal Canin" a la marca).
        t_norm = re.sub(r"\s+", " ", t)
        b_norm = re.sub(r"\s+", " ", b)
        if t_norm.lower().startswith(b_norm.lower()):
            rest = t_norm[len(b_norm):]
        else:
            return t

    rest = _AFTER_BRAND_SEP_RX.sub("", rest).strip()
    if len(rest) < 5:
        return t

    # Capitalitza la primera lletra si quedem amb una paraula en minúscula
    # ("correa Perro Larga…" → "Correa Perro Larga…").
    if rest[0].islower():
        rest = rest[0].upper() + rest[1:]
    return rest
