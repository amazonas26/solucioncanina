#!/usr/bin/env python3
"""
Scraper de preus i mètriques d'Amazon.es per a solucioncanina.

Per cada producte (`src/content/articulos/<slug>/index.json`):
  - Llegeix `linkAmazon`.
  - Consulta la pàgina d'Amazon i extreu NOMÉS el que es mostra en aquest
    instant (no calculem res):
        * precio actual          -> camp `precio`             (ex: "25.99€")
        * preu original tatxat   -> camp `precioOriginal`     (ex: "39.99€")
        * descompte (badge -NN%) -> camp `descuentoPct`       (enter 0..100)
        * vendes/mes (social)    -> camp `ventas`             (enter, ex: 1000)
        * valoració mitjana      -> camp `valoracion` (només si ≥3,7; si és més baixa
                                  s'elimina el producte sencer, vegeu més amunt)
        * nº de valoracions      -> camp `valoracionesCount`  (enter, ex: 1234)
  - `precioOriginal` i `descuentoPct` només es guarden si Amazon mostra
    SIMULTÀNIAMENT preu tatxat I badge "-NN%". Si la pàgina ja no mostra
    oferta, els camps es NETEGEN del JSON.
  - **Eliminació** del producte (carpeta `src/content/articulos/<slug>/` i imatges
    sota `public/images/articulos/<slug>/`) si:
    · **Valoració al PDP < 3,7** (amb nota llegible).
    · **Menys de 10 valoracions**: es fa servir el recompte del PDP si n’hi ha;
      si no, el camp `valoracionesCount` del JSON (si és vàlid). Si no es pot
      determinar cap recompte, no s’elimina per aquest motiu.
    · **No disponible**: només si **no** s'extreu preu vàlid *i* el text dels
      blocs `#availability` / `#availability-brief` / `#outOfStock` (sense scripts)
      coincideix amb patrons d'esgotament. **No** es fa servir `#buybox` (conté
      JSON amb la paraula "unavailable" i generava falsos positius a tot el catàleg).
      Si hi ha **preu vàlid**, no s'elimina mai per «no disponible».
    Al final: **nombre total eliminat** i **desglossament per categoria**
    (secció). En CAPTCHA o error de xarxa **no** s'elimina res.
  - En guardar qualsevol `index.json`, s'assegura `linkAmazon` amb
    `?tag=solucioncanin-21` (vegeu `_common.ensure_affiliate_link`).
  - Opcional **`--refill-deleted`**: després d'eliminar (sense `--dry-run`), per
    cada categoria amb N baixes executa `scripts/find_new_products.py` amb
    `--only` i `--per-category=N` per intentar omplir forats (mateixes queries
    que el script de nous productes). En dry-run només s'anuncia què es cridaria.

Ús:
    python scripts/update_prices.py [--dry-run] [--only SLUG] [--limit N]
    python scripts/update_prices.py --refill-deleted
        # després d'eliminar productes, per cada secció amb baixes crida
        # `find_new_products.py --only=<categoria> --per-category=<N>` (N = eliminats).
"""

import json
import random
import re
import shutil
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from _common import ensure_affiliate_link as _ensure_affiliate_link  # noqa: E402
from _common import slugify as _slugify  # noqa: E402
from _common import strip_brand_prefix as _strip_brand_prefix  # noqa: E402

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"
IMAGES_DIR = ROOT / "public" / "images" / "articulos"

# Mateixa política que `find_new_products.py`: no mostrar ni persistir notes baixes.
MIN_CATALOG_RATING = 3.7
MIN_CATALOG_REVIEWS = 10

# Frases d'esgotament només dins del bloc d'disponibilitat (mai dins #buybox sencer:
# el buybox inclou <script> amb JSON on surt "unavailable" i això eliminava tot el catàleg).
_OOS_PATTERNS = re.compile(
    r"(?:^|[\s,.;(])"
    r"(no disponible|no disponible temporalmente|no disponible temporalment|"
    r"sin stock|agotado|no hay existencias|no hay suficientes unidades|"
    r"actualmente no disponible|desconocida disponibilidad|"
    r"currently unavailable|temporarily out of stock)"
    r"(?:$|[\s,.;)]|\b)",
    re.IGNORECASE,
)


def _availability_clean_text(soup: BeautifulSoup) -> str:
    """Text visible dels blocs d'estoc d'Amazon (sense <script>/<style>).

    No modifica el `soup` original (parseja una còpia del subarbre).
    """
    parts: list[str] = []
    for sel in ("#availability", "#availability-brief", "#outOfStock"):
        el = soup.select_one(sel)
        if not el:
            continue
        frag = BeautifulSoup(str(el), "html.parser")
        for bad in frag.find_all(["script", "style"]):
            bad.decompose()
        t = frag.get_text(" ", strip=True).lower()
        if t:
            parts.append(t)
    return " ".join(parts)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ca-ES,ca;q=0.9,es-ES;q=0.8,es;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
}


# ---------------------------------------------------------------------------
# Eliminació de productes (no disponible / valoració baixa / poques ressenyes)
# ---------------------------------------------------------------------------

def is_captcha_page(soup: BeautifulSoup) -> bool:
    txt = soup.get_text(" ", strip=True).lower()
    markers = (
        "introduce los caracteres",
        "enter the characters",
        "discúlpenos",
        "robot check",
        "automated access",
    )
    return any(m in txt for m in markers)


def detect_product_unavailable(soup: BeautifulSoup, *, has_price: bool) -> bool:
    """True només si no hi ha preu vàlid i el missatge d'estoc és clarament d'esgotament.

    Si Amazon mostra un preu d'compra vàlid (`has_price`), mai es considera
    no disponible (evita falsos positius del títol, mòduls relacionats, etc.).
    """
    if has_price:
        return False
    blob = _availability_clean_text(soup)
    if not blob.strip():
        return False
    # Senyals forts de producte comprable sense preu llegit (p. ex. parser desactualitzat)
    if re.search(r"\ben stock\b", blob, re.IGNORECASE):
        return False
    if re.search(r"\bdisponible\b", blob, re.IGNORECASE) and not re.search(
        r"no\s+disponible", blob, re.IGNORECASE
    ):
        return False
    return bool(_OOS_PATTERNS.search(blob))


def remove_product_from_disk(slug: str) -> None:
    """Elimina carpeta de contingut i d'imatges del producte (rutes sota el repo)."""
    art = (ARTICULOS_DIR / slug).resolve()
    img = (IMAGES_DIR / slug).resolve()
    root = ROOT.resolve()
    if not str(art).startswith(str(root)) or art.name != slug:
        raise RuntimeError(f"Refús d'eliminar ruta insegura: {art}")
    if not str(img).startswith(str(root)):
        raise RuntimeError(f"Refús d'eliminar ruta insegura: {img}")
    if art.is_dir():
        shutil.rmtree(art)
    if img.is_dir():
        shutil.rmtree(img)


def _find_new_products_script() -> Path:
    return Path(__file__).resolve().parent / "find_new_products.py"


def _refill_supported_categories() -> set[str]:
    """Categories per les quals `find_new_products.py` té `CATEGORY_QUERIES`."""
    try:
        import find_new_products as fnp  # noqa: PLC0415

        return set(fnp.CATEGORY_QUERIES.keys())
    except Exception:
        return set()


def maybe_refill_deleted(
    removed_by_cat: Counter[str],
    *,
    dry_run: bool,
    do_refill: bool,
) -> None:
    """Per cada secció amb N eliminacions, crida find_new_products per buscar N candidats nous."""
    if not do_refill or not removed_by_cat:
        return

    supported = _refill_supported_categories()
    actionable = [
        (c, n)
        for c, n in removed_by_cat.items()
        if c and c != "Sense categoria" and n > 0 and c in supported
    ]
    if not actionable:
        return

    print("\n" + "=" * 60)
    print("REFILL (substituir eliminats amb nous productes a Amazon)")
    if dry_run:
        for cat, n in sorted(actionable, key=lambda x: (-x[1], x[0])):
            print(
                f"  · «{cat}» ({n} baixa/es): s'hauria executat\n"
                f"      python scripts/find_new_products.py --only={cat!r} --per-category={n}"
            )
        print("  (amb --dry-run no es crida el script ni es creen fitxes)\n")
        return

    script = _find_new_products_script()
    if not script.is_file():
        print(f"  ERROR: no trobo {script}")
        return

    for cat, n in sorted(actionable, key=lambda x: (-x[1], x[0])):
        cmd = [
            sys.executable,
            str(script),
            f"--only={cat}",
            f"--per-category={n}",
        ]
        print(f"\n  ▶ {' '.join(cmd)}")
        proc = subprocess.run(cmd, cwd=str(ROOT))
        if proc.returncode != 0:
            print(f"     ⚠ find_new_products ha acabat amb codi {proc.returncode}")
    print()


# ---------------------------------------------------------------------------
# Helpers de parsing
# ---------------------------------------------------------------------------

def _euro_str(value: float) -> str:
    """Formata un valor numèric en euros amb 2 decimals i símbol final."""
    return f"{value:.2f}€"


def _parse_eur(raw: str) -> float | None:
    """Converteix '1.234,56€' / '25,99€' / '25.99€' a float."""
    if not raw:
        return None
    s = re.sub(r"[^\d,.\-]", "", raw)
    if not s:
        return None
    # Si conté ',' i '.', el ',' és decimal i el '.' és separador de milers
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str | None:
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(" ", strip=True)
            if text:
                return text
    return None


# ---------------------------------------------------------------------------
# Extracció de preus
# ---------------------------------------------------------------------------

# Selectors per al "scope" — el bloc principal del producte. Tot el que NO
# està dins d'aquests blocs (cupons d'altres productes, sidebar, sponsored,
# etc.) s'ha d'ignorar per evitar contaminar les dades.
PRICE_SCOPE_SELECTORS = (
    "#corePriceDisplay_desktop_feature_div",
    "#corePrice_feature_div",
    "#apex_desktop",
    "#apex_offerDisplay_desktop",
)


def _price_scope(soup: BeautifulSoup):
    """Retorna el primer bloc de preu principal trobat, o None."""
    for sel in PRICE_SCOPE_SELECTORS:
        el = soup.select_one(sel)
        if el:
            return el
    return None


def extract_current_price(soup: BeautifulSoup) -> float | None:
    """Preu actual (el gran, sovint en vermell o negre)."""
    scope = _price_scope(soup)

    # 1) Selectors estrictes dins el bloc principal.
    if scope is not None:
        for sel in (
            "span.priceToPay .a-offscreen",
            ".a-price[data-a-color='price'] .a-offscreen",
            ".a-price .a-offscreen",
        ):
            el = scope.select_one(sel)
            if el:
                val = _parse_eur(el.get_text(strip=True))
                if val and 0.5 <= val <= 5000:
                    return val

    # 2) Fallback amb selectors globals (per pàgines amb DOM diferent).
    for sel in (
        "#corePrice_feature_div .a-price .a-offscreen",
        "#apex_offerDisplay_desktop .a-price .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        "span.priceToPay .a-offscreen",
        ".a-price[data-a-color='price'] .a-offscreen",
    ):
        el = soup.select_one(sel)
        if el:
            val = _parse_eur(el.get_text(strip=True))
            if val and 0.5 <= val <= 5000:
                return val
    return None


def extract_original_price(soup: BeautifulSoup, current: float | None) -> float | None:
    """Preu original (PVP / tatxat). Només dins del bloc principal del producte."""
    scope = _price_scope(soup)
    if scope is None:
        return None

    selectors = (
        ".a-price.a-text-price[data-a-strike='true'] .a-offscreen",
        ".basisPrice .a-price .a-offscreen",
        ".a-price.a-text-price .a-offscreen",
    )
    for sel in selectors:
        for el in scope.select(sel):
            val = _parse_eur(el.get_text(strip=True))
            if val and 0.5 <= val <= 5000:
                if current is None or val > current + 0.01:
                    return val
    return None


def extract_discount_pct(soup: BeautifulSoup) -> int | None:
    """
    Percentatge mostrat al BADGE de descompte (ex: -25%) DINS el bloc principal.
    No comptem cupons "Suscríbete y ahorra X%" ni promos d'altres productes.
    """
    scope = _price_scope(soup)
    if scope is None:
        return None

    # Només selectors específics del badge oficial (NO ".a-color-price",
    # NO "data-a-strike + span" perquè capturen cupons/textos solts).
    for sel in (".savingsPercentage", ".reinventPriceSavingsPercentageMargin"):
        for el in scope.select(sel):
            txt = el.get_text(" ", strip=True)
            m = re.search(r"-?\s*(\d{1,2})\s*%", txt)
            if m:
                pct = int(m.group(1))
                if 1 <= pct <= 99:
                    return pct
    return None


# ---------------------------------------------------------------------------
# Extracció de valoració (estrelles i nº de ressenyes)
# ---------------------------------------------------------------------------

def extract_rating(soup: BeautifulSoup) -> float | None:
    """
    Llegeix la mitjana d'estrelles (0-5) de la fitxa d'Amazon.
    Probes:
      - <span class="a-icon-alt">4,5 de 5 estrellas</span>
      - <span id="acrPopover" title="4,5 de 5 estrellas">
      - [data-hook="rating-out-of-text"]
    """
    candidates: list[str] = []

    el = soup.select_one("#acrPopover")
    if el:
        title = el.get("title") or el.get_text(" ", strip=True)
        if title:
            candidates.append(title)

    for sel in (
        "i.a-icon-star span.a-icon-alt",
        "i.a-icon-star-medium span.a-icon-alt",
        '[data-hook="rating-out-of-text"]',
        "span.reviewCountTextLinkedHistogram",
    ):
        for e in soup.select(sel):
            candidates.append(e.get_text(" ", strip=True))

    for txt in candidates:
        if not txt:
            continue
        # "4,5 de 5 estrellas" / "4.5 out of 5" / "4,7 de 5"
        m = re.search(r"(\d[.,]\d)\s*(?:de\s*5|out\s*of\s*5|\/\s*5)", txt, flags=re.IGNORECASE)
        if not m:
            m = re.search(r"^\s*(\d[.,]\d)\s*$", txt)
        if m:
            val = float(m.group(1).replace(",", "."))
            if 0 < val <= 5:
                return round(val, 1)
    return None


def _parse_amazon_review_count_token(raw: str) -> int | None:
    """Converteix '1234', '1.234', '12.345' (separadors de milers ES) a int."""
    raw = raw.strip()
    if not raw or not re.fullmatch(r"[\d.,]+", raw):
        return None
    # Un sol separador ',' o '.' com a decimal improbable en recompte de ressenyes;
    # a Amazon.es els milers van amb punt: 1.234
    if raw.count(".") >= 1 and raw.replace(".", "").isdigit():
        parts = raw.split(".")
        if parts and parts[0] and all(p.isdigit() for p in parts):
            if len(parts) == 1:
                return int(parts[0])
            if all(len(p) == 3 for p in parts[1:]) and 1 <= len(parts[0]) <= 3:
                return int("".join(parts))
    if raw.isdigit():
        return int(raw)
    if "," in raw and raw.replace(",", "").isdigit():
        return int(raw.replace(",", ""))
    return None


def extract_rating_count(soup: BeautifulSoup) -> int | None:
    """Nº total de valoracions al PDP (Amazon canvia markup sovint).

    Ordre: enllaços a customerReviews amb «(1.234)»; després blocs de text coneguts
    (#acrCustomerReviewText, data-hook, etc.). Abans només es capturava si sortia
    la paraula «valoraciones»; moltes fitxes només mostren «(2)» sense aquesta paraula.
    """
    for a in soup.select(
        'a[href*="customerReviews"], a[href*="CustomerReviews"], a[href*="#customerReviews"]'
    ):
        t = a.get_text(" ", strip=True)
        m = re.search(r"\(\s*([\d.]+)\s*\)", t)
        if m:
            n = _parse_amazon_review_count_token(m.group(1))
            if n and n > 0:
                return n

    candidates: list[str] = []
    el = soup.select_one("#acrCustomerReviewText")
    if el:
        candidates.append(el.get_text(" ", strip=True))
    for sel in (
        '[data-hook="total-review-count"]',
        "#averageCustomerReviews_feature_div",
        "#reviewsMedley",
    ):
        for e in soup.select(sel):
            candidates.append(e.get_text(" ", strip=True))

    kw = r"(?:valoraciones?|calificaciones?|reseñas?|reviews?|opiniones?|ratings?)"
    for txt in candidates:
        if not txt:
            continue
        m = re.search(
            rf"(\d{{1,3}}(?:[.,]\d{{3}})*)\s*{kw}\b",
            txt,
            flags=re.IGNORECASE,
        )
        if m:
            n = int(m.group(1).replace(".", "").replace(",", ""))
            if n > 0:
                return n
        m2 = re.search(rf"\b{kw}\b\s*[:(]?\s*(\d{{1,3}}(?:[.,]\d{{3}})*)", txt, flags=re.IGNORECASE)
        if m2:
            n = int(m2.group(1).replace(".", "").replace(",", ""))
            if n > 0:
                return n
        m3 = re.search(r"\(\s*([\d.]+)\s*\)", txt)
        if m3:
            n = _parse_amazon_review_count_token(m3.group(1))
            if n and n > 0:
                return n
    return None


# ---------------------------------------------------------------------------
# Extracció de vendes ("Más de X comprados en el último mes")
# ---------------------------------------------------------------------------

def extract_monthly_sales(soup: BeautifulSoup) -> int | None:
    """
    Llegeix l'indicador social-proof d'Amazon (ex: 'Más de 1 mil comprados...')
    i retorna un enter aproximat (1.000 / 5.000 / 10.000…).
    """
    candidates = []
    # Element específic
    el = soup.select_one("#social-proofing-faceout-title-tk_bought")
    if el:
        candidates.append(el.get_text(" ", strip=True))
    # Variants amb data-csa
    for el in soup.select('[data-csa-c-content-id="social-proofing-faceout-title"]'):
        candidates.append(el.get_text(" ", strip=True))
    # Fallback per text dins el HTML
    html_text = soup.get_text(" ", strip=True)
    candidates.append(html_text)

    for txt in candidates:
        if not txt:
            continue
        # Català/Castellà: "Más de 1 mil comprados", "Más de 50 comprados",
        # "10 mil+ comprados el último mes", etc.
        m = re.search(
            r"(?:m[áa]s\s+de\s+)?(\d{1,3}(?:[.,]\d{3})*)\s*(mil|k)?\+?\s*(?:comprados|bought)",
            txt,
            flags=re.IGNORECASE,
        )
        if m:
            num = m.group(1).replace(".", "").replace(",", "")
            try:
                n = int(num)
            except ValueError:
                continue
            unit = (m.group(2) or "").lower()
            if unit in ("mil", "k"):
                n *= 1000
            if n > 0:
                return n
    return None


def _coerce_review_count_json(value) -> int | None:
    """Enter no negatiu des del JSON, o None."""
    if value is None or isinstance(value, bool):
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


# ---------------------------------------------------------------------------
# Pipeline per producte
# ---------------------------------------------------------------------------

def fetch_product_data(
    url: str,
    session: requests.Session,
    *,
    review_count_json: int | None = None,
) -> dict:
    """Retorna camps d'actualització o `_delete_reason` si cal eliminar el producte."""
    out: dict = {}
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  ERROR de xarxa: {e}")
        return out

    soup = BeautifulSoup(resp.text, "html.parser")

    if is_captcha_page(soup):
        print("  ⚠ CAPTCHA d'Amazon: no s'actualitza ni elimina aquest producte.")
        return out

    current = extract_current_price(soup)
    rating = extract_rating(soup)
    rating_count = extract_rating_count(soup)
    eff_reviews: int | None = (
        int(rating_count) if rating_count is not None else review_count_json
    )

    unavailable = detect_product_unavailable(soup, has_price=(current is not None))
    delete_reason: str | None = None
    if unavailable:
        delete_reason = "no_disponible"
    elif rating is not None and rating < MIN_CATALOG_RATING:
        delete_reason = "valoracio_baixa"
    elif eff_reviews is not None and eff_reviews < MIN_CATALOG_REVIEWS:
        delete_reason = "pocs_reviews"

    if delete_reason:
        out["_delete_reason"] = delete_reason
        out["_has_price"] = current is not None
        out["_has_offer"] = False
        if rating is not None and rating < MIN_CATALOG_RATING:
            print(f"  · valoració PDP: {rating} (< {MIN_CATALOG_RATING})")
        if unavailable:
            print("  · Amazon indica no disponible / sense estoc")
        if delete_reason == "pocs_reviews":
            src = "PDP" if rating_count is not None else "JSON"
            print(f"  · valoracions ({src}): {eff_reviews} (< {MIN_CATALOG_REVIEWS})")
        return out

    original = extract_original_price(soup, current)
    discount = extract_discount_pct(soup)
    sales = extract_monthly_sales(soup)

    if current:
        out["precio"] = _euro_str(current)

    # IMPORTANT: només guardem `precioOriginal` i `descuentoPct` si Amazon els
    # MOSTRA explícitament en aquest mateix instant. No calculem res.
    #
    # A més, validem coherència matemàtica: si el badge diu "-X%" però el
    # ratio real (1 - actual/original) no s'aproxima a X (±5 punts), descartem
    # tota l'oferta. Això evita que un cupó "Suscríbete y ahorra 5%" es combini
    # amb un PVP antic i acabi mostrant-se com a oferta fantasma a la web.
    if current and original and original > current and discount is not None:
        real_pct = round((1 - current / original) * 100)
        if abs(real_pct - discount) <= 5:
            out["precioOriginal"] = _euro_str(original)
            if 1 <= discount <= 99:
                out["descuentoPct"] = int(discount)
        else:
            print(
                f"  ⚠ oferta INCOHERENT descartada: badge={discount}% però "
                f"{current:.2f}€/{original:.2f}€ implica {real_pct}%."
            )

    if sales:
        out["ventas"] = int(sales)

    if rating is not None and rating >= MIN_CATALOG_RATING:
        out["valoracion"] = round(rating, 1)
        if rating_count is not None:
            out["valoracionesCount"] = int(rating_count)

    # Marcadors auxiliars per al pipeline (no s'escriuen al JSON).
    out["_has_price"] = current is not None
    out["_has_offer"] = "precioOriginal" in out and "descuentoPct" in out

    return out


# ---------------------------------------------------------------------------
# IO
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict):
    if _ensure_affiliate_link(data):
        pass  # tag afiliat sempre al guardar
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: list[str]) -> dict:
    dry_run = "--dry-run" in argv
    refill_deleted = "--refill-deleted" in argv
    only = None
    limit = None
    for a in argv:
        if a.startswith("--only="):
            only = a.split("=", 1)[1]
        if a.startswith("--limit="):
            try:
                limit = int(a.split("=", 1)[1])
            except ValueError:
                pass
    return {"dry_run": dry_run, "only": only, "limit": limit, "refill_deleted": refill_deleted}


def main():
    args = parse_args(sys.argv[1:])
    dry_run = args["dry_run"]

    products = sorted(ARTICULOS_DIR.glob("*/index.json"))
    if args["only"]:
        products = [p for p in products if p.parent.name == args["only"]]
    if args["limit"]:
        products = products[: args["limit"]]
    print(f"Trobats {len(products)} productes.\n")

    session = requests.Session()
    session.headers.update(HEADERS)

    updated = []
    failed = []
    removed_by_cat: Counter[str] = Counter()
    removed_by_reason: Counter[str] = Counter()
    n_removed = 0

    for json_path in products:
        data = load_json(json_path)
        slug = json_path.parent.name
        name = data.get("nombre", slug)
        url = data.get("linkAmazon", "")

        print(f"[{slug}]")
        print(f"  URL: {url}")

        if not url:
            print("  SKIP: sense linkAmazon")
            failed.append((name, "sense URL"))
            continue

        # ---------------------------------------------------------------
        # Higienització del títol: si el `nombre` comença per la marca
        # (ex: "Edipets, Correa Perro Larga…"), la traiem. Abans, però,
        # ens assegurem de preservar l'slug actual al JSON perquè la URL
        # del producte no canviï quan canviï el `nombre`.
        # ---------------------------------------------------------------
        nombre_actual = data.get("nombre", "")
        marca = data.get("marca")
        name_changed = False
        slug_added = False
        if nombre_actual and "slug" not in data:
            if not dry_run:
                data["slug"] = _slugify(nombre_actual)
            slug_added = True
        nombre_net = _strip_brand_prefix(nombre_actual, marca)
        if nombre_net != nombre_actual:
            print(f"  nombre: '{nombre_actual[:60]}…' -> '{nombre_net[:60]}…'")
            if not dry_run:
                data["nombre"] = nombre_net
            name_changed = True

        new_data = fetch_product_data(
            url,
            session,
            review_count_json=_coerce_review_count_json(data.get("valoracionesCount")),
        )
        delete_reason = new_data.pop("_delete_reason", None)

        if delete_reason:
            cat = (data.get("categoria") or "").strip() or "Sense categoria"
            label = {
                "no_disponible": "no disponible a Amazon",
                "valoracio_baixa": f"valoració < {MIN_CATALOG_RATING}",
                "pocs_reviews": f"menys de {MIN_CATALOG_REVIEWS} valoracions",
            }.get(delete_reason, delete_reason)
            if dry_run:
                print(f"  -> [DRY RUN] s'eliminaria ({label}) — secció: «{cat}»")
            else:
                remove_product_from_disk(slug)
                print(f"  -> ELIMINAT ({label}) — secció: «{cat}»")
            removed_by_cat[cat] += 1
            removed_by_reason[delete_reason] += 1
            n_removed += 1
            delay = random.uniform(3, 7)
            print(f"  (esperant {delay:.1f}s...)\n")
            time.sleep(delay)
            continue

        if not new_data:
            print(f"  -> NO TROBAT (preu/valoració no actualitzats)")
            failed.append((name, "res trobat"))
            # Encara així pot ser que tinguem canvis de nombre/slug a guardar.
            if (name_changed or slug_added) and not dry_run:
                save_json(json_path, data)
                if name_changed:
                    print("     · nombre netejat (marca treta) — guardat")
                if slug_added:
                    print("     · slug preservat al JSON — guardat")
        else:
            has_price = new_data.pop("_has_price", False)
            has_offer = new_data.pop("_has_offer", False)

            changed_keys = []
            for k in ("precio", "precioOriginal", "descuentoPct", "ventas", "valoracion", "valoracionesCount"):
                if k in new_data and data.get(k) != new_data[k]:
                    changed_keys.append(
                        f"{k}: {data.get(k, '—')} -> {new_data[k]}"
                    )
                    if not dry_run:
                        data[k] = new_data[k]

            # ESTRICTE: només mantenim al JSON el que Amazon ENSENYA en aquest
            # instant. Si la pàgina actual no mostra oferta -> netegem.
            if not has_offer:
                for k in ("precioOriginal", "descuentoPct"):
                    if k in data:
                        changed_keys.append(f"{k}: {data[k]} -> (no mostrat ara) net")
                        if not dry_run:
                            data.pop(k, None)

            # Si el producte està "No disponible" (sense preu actual), no podem
            # parlar d'oferta -> també netegem el descompte/preu original.
            if not has_price:
                for k in ("precioOriginal", "descuentoPct"):
                    if k in data:
                        changed_keys.append(f"{k}: {data[k]} -> (producte sense preu) net")
                        if not dry_run:
                            data.pop(k, None)

            if changed_keys or name_changed or slug_added:
                if not dry_run:
                    save_json(json_path, data)
                print("  -> ACTUALITZAT")
                if name_changed:
                    print("     · nombre netejat (marca treta)")
                if slug_added:
                    print("     · slug preservat al JSON")
                for line in changed_keys:
                    print(f"     · {line}")
                updated.append((name, changed_keys or ["(neteja nombre/slug)"]))
            else:
                print("  -> sense canvis")

        # Pausa aleatòria per evitar bloqueig
        delay = random.uniform(3, 7)
        print(f"  (esperant {delay:.1f}s...)\n")
        time.sleep(delay)

    print("=" * 60)
    print(
        "ELIMINACIONS (no disponible, valoració < {:.1f}, o < {} valoracions)".format(
            MIN_CATALOG_RATING,
            MIN_CATALOG_REVIEWS,
        )
    )
    if dry_run and n_removed:
        print(f"  S'haurien eliminat: {n_removed} producte(s)")
    elif not dry_run and n_removed:
        print(f"  Total eliminats: {n_removed} producte(s)")
    else:
        print("  Cap eliminació en aquesta execució.")
    if n_removed:
        print("  Per secció (camp «categoria» al JSON):")
        for cat, cnt in sorted(removed_by_cat.items(), key=lambda x: (-x[1], x[0])):
            print(f"    · {cat}: {cnt}")
        if removed_by_reason:
            print("  Per motiu:")
            for reason, cnt in sorted(removed_by_reason.items(), key=lambda x: (-x[1], x[0])):
                lbl = {
                    "no_disponible": "no disponible",
                    "valoracio_baixa": f"valoració < {MIN_CATALOG_RATING}",
                    "pocs_reviews": f"menys de {MIN_CATALOG_REVIEWS} valoracions",
                }.get(reason, reason)
                print(f"    · {lbl}: {cnt}")

    maybe_refill_deleted(
        removed_by_cat,
        dry_run=dry_run,
        do_refill=args["refill_deleted"],
    )

    # -----------------------------------------------------------------------
    # Resums Top 6 (després del refill per reflectir nous ítems)
    # -----------------------------------------------------------------------
    all_products: list[dict] = []
    for json_path in sorted(ARTICULOS_DIR.glob("*/index.json")):
        d = load_json(json_path)
        d["_slug"] = json_path.parent.name
        all_products.append(d)

    top_discount = sorted(
        [p for p in all_products if isinstance(p.get("descuentoPct"), int) and p["descuentoPct"] > 0],
        key=lambda p: p["descuentoPct"],
        reverse=True,
    )[:6]

    top_sales = sorted(
        [p for p in all_products if isinstance(p.get("ventas"), int) and p["ventas"] > 0],
        key=lambda p: p["ventas"],
        reverse=True,
    )[:6]

    top_rated = sorted(
        [
            p
            for p in all_products
            if isinstance(p.get("valoracion"), (int, float))
            and p["valoracion"] >= MIN_CATALOG_RATING
            and not (
                type(p.get("valoracionesCount")) is int
                and p["valoracionesCount"] < MIN_CATALOG_REVIEWS
            )
        ],
        key=lambda p: (p["valoracion"], p.get("valoracionesCount", 0) or 0),
        reverse=True,
    )[:5]

    print("=" * 60)
    print(f"RESUM: {len(updated)} actualitzats, {len(failed)} fallits")

    if top_discount:
        print("\nTOP 6 més rebaixats:")
        for p in top_discount:
            print(f"  -{p['descuentoPct']:>2}%  {p['_slug']}  ({p.get('precio', '?')})")
    else:
        print("\nTOP 6 més rebaixats: cap producte amb descompte")

    if top_sales:
        print("\nTOP 6 més venuts (vendes/mes):")
        for p in top_sales:
            print(f"  {p['ventas']:>6}  {p['_slug']}")
    else:
        print("\nTOP 6 més venuts: cap producte amb dades de vendes")

    if top_rated:
        print("\nTOP 5 millor valorats:")
        for p in top_rated:
            count = p.get("valoracionesCount", 0) or 0
            print(f"  ★ {p['valoracion']:<3}  ({count:>5} ress.)  {p['_slug']}")
    else:
        print("\nTOP 5 millor valorats: cap producte amb dades de valoració")

    if failed:
        print("\nFallits:")
        for name, reason in failed:
            print(f"  {name}: {reason}")

    if dry_run:
        print("\n[DRY RUN] Cap canvi al disc: ni JSON actualitzats ni carpetes eliminades.")
        if args["refill_deleted"]:
            print("         (--refill-deleted: les crides a find_new_products només s'han llistat més amunt.)")


if __name__ == "__main__":
    main()
