#!/usr/bin/env python3
"""Busca listados/roundups de blogs de perros y extrae datos de contacto.

Dado un listado de queries, consulta el buscador, toma los primeros N
resultados de cada una y visita cada URL para comprobar:

  1. Si menciona solucioncanina.es → se descarta (ya nos enlazan).
  2. Si hay email visible y/o página de contacto.
  3. Título y fecha del artículo, si se pueden detectar.

NO envía correos ni formularios: solo investiga y vuelca candidatos a CSV.

Uso:
    python scripts/buscar_roundups.py
    python scripts/buscar_roundups.py -q "mejores blogs de perros" -q "blogs sobre perros recomendados"
    python scripts/buscar_roundups.py --queries-file scratch/queries.txt
    python scripts/buscar_roundups.py --urls-file scratch/urls.txt
    python scripts/buscar_roundups.py --engine yahoo --top 20
    python scripts/buscar_roundups.py --resume

Por defecto intenta Google (y Programmable Search si hay GOOGLE_CSE_KEY +
GOOGLE_CSE_ID). Si Google responde captcha, consentimiento o un muro JS,
pasa a DuckDuckGo HTML, Yahoo y, en último término, Bing. Descarta SERPs que no
encajan con la query (Bing a veces sirve rankings irrelevantes a scripts).
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import random
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import (
    parse_qs,
    parse_qsl,
    unquote,
    urlencode,
    urljoin,
    urlparse,
    urlunparse,
)

import requests
from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "scratch"
DEFAULT_OUT = SCRATCH / "roundups.csv"
OUR_DOMAIN = "solucioncanina.es"

DEFAULT_QUERIES = [
    "mejores blogs de perros",
    "blogs sobre perros recomendados",
    "mejores blogs de perros España",
    "mejores blogs caninos",
    "mejores webs de perros",
    "blogs de perros que seguir",
    "mejores blogs de mascotas España",
    "listado de blogs de perros",
    "mejores blogs adiestramiento de perros",
    "mejores blogs veterinarios perros",
]

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.4",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

# Hosts que nunca son un roundup al que escribir.
_DENY_HOSTS = {
    "google.com",
    "google.es",
    "googleapis.com",
    "gstatic.com",
    "googleusercontent.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "fb.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "t.co",
    "tiktok.com",
    "pinterest.com",
    "pinterest.es",
    "amazon.com",
    "amazon.es",
    "amzn.eu",
    "amzn.to",
    "wikipedia.org",
    "wikimedia.org",
    "linkedin.com",
    "reddit.com",
    "apple.com",
    "play.google.com",
    "maps.google.com",
    "support.google.com",
    "accounts.google.com",
    "duckduckgo.com",
    "bing.com",
    "microsoft.com",
    "yahoo.com",
    "yandex.com",
    "yandex.ru",
    "baidu.com",
    "threads.net",
    "whatsapp.com",
    "t.me",
}

_TRACKING_PARAMS = {
    "fbclid",
    "gclid",
    "gbraid",
    "wbraid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "si",
    "spm",
    "ref",
    "ref_src",
    "ref_url",
    "feature",
    "ved",
    "usg",
    "sa",
    "source",
    "ei",
    "gs_lcrp",
    "sca_esv",
}

EMAIL_RE = re.compile(
    r"(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._%+\-])"
    r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,24}"
)
OBFUSCATED_EMAIL_RE = re.compile(
    r"([a-zA-Z0-9._%+\-]{1,64})\s*(?:\[at\]|\(at\)|\s+at\s+)\s*"
    r"([a-zA-Z0-9.\-]{1,64})\s*(?:\[dot\]|\(dot\)|\s+dot\s+|\.)\s*"
    r"([a-zA-Z]{2,24})",
    re.IGNORECASE,
)
OUR_MENTION_RE = re.compile(r"solucioncanina(?:\.es|%2e(?:es))", re.IGNORECASE)
CFEMAIL_RE = re.compile(r"\bdata-cfemail=[\"']([0-9a-fA-F]+)[\"']")

_EMAIL_JUNK_NEEDLES = (
    "example.com",
    "example.net",
    "domain.net",
    "ejemplo.com",
    "email.com",
    "domain.com",
    "tudominio.com",
    "yourdomain",
    "sentry.io",
    "wixpress.com",
    "cloudflare.com",
    "localhost",
    "schema.org",
    "w3.org",
    "googleapis.com",
    "google.com",
    "gstatic.com",
    "wordpress@",
    "noreply@",
    "no-reply@",
    "donotreply@",
    "mailer-daemon@",
    "privacy@godaddy",
    "support@squarespace",
)
_EMAIL_BAD_TLDS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".woff", ".mp4"}

_CONTACT_HINTS = (
    "contacto",
    "contactanos",
    "contáctanos",
    "contactar",
    "contact-us",
    "contact_us",
    "contacte",
    "kontakt",
)
_LEGAL_HINTS = (
    "aviso-legal",
    "avisolegal",
    "aviso_legal",
    "legal",
    "impressum",
    "privacidad",
    "privacy",
    "politica-de-privacidad",
    "cookies",
)
_ABOUT_HINTS = (
    "sobre-nosotros",
    "sobre_nosotros",
    "quienes-somos",
    "quiénes-somos",
    "about",
    "acerca",
    "colabora",
    "colaboraciones",
    "publicidad",
    "advertise",
    "media-kit",
    "mediakit",
    "escribe",
    "guest-post",
    "guestpost",
)
_OUTREACH_HINTS = (
    "colabora",
    "colaboraciones",
    "guest post",
    "guest-post",
    "escribe para nosotros",
    "escribe-para",
    "propuesta de post",
    "publicidad",
    "patrocinio",
    "media kit",
    "mediakit",
    "sponsored",
    "branded content",
)

_FALLBACK_CONTACT_PATHS = (
    "/contacto",
    "/contact",
    "/contactanos",
    "/contáctanos",
    "/contactar",
    "/sobre-nosotros",
    "/quienes-somos",
    "/aviso-legal",
    "/politica-de-privacidad",
    "/about",
    "/about-us",
    "/advertise",
    "/colaboraciones",
    "/publicidad",
)

_MESES = {
    "enero": 1,
    "ene": 1,
    "january": 1,
    "jan": 1,
    "febrero": 2,
    "feb": 2,
    "february": 2,
    "marzo": 3,
    "mar": 3,
    "march": 3,
    "abril": 4,
    "abr": 4,
    "april": 4,
    "apr": 4,
    "mayo": 5,
    "may": 5,
    "junio": 6,
    "jun": 6,
    "june": 6,
    "julio": 7,
    "jul": 7,
    "july": 7,
    "agosto": 8,
    "ago": 8,
    "august": 8,
    "aug": 8,
    "septiembre": 9,
    "setiembre": 9,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "octubre": 10,
    "oct": 10,
    "october": 10,
    "noviembre": 11,
    "nov": 11,
    "november": 11,
    "diciembre": 12,
    "dic": 12,
    "dec": 12,
    "december": 12,
}

_SPANISH_DATE_RE = re.compile(
    r"\b(\d{1,2})\s+de\s+"
    r"(enero|febrero|marzo|abril|mayo|junio|julio|agosto|"
    r"septiembre|setiembre|octubre|noviembre|diciembre)"
    r"\s+(?:de\s+)?(\d{4})\b",
    re.IGNORECASE,
)
_NUMERIC_DATE_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b")
_ISO_DATE_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})(?:[T\s]|$)")

_SKIP_SERP_TITLES = {
    "cached",
    "en caché",
    "en cache",
    "similar",
    "traducir esta página",
    "translate this page",
    "más imágenes",
    "more images",
}


class SearchBlocked(RuntimeError):
    """El buscador devolvió captcha, consentimiento o HTML vacío."""


@dataclass
class SerpHit:
    query: str
    position: int
    url: str
    title: str
    engine: str


@dataclass
class PageInfo:
    url: str
    domain: str
    title: str = ""
    date: str = ""
    emails: list[str] = field(default_factory=list)
    contact_page: str = ""
    already_links_us: bool = False
    notes: list[str] = field(default_factory=list)
    fetch_error: str = ""


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    s.cookies.set("CONSENT", "YES+", domain=".google.com")
    s.cookies.set(
        "SOCS",
        "CAISNQgQEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwNTI5LjA2X3AxGgJlbiACGgYIgML-sgY",
        domain=".google.com",
    )
    s.cookies.set("CONSENT", "YES+", domain=".google.es")
    return s


def pause(lo: float, hi: float) -> None:
    time.sleep(random.uniform(lo, hi))


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def fetch_html(
    session: requests.Session,
    url: str,
    *,
    timeout: float = 22,
    referer: str | None = None,
) -> tuple[str, str, str]:
    """Devuelve (url_final, html, error). error vacío si OK."""
    headers = {}
    if referer:
        headers["Referer"] = referer
    try:
        resp = session.get(
            url,
            timeout=timeout,
            headers=headers,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        return url, "", f"red: {e.__class__.__name__}"
    final = resp.url or url
    ctype = (resp.headers.get("Content-Type") or "").lower()
    if "pdf" in ctype or urlparse(final).path.lower().endswith(".pdf"):
        return final, "", "pdf"
    if resp.status_code >= 400:
        return final, "", f"http {resp.status_code}"
    if "html" not in ctype and "xml" not in ctype and "text/" not in ctype and ctype:
        return final, "", f"content-type {ctype.split(';')[0]}"
    raw = resp.content[: 2_500_000]
    html = raw.decode(resp.apparent_encoding or "utf-8", errors="replace")
    return final, html, ""


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------


def host_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "@" in host:
        host = host.rsplit("@", 1)[-1]
    if ":" in host:
        host = host.split(":", 1)[0]
    return host.removeprefix("www.")


def is_denied_host(host: str) -> bool:
    h = host.lower().removeprefix("www.")
    if h == OUR_DOMAIN or h.endswith("." + OUR_DOMAIN):
        return True
    if h in _DENY_HOSTS:
        return True
    return any(h.endswith("." + d) for d in _DENY_HOSTS)


def clean_url(url: str) -> str:
    url = unescape(url.strip())
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return url
    qs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    path = parsed.path or "/"
    return urlunparse(
        (parsed.scheme, parsed.netloc.lower(), path, "", urlencode(qs), "")
    )


def dedup_key(url: str) -> str:
    parsed = urlparse(clean_url(url))
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.rstrip("/") or "/"
    return f"{host}{path}".lower()


def unwrap_google_href(href: str) -> str | None:
    href = unescape(href.strip())
    if href.startswith("/url?"):
        qs = parse_qs(urlparse("https://www.google.com" + href).query)
        target = (qs.get("q") or qs.get("url") or [""])[0]
        return unquote(target) if target else None
    if href.startswith("/search") or href.startswith("/sorry"):
        return None
    if href.startswith("http"):
        return href
    return None


def unwrap_bing_href(href: str) -> str | None:
    href = unescape(href.strip())
    if href.startswith("/"):
        href = "https://www.bing.com" + href
    parsed = urlparse(href)
    if "bing.com" in parsed.netloc and (parsed.path.startswith("/ck/") or "u=" in parsed.query):
        u = (parse_qs(parsed.query).get("u") or [""])[0]
        if not u:
            return None
        raw = u[2:] if u.startswith("a1") else u
        pad = "=" * ((4 - len(raw) % 4) % 4)
        try:
            decoded = base64.urlsafe_b64decode(raw + pad).decode("utf-8", errors="replace")
        except (ValueError, UnicodeDecodeError):
            decoded = unquote(u)
        if decoded.startswith("http"):
            return decoded
        if "http" in decoded:
            return decoded[decoded.index("http") :]
        return None
    if href.startswith("http"):
        return href
    return None


def unwrap_ddg_href(href: str) -> str | None:
    href = unescape(href.strip())
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    if "duckduckgo.com" in parsed.netloc and "uddg=" in parsed.query:
        qs = parse_qs(parsed.query)
        if qs.get("uddg"):
            return unquote(qs["uddg"][0])
    if href.startswith("http"):
        return href
    return None


def unwrap_yahoo_href(href: str) -> str | None:
    href = unescape(href.strip())
    if "r.search.yahoo.com" in href:
        m = re.search(r"/RU=([^/]+)/", href)
        if m:
            return unquote(m.group(1))
        qs = parse_qs(urlparse(href).query)
        if qs.get("RU"):
            return unquote(qs["RU"][0])
        return None
    parsed = urlparse(href)
    if href.startswith("http") and "yahoo.com" not in parsed.netloc and "yahoo.net" not in parsed.netloc:
        return href
    return None


_QUERY_STOPWORDS = {
    "mejores",
    "mejor",
    "sobre",
    "para",
    "como",
    "cómo",
    "que",
    "qué",
    "los",
    "las",
    "una",
    "unos",
    "unas",
    "del",
    "por",
    "con",
    "más",
    "mas",
    "recomendados",
    "recomendadas",
    "recomendado",
    "listado",
    "lista",
    "seguir",
    "espanol",
    "español",
}


def query_tokens(query: str) -> list[str]:
    return [
        t
        for t in re.split(r"\W+", query.lower())
        if len(t) >= 4 and t not in _QUERY_STOPWORDS
    ]


def results_look_relevant(query: str, results: list[tuple[str, str]]) -> bool:
    """Rechaza SERPs basura (p. ej. Bing sirviendo rankings de cine a un bot)."""
    tokens = query_tokens(query)
    if not tokens or not results:
        return bool(results)
    n = min(len(results), 8)
    hits = 0
    for url, title in results[:n]:
        blob = f"{title} {url}".lower()
        if any(t in blob for t in tokens):
            hits += 1
    return hits >= max(1, (n + 2) // 3)


def looks_like_result_url(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False
    host = host_of(url)
    if not host or is_denied_host(host):
        return False
    low = url.lower()
    if any(
        s in low
        for s in (
            "google.com/aclk",
            "googleadservices",
            "doubleclick",
            "google.com/search",
            "policies.google",
        )
    ):
        return False
    return True


# ---------------------------------------------------------------------------
# Parsers de SERP
# ---------------------------------------------------------------------------


def _google_kind(html: str, url: str) -> str:
    """consent | captcha | js-wall | ok"""
    low_url = url.lower()
    low = html.lower()
    if "consent.google.com" in low_url or "antes de ir a google" in low or "antes de ir a la búsqueda" in low:
        return "consent"
    if "/sorry/" in low_url or "sorry/index" in low_url:
        return "captcha"
    markers = (
        "unusual traffic",
        "tráfico inusual",
        "detected unusual",
        "no soy un robot",
        "our systems have detected",
    )
    if any(m in low for m in markers):
        return "captcha"
    if "enablejs" in low and html.count("href=") < 15:
        return "js-wall"
    title = ""
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if m:
        title = m.group(1).strip().lower()
    if title in {"google search", "google"} and html.count("href=") < 15:
        return "js-wall"
    return "ok"


def accept_google_consent(session: requests.Session, html: str) -> bool:
    soup = soup_of(html)
    form = None
    for f in soup.find_all("form", action=True):
        action = str(f.get("action") or "")
        if "consent.google.com/save" not in action:
            continue
        if f.find("input", attrs={"name": "set_eom", "value": "true"}):
            form = f
            break
        form = f
    if not isinstance(form, Tag):
        return False
    data = {
        str(inp.get("name")): str(inp.get("value") or "")
        for inp in form.find_all("input")
        if inp.get("name")
    }
    action = urljoin("https://consent.google.com/", str(form.get("action")))
    try:
        session.post(action, data=data, timeout=25, allow_redirects=True)
    except requests.RequestException:
        return False
    return True


def parse_google_results(html: str) -> list[tuple[str, str]]:
    soup = soup_of(html)
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(href: str | None, title: str) -> None:
        if not href:
            return
        url = unwrap_google_href(href) or (href if href.startswith("http") else None)
        if not url or not looks_like_result_url(url):
            return
        title = re.sub(r"\s+", " ", title or "").strip()
        if title.lower() in _SKIP_SERP_TITLES:
            return
        if len(title) < 4:
            return
        key = dedup_key(url)
        if key in seen:
            return
        seen.add(key)
        out.append((clean_url(url), title))

    for block in soup.select("div.yuRUbf"):
        a = block.find("a", href=True)
        if not isinstance(a, Tag):
            continue
        h3 = block.find("h3")
        title = h3.get_text(" ", strip=True) if h3 else a.get_text(" ", strip=True)
        add(str(a.get("href") or ""), title)

    for h3 in soup.select("a h3"):
        a = h3.find_parent("a")
        if not isinstance(a, Tag):
            continue
        add(str(a.get("href") or ""), h3.get_text(" ", strip=True))

    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag):
            continue
        href = str(a.get("href") or "")
        if not (href.startswith("/url?") or "url?q=" in href):
            continue
        title = a.get_text(" ", strip=True)
        if title.lower().startswith("http") or "." in title and " " not in title:
            parent = a.find_parent("div") or a.find_parent("td")
            if parent:
                h3 = parent.find("h3")
                if h3:
                    title = h3.get_text(" ", strip=True)
        add(href, title)

    return out


def parse_bing_results(html: str) -> list[tuple[str, str]]:
    soup = soup_of(html)
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for li in soup.select("li.b_algo"):
        a = li.select_one("h2 a[href], h2 a")
        if not isinstance(a, Tag):
            a = li.find("a", href=True)
        if not isinstance(a, Tag):
            continue
        href = unwrap_bing_href(str(a.get("href") or "")) or ""
        title = a.get_text(" ", strip=True)
        if not looks_like_result_url(href):
            continue
        key = dedup_key(href)
        if key in seen:
            continue
        seen.add(key)
        out.append((clean_url(href), title))
    return out


def parse_ddg_results(html: str) -> list[tuple[str, str]]:
    soup = soup_of(html)
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select("a.result__a, a.result-link"):
        if not isinstance(a, Tag):
            continue
        parent_classes = " ".join(a.find_parent("div").get("class", []) if a.find_parent("div") else [])
        if "result--ad" in parent_classes:
            continue
        href = unwrap_ddg_href(str(a.get("href") or ""))
        title = a.get_text(" ", strip=True)
        if not href or not looks_like_result_url(href):
            continue
        key = dedup_key(href)
        if key in seen:
            continue
        seen.add(key)
        out.append((clean_url(href), title))
    return out


def _clean_yahoo_title(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if " › " in text:
        text = text.split(" › ")[-1].strip()
        m = re.search(r"[A-ZÁÉÍÓÚÑÜ¿¡].{8,}$", text)
        if m:
            text = m.group(0)
    m = re.match(r"^(?:https?://)?(?:www\.)?[\w.-]+\.[a-z]{2,}\s+(.+)$", text, re.I)
    if m:
        text = m.group(1).strip()
    return text.strip(" -–—|")


def parse_yahoo_results(html: str) -> list[tuple[str, str]]:
    soup = soup_of(html)
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select("ol.searchCenterMiddle h3 a, .dd.algo h3 a"):
        if not isinstance(a, Tag):
            continue
        href = unwrap_yahoo_href(str(a.get("href") or ""))
        title = _clean_yahoo_title(a.get_text(" ", strip=True))
        if not href or not looks_like_result_url(href):
            continue
        key = dedup_key(href)
        if key in seen:
            continue
        seen.add(key)
        out.append((clean_url(href), title))
    return out


# ---------------------------------------------------------------------------
# Buscadores
# ---------------------------------------------------------------------------


def search_google_cse(
    session: requests.Session, query: str, top: int, api_key: str, cx: str
) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    start = 1
    while len(out) < top and start <= 21:
        num = min(10, top - len(out))
        try:
            resp = session.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": api_key,
                    "cx": cx,
                    "q": query,
                    "num": num,
                    "start": start,
                    "hl": "es",
                    "gl": "es",
                    "safe": "off",
                },
                timeout=25,
            )
        except requests.RequestException as e:
            raise SearchBlocked(f"CSE red: {e}") from e
        if resp.status_code >= 400:
            raise SearchBlocked(f"CSE http {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        items = data.get("items") or []
        if not items:
            break
        for item in items:
            link = item.get("link") or ""
            title = item.get("title") or ""
            if not looks_like_result_url(link):
                continue
            key = dedup_key(link)
            if key in seen:
                continue
            seen.add(key)
            out.append((clean_url(link), title))
            if len(out) >= top:
                break
        start += 10
        if len(out) < top:
            pause(0.4, 0.9)
    return out


def search_google(session: requests.Session, query: str, top: int) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    start = 0
    consented = False
    while len(out) < top and start < 40:
        url = "https://www.google.com/search"
        params = {
            "q": query,
            "num": 10,
            "hl": "es",
            "gl": "es",
            "pws": "0",
            "gbv": "1",
            "filter": "0",
            "start": start,
        }
        try:
            resp = session.get(
                url,
                params=params,
                timeout=25,
                headers={"Referer": "https://www.google.com/"},
            )
        except requests.RequestException as e:
            raise SearchBlocked(f"Google red: {e}") from e
        html = resp.text
        kind = _google_kind(html, resp.url)
        if kind == "consent" and not consented:
            if accept_google_consent(session, html):
                consented = True
                pause(0.6, 1.2)
                continue
            raise SearchBlocked("Google consentimiento")
        if kind == "captcha":
            raise SearchBlocked("Google captcha")
        if kind == "js-wall":
            raise SearchBlocked("Google exige JavaScript (muro anti-bot)")
        page = parse_google_results(html)
        if not page:
            if start == 0:
                raise SearchBlocked("Google no devolvió resultados parseables")
            break
        added = 0
        for link, title in page:
            key = dedup_key(link)
            if key in seen:
                continue
            seen.add(key)
            out.append((link, title))
            added += 1
            if len(out) >= top:
                break
        if added == 0:
            break
        start += 10
        if len(out) < top:
            pause(1.5, 3.0)
    if not results_look_relevant(query, out):
        raise SearchBlocked("Google devolvió resultados irrelevantes")
    return out[:top]


def search_bing(session: requests.Session, query: str, top: int) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    first = 1
    while len(out) < top and first <= 41:
        try:
            resp = session.get(
                "https://www.bing.com/search",
                params={
                    "q": query,
                    "count": 10,
                    "first": first,
                    "setlang": "es",
                    "cc": "ES",
                },
                timeout=25,
                headers={"Referer": "https://www.bing.com/"},
            )
        except requests.RequestException as e:
            raise SearchBlocked(f"Bing red: {e}") from e
        html = resp.text
        low = html.lower()
        if "captcha" in low and html.count("b_algo") < 2:
            raise SearchBlocked("Bing captcha")
        page = parse_bing_results(html)
        if not page:
            if first == 1:
                raise SearchBlocked("Bing no devolvió resultados parseables")
            break
        added = 0
        for link, title in page:
            key = dedup_key(link)
            if key in seen:
                continue
            seen.add(key)
            out.append((link, title))
            added += 1
            if len(out) >= top:
                break
        if added == 0:
            break
        first += 10
        if len(out) < top:
            pause(1.2, 2.5)
    if not results_look_relevant(query, out):
        raise SearchBlocked("Bing devolvió resultados irrelevantes")
    return out[:top]


def _ddg_next_form(html: str) -> dict[str, str] | None:
    soup = soup_of(html)
    for form in soup.select("div.nav-link form"):
        btn = form.find("input", attrs={"type": "submit"})
        value = str(btn.get("value") or "").lower() if isinstance(btn, Tag) else ""
        if value not in {"next", "siguiente"}:
            continue
        data = {
            str(inp.get("name")): str(inp.get("value") or "")
            for inp in form.find_all("input")
            if inp.get("name")
        }
        if data:
            return data
    return None


def search_ddg(session: requests.Session, query: str, top: int) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    data: dict[str, str] = {"q": query, "kl": "es-es"}
    url = "https://html.duckduckgo.com/html/"
    pages = 0
    while len(out) < top and pages < 5:
        try:
            resp = session.post(
                url,
                data=data,
                timeout=25,
                headers={"Referer": "https://html.duckduckgo.com/html/"},
            )
        except requests.RequestException as e:
            raise SearchBlocked(f"DuckDuckGo red: {e}") from e
        html = resp.text
        low = html.lower()
        if "anomaly.js" in low or "unfortunately, bots" in low:
            raise SearchBlocked("DuckDuckGo anti-bot")
        page = parse_ddg_results(html)
        if not page:
            if pages == 0:
                raise SearchBlocked("DuckDuckGo no devolvió resultados parseables")
            break
        added = 0
        for link, title in page:
            key = dedup_key(link)
            if key in seen:
                continue
            seen.add(key)
            out.append((link, title))
            added += 1
            if len(out) >= top:
                break
        if added == 0:
            break
        nxt = _ddg_next_form(html)
        if not nxt:
            break
        data = nxt
        pages += 1
        if len(out) < top:
            pause(1.2, 2.5)
    if not results_look_relevant(query, out):
        raise SearchBlocked("DuckDuckGo devolvió resultados irrelevantes")
    return out[:top]


def search_yahoo(session: requests.Session, query: str, top: int) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    start = 1
    pages = 0
    empty_retries = 0
    while len(out) < top and pages < 6:
        try:
            resp = session.get(
                "https://es.search.yahoo.com/search",
                params={"p": query, "n": 7, "b": start},
                timeout=25,
                headers={"Referer": "https://es.search.yahoo.com/"},
            )
        except requests.RequestException as e:
            raise SearchBlocked(f"Yahoo red: {e}") from e
        page = parse_yahoo_results(resp.text)
        if not page:
            if pages == 0 and empty_retries < 2:
                empty_retries += 1
                pause(8.0, 14.0)
                continue
            if pages == 0:
                raise SearchBlocked("Yahoo no devolvió resultados parseables")
            break
        added = 0
        for link, title in page:
            key = dedup_key(link)
            if key in seen:
                continue
            seen.add(key)
            out.append((link, title))
            added += 1
            if len(out) >= top:
                break
        if added == 0:
            break
        start += max(added, 7)
        pages += 1
        if len(out) < top:
            pause(1.0, 2.0)
    if not results_look_relevant(query, out):
        raise SearchBlocked("Yahoo devolvió resultados irrelevantes")
    return out[:top]


def search_query(
    session: requests.Session,
    query: str,
    top: int,
    engine: str,
) -> tuple[str, list[tuple[str, str]]]:
    """Devuelve (motor_usado, resultados)."""
    cse_key = os.environ.get("GOOGLE_CSE_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    cse_id = os.environ.get("GOOGLE_CSE_ID") or os.environ.get("GOOGLE_CX") or ""

    order: list[str]
    if engine == "auto":
        order = ["cse", "google", "ddg", "yahoo", "bing"] if (cse_key and cse_id) else ["google", "ddg", "yahoo", "bing"]
    elif engine == "google":
        order = ["cse", "google"] if (cse_key and cse_id) else ["google"]
    else:
        order = [engine]

    errors: list[str] = []
    for name in order:
        try:
            if name == "cse":
                if not (cse_key and cse_id):
                    continue
                hits = search_google_cse(session, query, top, cse_key, cse_id)
                used = "google-cse"
            elif name == "google":
                hits = search_google(session, query, top)
                used = "google"
            elif name == "bing":
                hits = search_bing(session, query, top)
                used = "bing"
            elif name == "yahoo":
                hits = search_yahoo(session, query, top)
                used = "yahoo"
            elif name == "ddg":
                hits = search_ddg(session, query, top)
                used = "ddg"
            else:
                continue
        except SearchBlocked as e:
            errors.append(f"{name}: {e}")
            print(f"    ⚠ {name} falló ({e})", flush=True)
            continue
        if hits:
            if not results_look_relevant(query, hits):
                errors.append(f"{name}: resultados irrelevantes")
                print(f"    ⚠ {name} falló (resultados irrelevantes)", flush=True)
                continue
            return used, hits
        errors.append(f"{name}: 0 resultados")
    raise SearchBlocked("; ".join(errors) or "ningún motor disponible")


# ---------------------------------------------------------------------------
# Extracción de la página
# ---------------------------------------------------------------------------


def decode_cfemail(hexstr: str) -> str | None:
    try:
        data = bytes.fromhex(hexstr)
    except ValueError:
        return None
    if len(data) < 2:
        return None
    key = data[0]
    return "".join(chr(b ^ key) for b in data[1:])


def is_junk_email(addr: str) -> bool:
    a = addr.strip().lower()
    if a.count("@") != 1:
        return True
    local, _, domain = a.partition("@")
    if len(local) < 1 or "." not in domain:
        return True
    if any(a.endswith(t) for t in _EMAIL_BAD_TLDS):
        return True
    if any(n in a for n in _EMAIL_JUNK_NEEDLES):
        return True
    if len(local) < 2:
        return True
    if local in {"user", "name", "email", "username", "nombre", "tu-email", "tucorreo", "correo", "example"}:
        return True
    if domain.endswith(".png") or domain.endswith(".jpg"):
        return True
    return False


def normalize_email(addr: str) -> str:
    return unescape(addr).strip().strip(".,;:()<>[]").lower()


def emails_from_mailto(href: str) -> list[str]:
    if not href.lower().startswith("mailto:"):
        return []
    rest = unescape(href[7:])
    rest = rest.split("?", 1)[0]
    found = []
    for part in re.split(r"[;,]", rest):
        part = normalize_email(part)
        if "@" in part and not is_junk_email(part):
            found.append(part)
    return found


def extract_emails(html: str, soup: BeautifulSoup) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    def add(addr: str) -> None:
        addr = normalize_email(addr)
        if not addr or is_junk_email(addr) or addr in seen:
            return
        seen.add(addr)
        found.append(addr)

    for a in soup.select("a[href^='mailto:'], a[href^='MAILTO:']"):
        for e in emails_from_mailto(str(a.get("href") or "")):
            add(e)

    for m in CFEMAIL_RE.finditer(html):
        decoded = decode_cfemail(m.group(1))
        if decoded:
            add(decoded)

    # Quitar scripts/styles para no coger emails de JS de tracking.
    text_soup = soup_of(html)
    for tag in text_soup(["script", "style", "noscript"]):
        tag.decompose()
    text = text_soup.get_text(" ", strip=True)

    for m in EMAIL_RE.finditer(html):
        add(m.group(0))
    for m in EMAIL_RE.finditer(text):
        add(m.group(0))
    for m in OBFUSCATED_EMAIL_RE.finditer(text):
        add(f"{m.group(1)}@{m.group(2)}.{m.group(3)}")

    return found


def _href_blob(href: str, text: str) -> str:
    return f"{unquote(href)} {text}".lower()


def contact_score(href: str, text: str) -> int:
    blob = _href_blob(href, text)
    path = urlparse(href).path.lower()
    if any(h in blob or h in path for h in _CONTACT_HINTS):
        return 3
    if any(h in path for h in _LEGAL_HINTS):
        return 2
    if any(h in blob or h in path for h in _ABOUT_HINTS):
        return 1
    return 0


def extract_contact_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    base_host = host_of(base_url)
    scored: list[tuple[int, str]] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        if not isinstance(a, Tag):
            continue
        href = str(a.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        abs_url = clean_url(urljoin(base_url, href))
        if host_of(abs_url) != base_host:
            continue
        text = a.get_text(" ", strip=True)
        score = contact_score(abs_url, text)
        if score <= 0:
            continue
        key = dedup_key(abs_url)
        if key in seen or key == dedup_key(base_url):
            continue
        seen.add(key)
        scored.append((score, abs_url))
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    return [u for _, u in scored]


def walk_jsonld(node: Any, acc: list[dict[str, Any]]) -> None:
    if isinstance(node, list):
        for item in node:
            walk_jsonld(item, acc)
        return
    if not isinstance(node, dict):
        return
    acc.append(node)
    if "@graph" in node:
        walk_jsonld(node["@graph"], acc)
    for key in ("itemListElement", "mainEntity", "about"):
        if key in node:
            walk_jsonld(node[key], acc)


def jsonld_blocks(soup: BeautifulSoup) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            try:
                data = json.loads(re.sub(r",\s*}", "}", raw))
            except json.JSONDecodeError:
                continue
        walk_jsonld(data, blocks)
    return blocks


def extract_title(soup: BeautifulSoup) -> str:
    for sel, attr in (
        ("meta[property='og:title']", "content"),
        ("meta[name='twitter:title']", "content"),
        ("meta[name='title']", "content"),
    ):
        tag = soup.select_one(sel)
        if tag and tag.get(attr):
            t = str(tag.get(attr)).strip()
            if t:
                return re.sub(r"\s+", " ", t)
    for block in jsonld_blocks(soup):
        for key in ("headline", "name"):
            val = block.get(key)
            if isinstance(val, str) and len(val.strip()) > 3:
                return re.sub(r"\s+", " ", val.strip())
    h1 = soup.find("h1")
    if h1:
        t = h1.get_text(" ", strip=True)
        if t:
            return re.sub(r"\s+", " ", t)
    if soup.title and soup.title.string:
        return re.sub(r"\s+", " ", soup.title.string.strip())
    return ""


def _coerce_date(raw: str) -> str:
    raw = unescape(raw).strip()
    if not raw:
        return ""
    raw = raw.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
        return dt.date().isoformat()
    except ValueError:
        pass
    m = _ISO_DATE_RE.search(raw)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = _SPANISH_DATE_RE.search(raw)
    if m:
        month = _MESES[m.group(2).lower()]
        return f"{int(m.group(3)):04d}-{month:02d}-{int(m.group(1)):02d}"
    m = _NUMERIC_DATE_RE.search(raw)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a > 12:
            day, month = a, b
        elif b > 12:
            day, month = b, a
        else:
            # En ES lo habitual es d/m/Y.
            day, month = a, b
        if 1 <= month <= 12 and 1 <= day <= 31 and 1995 <= y <= 2035:
            return f"{y:04d}-{month:02d}-{day:02d}"
    try:
        dt = parsedate_to_datetime(raw)
        return dt.date().isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    return ""


def extract_date(soup: BeautifulSoup) -> str:
    metas = [
        "meta[property='article:published_time']",
        "meta[property='article:modified_time']",
        "meta[property='og:updated_time']",
        "meta[name='publish-date']",
        "meta[name='publishdate']",
        "meta[name='date']",
        "meta[name='dc.date']",
        "meta[name='DC.date']",
        "meta[name='citation_publication_date']",
        "meta[itemprop='datePublished']",
        "meta[itemprop='dateCreated']",
        "time[datetime]",
    ]
    for sel in metas:
        tag = soup.select_one(sel)
        if not tag:
            continue
        raw = str(tag.get("content") or tag.get("datetime") or tag.get_text(" ", strip=True) or "")
        coerced = _coerce_date(raw)
        if coerced:
            return coerced

    for block in jsonld_blocks(soup):
        for key in ("datePublished", "dateCreated", "dateModified"):
            val = block.get(key)
            if isinstance(val, str):
                coerced = _coerce_date(val)
                if coerced:
                    return coerced

    for t in soup.find_all("time"):
        raw = str(t.get("datetime") or t.get_text(" ", strip=True) or "")
        coerced = _coerce_date(raw)
        if coerced:
            return coerced

    text = soup.get_text(" ", strip=True)[:4000]
    m = _SPANISH_DATE_RE.search(text)
    if m:
        return _coerce_date(m.group(0))
    return ""


def mentions_us(html: str) -> bool:
    return bool(OUR_MENTION_RE.search(html))


def outreach_notes(html: str, soup: BeautifulSoup) -> list[str]:
    text = soup.get_text(" ", strip=True).lower()
    notes: list[str] = []
    for hint in _OUTREACH_HINTS:
        if hint in text:
            notes.append(f"menciona «{hint}»")
            break
    return notes


def analyze_page(
    session: requests.Session,
    url: str,
    domain_cache: dict[str, PageInfo],
    *,
    extra_fetches: int = 2,
    delay: tuple[float, float] = (1.1, 2.0),
) -> PageInfo:
    domain = host_of(url)
    info = PageInfo(url=url, domain=domain)
    final, html, err = fetch_html(session, url)
    if err:
        info.fetch_error = err
        info.notes.append(f"no se pudo analizar ({err})")
        return info
    info.url = clean_url(final) or url
    info.domain = host_of(info.url) or domain

    soup = soup_of(html)
    info.already_links_us = mentions_us(html)
    info.title = extract_title(soup)
    info.date = extract_date(soup)
    info.emails = extract_emails(html, soup)
    contact_links = extract_contact_links(soup, info.url)
    if contact_links:
        info.contact_page = contact_links[0]
    info.notes.extend(outreach_notes(html, soup))

    if info.already_links_us:
        return info

    cached = domain_cache.get(info.domain)
    if cached:
        if not info.emails and cached.emails:
            info.emails = list(cached.emails)
            info.notes.append("email reutilizado del mismo dominio")
        if not info.contact_page and cached.contact_page:
            info.contact_page = cached.contact_page
        if info.emails:
            return info

    if info.emails:
        domain_cache[info.domain] = info
        return info

    candidates: list[str] = []
    seen = {dedup_key(info.url)}
    for link in contact_links:
        key = dedup_key(link)
        if key not in seen:
            seen.add(key)
            candidates.append(link)
    if not contact_links:
        origin = f"{urlparse(info.url).scheme}://{urlparse(info.url).netloc}"
        for path in _FALLBACK_CONTACT_PATHS:
            guess = clean_url(urljoin(origin, path))
            key = dedup_key(guess)
            if key not in seen:
                seen.add(key)
                candidates.append(guess)

    tried = 0
    for link in candidates:
        if tried >= extra_fetches:
            break
        pause(*delay)
        tried += 1
        _final, extra_html, extra_err = fetch_html(session, link, referer=info.url)
        if extra_err or not extra_html:
            continue
        extra_soup = soup_of(extra_html)
        extra_emails = extract_emails(extra_html, extra_soup)
        if mentions_us(extra_html):
            info.already_links_us = True
            info.notes.append(f"mención en {link}")
            return info
        if extra_emails:
            info.emails = extra_emails
            info.contact_page = clean_url(_final) or link
            info.notes.append("email extraído de página de contacto/legal")
            break
        if not info.contact_page and contact_score(link, "") >= 3:
            info.contact_page = clean_url(_final) or link

    if info.emails or info.contact_page:
        domain_cache[info.domain] = info
    return info


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------


CSV_FIELDS = [
    "prioridad",
    "url",
    "dominio",
    "titulo",
    "fecha",
    "emails",
    "pagina_contacto",
    "tiene_email",
    "tiene_contacto",
    "queries",
    "mejor_posicion",
    "titulo_serp",
    "motor",
    "notas",
]


def prioridad_of(emails: list[str], contact_page: str) -> str:
    if emails:
        return "alta"
    if contact_page:
        return "media"
    return "baja"


def load_existing(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[str, str]] = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            url = (row.get("url") or "").strip()
            if url:
                out[dedup_key(url)] = row
    return out


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    order = {"alta": 0, "media": 1, "baja": 2}
    rows = sorted(
        rows,
        key=lambda r: (
            order.get(r.get("prioridad", "baja"), 9),
            int(r.get("mejor_posicion") or 99),
            r.get("dominio") or "",
        ),
    )
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def load_urls_file(path: Path) -> list[SerpHit]:
    if not path.is_file():
        sys.exit(f"No existe el fichero de URLs: {path}")
    hits: list[SerpHit] = []
    pos = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "\t" in line:
            query, url = line.split("\t", 1)
        else:
            query, url = "(urls-file)", line
        url = url.strip()
        if not url.startswith("http"):
            continue
        pos += 1
        hits.append(
            SerpHit(
                query=query.strip() or "(urls-file)",
                position=pos,
                url=clean_url(url),
                title="",
                engine="urls-file",
            )
        )
    return hits


def load_queries_file(path: Path) -> list[str]:
    queries: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        queries.append(line)
    return queries


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Investiga roundups de blogs de perros y vuelca candidatos a CSV. No envía nada."
    )
    p.add_argument(
        "-q",
        "--query",
        action="append",
        dest="queries",
        help="Query a buscar (se puede repetir). Si no hay ninguna, usa el listado por defecto.",
    )
    p.add_argument(
        "--urls-file",
        type=Path,
        help="URLs extra (una por línea, o query<TAB>url). Se analizan igual que los resultados de búsqueda.",
    )
    p.add_argument(
        "--queries-file",
        type=Path,
        help="Fichero de texto con una query por línea.",
    )
    p.add_argument("--top", type=int, default=20, help="Resultados por query (defecto: 20).")
    p.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"CSV de salida (defecto: {DEFAULT_OUT.relative_to(ROOT)})",
    )
    p.add_argument(
        "--engine",
        choices=("auto", "google", "bing", "ddg", "yahoo"),
        default="auto",
        help="Motor de búsqueda. auto = Google y, si falla, DuckDuckGo, Yahoo y Bing.",
    )
    p.add_argument(
        "--resume",
        action="store_true",
        help="Reutiliza filas ya presentes en el CSV y no vuelve a visitar esas URLs.",
    )
    p.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Solo extrae la SERP; no visita las URLs (útil para depurar el buscador).",
    )
    p.add_argument(
        "--keep-linked",
        action="store_true",
        help="No descartar páginas que ya mencionan solucioncanina.es.",
    )
    p.add_argument(
        "--limit-urls",
        type=int,
        default=0,
        help="Analizar como máximo N URLs únicas (0 = todas).",
    )
    p.add_argument("--search-delay", type=float, default=6.0, help="Pausa base entre queries (s).")
    p.add_argument("--delay", type=float, default=1.4, help="Pausa base entre páginas (s).")
    return p.parse_args(argv)


def collect_queries(args: argparse.Namespace) -> list[str]:
    queries: list[str] = []
    if args.queries_file:
        if not args.queries_file.is_file():
            sys.exit(f"No existe el fichero de queries: {args.queries_file}")
        queries.extend(load_queries_file(args.queries_file))
    if args.queries:
        queries.extend(q.strip() for q in args.queries if q.strip())
    if not queries:
        if args.urls_file:
            return []
        queries = list(DEFAULT_QUERIES)
    # Dedup preservando orden.
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        key = re.sub(r"\s+", " ", q).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(re.sub(r"\s+", " ", q).strip())
    return out


def row_from_parts(
    *,
    url: str,
    domain: str,
    title: str,
    date: str,
    emails: list[str],
    contact_page: str,
    queries: list[str],
    best_pos: int,
    serp_title: str,
    engine: str,
    notes: list[str],
) -> dict[str, str]:
    prio = prioridad_of(emails, contact_page)
    return {
        "prioridad": prio,
        "url": url,
        "dominio": domain,
        "titulo": title,
        "fecha": date,
        "emails": "; ".join(emails),
        "pagina_contacto": contact_page,
        "tiene_email": "si" if emails else "no",
        "tiene_contacto": "si" if contact_page else "no",
        "queries": " | ".join(queries),
        "mejor_posicion": str(best_pos),
        "titulo_serp": serp_title,
        "motor": engine,
        "notas": "; ".join(notes),
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    queries = collect_queries(args)
    top = max(1, min(args.top, 50))
    out_path = args.out if args.out.is_absolute() else ROOT / args.out

    print("buscar_roundups.py — solo investigación, no envía nada", flush=True)
    print(f"  queries: {len(queries)}  top: {top}  engine: {args.engine}", flush=True)
    print(f"  salida:  {out_path}", flush=True)
    print(flush=True)

    session = make_session()
    hits: list[SerpHit] = []

    if args.urls_file:
        extra = load_urls_file(args.urls_file if args.urls_file.is_absolute() else ROOT / args.urls_file)
        print(f"  urls-file: {len(extra)} URLs", flush=True)
        hits.extend(extra)

    for i, query in enumerate(queries, 1):
        print(f"[{i}/{len(queries)}] «{query}»", flush=True)
        try:
            engine_used, results = search_query(session, query, top, args.engine)
        except SearchBlocked as e:
            print(f"    ERROR: no se pudo buscar ({e})", flush=True)
            if i < len(queries):
                pause(args.search_delay, args.search_delay + 3)
            continue
        print(f"    {len(results)} resultados vía {engine_used}", flush=True)
        for pos, (url, title) in enumerate(results, 1):
            hits.append(
                SerpHit(query=query, position=pos, url=url, title=title, engine=engine_used)
            )
        if i < len(queries):
            pause(args.search_delay, args.search_delay + 3)

    if not hits:
        print("\nSin resultados de búsqueda. CSV no escrito.", file=sys.stderr)
        return 1

    grouped: dict[str, list[SerpHit]] = defaultdict(list)
    for h in hits:
        grouped[dedup_key(h.url)].append(h)

    keys = list(grouped.keys())
    if args.limit_urls and args.limit_urls > 0:
        keys = keys[: args.limit_urls]

    existing = load_existing(out_path) if args.resume else {}
    rows: dict[str, dict[str, str]] = {}
    discarded = 0
    analyzed = 0
    domain_cache: dict[str, PageInfo] = {}
    page_delay = (max(0.4, args.delay * 0.75), args.delay * 1.4)

    print(f"\nURLs únicas a analizar: {len(keys)} (apariciones SERP: {len(hits)})", flush=True)

    for idx, key in enumerate(keys, 1):
        group = grouped[key]
        group.sort(key=lambda h: h.position)
        best = group[0]
        qnames = list(dict.fromkeys(h.query for h in group))
        engines = list(dict.fromkeys(h.engine for h in group))
        best_pos = min(h.position for h in group)

        if args.resume and key in existing:
            row = dict(existing[key])
            prev_q = [q.strip() for q in (row.get("queries") or "").split("|") if q.strip()]
            row["queries"] = " | ".join(list(dict.fromkeys(prev_q + qnames)))
            try:
                row["mejor_posicion"] = str(min(int(row.get("mejor_posicion") or 99), best_pos))
            except ValueError:
                row["mejor_posicion"] = str(best_pos)
            rows[key] = row
            print(f"  [{idx}/{len(keys)}] resume {best.url}", flush=True)
            continue

        if args.skip_fetch:
            rows[key] = row_from_parts(
                url=best.url,
                domain=host_of(best.url),
                title=best.title,
                date="",
                emails=[],
                contact_page="",
                queries=qnames,
                best_pos=best_pos,
                serp_title=best.title,
                engine=",".join(engines),
                notes=["solo SERP (--skip-fetch)"],
            )
            continue

        print(f"  [{idx}/{len(keys)}] {best.url}", flush=True)
        info = analyze_page(session, best.url, domain_cache, delay=page_delay)
        analyzed += 1

        if info.already_links_us and not args.keep_linked:
            discarded += 1
            print("      DESCARTADO: ya menciona solucioncanina.es", flush=True)
            pause(*page_delay)
            continue

        title = info.title or best.title
        notes = list(info.notes)
        if info.already_links_us:
            notes.insert(0, "menciona solucioncanina.es")

        rows[key] = row_from_parts(
            url=info.url or best.url,
            domain=info.domain or host_of(best.url),
            title=title,
            date=info.date,
            emails=info.emails,
            contact_page=info.contact_page,
            queries=qnames,
            best_pos=best_pos,
            serp_title=best.title,
            engine=",".join(engines),
            notes=notes,
        )
        extra = []
        if info.emails:
            extra.append("email=" + ", ".join(info.emails[:3]))
        if info.contact_page:
            extra.append("contacto=" + info.contact_page)
        if info.date:
            extra.append("fecha=" + info.date)
        if extra:
            print("      " + " | ".join(extra), flush=True)
        else:
            print("      sin email ni página de contacto detectable", flush=True)
        pause(*page_delay)

    write_csv(out_path, list(rows.values()))

    n = len(rows)
    n_email = sum(1 for r in rows.values() if r.get("tiene_email") == "si")
    n_contact = sum(
        1
        for r in rows.values()
        if r.get("tiene_contacto") == "si" and r.get("tiene_email") != "si"
    )
    n_none = n - n_email - n_contact
    print(flush=True)
    print(f"Listo. Candidatos en CSV: {n}", flush=True)
    print(f"  con email:          {n_email}", flush=True)
    print(f"  solo página contacto: {n_contact}", flush=True)
    print(f"  sin contacto:       {n_none}", flush=True)
    print(f"  descartados (ya nos mencionan): {discarded}", flush=True)
    print(f"  páginas visitadas:  {analyzed}", flush=True)
    print(f"  CSV: {out_path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
