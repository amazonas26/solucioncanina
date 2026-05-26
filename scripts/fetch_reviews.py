#!/usr/bin/env python3
"""Scraping de reviews REALS d'Amazon.es per cada producte del catàleg.

Per cada `src/content/articulos/<slug>/index.json` amb `linkAmazon` vàlid,
visita el PDP (`/dp/{ASIN}/`) i n'extreu les ~10-13 reviews top que Amazon
mostra inline (sense login). Les guarda a `src/content/articulos/<slug>/reviews.json`.

Nota: la pàgina `/product-reviews/` actual d'Amazon redirigeix a login per a
usuaris anònims. Per això scrappegem del PDP, que mostra reviews destacades
sense login. ~10-13 reviews per producte és suficient per a classificació
i generació editorial groundejada.

Ús:
    python scripts/fetch_reviews.py
    python scripts/fetch_reviews.py --dry-run
    python scripts/fetch_reviews.py --only=slug1,slug2
    python scripts/fetch_reviews.py --limit=10
    python scripts/fetch_reviews.py --force          # ignora cache
    python scripts/fetch_reviews.py --max-age=30     # dies (default 30)
    python scripts/fetch_reviews.py --target=30      # reviews objectiu

Notes:
  - Pauses random entre productes per no acabar amb captcha.
  - Si Amazon respon amb captcha, descansa 60-90s i continua.
  - Idempotent: si reviews.json existeix i és recent, salta el producte.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from _common import extract_asin  # noqa: E402

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": "https://www.amazon.es/",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

CAPTCHA_HINTS = (
    "captcha",
    "type the characters",
    "escribe los caracteres",
    "vuelve a intentarlo",
    "errors/validatecaptcha",
)


def is_captcha(html: str) -> bool:
    sample = html[:6000].lower()
    return any(h in sample for h in CAPTCHA_HINTS)


def parse_stars(text: str) -> float:
    if not text:
        return 0.0
    m = re.search(r"(\d+[\.,]?\d*)", text)
    if not m:
        return 0.0
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return 0.0


def parse_helpful(text: str) -> int:
    if not text:
        return 0
    m = re.search(r"(\d{1,5})", text.replace(".", ""))
    return int(m.group(1)) if m else 0


def parse_review(div) -> dict | None:
    """Extreu una review d'un <div data-hook='review'>.

    Suporta dos formats Amazon: PDP (data-hook="reviewTitle"/reviewText)
    i el clàssic product-reviews (data-hook="review-title"/review-body).
    """
    rating_el = div.select_one(
        '[data-hook="review-star-rating"], [data-hook="cmps-review-star-rating"]'
    )
    stars = parse_stars(rating_el.get_text(" ", strip=True) if rating_el else "")

    # Title: prova primer el PDP, després product-reviews
    title_el = (
        div.select_one('[data-hook="reviewTitle"]')
        or div.select_one('[data-hook="review-title"] span:not([class])')
        or div.select_one('[data-hook="review-title"]')
    )
    title = title_el.get_text(" ", strip=True) if title_el else ""
    title = re.sub(r"^\d[\.,]?\d?\s*de 5 estrellas\s*", "", title, flags=re.IGNORECASE).strip()

    # Body: PDP usa reviewRichContentContainer (text expandit) i reviewText.
    # Prioritzem reviewRichContentContainer perquè conté el text complet.
    body_el = (
        div.select_one('[data-hook="reviewRichContentContainer"]')
        or div.select_one('[data-hook="reviewText"] span')
        or div.select_one('[data-hook="reviewText"]')
        or div.select_one('[data-hook="review-body"] span')
        or div.select_one('[data-hook="review-body"]')
    )
    body = body_el.get_text("\n", strip=True) if body_el else ""
    # Filtra el text d'UI d'Amazon que apareix incrustat ("Brief content visible, double tap...")
    body = re.sub(r"^Brief content visible.+?content\.\s*", "", body, flags=re.IGNORECASE | re.DOTALL)
    body = re.sub(r"\bLeer más\b|\bLeer menos\b", "", body).strip()

    date_el = div.select_one('[data-hook="review-date"]')
    date = date_el.get_text(" ", strip=True) if date_el else ""
    helpful_el = div.select_one('[data-hook="helpful-vote-statement"]')
    helpful = parse_helpful(helpful_el.get_text() if helpful_el else "")
    verified = bool(div.select_one('[data-hook="avp-badge"]'))
    if not (body or title):
        return None
    return {
        "stars": stars,
        "title": title,
        "body": body,
        "date": date,
        "helpful": helpful,
        "verified": verified,
    }


def fetch_reviews_for(asin: str, target: int, delay_min: float, delay_max: float) -> tuple[list[dict] | None, str]:
    """Retorna (reviews | None, status). status ∈ {ok, captcha, empty}

    Scrappeja el PDP (/dp/{ASIN}/) que mostra ~10-13 reviews top sense login.
    `target` és el límit superior; si el producte té menys reviews, retornem
    el que hi hagi.
    """
    session = requests.Session()
    url = f"https://www.amazon.es/dp/{asin}/"
    try:
        r = session.get(url, headers=HEADERS, timeout=25)
    except requests.RequestException:
        return [], "empty"
    if r.status_code != 200:
        return [], "empty"
    html = r.text
    if is_captcha(html):
        return None, "captcha"

    soup = BeautifulSoup(html, "html.parser")
    out: list[dict] = []
    seen: set[str] = set()
    for div in soup.select('[data-hook="review"]'):
        try:
            rv = parse_review(div)
        except Exception:
            continue
        if not rv:
            continue
        key = (rv["body"] or rv["title"])[:120]
        if key in seen:
            continue
        seen.add(key)
        out.append(rv)
        if len(out) >= target:
            break
    # Petita pausa per gentilesa fins i tot si només una crida
    time.sleep(random.uniform(delay_min, delay_max))
    if not out:
        return [], "empty"
    return out, "ok"


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--only", default=None, help="Slugs separats per coma")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--force", action="store_true", help="Re-fetch tot ignorant cache")
    p.add_argument("--max-age", type=int, default=30, help="Dies de cache (default 30)")
    p.add_argument("--target", type=int, default=30, help="Reviews objectiu per producte")
    p.add_argument("--delay-min", type=float, default=2.5)
    p.add_argument("--delay-max", type=float, default=5.5)
    p.add_argument("--product-delay-min", type=float, default=4.0)
    p.add_argument("--product-delay-max", type=float, default=9.0)
    return p.parse_args(argv)


def main(argv):
    args = parse_args(argv)
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    now = time.time()
    cache_secs = args.max_age * 86400

    items = []
    for d in sorted(ARTICULOS_DIR.iterdir()):
        if not d.is_dir():
            continue
        if only and d.name not in only:
            continue
        items.append(d)
    if args.limit:
        items = items[: args.limit]

    print(f"Productes a processar: {len(items)}")
    stats = {"ok": 0, "captcha": 0, "empty": 0, "skipped_cache": 0, "no_asin": 0, "fail": 0}

    for idx, d in enumerate(items, 1):
        jf = d / "index.json"
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[{idx}/{len(items)}] {d.name} · ❌ JSON invàlid: {e}")
            stats["fail"] += 1
            continue

        asin = extract_asin(data.get("linkAmazon", ""))
        if not asin:
            print(f"[{idx}/{len(items)}] {d.name} · ⚠ sense ASIN")
            stats["no_asin"] += 1
            continue

        rf = d / "reviews.json"
        if rf.exists() and not args.force:
            age = now - rf.stat().st_mtime
            if age < cache_secs:
                print(f"[{idx}/{len(items)}] {d.name} · ⏭  cache fresca ({age/86400:.1f}d)")
                stats["skipped_cache"] += 1
                continue

        print(f"[{idx}/{len(items)}] {d.name} · ASIN {asin} ...", end=" ", flush=True)
        if args.dry_run:
            print("(dry-run)")
            continue

        reviews, status = fetch_reviews_for(
            asin, target=args.target,
            delay_min=args.delay_min, delay_max=args.delay_max,
        )
        if status == "captcha":
            print("🛑 CAPTCHA — descans llarg")
            stats["captcha"] += 1
            time.sleep(random.uniform(60, 90))
            continue
        if status == "empty" or not reviews:
            print("⚠ buit")
            stats["empty"] += 1
            continue

        payload = {
            "asin": asin,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "amazon.es/product-reviews",
            "count": len(reviews),
            "reviews": reviews,
        }
        rf.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"✓ {len(reviews)} reviews")
        stats["ok"] += 1
        time.sleep(random.uniform(args.product_delay_min, args.product_delay_max))

    print("\n=== Resum ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main(sys.argv[1:])
