"""Accés a Amazon.es per al catàleg: client HTTP prudent + lectura de la fitxa (PDP).

Tot el que toca Amazon en un sol lloc:
  - `AmazonClient`: sessió amb capçaleres de navegador, visita inicial a la portada
    (cookies), pausa aleatòria entre peticions, reintents amb espera creixent i
    tallafocs de CAPTCHA: després de N CAPTCHA seguits llança `AmazonBlocked` per
    no continuar picant quan Amazon ja ens ha bloquejat.
  - `parse_product_page(html)`: tot el que es llegeix d'una fitxa en UNA passada
    (preu, oferta, nota, valoracions, vendes, disponibilitat, títol, ASIN real,
    imatge principal i text «Acerca de este producto»). Abans eren tres scripts
    que baixaven la mateixa pàgina.
  - Els extractors individuals (`extract_current_price`, …), que venen de
    `update_prices.py` sense canvis.

Sempre amb la URL neta /dp/{ASIN}/ (sense ?tag=): una visita amb el tag
d'afiliat compta com a clic.
"""

from __future__ import annotations

import io
import json
import random
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.amazon.es"

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
        "(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
    ),
    # Castellà primer: Amazon.es no té català i els patrons de text són en castellà.
    "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8,en;q=0.6",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
}


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

    # 3) Últim recurs, maquetació nova (2026): `priceToPay` sense `.a-offscreen`.
    #    El preu és a l'etiqueta d'accessibilitat («25,98 € con un ahorro del 30 %»:
    #    només el primer import) o a les peces enter/decimals.
    if scope is not None:
        el = scope.select_one("#apex-pricetopay-accessibility-label")
        m = re.search(r"\d[\d.]*,\d{2}", el.get_text(" ", strip=True)) if el else None
        val = _parse_eur(m.group(0)) if m else None
        if val and 0.5 <= val <= 5000:
            return val
        whole = scope.select_one(".priceToPay .a-price-whole")
        if whole:
            frac = scope.select_one(".priceToPay .a-price-fraction")
            digits = re.sub(r"\D", "", whole.get_text())
            cents = re.sub(r"\D", "", frac.get_text()) if frac else ""
            val = float(f"{digits}.{cents or '00'}") if digits else None
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
    """Converteix '1234', '1.234', '12.345' (ES) o '1,234' (EN) a int."""
    raw = (raw or "").strip()
    if not raw or not re.fullmatch(r"[\d.,]+", raw):
        return None

    def _thousands(sep: str) -> int | None:
        if raw.count(sep) < 1 or not raw.replace(sep, "").isdigit():
            return None
        parts = raw.split(sep)
        if (
            parts
            and parts[0]
            and all(p.isdigit() for p in parts)
            and all(len(p) == 3 for p in parts[1:])
            and 1 <= len(parts[0]) <= 3
        ):
            return int("".join(parts))
        return None

    for sep in (".", ","):
        n = _thousands(sep)
        if n is not None:
            return n
    if raw.isdigit():
        return int(raw)
    return None


_REVIEW_COUNT_KW = (
    r"(?:valoraciones?|calificaciones?|reseñas?|reviews?|opiniones?|ratings?)"
)


def _review_count_from_text(txt: str | None) -> int | None:
    """Extreu un recompte > 0 d'un fragment (widget, aria-label o histograma)."""
    if not txt:
        return None
    m = re.search(r"\(\s*([\d.,]+)\s*\)", txt)
    if m:
        n = _parse_amazon_review_count_token(m.group(1))
        if n and n > 0:
            return n
    m = re.search(
        rf"(\d{{1,3}}(?:[.,]\d{{3}})*)\s+(?:global(?:es?)?\s+)?{_REVIEW_COUNT_KW}\b",
        txt,
        flags=re.IGNORECASE,
    )
    if m:
        n = _parse_amazon_review_count_token(m.group(1))
        if n and n > 0:
            return n
    m = re.search(
        rf"\b{_REVIEW_COUNT_KW}\b\s*[:(]?\s*(\d{{1,3}}(?:[.,]\d{{3}})*)",
        txt,
        flags=re.IGNORECASE,
    )
    if m:
        n = _parse_amazon_review_count_token(m.group(1))
        if n and n > 0:
            return n
    return None


def extract_rating_count(soup: BeautifulSoup) -> int | None:
    """Nº de valoracions del widget d'AQUEST PDP.

    Amazon, si agrupa variants (Halti talla S/L, Pets Purest), posa el recompte
    de la família a `#acrCustomerReviewText` i al histograma. Si les desagrupa
    (Taglory 5 m vs 10 m), hi posa el de la variant actual. Sempre llegim aquest
    widget: no el primer `a[href*="#customerReviews"]` de la pàgina (els anuncis
    i productes relacionats també el tenen) ni tot `#reviewsMedley` (hi ha
    ressenyes individuals amb xifres).
    """
    widget = soup.select_one("#averageCustomerReviews")
    el = None
    if widget:
        el = widget.select_one("#acrCustomerReviewText")
    if el is None:
        el = soup.select_one("#acrCustomerReviewText")
    if el is not None:
        for raw in (el.get("aria-label"), el.get_text(" ", strip=True)):
            n = _review_count_from_text(raw)
            if n:
                return n

    link = soup.select_one("#acrCustomerReviewLink")
    if link is not None:
        n = _review_count_from_text(link.get_text(" ", strip=True))
        if n:
            return n

    hist = soup.select_one('[data-hook="total-review-count"]')
    if hist is not None:
        n = _review_count_from_text(hist.get_text(" ", strip=True))
        if n:
            return n

    for sel in (
        "#averageCustomerReviews_feature_div",
        ".cr-widget-TitleRatingsHistogram",
        "#averageCustomerReviews",
    ):
        node = soup.select_one(sel)
        if node is None:
            continue
        n = _review_count_from_text(node.get_text(" ", strip=True))
        if n:
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
# Títol, ASIN real i imatge principal
# ---------------------------------------------------------------------------

_ASIN_RE = re.compile(r"^[A-Z0-9]{10}$")


def extract_page_asin(soup: BeautifulSoup) -> str | None:
    """ASIN de la fitxa servida (pot diferir del demanat si Amazon redirigeix)."""
    el = soup.select_one("input#ASIN") or soup.select_one('input[name="ASIN"]')
    value = (el.get("value") or "").strip().upper() if el else ""
    if _ASIN_RE.match(value):
        return value
    link = soup.select_one('link[rel="canonical"]')
    m = re.search(r"/dp/([A-Z0-9]{10})", (link.get("href") or "") if link else "")
    return m.group(1) if m else None


def is_used_only(soup: BeautifulSoup) -> bool:
    """L'única oferta és de segona mà: el preu que mostra Amazon no és el del producte nou."""
    return soup.select_one("#usedOnlyBuybox") is not None


def detect_no_featured_offer(soup: BeautifulSoup, *, has_price: bool) -> bool:
    """Fitxa sense oferta destacada de producte nou: Amazon no mostra preu al buybox
    (només «Ver todas las opciones de compra», venedors externs) o només en té de
    segona mà. Es pot comprar, però no hi ha un preu de nou que puguem donar."""
    if is_used_only(soup):
        return True
    if has_price:
        return False
    if soup.select_one("#unqualifiedBuyBox"):
        return True
    see_all = soup.select_one("#buybox-see-all-buying-choices")
    return bool(see_all and "opciones de compra" in see_all.get_text(" ", strip=True).lower())


def extract_title(soup: BeautifulSoup) -> str | None:
    el = soup.select_one("#productTitle")
    title = " ".join(el.get_text(" ", strip=True).split()) if el else ""
    return title or None


def _clean_image_url(raw: str) -> str:
    return (
        raw.split("&quot;")[0].split('"')[0]
        .replace("\\u0026", "&").replace("&amp;", "&").strip()
    )


def _is_product_image(url: str) -> bool:
    return (
        "media-amazon.com/images/I/" in url
        and "_AC_US" not in url
        and "_SR38," not in url
        and not re.search(r"\.(js|css)(\?|$)", url, re.IGNORECASE)
    )


def extract_main_image_url(soup: BeautifulSoup, html: str) -> str | None:
    """Imatge principal en alta resolució (mateix criteri que fetch-amazon-images.mjs)."""
    img = soup.select_one("#landingImage") or soup.select_one("#imgBlkFront")
    if img:
        old = _clean_image_url(img.get("data-old-hires") or "")
        if _is_product_image(old):
            return old
        dyn = img.get("data-a-dynamic-image")
        if dyn:
            try:
                sizes = json.loads(dyn)
            except json.JSONDecodeError:
                sizes = {}
            best = max(
                ((u, w * h) for u, (w, h) in sizes.items() if _is_product_image(u)),
                key=lambda x: x[1],
                default=None,
            )
            if best:
                return _clean_image_url(best[0])
    for m in re.finditer(r'"hiRes":"(https://[^"]+)"', html):
        url = _clean_image_url(m.group(1))
        if _is_product_image(url):
            return url
    return None


# ---------------------------------------------------------------------------
# Lectura completa d'una fitxa
# ---------------------------------------------------------------------------

@dataclass
class ProductPage:
    asin: str | None
    title: str | None
    price: float | None
    original_price: float | None
    discount_pct: int | None
    rating: float | None
    rating_count: int | None
    monthly_sales: int | None
    unavailable: bool
    no_featured_offer: bool
    image_url: str | None
    description: str | None
    soup: BeautifulSoup = field(repr=False)

    @property
    def offer(self) -> tuple[float, int] | None:
        """(preu original, % descompte) només si Amazon mostra preu tatxat i badge
        coherents entre ells (±5 punts). Evita ofertes fantasma, p. ex. un cupó
        «Suscríbete y ahorra 5%» combinat amb un PVP antic."""
        cur, orig, pct = self.price, self.original_price, self.discount_pct
        if not (cur and orig and orig > cur and pct is not None and 1 <= pct <= 99):
            return None
        if abs(round((1 - cur / orig) * 100) - pct) > 5:
            return None
        return orig, int(pct)


def parse_product_page(html: str) -> ProductPage:
    # Import tardà: fetch_descriptions importa coses del catàleg que aquí no calen.
    from fetch_descriptions import compose_description, extract_bullets, extract_long_description

    soup = BeautifulSoup(html, "html.parser")
    # Si només hi ha oferta de segona mà, aquell preu no és el del producte.
    price = None if is_used_only(soup) else extract_current_price(soup)
    return ProductPage(
        asin=extract_page_asin(soup),
        title=extract_title(soup),
        price=price,
        original_price=extract_original_price(soup, price),
        discount_pct=extract_discount_pct(soup),
        rating=extract_rating(soup),
        rating_count=extract_rating_count(soup),
        monthly_sales=extract_monthly_sales(soup),
        unavailable=detect_product_unavailable(soup, has_price=price is not None),
        no_featured_offer=detect_no_featured_offer(soup, has_price=price is not None),
        image_url=extract_main_image_url(soup, html),
        description=compose_description(
            extract_bullets(soup), extract_long_description(soup), min_len=180, max_len=700
        ),
        soup=soup,
    )


# ---------------------------------------------------------------------------
# Client HTTP
# ---------------------------------------------------------------------------

# Una fitxa real fa més d'1 MB; per sota d'això és una pàgina d'error o de bloqueig.
MIN_PAGE_BYTES = 20_000

_CAPTCHA_MARKERS = (
    "validatecaptcha",
    "api-services-support@amazon.com",
    "introduce los caracteres",
    "enter the characters",
    "robot check",
    "automated access",
    "discúlpenos",
)


def is_captcha_html(html: str) -> bool:
    low = html.lower()
    return any(m in low for m in _CAPTCHA_MARKERS)


class AmazonBlocked(RuntimeError):
    """Amazon respon amb CAPTCHA de manera continuada: cal aturar l'execució."""


@dataclass
class FetchResult:
    status: str  # "ok" | "no_existeix" | "captcha" | "error"
    html: str = ""
    url: str = ""
    detail: str = ""


class AmazonClient:
    """Sessió prudent amb Amazon.es.

    - Pausa aleatòria de `delay` segons entre dues peticions qualssevol.
    - Fins a `retries` reintents per fitxa: 15 s/30 s si és error de xarxa o 5xx,
      60 s/120 s si és CAPTCHA.
    - `captcha_limit` CAPTCHA seguits (comptant reintents) → `AmazonBlocked`.
    """

    def __init__(
        self,
        *,
        delay: tuple[float, float] = (4.0, 8.0),
        retries: int = 2,
        captcha_limit: int = 3,
        timeout: float = 25,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.delay = delay
        self.retries = retries
        self.captcha_limit = captcha_limit
        self.timeout = timeout
        self.sleep = sleep
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.requests_made = 0
        self._last_request: float | None = None
        self._warmed = False
        self._captchas_in_a_row = 0

    def _get(self, url: str, **kwargs) -> requests.Response:
        if self._last_request is not None:
            wait = random.uniform(*self.delay) - (time.monotonic() - self._last_request)
            if wait > 0:
                self.sleep(wait)
        try:
            self.requests_made += 1
            return self.session.get(url, timeout=self.timeout, **kwargs)
        finally:
            self._last_request = time.monotonic()

    def _warmup(self) -> None:
        """Primera visita a la portada: Amazon dona les cookies de sessió i la fitxa
        següent ja no arriba «en fred» (menys CAPTCHA)."""
        if self._warmed:
            return
        self._warmed = True
        try:
            self._get(BASE_URL + "/")
        except requests.RequestException:
            pass

    def fetch_product(self, asin: str) -> FetchResult:
        self._warmup()
        url = f"{BASE_URL}/dp/{asin}/"
        last = FetchResult("error", url=url, detail="sense resposta")
        for attempt in range(self.retries + 1):
            if attempt:
                base = 60 if last.status == "captcha" else 15
                self.sleep(base * attempt + random.uniform(0, 5))
            try:
                resp = self._get(url)
            except requests.RequestException as e:
                last = FetchResult("error", url=url, detail=str(e))
                continue
            if resp.status_code == 404:
                self._captchas_in_a_row = 0
                return FetchResult("no_existeix", url=resp.url, detail="HTTP 404")
            html = resp.text or ""
            if resp.status_code == 503 or is_captcha_html(html) or len(html) < MIN_PAGE_BYTES:
                self._captchas_in_a_row += 1
                last = FetchResult("captcha", url=resp.url, detail=f"HTTP {resp.status_code}, {len(html)} bytes")
                if self._captchas_in_a_row >= self.captcha_limit:
                    raise AmazonBlocked(
                        f"{self._captchas_in_a_row} CAPTCHA seguits d'Amazon: s'atura l'execució."
                    )
                continue
            if resp.status_code >= 400:
                last = FetchResult("error", url=resp.url, detail=f"HTTP {resp.status_code}")
                continue
            self._captchas_in_a_row = 0
            return FetchResult("ok", html=html, url=resp.url)
        return last

    def download_image(self, url: str, dest: Path, *, max_side: int = 1000) -> Path:
        """Baixa la imatge i la desa com a JPEG (costat llarg ≤ `max_side` px)."""
        from PIL import Image  # Pillow ja és a requirements.txt

        resp = self.session.get(
            url,
            timeout=self.timeout,
            headers={"Accept": "image/avif,image/webp,image/*,*/*;q=0.8", "Referer": BASE_URL + "/"},
        )
        resp.raise_for_status()
        if len(resp.content) < 1000:
            raise ValueError("imatge massa petita (resposta d'error?)")
        img = Image.open(io.BytesIO(resp.content))
        if img.mode not in ("RGB", "L"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.convert("RGBA").split()[-1])
            img = background
        img.thumbnail((max_side, max_side))
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.convert("RGB").save(dest, "JPEG", quality=85, optimize=True, progressive=True)
        return dest
