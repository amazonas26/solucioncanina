#!/usr/bin/env python3
"""
Omple el camp `descripcion` dels productes a partir de la pàgina d'Amazon.

Per a cada `src/content/articulos/<slug>/index.json` sense `descripcion`,
visita `linkAmazon` i extreu el bloc "Acerca de este producto"
(`#feature-bullets`). En genera una descripció compacta (1-2 frases) i la
guarda al JSON.

Ús:
    python scripts/fetch_descriptions.py
    python scripts/fetch_descriptions.py --dry-run        # no escriu res
    python scripts/fetch_descriptions.py --only=edipets-* # filtre per slug
    python scripts/fetch_descriptions.py --limit=10       # primers N productes
    python scripts/fetch_descriptions.py --force          # reescriu tot
    python scripts/fetch_descriptions.py --min-len=120    # mínim chars sortida
    python scripts/fetch_descriptions.py --max-len=320    # màxim chars sortida

Inclou:
  - Detecció de CAPTCHA (avorta la fitxa).
  - Pausa aleatòria entre productes.
  - Resum final amb productes omplerts / fallits.
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
}


# ---------------------------------------------------------------------------
# Helpers
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


# Frases promocionals / metadades que descartem de les bullets.
_NOISE_PATTERNS = [
    re.compile(r"^\s*(?:descripción|description)\b[:\-]?", re.IGNORECASE),
    re.compile(r"\b(garantía|warranty)\b.*\b(años?|years?)\b", re.IGNORECASE),
    re.compile(r"\b(envío|delivery)\b.*\b(gratis|free)\b", re.IGNORECASE),
    re.compile(r"\bamazon\s*prime\b", re.IGNORECASE),
    re.compile(r"^[\s•·●▶■\-–—]+$"),
]

# Substitucions per netejar text (eslogans tipogràfics, repeticions).
_REPLACEMENTS = [
    (re.compile(r"\s+"), " "),
    (re.compile(r"\s+([,.;:!?])"), r"\1"),
    (re.compile(r"([.!?]){2,}"), r"\1"),
]

# Emoji / símbols decoratius freqüents al principi de bullets d'Amazon.
_EMOJI_RX = re.compile(
    "["
    "\U0001F300-\U0001F6FF"  # icones, transport, símbols
    "\U0001F900-\U0001F9FF"  # suplementaris
    "\U00002600-\U000027BF"  # misc + dingbats
    "\u2700-\u27BF"
    "✓✔✗✘●▶■□◆★☆♥♦"
    "]+",
    flags=re.UNICODE,
)


def _normalize_caps(text: str) -> str:
    """Si una bullet comença amb un títol majoritàriament en MAJÚSCULES seguit de ':',
    el passa a Sentence case.

    Patrons que ataquem:
      'MATERIAL DE ALTA CALIDAD: la correa…' → 'Material de alta calidad: la correa…'
      'DISEÑO de DOBLE CARA: la espuma…'    → 'Diseño de doble cara: la espuma…'
    Acceptem petites paraules connectores en minúscula (de, y, para, con, …)
    enmig del títol. No tocarem sigles soltes com "CO-Z" perquè exigim ≥ 6 chars.
    """
    if not text or ":" not in text[:120]:
        return text
    head, sep, tail = text.partition(":")
    if not head or not (6 <= len(head) <= 100):
        return text
    # Caràcters invisibles que sovint apareixen davant (ZWJ, NBSP, …).
    if head[0] in "\u200b\u200c\u200d\u2060\ufeff\u00a0":
        head = head.lstrip("\u200b\u200c\u200d\u2060\ufeff\u00a0 ").strip()
        if not head:
            return text
    letters = [c for c in head if c.isalpha()]
    if not letters:
        return text
    if sum(1 for c in letters if c.isupper()) / len(letters) < 0.80:
        return text
    return f"{head.capitalize()}{sep}{tail}"


def _clean(text: str) -> str:
    if not text:
        return ""
    t = text.replace("\u00ad", "")
    # Treu caràcters invisibles al principi (zero-width, NBSP, …) que
    # confonen el normalitzador de majúscules.
    t = t.lstrip("\u200b\u200c\u200d\u2060\ufeff\u00a0 ").strip()
    t = _EMOJI_RX.sub("", t).strip()
    for rx, repl in _REPLACEMENTS:
        t = rx.sub(repl, t)
    t = _normalize_caps(t)
    return t.strip()


def _is_noise(text: str) -> bool:
    if len(text) < 8:
        return True
    for rx in _NOISE_PATTERNS:
        if rx.search(text):
            return True
    return False


def _ensure_terminator(text: str) -> str:
    """Garanteix que el text acaba amb un signe de puntuació final."""
    if not text:
        return text
    if text[-1] not in ".!?":
        return text + "."
    return text


def extract_bullets(soup: BeautifulSoup) -> list[str]:
    """Extreu les bullets "Acerca de este producto" de la pàgina d'Amazon."""
    bullets: list[str] = []
    selectors = (
        "#feature-bullets ul li span.a-list-item",
        "#feature-bullets ul.a-unordered-list li",
        "#productFactsDesktopExpander span.a-list-item",
        "[data-feature-name='featurebullets'] li span.a-list-item",
    )
    seen: set[str] = set()
    for sel in selectors:
        for el in soup.select(sel):
            txt = _clean(el.get_text(" ", strip=True))
            if not txt or _is_noise(txt):
                continue
            key = txt.lower()
            if key in seen:
                continue
            seen.add(key)
            bullets.append(txt)
        if bullets:
            break
    return bullets


def extract_long_description(soup: BeautifulSoup) -> str | None:
    """Fallback: text de #productDescription (alguns productes tenen detall ampliat)."""
    for sel in (
        "#productDescription p",
        "#productDescription_feature_div p",
        "#bookDescription_feature_div noscript",
        "#bookDescription_feature_div",
    ):
        el = soup.select_one(sel)
        if not el:
            continue
        txt = _clean(el.get_text(" ", strip=True))
        if len(txt) >= 60:
            return txt
    return None


def compose_description(bullets: list[str], long_desc: str | None, min_len: int, max_len: int) -> str | None:
    """Compon una descripció final a partir de les bullets / text llarg.

    Estratègia:
      - Si hi ha 1+ bullets, en pren les més "substanciases" i les uneix.
      - Si no hi ha bullets, retalla la descripció llarga.
      - Comprimeix per quedar dins el rang [min_len, max_len] de manera natural.
    """
    if bullets:
        picked: list[str] = []
        total = 0
        for b in bullets:
            b = _ensure_terminator(b)
            if total + len(b) + 1 > max_len:
                if not picked:
                    picked.append(b[: max_len - 1].rstrip() + "…")
                break
            picked.append(b)
            total += len(b) + 1
            if total >= min_len and len(picked) >= 2:
                break
        out = " ".join(picked).strip()
        if len(out) >= 40:
            return out

    if long_desc:
        if len(long_desc) <= max_len:
            return _ensure_terminator(long_desc)
        cut = long_desc[: max_len].rsplit(".", 1)
        head = cut[0] if len(cut[0]) >= min_len else long_desc[: max_len]
        return _ensure_terminator(head.rstrip())

    return None


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def fetch_description(url: str, session: requests.Session, min_len: int, max_len: int) -> str | None:
    try:
        resp = session.get(url, timeout=25)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"    ERROR xarxa: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    if is_captcha(soup):
        print("    ⚠ CAPTCHA d'Amazon, saltant aquest producte")
        return None

    bullets = extract_bullets(soup)
    long_desc = extract_long_description(soup)
    if not bullets and not long_desc:
        return None

    return compose_description(bullets, long_desc, min_len=min_len, max_len=max_len)


# ---------------------------------------------------------------------------
# IO + CLI
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: list[str]) -> dict:
    args = {
        "dry_run": False,
        "force": False,
        "only": None,
        "limit": None,
        "min_len": 180,
        "max_len": 700,
    }
    for a in argv:
        if a == "--dry-run":
            args["dry_run"] = True
        elif a == "--force":
            args["force"] = True
        elif a.startswith("--only="):
            args["only"] = a.split("=", 1)[1]
        elif a.startswith("--limit="):
            try:
                args["limit"] = max(1, int(a.split("=", 1)[1]))
            except ValueError:
                pass
        elif a.startswith("--min-len="):
            try:
                args["min_len"] = max(40, int(a.split("=", 1)[1]))
            except ValueError:
                pass
        elif a.startswith("--max-len="):
            try:
                args["max_len"] = max(80, int(a.split("=", 1)[1]))
            except ValueError:
                pass
    return args


def main():
    args = parse_args(sys.argv[1:])

    products = sorted(ARTICULOS_DIR.glob("*/index.json"))
    if args["only"]:
        rx = re.compile(args["only"].replace("*", ".*"))
        products = [p for p in products if rx.match(p.parent.name)]

    pending: list[Path] = []
    for p in products:
        d = load_json(p)
        if not args["force"] and d.get("descripcion"):
            continue
        if not d.get("linkAmazon"):
            continue
        pending.append(p)

    if args["limit"]:
        pending = pending[: args["limit"]]

    print(f"Trobats {len(products)} productes, {len(pending)} a processar.\n")

    session = requests.Session()
    session.headers.update(HEADERS)

    updated: list[str] = []
    failed: list[tuple[str, str]] = []

    for json_path in pending:
        data = load_json(json_path)
        slug = json_path.parent.name
        url = data["linkAmazon"]

        print(f"[{slug}]")
        print(f"  URL: {url}")
        desc = fetch_description(
            url, session, min_len=args["min_len"], max_len=args["max_len"]
        )
        if not desc:
            print("  -> sense descripció trobada")
            failed.append((slug, "no trobada"))
        else:
            print(f"  -> {len(desc)} chars: {desc[:90]}{'…' if len(desc) > 90 else ''}")
            if not args["dry_run"]:
                data["descripcion"] = desc
                save_json(json_path, data)
            updated.append(slug)

        delay = random.uniform(4, 8)
        print(f"  (esperant {delay:.1f}s…)\n")
        time.sleep(delay)

    print("=" * 60)
    print(f"RESUM: {len(updated)} actualitzats, {len(failed)} sense descripció")
    if failed:
        print("\nSense descripció:")
        for slug, reason in failed:
            print(f"  - {slug}: {reason}")
    if args["dry_run"]:
        print("\n[DRY RUN] No s'ha escrit res al disc.")


if __name__ == "__main__":
    main()
