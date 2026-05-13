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
        * valoració mitjana      -> camp `valoracion`         (float 0-5; només si ≥3,7,
                                  alineat amb el catàleg; si Amazon mostra menys,
                                  s'eliminen aquests camps del JSON)
        * nº de valoracions      -> camp `valoracionesCount`  (enter, ex: 1234)
  - `precioOriginal` i `descuentoPct` només es guarden si Amazon mostra
    SIMULTÀNIAMENT preu tatxat I badge "-NN%". Si la pàgina ja no mostra
    oferta (o el producte està No disponible), els camps es NETEGEN del JSON.

Ús:
    python scripts/update_prices.py [--dry-run] [--only SLUG] [--limit N]
"""

import json
import time
import random
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from _common import slugify as _slugify  # noqa: E402
from _common import strip_brand_prefix as _strip_brand_prefix  # noqa: E402

ARTICULOS_DIR = Path(__file__).parent.parent / "src" / "content" / "articulos"

# Mateixa política que `find_new_products.py`: no mostrar ni persistir notes baixes.
MIN_CATALOG_RATING = 3.7

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


def extract_rating_count(soup: BeautifulSoup) -> int | None:
    """Nº total de valoracions (ex: '1.234 valoraciones')."""
    candidates: list[str] = []
    el = soup.select_one("#acrCustomerReviewText")
    if el:
        candidates.append(el.get_text(" ", strip=True))
    for sel in ('[data-hook="total-review-count"]', "#averageCustomerReviews_feature_div"):
        for e in soup.select(sel):
            candidates.append(e.get_text(" ", strip=True))

    for txt in candidates:
        m = re.search(r"(\d{1,3}(?:[.,]\d{3})*)\s*(?:valoraciones|reviews|opiniones|ratings)", txt, flags=re.IGNORECASE)
        if m:
            n = int(m.group(1).replace(".", "").replace(",", ""))
            if n > 0:
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


# ---------------------------------------------------------------------------
# Pipeline per producte
# ---------------------------------------------------------------------------

def fetch_product_data(url: str, session: requests.Session) -> dict:
    """Retorna {precio?, precioOriginal?, descuentoPct?, ventas?}."""
    out: dict = {}
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  ERROR de xarxa: {e}")
        return out

    soup = BeautifulSoup(resp.text, "html.parser")

    current = extract_current_price(soup)
    original = extract_original_price(soup, current)
    discount = extract_discount_pct(soup)
    sales = extract_monthly_sales(soup)
    rating = extract_rating(soup)
    rating_count = extract_rating_count(soup)

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

    if rating is not None:
        if rating >= MIN_CATALOG_RATING:
            out["valoracion"] = round(rating, 1)
            if rating_count is not None:
                out["valoracionesCount"] = int(rating_count)
        else:
            # La fitxa PDP pot tenir nota més baixa que el llistat de cerca;
            # no persistim valoracions per sota del llindar del catàleg.
            out["_strip_low_rating"] = True

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
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: list[str]) -> dict:
    dry_run = "--dry-run" in argv
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
    return {"dry_run": dry_run, "only": only, "limit": limit}


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

        new_data = fetch_product_data(url, session)

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
            strip_low_rating = new_data.pop("_strip_low_rating", False)

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

            if strip_low_rating:
                for k in ("valoracion", "valoracionesCount"):
                    if k in data:
                        changed_keys.append(
                            f"{k}: {data[k]} -> (nota < {MIN_CATALOG_RATING}) net"
                        )
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

    # -----------------------------------------------------------------------
    # Resums Top 6
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
        [p for p in all_products if isinstance(p.get("valoracion"), (int, float)) and p["valoracion"] > 0],
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
        print("\n[DRY RUN] No s'ha escrit res.")


if __name__ == "__main__":
    main()
