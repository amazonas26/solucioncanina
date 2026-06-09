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

# Store ID Amazon Associates (solucioncanina.es)
DEFAULT_AMAZON_TAG = "solucioncanin-21"
_ASIN_IN_URL_RE = re.compile(r"/(?:dp|gp/product)/([A-Z0-9]{10})", re.IGNORECASE)


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


def extract_asin(url_or_asin: str) -> str | None:
    """Extreu ASIN d'una URL d'Amazon o retorna l'ASIN si ja en té format."""
    s = (url_or_asin or "").strip()
    if not s:
        return None
    m = _ASIN_IN_URL_RE.search(s)
    if m:
        return m.group(1).upper()
    if re.fullmatch(r"[A-Z0-9]{10}", s, re.IGNORECASE):
        return s.upper()
    return None


def amazon_affiliate_url(url_or_asin: str, tag: str = DEFAULT_AMAZON_TAG) -> str:
    """URL canònica d'afiliat: https://www.amazon.es/dp/{ASIN}/?tag={tag}"""
    asin = extract_asin(url_or_asin)
    if not asin:
        raise ValueError(f"No s'ha pogut extreure ASIN de: {url_or_asin!r}")
    return f"https://www.amazon.es/dp/{asin}/?tag={tag}"


def amazon_scrape_url(url_or_asin: str) -> str:
    """URL NETA per fer scraping, SENSE el tag d'afiliat.

    Important: visitar Amazon amb `?tag=...` des d'un script compta com un "clic"
    d'afiliat fals (infla els clics i viola l'Operating Agreement d'Associates).
    Per scrapejar preu/imatge/descripció s'ha d'usar SEMPRE aquesta URL neta.
    Si no es pot extreure l'ASIN, retorna l'entrada original (millor scrapejar
    alguna cosa que res), però sense afegir-hi cap tag.
    """
    asin = extract_asin(url_or_asin)
    if not asin:
        return url_or_asin or ""
    return f"https://www.amazon.es/dp/{asin}/"


def ensure_affiliate_link(data: dict, tag: str = DEFAULT_AMAZON_TAG) -> bool:
    """Afegeix o normalitza tag= al camp linkAmazon. Retorna True si ha canviat."""
    url = (data.get("linkAmazon") or "").strip()
    if not url:
        return False
    try:
        new_url = amazon_affiliate_url(url, tag)
    except ValueError:
        return False
    if new_url == url:
        return False
    data["linkAmazon"] = new_url
    return True
