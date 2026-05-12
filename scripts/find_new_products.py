#!/usr/bin/env python3
"""
Busca en Amazon.es nuevos productos para cada categoría del catálogo
y crea fichas (`src/content/articulos/<slug>/index.json` + imagen) para
los candidatos que aún no tengamos.

Uso:
    python scripts/find_new_products.py
    python scripts/find_new_products.py --per-category=8
    python scripts/find_new_products.py --only="Rampas"
    python scripts/find_new_products.py --dry-run        # no escribe nada
    python scripts/find_new_products.py --no-create      # solo lista, no crea

Notas:
  - "Estricto": descarta resultados patrocinados, sin precio, sin imagen
    y sin marca identificable.
  - Hace pausas aleatorias para no acabar baneado por Amazon.
  - Si Amazon devuelve un CAPTCHA, el script lo detecta y aborta esa
    categoría.
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent.parent
ART = ROOT / "src" / "content" / "articulos"
IMG = ROOT / "public" / "images" / "articulos"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
}

# Cada categoría se mapea a una o varias búsquedas en Amazon.es.
# IMPORTANTE: las claves deben coincidir EXACTAMENTE con las categorías
# existentes en el catálogo (`src/content/articulos/*/index.json` -> campo
# `categoria`). El script verifica esto al arrancar y avisa si difieren.
# Si añades una categoría nueva al catálogo, añade aquí sus queries.
CATEGORY_QUERIES: dict[str, list[str]] = {
    "Rampas": [
        "rampa perro plegable coche",
        "rampa perro grande maletero",
    ],
    "Ansiedad": [
        "antiestres perro feromonas",
        "calmante perro ansiedad masticables",
    ],
    "Camas ortopédicas": [
        "cama ortopedica perro grande",
        "cama viscoelastica perro",
    ],
    "Alimentación específica": [
        "pienso veterinario perro renal",
        "pienso prescripcion perro digestivo",
    ],
    "Suplementos": [
        "condroprotector perro glucosamina",
        "aceite salmon perro omega 3",
    ],
    "Perros senior": [
        "suplemento articulaciones perro senior",
        "perro senior pienso",
    ],
    "Correas": [
        "correa perro adiestramiento larga",
        "correa canicross perro",
    ],
    "Bozales": [
        "bozal perro silicona cesta",
        "bozal perro grande",
    ],
}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str]) -> dict:
    args = {
        "per_category": 5,
        "only": None,
        "dry_run": False,
        "no_create": False,
        "debug": False,
        "loose": False,
    }
    for a in argv:
        if a == "--dry-run":
            args["dry_run"] = True
        elif a == "--no-create":
            args["no_create"] = True
        elif a == "--debug":
            args["debug"] = True
        elif a == "--loose":
            args["loose"] = True
        elif a.startswith("--per-category="):
            try:
                args["per_category"] = max(1, int(a.split("=", 1)[1]))
            except ValueError:
                pass
        elif a.startswith("--only="):
            args["only"] = a.split("=", 1)[1].strip()
    return args


# ---------------------------------------------------------------------------
# Catálogo actual
# ---------------------------------------------------------------------------

def existing_asins() -> set[str]:
    asins: set[str] = set()
    for p in ART.glob("*/index.json"):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        m = re.search(r"/dp/([A-Z0-9]{10})", d.get("linkAmazon", ""))
        if m:
            asins.add(m.group(1))
    return asins


def existing_slugs() -> set[str]:
    return {p.name for p in ART.iterdir() if p.is_dir()}


def existing_categories() -> set[str]:
    """Conjunt de categories que ja existeixen al catàleg."""
    cats: set[str] = set()
    for p in ART.glob("*/index.json"):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        c = d.get("categoria")
        if c:
            cats.add(c)
    return cats


def existing_fingerprints() -> list[tuple[str, str]]:
    """Llista de (brand_lower, title_normalized) per detectar duplicats fuzzy.

    title_normalized: tot en minúscules, sense accents, sense símbols, sense
    paraules de "variant" (mida, color, etc.) — així dues fitxes que només
    es distingeixen per "Talla 2" vs "Talla 3" col·lapsen al mateix
    fingerprint.
    """
    fps: list[tuple[str, str]] = []
    for p in ART.glob("*/index.json"):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        b = (d.get("marca") or "").lower().strip()
        t = _normalize_title(d.get("nombre", ""))
        if t:
            fps.append((b, t))
    return fps


_VARIANT_RX = re.compile(
    r"\b(talla|tamano|tamaño|size|talle|color|negro|negra|blanco|blanca|"
    r"gris|azul|rojo|verde|marron|s|m|l|xl|xxl|xs|"
    r"\d+\s*(?:cm|kg|g|ml|l|m|uds|unidades|comprimidos|capsulas|"
    r"masticables|piezas))\b",
    flags=re.IGNORECASE,
)


def _normalize_title(t: str) -> str:
    """Treu accents, paraules de variant, números, símbols i comprimeix espais."""
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()
    s = s.lower()
    s = _VARIANT_RX.sub(" ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


_STOPWORDS = {
    "para", "perros", "perro", "de", "del", "con", "y", "o", "el", "la", "los",
    "las", "un", "una", "en", "a", "al", "por", "sin", "bozal", "cama", "rampa",
    "correa", "pienso", "que", "es", "su", "su", "muy", "este", "esta",
}


def is_duplicate(brand: str | None, title: str, fingerprints: list[tuple[str, str]]) -> bool:
    """True si ja existeix un producte amb la mateixa marca i títol molt similar.

    Heurística doble:
      - Jaccard ≥ 0.55 sobre tokens significatius (sense stopwords).
      - O containment: tots els tokens significatius del títol més curt
        estan continguts al més llarg, amb com a mínim 2 tokens en comú.
    Es requereix la mateixa marca (si totes dues la tenen).
    """
    b = (brand or "").lower().strip()
    t = _normalize_title(title)
    if not t:
        return False
    t_tokens = {w for w in t.split() if w not in _STOPWORDS and len(w) > 2}
    if not t_tokens:
        return False
    for fb, ft in fingerprints:
        # Si tenim marca i no coincideix, ignorem
        if b and fb and b != fb:
            continue
        ft_tokens = {w for w in ft.split() if w not in _STOPWORDS and len(w) > 2}
        if not ft_tokens:
            continue
        inter = t_tokens & ft_tokens
        if len(inter) < 2:
            continue
        union = t_tokens | ft_tokens
        jaccard = len(inter) / len(union) if union else 0
        smaller = min(len(t_tokens), len(ft_tokens))
        containment = len(inter) / smaller if smaller else 0
        # Duplicat si: títol curt està quasi tot dins el llarg (containment alt)
        # o bé si la similitud global és alta.
        if containment >= 0.80 or jaccard >= 0.55:
            return True
    return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _basic_slug(text: str) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def smart_slug(brand: str | None, title: str, max_words: int = 6, max_len: int = 60) -> str:
    """Slug que NO duplica la marca al principio."""
    brand_slug = _basic_slug(brand) if brand else ""
    title_slug = _basic_slug(title)
    if brand_slug and title_slug.startswith(brand_slug + "-"):
        title_slug = title_slug[len(brand_slug) + 1:]
    combined = f"{brand_slug}-{title_slug}" if brand_slug else title_slug
    parts = [p for p in combined.split("-") if p][:max_words]
    return "-".join(parts)[:max_len].strip("-") or "producto"


def slugify(text: str) -> str:
    """Compatibilidad: slug simple sin marca."""
    parts = [p for p in _basic_slug(text).split("-") if p][:6]
    return "-".join(parts)[:60] or "producto"


def unique_slug(base: str, taken: set[str]) -> str:
    s = base
    i = 2
    while s in taken:
        s = f"{base}-{i}"
        i += 1
    return s


def euro_str(v: float) -> str:
    return f"{v:.2f}€"


def parse_eur(raw: str) -> float | None:
    if not raw:
        return None
    s = re.sub(r"[^\d,.\-]", "", raw)
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def best_image_url(img) -> str | None:
    """Devuelve la URL de mayor resolución del srcset, o el src."""
    srcset = img.get("srcset", "")
    if srcset:
        cands: list[tuple[int, str]] = []
        for part in srcset.split(","):
            tokens = part.strip().split()
            if len(tokens) >= 2:
                url, size = tokens[0], tokens[1]
                m = re.match(r"(\d+)x", size)
                if m:
                    cands.append((int(m.group(1)), url))
        if cands:
            cands.sort(reverse=True)
            return cands[0][1]
    return img.get("src")


# ---------------------------------------------------------------------------
# Scraping
# ---------------------------------------------------------------------------

def is_captcha(soup: BeautifulSoup) -> bool:
    txt = soup.get_text(" ", strip=True).lower()
    markers = (
        "introduce los caracteres",
        "enter the characters",
        "discúlpenos",
        "robot check",
        "automated access",
    )
    return any(m in txt for m in markers)


def fetch_search(session: requests.Session, query: str) -> BeautifulSoup | None:
    url = "https://www.amazon.es/s?k=" + requests.utils.quote(query)
    try:
        resp = session.get(url, timeout=25)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"    ERROR red: {e}")
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    if is_captcha(soup):
        print("    ⚠ CAPTCHA de Amazon, saltando esta query")
        return None
    return soup


def extract_candidates(
    soup: BeautifulSoup, strict: bool = True, debug: bool = False
) -> list[dict]:
    cards = soup.select("[data-component-type='s-search-result'][data-asin]")
    if debug:
        print(f"    debug: {len(cards)} cards detectadas")
    out: list[dict] = []
    rejects: dict[str, int] = {}

    def reject(reason: str):
        rejects[reason] = rejects.get(reason, 0) + 1

    for card in cards:
        asin = (card.get("data-asin") or "").strip()
        if not asin or not re.fullmatch(r"[A-Z0-9]{10}", asin):
            reject("asin-invalido")
            continue

        # Patrocinado
        is_sponsored = bool(
            card.select_one(".puis-sponsored-label-text")
            or card.find(string=re.compile(r"Patrocinado", re.IGNORECASE))
        )
        if strict and is_sponsored:
            reject("patrocinado")
            continue

        # Título: probamos varias variantes (Amazon cambia el markup a menudo)
        title_el = (
            card.select_one("h2 a span")
            or card.select_one("h2 span")
            or card.select_one("h2")
            or card.select_one("[data-cy='title-recipe'] span")
            or card.select_one(".a-link-normal .a-text-normal")
            or card.select_one("a.a-link-normal span.a-text-normal")
        )
        title = title_el.get_text(" ", strip=True) if title_el else ""
        if strict and len(title) < 12:
            reject(f"titulo-corto({len(title)})")
            continue

        # Precio
        price_el = (
            card.select_one(".a-price[data-a-color='base'] .a-offscreen")
            or card.select_one(".a-price .a-offscreen")
        )
        price_val = parse_eur(price_el.get_text(strip=True)) if price_el else None
        if strict and (not price_val or price_val <= 0):
            reject("sin-precio")
            continue

        # Precio original (tachado)
        orig_el = card.select_one(".a-price.a-text-price .a-offscreen")
        orig_val = parse_eur(orig_el.get_text(strip=True)) if orig_el else None

        # Imagen
        img_el = card.select_one("img.s-image")
        img_url = best_image_url(img_el) if img_el else None
        if strict and not img_url:
            reject("sin-imagen")
            continue

        # Marca: orden de preferencia
        brand = None
        brand_el = (
            card.select_one("h5.s-line-clamp-1 span")
            or card.select_one(".a-row.a-size-base-plus span")
            or card.select_one("[data-cy='title-recipe'] h2 + div span")
        )
        if brand_el:
            brand = brand_el.get_text(strip=True)
        # Limpia comas/símbolos al final
        if brand:
            brand = brand.rstrip(",.").strip()

        generic_brands = {
            "para", "perro", "perros", "cama", "rampa", "correa",
            "bozal", "pienso", "kit", "pack", "condroprotector",
            "calmante", "feromonas", "los", "el", "la", "un", "una",
            "multivitaminico", "multivitaminicos", "multivitaminas",
            "aceite", "suplemento", "comida", "snack", "snacks",
        }

        if not brand and title:
            first = title.split()[0].rstrip(",.")
            if 2 < len(first) <= 25 and first.lower() not in generic_brands and first[0].isalpha():
                brand = first

        if strict and (not brand or brand.lower() in generic_brands):
            reject("marca-generica" if brand else "sin-marca")
            continue

        out.append({
            "asin": asin,
            "title": title,
            "price": price_val,
            "original": orig_val,
            "image": img_url,
            "brand": brand,
        })

    if debug and rejects:
        print(f"    debug: descartados → {rejects}")
    return out


def download_image(url: str | None, target_dir: Path) -> str | None:
    if not url:
        return None
    headers = {
        **HEADERS,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.amazon.es/",
    }
    try:
        r = requests.get(url, headers=headers, timeout=25)
        r.raise_for_status()
        buf = r.content
    except requests.RequestException as e:
        print(f"     img FAIL: {e}")
        return None
    if len(buf) < 500:
        return None
    if buf[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif buf[:8].startswith(b"\x89PNG"):
        ext = "png"
    elif len(buf) >= 12 and buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        ext = "webp"
    else:
        ext = "jpg"
    target_dir.mkdir(parents=True, exist_ok=True)
    out = target_dir / f"imagen.{ext}"
    out.write_bytes(buf)
    return ext


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args(sys.argv[1:])
    per_cat: int = args["per_category"]
    only: str | None = args["only"]
    dry: bool = args["dry_run"]
    no_create: bool = args["no_create"] or dry

    asins = existing_asins()
    slugs = existing_slugs()
    cats_in_catalog = existing_categories()
    fingerprints = existing_fingerprints()

    print(f"Catálogo actual: {len(asins)} ASIN únicos, {len(slugs)} carpetas.")
    print(f"Categorías en uso: {sorted(cats_in_catalog)}")
    print(f"Objetivo: hasta {per_cat} candidatos NUEVOS por categoría.")

    # Validación: avisar si alguna categoría del script NO coincide con las
    # del catálogo (evita crear categorías duplicadas tipo "Bozal" vs "Bozales").
    declared = set(CATEGORY_QUERIES.keys())
    unknown = declared - cats_in_catalog
    if unknown and cats_in_catalog:
        print(
            f"\n⚠ AVISO: estas categorías del script NO coinciden con ninguna "
            f"existente en el catálogo: {sorted(unknown)}"
        )
        print(
            f"   Existentes: {sorted(cats_in_catalog)}\n"
            f"   Si continúas, se CREARÁN como nuevas categorías. Si no era tu "
            f"intención, corrige las claves de CATEGORY_QUERIES en este script."
        )
        if not args["loose"]:
            ans = input("   ¿Continuar igualmente? [s/N]: ").strip().lower()
            if ans not in ("s", "si", "sí", "y", "yes"):
                print("Abortado.")
                return
    print()

    session = requests.Session()
    session.headers.update(HEADERS)

    summary: dict[str, list[dict]] = {}
    created = 0

    for cat, queries in CATEGORY_QUERIES.items():
        if only and only.lower() != cat.lower():
            continue
        print(f"=== {cat} ===")
        candidates: list[dict] = []
        seen_asin: set[str] = set()

        for q in queries:
            if len(candidates) >= per_cat:
                break
            print(f"  · query: {q}")
            soup = fetch_search(session, q)
            if soup is None:
                time.sleep(random.uniform(4, 7))
                continue
            for c in extract_candidates(soup, strict=not args["loose"], debug=args["debug"]):
                if c["asin"] in asins or c["asin"] in seen_asin:
                    continue
                # Detector fuzzy: mateix brand + títol molt similar
                if is_duplicate(c.get("brand"), c.get("title", ""), fingerprints):
                    if args["debug"]:
                        print(f"    debug: descartat per duplicat fuzzy → {c['title'][:60]}…")
                    continue
                seen_asin.add(c["asin"])
                candidates.append(c)
                if len(candidates) >= per_cat:
                    break
            time.sleep(random.uniform(5, 9))

        summary[cat] = candidates
        if not candidates:
            print("  → sin candidatos nuevos.\n")
            continue

        for c in candidates:
            short = c["title"][:80] + ("…" if len(c["title"]) > 80 else "")
            marker = "·" if no_create else "+"
            print(
                f"  {marker} [{c['asin']}] {short}  ({euro_str(c['price'])}, marca: {c['brand']})"
            )

            if no_create:
                continue

            base = smart_slug(c["brand"], c["title"])
            slug = unique_slug(base, slugs)
            slugs.add(slug)

            folder = ART / slug
            data: dict = {
                "nombre": c["title"],
                "descripcion": "",
                "linkAmazon": f"https://www.amazon.es/dp/{c['asin']}",
                "categoria": cat,
                "marca": c["brand"] or "",
            }
            if c["price"]:
                data["precio"] = euro_str(c["price"])
            # NOTA: NO guardem `precioOriginal` ni `descuentoPct` aquí.
            # Els llistats de cerca d'Amazon mostren preus tatxats que
            # sovint són PVP històrics o promos d'altres venedors. Deixem
            # que `update_prices.py` (que llegeix la fitxa real del
            # producte) ompli aquests camps amb validació estricta.

            ext = download_image(c["image"], IMG / slug)
            if ext:
                data["imagen"] = f"/images/articulos/{slug}/imagen.{ext}"

            data = {k: v for k, v in data.items() if v not in (None, "")}

            folder.mkdir(parents=True, exist_ok=True)
            (folder / "index.json").write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            asins.add(c["asin"])
            fingerprints.append(
                ((c.get("brand") or "").lower().strip(),
                 _normalize_title(c.get("title", "")))
            )
            created += 1
            print(f"     → creado: src/content/articulos/{slug}/")
            time.sleep(random.uniform(2, 4))

        print()

    print("=" * 60)
    print("RESUMEN")
    total_found = 0
    for cat, items in summary.items():
        total_found += len(items)
        print(f"  {cat:>26}: {len(items)} candidatos")
    print(f"  {'TOTAL':>26}: {total_found} candidatos, {created} fichas creadas")
    if no_create:
        print("\n[NO-CREATE] Solo se ha listado. Ejecuta sin --no-create/--dry-run para crear las fichas.")
    print(
        "\nSiguientes pasos sugeridos:"
        "\n  1. Revisa las fichas en Keystatic (npm run dev → /keystatic) y rellena la descripción."
        "\n  2. Ejecuta: npm run fetch-product-images   # para imagen de alta resolución."
        "\n  3. Ejecuta: python scripts/update_prices.py # para descuentos y ventas."
    )


if __name__ == "__main__":
    main()
