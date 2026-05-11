#!/usr/bin/env python3
"""
Scraper de preus i mètriques d'Amazon.es per a solucioncanina.

Per cada producte (`src/content/articulos/<slug>/index.json`):
  - Llegeix `linkAmazon`.
  - Consulta la pàgina d'Amazon i extreu:
        * precio actual          -> camp `precio`            (ex: "25.99€")
        * preu original tatxat   -> camp `precioOriginal`    (ex: "39.99€")
        * descompte calculat     -> camp `descuentoPct`      (enter 0..100)
        * vendes/mes (social)    -> camp `ventas`            (enter, ex: 1000)
  - Si no troba algun camp opcional (`precioOriginal`, `descuentoPct`, `ventas`),
    el deixa com estava (no l'esborra) o el manté absent.

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

ARTICULOS_DIR = Path(__file__).parent.parent / "src" / "content" / "articulos"

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

def extract_current_price(soup: BeautifulSoup) -> float | None:
    """Preu actual (el gran, sovint en vermell o negre)."""
    selectors = [
        "#corePrice_feature_div .a-price .a-offscreen",
        "#apex_offerDisplay_desktop .a-price .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        "span.priceToPay .a-offscreen",
        ".a-price[data-a-color='price'] .a-offscreen",
        ".a-price .a-offscreen",
    ]
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            val = _parse_eur(el.get_text(strip=True))
            if val and val > 0:
                return val
    # Fallback: primer patró "12,34€" del HTML
    m = re.search(r"(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*€", str(soup))
    if m:
        return _parse_eur(m.group(0))
    return None


def extract_original_price(soup: BeautifulSoup, current: float | None) -> float | None:
    """Preu original (PVP / tatxat). Ha de ser major que el preu actual."""
    selectors = [
        "#corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen",
        "#corePrice_feature_div .a-price.a-text-price .a-offscreen",
        ".basisPrice .a-price .a-offscreen",
        "span.a-price.a-text-price[data-a-strike='true'] .a-offscreen",
        "span.a-text-price .a-offscreen",
    ]
    for sel in selectors:
        for el in soup.select(sel):
            val = _parse_eur(el.get_text(strip=True))
            if val and val > 0:
                if current is None or val > current + 0.01:
                    return val
    return None


def extract_discount_pct(soup: BeautifulSoup) -> int | None:
    """Percentatge de descompte mostrat per Amazon (ex: -25%)."""
    selectors = [
        ".savingsPercentage",
        ".reinventPriceSavingsPercentageMargin",
        "#corePriceDisplay_desktop_feature_div .a-color-price",
        "span[data-a-strike='true'] + span",
    ]
    for sel in selectors:
        for el in soup.select(sel):
            txt = el.get_text(" ", strip=True)
            m = re.search(r"-?\s*(\d{1,2})\s*%", txt)
            if m:
                pct = int(m.group(1))
                if 1 <= pct <= 99:
                    return pct
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

    if current:
        out["precio"] = _euro_str(current)
    if original:
        out["precioOriginal"] = _euro_str(original)

    # Si Amazon no exposa el % però tenim ambdós preus, el calculem
    if discount is None and current and original and original > current:
        discount = round((1 - current / original) * 100)
    if discount and 1 <= discount <= 99:
        out["descuentoPct"] = int(discount)

    if sales:
        out["ventas"] = int(sales)

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

        new_data = fetch_product_data(url, session)

        if not new_data:
            print(f"  -> NO TROBAT (es manté tal qual)")
            failed.append((name, "res trobat"))
        else:
            changed_keys = []
            for k in ("precio", "precioOriginal", "descuentoPct", "ventas"):
                if k in new_data and data.get(k) != new_data[k]:
                    changed_keys.append(
                        f"{k}: {data.get(k, '—')} -> {new_data[k]}"
                    )
                    if not dry_run:
                        data[k] = new_data[k]
            # Si Amazon ja no mostra ofertes, neteja precioOriginal/descuentoPct
            if "precio" in new_data and "precioOriginal" not in new_data:
                if "precioOriginal" in data or "descuentoPct" in data:
                    changed_keys.append("oferta acabada (neteja)")
                    if not dry_run:
                        data.pop("precioOriginal", None)
                        data.pop("descuentoPct", None)

            if changed_keys:
                if not dry_run:
                    save_json(json_path, data)
                print("  -> ACTUALITZAT")
                for line in changed_keys:
                    print(f"     · {line}")
                updated.append((name, changed_keys))
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

    if failed:
        print("\nFallits:")
        for name, reason in failed:
            print(f"  {name}: {reason}")

    if dry_run:
        print("\n[DRY RUN] No s'ha escrit res.")


if __name__ == "__main__":
    main()
