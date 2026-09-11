#!/usr/bin/env python3
"""Informe semanal accionable a partir de la API de Google Search Console.

Uso:
    python scripts/gsc_weekly_report.py
    python scripts/gsc_weekly_report.py --setup
    SKIP_GSC=1 scripts/semanal.sh          # saltar este paso

Credenciales (cuenta de servicio), en este orden:
    1. --credentials PATH
    2. $GSC_CREDENTIALS
    3. $GOOGLE_APPLICATION_CREDENTIALS
    4. scratch/gsc/service-account.json

El informe markdown va a scratch/informe-gsc.md (y una copia fechada).
El histórico JSON, a scratch/gsc/YYYY-MM-DD.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "scratch"
HIST_DIR = SCRATCH / "gsc"
DEFAULT_CREDS = HIST_DIR / "service-account.json"
SITEMAP_URL = "https://www.solucioncanina.es/sitemap-index.xml"
SITE_HOST = "www.solucioncanina.es"
GSC_API = "https://www.googleapis.com/webmasters/v3"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

# Umbrales pensados para un sitio pequeño: si no hay filas, se dice explícitamente.
MIN_IMPR_QUICK_WIN = 8
MIN_IMPR_CTR = 15
MIN_IMPR_DROP = 8
MIN_POS_DROP = 3.0
QUICK_WIN_POS = (5.0, 20.0)
LOW_CTR_RATIO = 0.60
TOP_N = 15
GSC_LAG_DAYS = 3
ROW_LIMIT = 25000

# CTR orgánico típico por posición (curva SERP ~2024, no el CTR de este sitio).
# Fuente de orden de magnitud: estudios tipo Advanced Web Ranking / Sistrix.
_CTR_BY_POS = {
    1: 0.276, 2: 0.158, 3: 0.110, 4: 0.084, 5: 0.063,
    6: 0.049, 7: 0.039, 8: 0.033, 9: 0.029, 10: 0.026,
    11: 0.016, 12: 0.014, 13: 0.012, 14: 0.011, 15: 0.010,
    16: 0.009, 17: 0.008, 18: 0.007, 19: 0.006, 20: 0.006,
}

CALCULADORAS = [
    ("condroprotector", "Dosis de condroprotector", "/calculadora-dosis-condroprotector-perros/"),
    ("bozal", "Talla de bozal", "/calculadora-talla-bozal-perros/"),
    ("cama", "Talla de cama ortopédica", "/calculadora-talla-cama-ortopedica-perros/"),
    ("rampa", "Medida de rampa", "/calculadora-medida-rampa-perros/"),
]
HERRAMIENTAS_HUB = "/herramientas/"
LEGACY_CALCULADORAS = {
    "/categoria/condroprotectores/calculadora-dosis/": "/calculadora-dosis-condroprotector-perros/",
    "/categoria/bozales/calculadora-talla/": "/calculadora-talla-bozal-perros/",
    "/categoria/rampas/calculadora-medida/": "/calculadora-medida-rampa-perros/",
    "/categoria/camas-ortopedicas/calculadora-talla/": "/calculadora-talla-cama-ortopedica-perros/",
}
ORPHAN_IGNORE_PREFIXES = ("/aviso-legal",)
_MESES = (
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
)

SETUP_GUIDE = """
══════════════════════════════════════════════════════════════════
  Credenciales de servicio para Search Console (una sola vez)
══════════════════════════════════════════════════════════════════

Necesitas estar logueado en Google con la misma cuenta que es
propietaria de solucioncanina.es en Search Console.

── A. Proyecto en Google Cloud ───────────────────────────────────

1. Abre:
   https://console.cloud.google.com/projectcreate

2. Nombre del proyecto:  solucioncanina-gsc
   Organización / ubicación: la que te salga (sin org, «Sin organización»).

3. Pulsa CREAR y espera a que el selector de arriba a la izquierda
   muestre «solucioncanina-gsc». Si no cambia solo, selecciónalo.

── B. Activar la API ─────────────────────────────────────────────

4. Abre (con ese proyecto seleccionado):
   https://console.cloud.google.com/apis/library/searchconsole.googleapis.com

5. Pulsa HABILITAR.
   Si pide cuenta de facturación: la Search Console API es gratuita
   y con el cupo por defecto basta. No habilites otros productos.

── C. Cuenta de servicio + clave JSON ────────────────────────────

6. Abre:
   https://console.cloud.google.com/iam-admin/serviceaccounts

7. Pulsa + CREAR CUENTA DE SERVICIO.

8. Nombre:  gsc-semanal
   ID: déjalo como se autocompleta
   Descripción:  Lectura Search Console para el informe semanal local

9. Pulsa CREAR Y CONTINUAR.

10. «Conceder a esta cuenta de servicio acceso al proyecto»:
    NO asignes ningún rol. Pulsa CONTINUAR y luego LISTO.
    (El permiso se da en Search Console, no en IAM de Cloud.)

11. En la lista, pulsa la cuenta gsc-semanal (el email
    …@solucioncanina-gsc.iam.gserviceaccount.com).

12. Pestaña CLAVES → AGREGAR CLAVE → Crear clave nueva → JSON → CREAR.

13. Se descarga un .json. Muévelo aquí (el nombre da igual, la ruta no):

    scratch/gsc/service-account.json

    Desde la raíz del repo:

      mkdir -p scratch/gsc
      mv ~/Downloads/*solucioncanina-gsc*.json scratch/gsc/service-account.json
      chmod 600 scratch/gsc/service-account.json

14. Abre ese JSON y copia el valor de "client_email"
    (termina en .iam.gserviceaccount.com). Lo necesitas en el paso D.

── D. Autorizar la cuenta en Search Console ──────────────────────

ESTE PASO ES EL QUE SUELE FALTAR. Sin él la API responde 403.

15. Abre Search Console:
    https://search.google.com/search-console

16. Arriba a la izquierda, elige la propiedad de solucioncanina.
    Si tienes las dos, usa la de dominio (sc-domain:solucioncanina.es).
    Si solo tienes prefijo de URL, usa https://www.solucioncanina.es/

17. Menú izquierdo: Configuración (el engranaje)
    → Usuarios y permisos
    → Añadir usuario

18. Correo electrónico: pega el client_email del JSON
    Permiso: Restringido  (solo lectura; suficiente)
    Pulsa AÑADIR.

    Search Console acepta ese email aunque no sea un usuario de Gmail
    ni tenga buzón. No hace falta invitación extra.

19. Espera ~1 minuto.

── E. Comprobar ──────────────────────────────────────────────────

20. En la raíz del repo:

      pip install -r requirements.txt
      python scripts/gsc_weekly_report.py

    Si funciona, verás la propiedad detectada y se escribirá
    scratch/informe-gsc.md.

Errores frecuentes
  403 permission  → el client_email no está en Usuarios y permisos
                    de ESA propiedad (dominio ≠ prefijo www).
  404 siteUrl     → propiedad mal puesta; el script lista las que ve.
  No module google → pip install -r requirements.txt
""".strip()


# ── formato ──────────────────────────────────────────────────────

def n0(x: float | int) -> str:
    return f"{int(round(x)):,}".replace(",", ".")


def n1(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def pct(x: float) -> str:
    return f"{x * 100:.2f} %".replace(".", ",")


def fmt_date(d: date) -> str:
    return f"{d.day} {_MESES[d.month - 1]} {d.year}"


def fmt_range(a: date, b: date) -> str:
    if a.year == b.year and a.month == b.month:
        return f"{a.day}–{b.day} {_MESES[a.month - 1]} {a.year}"
    if a.year == b.year:
        return f"{a.day} {_MESES[a.month - 1]} – {b.day} {_MESES[b.month - 1]} {a.year}"
    return f"{fmt_date(a)} – {fmt_date(b)}"


def delta_n(cur: float, prev: float) -> str:
    d = cur - prev
    sign = "+" if d > 0 else ""
    return f"{sign}{n0(d)}"


def _delta_pp(cur: float, prev: float) -> str:
    d = (cur - prev) * 100
    sign = "+" if d > 0 else ""
    return f"{sign}{d:.2f} pp".replace(".", ",")


def _delta_pos(cur: float, prev: float, cur_impr: float, prev_impr: float) -> str:
    if cur_impr <= 0 or prev_impr <= 0:
        return ""
    d = cur - prev  # positivo = peor
    sign = "+" if d > 0 else ""
    note = " peor" if d > 0.15 else (" mejor" if d < -0.15 else "")
    return f"{sign}{n1(d)}{note}"


def pct_change(cur: float, prev: float) -> str:
    if prev <= 0:
        return "nuevo" if cur > 0 else "n/d"
    return f"{((cur - prev) / prev) * 100:+.0f} %".replace(".", ",")


def expected_ctr(position: float) -> float:
    if position <= 1:
        return _CTR_BY_POS[1]
    if position >= 20:
        return 0.005
    lo = int(position)
    hi = min(lo + 1, 20)
    frac = position - lo
    return _CTR_BY_POS[lo] + (_CTR_BY_POS[hi] - _CTR_BY_POS[lo]) * frac


def localname(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def canon_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if raw.startswith("sc-domain:"):
        return raw
    if "://" not in raw:
        raw = "https://" + raw.lstrip("/")
    u = urlparse(raw)
    host = (u.netloc or "").lower()
    if host in ("solucioncanina.es", "www.solucioncanina.es"):
        host = SITE_HOST
    path = u.path or "/"
    if not path.endswith("/"):
        path += "/"
    return f"https://{host}{path}" if host else path


def url_path(url: str) -> str:
    c = canon_url(url)
    if not c or c.startswith("sc-domain:"):
        return c
    return urlparse(c).path or "/"


def page_kind(path: str) -> str:
    if path in ("/", ""):
        return "home"
    if path.startswith("/producto/"):
        return "producto"
    if path.startswith("/blog/"):
        return "blog"
    if path.startswith("/categoria/"):
        return "categoria"
    if path.startswith("/calculadora"):
        return "calculadora"
    if path.startswith("/herramientas"):
        return "herramientas"
    return "otra"


def md_cell(text: str, width: int = 60) -> str:
    t = " ".join((text or "").split())
    if len(t) > width:
        t = t[: width - 1] + "…"
    return t.replace("|", "\\|")


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "_Sin filas._"
    line = "| " + " | ".join(headers) + " |"
    sep = "| " + " | ".join("---" for _ in headers) + " |"
    body = "\n".join("| " + " | ".join(r) + " |" for r in rows)
    return f"{line}\n{sep}\n{body}"


# ── sitemap ──────────────────────────────────────────────────────

def _iter_locs(root: ET.Element) -> list[str]:
    out: list[str] = []
    for el in root.iter():
        if localname(el.tag) == "loc" and el.text:
            out.append(el.text.strip())
    return out


def parse_sitemap_xml(xml_bytes: bytes) -> tuple[str, list[str]]:
    root = ET.fromstring(xml_bytes)
    kind = localname(root.tag)
    locs = _iter_locs(root)
    return kind, locs


def _http():
    try:
        import requests
    except ImportError:
        raise SystemExit("Falta el paquete requests. Ejecuta: pip install -r requirements.txt")
    s = requests.Session()
    s.headers["User-Agent"] = "solucioncanina-gsc-weekly/1.0 (+https://www.solucioncanina.es/)"
    return s


def _read_xml(url: str, http) -> bytes:
    if url.startswith("file:"):
        return Path(urlparse(url).path).read_bytes()
    r = http.get(url, timeout=30)
    r.raise_for_status()
    return r.content


def load_sitemap() -> list[str]:
    """URLs canónicas del sitemap publicado; si falla, dist/ local."""
    http = _http()
    dist_index = ROOT / "dist" / "sitemap-index.xml"
    dist_zero = ROOT / "dist" / "sitemap-0.xml"
    sources = [SITEMAP_URL]
    if dist_index.exists():
        sources.append(dist_index.as_uri())
    if dist_zero.exists():
        sources.append(dist_zero.as_uri())

    xml = None
    for url in sources:
        try:
            xml = _read_xml(url, http)
            if xml:
                break
        except Exception:
            continue
    if not xml:
        raise RuntimeError(
            "No pude leer el sitemap (ni live ni dist/). "
            "¿Está caído el sitio o no hay un build en dist/?"
        )

    kind, locs = parse_sitemap_xml(xml)
    urls: list[str] = []
    if kind == "sitemapindex":
        for child in locs:
            try:
                _k, child_locs = parse_sitemap_xml(_read_xml(child, http))
                urls.extend(child_locs)
            except Exception:
                local = dist_zero if dist_zero.exists() else None
                if local is not None:
                    _k, child_locs = parse_sitemap_xml(local.read_bytes())
                    urls.extend(child_locs)
                continue
    else:
        urls = locs
    return sorted({canon_url(u) for u in urls if u.startswith("http")})


# ── GSC API ──────────────────────────────────────────────────────

def credentials_path(cli: str | None) -> Path | None:
    for c in (cli, os.environ.get("GSC_CREDENTIALS"), os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")):
        if c:
            p = Path(c).expanduser()
            if not p.is_absolute():
                p = ROOT / p
            return p
    if DEFAULT_CREDS.exists():
        return DEFAULT_CREDS
    return None


def make_session(cred_file: Path):
    try:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account
    except ImportError:
        print("Falta el paquete google-auth. Ejecuta: pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)

    info = json.loads(cred_file.read_text(encoding="utf-8"))
    if info.get("type") != "service_account":
        raise SystemExit(f"{cred_file} no es una clave de cuenta de servicio (type != service_account).")
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    return AuthorizedSession(creds), info.get("client_email", "")


def gsc_request(session, method: str, path: str, body: dict | None = None, retries: int = 5) -> dict:
    url = f"{GSC_API}{path}"
    last = None
    for attempt in range(retries):
        if method == "GET":
            resp = session.get(url, timeout=90)
        else:
            resp = session.post(url, json=body or {}, timeout=90)
        last = resp
        if resp.status_code == 429 or resp.status_code >= 500:
            time.sleep(2 ** attempt)
            continue
        break
    assert last is not None
    if last.status_code == 403:
        raise SystemExit(
            "403: la cuenta de servicio no tiene permiso en esta propiedad.\n"
            "Añade el client_email en Search Console → Configuración → "
            "Usuarios y permisos (permiso Restringido).\n"
            "Guía: python scripts/gsc_weekly_report.py --setup"
        )
    if last.status_code >= 400:
        snippet = (last.text or "")[:500]
        raise SystemExit(f"Error GSC {last.status_code} {path}: {snippet}")
    if not last.content:
        return {}
    return last.json()


def list_sites(session) -> list[dict]:
    data = gsc_request(session, "GET", "/sites")
    return data.get("siteEntry") or []


def resolve_site(session, preferred: str | None) -> str:
    entries = list_sites(session)
    urls = [e.get("siteUrl", "") for e in entries if e.get("siteUrl")]
    if not urls:
        raise SystemExit(
            "La cuenta de servicio no ve ninguna propiedad de Search Console.\n"
            "Completa el paso D de la guía: python scripts/gsc_weekly_report.py --setup"
        )
    if preferred:
        if preferred in urls:
            return preferred
        print(f"Aviso: {preferred} no está en las propiedades visibles. Uso auto-detección.", file=sys.stderr)
        print("  Propiedades: " + ", ".join(urls), file=sys.stderr)
    for u in urls:
        if u == "sc-domain:solucioncanina.es":
            return u
    for u in urls:
        if "solucioncanina.es" in u:
            return u
    return urls[0]


def search_analytics(session, site: str, body: dict) -> dict:
    encoded = quote(site, safe="")
    start = 0
    rows: list[dict] = []
    agg = None
    base = {k: v for k, v in body.items() if k not in ("startRow", "rowLimit")}
    while True:
        chunk = dict(base, rowLimit=ROW_LIMIT, startRow=start)
        data = gsc_request(session, "POST", f"/sites/{encoded}/searchAnalytics/query", chunk)
        if agg is None:
            agg = data.get("responseAggregationType")
        batch = data.get("rows") or []
        rows.extend(batch)
        if len(batch) < ROW_LIMIT:
            break
        start += ROW_LIMIT
    out = {"rows": rows}
    if agg:
        out["responseAggregationType"] = agg
    return out


def normalize_rows(raw: dict, dims: list[str]) -> list[dict]:
    out: list[dict] = []
    for r in raw.get("rows") or []:
        keys = r.get("keys") or []
        item = {name: (keys[i] if i < len(keys) else "") for i, name in enumerate(dims)}
        item["clicks"] = float(r.get("clicks") or 0)
        item["impressions"] = float(r.get("impressions") or 0)
        item["ctr"] = float(r.get("ctr") or 0)
        item["position"] = float(r.get("position") or 0)
        out.append(item)
    return out


def totals_of(raw: dict) -> dict[str, float]:
    rows = raw.get("rows") or []
    if not rows:
        return {"clicks": 0.0, "impressions": 0.0, "ctr": 0.0, "position": 0.0}
    r = rows[0]
    clicks = float(r.get("clicks") or 0)
    impr = float(r.get("impressions") or 0)
    ctr = float(r.get("ctr") or 0)
    if ctr == 0 and impr:
        ctr = clicks / impr
    return {
        "clicks": clicks,
        "impressions": impr,
        "ctr": ctr,
        "position": float(r.get("position") or 0),
    }


def last_complete_window(today: date, lag_days: int) -> tuple[date, date, date, date, date, date]:
    """7 días actuales con datos finales, 7 días previos, 30 días (mismo end)."""
    end = today - timedelta(days=lag_days)
    cur_start = end - timedelta(days=6)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=6)
    d30_start = end - timedelta(days=29)
    return cur_start, end, prev_start, prev_end, d30_start, end


# ── análisis ─────────────────────────────────────────────────────

def landing_by_query(query_pages: list[dict]) -> dict[str, str]:
    best: dict[str, tuple[float, str]] = {}
    for r in query_pages:
        q = r.get("query") or ""
        page = canon_url(r.get("page") or "")
        impr = r["impressions"]
        prev = best.get(q)
        if not prev or impr > prev[0]:
            best[q] = (impr, page)
    return {q: p for q, (_i, p) in best.items()}


def opportunity_score(impr: float, ctr: float, pos: float) -> float:
    """Clics extra si el CTR igualara el típico + si subiera a un objetivo realista."""
    ctr_gap = impr * max(0.0, expected_ctr(pos) - ctr)
    target = 4.0 if pos <= 10 else 8.0
    rank_gap = impr * max(0.0, expected_ctr(target) - expected_ctr(pos))
    return ctr_gap + rank_gap


def analyze_quick_wins(queries: list[dict], landings: dict[str, str]) -> list[dict]:
    lo, hi = QUICK_WIN_POS
    wins: list[dict] = []
    for r in queries:
        pos = r["position"]
        impr = r["impressions"]
        clicks = r["clicks"]
        ctr = r["ctr"]
        if not (lo <= pos <= hi) or impr < MIN_IMPR_QUICK_WIN:
            continue
        exp = expected_ctr(pos)
        pocos = clicks <= 2 or ctr < exp * 0.85
        if not pocos:
            continue
        q = r.get("query") or ""
        wins.append({
            "query": q,
            "page": landings.get(q, ""),
            "clicks": clicks,
            "impressions": impr,
            "ctr": ctr,
            "position": pos,
            "expected_ctr": exp,
            "opportunity": round(opportunity_score(impr, ctr, pos), 2),
        })
    wins.sort(key=lambda x: (-x["opportunity"], -x["impressions"]))
    return wins[:TOP_N]


def analyze_low_ctr(pages: list[dict]) -> list[dict]:
    out: list[dict] = []
    for r in pages:
        pos = r["position"]
        impr = r["impressions"]
        if pos <= 0 or pos > 10 or impr < MIN_IMPR_CTR:
            continue
        exp = expected_ctr(pos)
        ctr = r["ctr"]
        if exp <= 0 or ctr >= exp * LOW_CTR_RATIO:
            continue
        missed = impr * max(0.0, exp - ctr)
        out.append({
            "page": canon_url(r.get("page") or ""),
            "clicks": r["clicks"],
            "impressions": impr,
            "ctr": ctr,
            "position": pos,
            "expected_ctr": exp,
            "missed_clicks": round(missed, 2),
        })
    out.sort(key=lambda x: (-x["missed_clicks"], -x["impressions"]))
    return out[:TOP_N]


def analyze_drops(current: list[dict], previous: list[dict]) -> list[dict]:
    now = {canon_url(r.get("page") or ""): r for r in current}
    prev = {canon_url(r.get("page") or ""): r for r in previous}
    out: list[dict] = []
    for url, pr in prev.items():
        if not url or pr["impressions"] < MIN_IMPR_DROP:
            continue
        cr = now.get(url)
        if cr is None or cr["impressions"] <= 0:
            delta = 50.0
            cur_pos = None
            cur_impr = 0.0
            cur_clicks = 0.0
        else:
            cur_pos = cr["position"]
            delta = cur_pos - pr["position"]
            cur_impr = cr["impressions"]
            cur_clicks = cr["clicks"]
            if delta < MIN_POS_DROP:
                continue
        impact = pr["impressions"] * (delta / 10.0)
        out.append({
            "page": url,
            "position_prev": pr["position"],
            "position": cur_pos,
            "delta": round(delta, 2),
            "impressions_prev": pr["impressions"],
            "impressions": cur_impr,
            "clicks_prev": pr["clicks"],
            "clicks": cur_clicks,
            "vanished": cr is None or cr["impressions"] <= 0,
            "impact": round(impact, 2),
        })
    out.sort(key=lambda x: (-x["impact"], -x["delta"]))
    return out[:TOP_N]


def analyze_orphans(sitemap: list[str], pages_30d: list[dict]) -> dict[str, Any]:
    seen = {canon_url(r.get("page") or "") for r in pages_30d if r["impressions"] > 0}
    orphans: list[str] = []
    for u in sitemap:
        p = url_path(u)
        if any(p.startswith(pref) for pref in ORPHAN_IGNORE_PREFIXES):
            continue
        if u not in seen:
            orphans.append(u)
    by_kind: dict[str, list[str]] = {}
    for u in orphans:
        by_kind.setdefault(page_kind(url_path(u)), []).append(u)
    indexed_off = []
    sitemap_set = set(sitemap)
    for r in pages_30d:
        u = canon_url(r.get("page") or "")
        if u and u not in sitemap_set and r["impressions"] > 0:
            indexed_off.append({
                "page": u,
                "impressions": r["impressions"],
                "clicks": r["clicks"],
                "position": r["position"],
            })
    indexed_off.sort(key=lambda x: -x["impressions"])
    return {
        "sitemap_count": len(sitemap),
        "with_impressions": len(seen & set(sitemap)),
        "orphans": orphans,
        "by_kind": {k: sorted(v) for k, v in sorted(by_kind.items())},
        "indexed_not_in_sitemap": indexed_off[:TOP_N],
        "indexed_not_in_sitemap_count": len(indexed_off),
    }


def empty_metrics() -> dict[str, float]:
    return {"clicks": 0.0, "impressions": 0.0, "ctr": 0.0, "position": 0.0}


def page_metrics(pages: list[dict], path: str) -> dict[str, float]:
    for r in pages:
        if url_path(r.get("page") or "") == path:
            return {
                "clicks": r["clicks"],
                "impressions": r["impressions"],
                "ctr": r["ctr"],
                "position": r["position"],
            }
    return empty_metrics()


def analyze_calculators(pages_cur: list[dict], pages_prev: list[dict], pages_30: list[dict]) -> dict[str, Any]:
    rows = []
    for cid, name, path in CALCULADORAS:
        cur = page_metrics(pages_cur, path)
        prev = page_metrics(pages_prev, path)
        d30 = page_metrics(pages_30, path)
        rows.append({
            "id": cid,
            "name": name,
            "path": path,
            "current": cur,
            "previous": prev,
            "days_30": d30,
        })
    hub = {
        "path": HERRAMIENTAS_HUB,
        "current": page_metrics(pages_cur, HERRAMIENTAS_HUB),
        "previous": page_metrics(pages_prev, HERRAMIENTAS_HUB),
        "days_30": page_metrics(pages_30, HERRAMIENTAS_HUB),
    }
    legacy = []
    for old, canonical in LEGACY_CALCULADORAS.items():
        m = page_metrics(pages_30, old)
        if m["impressions"] > 0:
            legacy.append({
                "path": old,
                "canonical": canonical,
                "impressions": m["impressions"],
                "clicks": m["clicks"],
                "position": m["position"],
            })
    return {"rows": rows, "hub": hub, "legacy": legacy}


def recommend_actions(report: dict) -> list[dict]:
    cands: list[dict] = []

    for w in report["quick_wins"][:8]:
        path = url_path(w["page"]) or "(sin landing clara)"
        pos = w["position"]
        if pos <= 10:
            how = (
                f"Reescribe title y H1 de `{path}` para anteponer «{w['query']}» "
                f"y un beneficio concreto (< 60 caracteres en el title). "
                f"El snippet no está convirtiendo impresiones en clics."
            )
        else:
            how = (
                f"Está en página 2. En `{path}` añade un H2 que cubra «{w['query']}» "
                f"y un párrafo útil; enlázala desde la categoría correspondiente."
            )
        cands.append({
            "bucket": "quick_win",
            "score": w["opportunity"] + w["impressions"] / 50,
            "title": f"Empujar la query «{w['query']}» (pos. {n1(pos)})",
            "why": (
                f"{n0(w['impressions'])} impr., {n0(w['clicks'])} clics, "
                f"CTR {pct(w['ctr'])} vs ~{pct(w['expected_ctr'])} típico. "
                f"Oportunidad ≈ {n1(w['opportunity'])} clics."
            ),
            "how": how,
        })

    for p in report["low_ctr"][:6]:
        path = url_path(p["page"])
        cands.append({
            "bucket": "ctr",
            "score": p["missed_clicks"] + 2,
            "title": f"Subir el CTR de `{path}`",
            "why": (
                f"Está en el top 10 (pos. {n1(p['position'])}) con CTR {pct(p['ctr'])}; "
                f"lo esperable es ~{pct(p['expected_ctr'])}. "
                f"≈ {n1(p['missed_clicks'])} clics dejados encima de la mesa."
            ),
            "how": (
                f"Nuevo title + meta description más específicos (intención + beneficio). "
                f"Mira en GSC las queries de esa URL y alinea el H1 con la principal."
            ),
        })

    for d in report["drops"][:6]:
        path = url_path(d["page"])
        if d["vanished"]:
            how = (
                f"Comprueba que `{path}` sigue publicada, con 200 y canonical correcta. "
                f"Si existe, solicita indexación en GSC."
            )
            title = f"Recuperar `{path}` (sin impresiones esta semana)"
        else:
            how = (
                f"Diff del contenido/title de `{path}` respecto a hace 7 días "
                f"(producto eliminado, H1 cambiado, cannibalización). "
                f"Si no hubo cambio on-site, refuerza enlaces internos a esa URL."
            )
            title = f"Frenar la caída de `{path}`"
        cands.append({
            "bucket": "drop",
            "score": d["impact"],
            "title": title,
            "why": (
                f"Posición {n1(d['position_prev'])} → "
                f"{'sin impr.' if d['vanished'] else n1(d['position'])} "
                f"({n0(d['impressions_prev'])} impr. la semana pasada)."
            ),
            "how": how,
        })

    calcs = report["calculators"]["rows"]
    ranked = sorted(calcs, key=lambda r: -r["days_30"]["impressions"])
    if ranked:
        best, worst = ranked[0], ranked[-1]
        if best["days_30"]["impressions"] > 0 and worst["days_30"]["impressions"] == 0:
            cands.append({
                "bucket": "calc",
                "score": 12,
                "title": f"Dar visibilidad a la calculadora de {worst['name'].lower()}",
                "why": (
                    f"`{worst['path']}` tiene 0 impresiones en 30 días; "
                    f"`{best['path']}` lidera con {n0(best['days_30']['impressions'])}."
                ),
                "how": (
                    f"Enlázala desde la categoría, desde 1 post del blog y desde "
                    f"`{HERRAMIENTAS_HUB}`. Luego solicita indexación en GSC."
                ),
            })
        elif best["days_30"]["impressions"] >= 0:
            weak = min(calcs, key=lambda r: (r["current"]["impressions"], r["current"]["clicks"]))
            cands.append({
                "bucket": "calc",
                "score": 4 + (3 if weak["current"]["impressions"] < best["current"]["impressions"] / 3 else 0),
                "title": f"Comparar internamente las calculadoras (peor: {weak['name'].lower()})",
                "why": (
                    f"Esta semana `{weak['path']}` va a {n0(weak['current']['impressions'])} impr. "
                    f"frente a {n0(best['current']['impressions'])} de {best['name'].lower()}."
                ),
                "how": (
                    "Replica el patrón de enlaces internos de la que mejor rankea "
                    "(banner de categoría + mención en la guía pilar)."
                ),
            })

    for item in report["calculators"].get("legacy") or []:
        cands.append({
            "bucket": "legacy",
            "score": item["impressions"] / 5 + 6,
            "title": f"Google sigue mostrando la URL vieja `{item['path']}`",
            "why": (
                f"{n0(item['impressions'])} impr. en 30 días a una ruta con 301. "
                f"La canónica es `{item['canonical']}`."
            ),
            "how": (
                f"En GSC, inspecciona `{item['canonical']}` y pide indexación. "
                f"No enlaces internamente la URL legacy."
            ),
        })

    by_kind = report["orphans"].get("by_kind") or {}
    for kind, urls in by_kind.items():
        if kind in ("producto", "otra", "calculadora", "herramientas") or not urls:
            continue
        shown = urls[0]
        cands.append({
            "bucket": "orphan",
            "score": {"categoria": 8, "blog": 7, "home": 9}.get(kind, 3),
            "title": f"Indexar contenido huérfano ({kind}: {len(urls)})",
            "why": f"En el sitemap y 0 impresiones en 30 días. Empieza por `{url_path(shown)}`.",
            "how": (
                "Confirma enlace interno visible, pide indexación en GSC "
                "y, si es un artículo, añade un H2 alineado con la query objetivo."
            ),
        })

    off = report["orphans"].get("indexed_not_in_sitemap") or []
    if off:
        top = off[0]
        cands.append({
            "bucket": "hygiene",
            "score": top["impressions"] / 8 + 3,
            "title": "Limpiar URLs indexadas que ya no están en el sitemap",
            "why": (
                f"{report['orphans']['indexed_not_in_sitemap_count']} URLs con impresiones "
                f"fuera del sitemap. La más gorda: `{url_path(top['page'])}` "
                f"({n0(top['impressions'])} impr.)."
            ),
            "how": (
                "Comprueba el 301 a la canónica y usa Inspección de URL en GSC. "
                "No recuperes slugs viejos."
            ),
        })

    cands.sort(key=lambda c: -c["score"])
    chosen: list[dict] = []
    used: set[str] = set()
    for c in cands:
        if c["bucket"] in used:
            continue
        chosen.append(c)
        used.add(c["bucket"])
        if len(chosen) == 3:
            break
    if len(chosen) < 3:
        for c in cands:
            if c in chosen:
                continue
            chosen.append(c)
            if len(chosen) == 3:
                break
    if not chosen:
        chosen = [
            {
                "bucket": "fallback",
                "score": 1,
                "title": "Pedir indexación de las 4 calculadoras y sus categorías",
                "why": "Aún no hay suficiente tráfico GSC para priorizar por oportunidad.",
                "how": "Inspección de URL en GSC sobre cada calculadora y `/herramientas/`.",
            },
            {
                "bucket": "fallback",
                "score": 1,
                "title": "Enlazar las calculadoras desde home, categorías y 1 post cada una",
                "why": "Sin impresiones no hay queries que optimizar; primero hay que entrar en el índice.",
                "how": "Un enlace con ancla descriptiva (no «haz clic aquí») hacia cada herramienta.",
            },
            {
                "bucket": "fallback",
                "score": 1,
                "title": "Revisar que la propiedad GSC coincida con www + dominio",
                "why": "Si los totales salen a 0, suele ser propiedad de prefijo vs dominio.",
                "how": "El script lista las propiedades al arrancar; usa la de dominio si existe.",
            },
        ]
    return [
        {"title": c["title"], "why": c["why"], "how": c["how"], "bucket": c["bucket"]}
        for c in chosen[:3]
    ]


def mark_repeat_wins(wins: list[dict], prev_report: dict | None) -> None:
    if not prev_report:
        return
    prev_q = {w.get("query") for w in (prev_report.get("quick_wins") or [])}
    for w in wins:
        w["repeat"] = w["query"] in prev_q


# ── markdown ─────────────────────────────────────────────────────

def _pos_cell(row: dict) -> str:
    if row.get("vanished") or row.get("position") is None:
        return "—"
    return n1(float(row["position"]))


def render_markdown(report: dict) -> str:
    m = report["meta"]
    cur = report["totals_current"]
    prev = report["totals_previous"]
    t30 = report["totals_30d"]
    cur_r = (date.fromisoformat(m["current_start"]), date.fromisoformat(m["current_end"]))
    prev_r = (date.fromisoformat(m["previous_start"]), date.fromisoformat(m["previous_end"]))
    d30_r = (date.fromisoformat(m["days30_start"]), date.fromisoformat(m["days30_end"]))

    lines: list[str] = []
    a = lines.append
    a(f"# Informe GSC — {fmt_range(*cur_r)}")
    a("")
    a(f"_Generado {m['generated_at']}. Datos finales (retraso GSC ~{m['lag_days']} días)._")
    a(f"Propiedad `{m['site']}` · cuenta `{m['client_email']}`.")
    a("")
    a("## Resumen")
    a("")
    a(md_table(
        ["Métrica", "Esta semana", "Semana anterior", "Δ", "30 días"],
        [
            ["Clics", n0(cur["clicks"]), n0(prev["clicks"]), delta_n(cur["clicks"], prev["clicks"]) + f" ({pct_change(cur['clicks'], prev['clicks'])})", n0(t30["clicks"])],
            ["Impresiones", n0(cur["impressions"]), n0(prev["impressions"]), delta_n(cur["impressions"], prev["impressions"]) + f" ({pct_change(cur['impressions'], prev['impressions'])})", n0(t30["impressions"])],
            ["CTR", pct(cur["ctr"]), pct(prev["ctr"]), _delta_pp(cur["ctr"], prev["ctr"]), pct(t30["ctr"])],
            [
                "Posición media",
                n1(cur["position"]) if cur["impressions"] else "—",
                n1(prev["position"]) if prev["impressions"] else "—",
                _delta_pos(cur["position"], prev["position"], cur["impressions"], prev["impressions"]),
                n1(t30["position"]) if t30["impressions"] else "—",
            ],
        ],
    ))
    a("")
    a(f"Ventanas: esta semana {fmt_range(*cur_r)} · anterior {fmt_range(*prev_r)} · 30 días {fmt_range(*d30_r)}.")
    a("")

    a("## Quick wins")
    a("")
    a("Queries en posición **5–20**, con impresiones y pocos clics, ordenadas por clics extra estimados (si el CTR se acercara al típico de esa posición y/o subieran a pos. 4 u 8).")
    a("")
    wins = report["quick_wins"]
    if not wins:
        a(f"_Ninguna query con ≥ {MIN_IMPR_QUICK_WIN} impresiones en pos. 5–20 y CTR flojo._")
    else:
        rows = []
        for w in wins:
            flag = " · sigue" if w.get("repeat") else ""
            landing = url_path(w["page"]) if w.get("page") else "—"
            rows.append([
                md_cell(w["query"] + flag, 48),
                n1(w["position"]),
                n0(w["impressions"]),
                n0(w["clicks"]),
                pct(w["ctr"]),
                n1(w["opportunity"]),
                md_cell(landing, 40),
            ])
        a(md_table(["Query", "Pos.", "Impr.", "Clics", "CTR", "Oport.", "Landing"], rows))
    a("")

    a("## CTR bajo")
    a("")
    a(f"Páginas en el **top 10** con ≥ {MIN_IMPR_CTR} impresiones y CTR por debajo del 60 % de lo típico para su posición.")
    a("")
    low = report["low_ctr"]
    if not low:
        a("_Ninguna página del top 10 con CTR claramente por debajo del esperado._")
    else:
        rows = []
        for p in low:
            rows.append([
                md_cell(url_path(p["page"]), 52),
                n1(p["position"]),
                n0(p["impressions"]),
                n0(p["clicks"]),
                pct(p["ctr"]),
                pct(p["expected_ctr"]),
                n1(p["missed_clicks"]),
            ])
        a(md_table(["Página", "Pos.", "Impr.", "Clics", "CTR", "CTR típico", "Clics perdidos"], rows))
    a("")

    a("## Caídas")
    a("")
    a(f"Páginas que **han perdido ≥ {n1(MIN_POS_DROP)} posiciones** vs la semana anterior (mín. {MIN_IMPR_DROP} impr. previas). Positivo en Δ = peor.")
    a("")
    drops = report["drops"]
    if not drops:
        a("_Sin caídas de posición que superen el umbral._")
    else:
        rows = []
        for d in drops:
            rows.append([
                md_cell(url_path(d["page"]), 52),
                n1(d["position_prev"]),
                _pos_cell(d),
                f"+{n1(d['delta'])}" if d["delta"] >= 0 else n1(d["delta"]),
                n0(d["impressions_prev"]),
                n0(d["impressions"]),
            ])
        a(md_table(["Página", "Pos. ant.", "Pos. ahora", "Δ pos.", "Impr. ant.", "Impr. ahora"], rows))
    a("")

    a("## Contenido huérfano")
    a("")
    o = report["orphans"]
    a(f"Sitemap: **{n0(o['sitemap_count'])}** URLs. Con ≥ 1 impresión en 30 días: **{n0(o['with_impressions'])}**. A cero: **{n0(len(o['orphans']))}**.")
    a("")
    by_kind = o.get("by_kind") or {}
    if not by_kind:
        a("_Todas las URLs del sitemap tuvieron al menos una impresión._")
    else:
        order = ["home", "calculadora", "herramientas", "categoria", "blog", "producto", "otra"]
        for kind in order:
            urls = by_kind.get(kind) or []
            if not urls:
                continue
            a(f"### {kind} ({len(urls)})")
            a("")
            if kind == "producto" and len(urls) > 12:
                a(f"Cola larga: **{len(urls)}** fichas sin impresiones. Normal; no son la palanca de esta semana. Ejemplos:")
                a("")
                for u in urls[:8]:
                    a(f"- `{url_path(u)}`")
                a(f"- … y {len(urls) - 8} más")
            else:
                for u in urls:
                    a(f"- `{url_path(u)}`")
            a("")
    off = o.get("indexed_not_in_sitemap") or []
    off_n = o.get("indexed_not_in_sitemap_count") or 0
    if off:
        a(f"### Indexadas fuera del sitemap ({off_n})")
        a("")
        a("Suelen ser slugs viejos o www/no-www. La canónica debería llevarse el tráfico.")
        a("")
        rows = [[md_cell(url_path(x["page"]), 56), n0(x["impressions"]), n0(x["clicks"]), n1(x["position"])] for x in off]
        a(md_table(["URL", "Impr. 30d", "Clics", "Pos."], rows))
        a("")

    a("## Calculadoras")
    a("")
    a("Las 4, misma ventana semanal, más el acumulado a 30 días. Orden: la que más impresiones tiene en 30 días.")
    a("")
    calc_rows = sorted(report["calculators"]["rows"], key=lambda r: -r["days_30"]["impressions"])
    table = []
    for r in calc_rows:
        c, p, d = r["current"], r["previous"], r["days_30"]
        table.append([
            r["name"],
            n0(c["impressions"]),
            n0(c["clicks"]),
            pct(c["ctr"]) if c["impressions"] else "—",
            n1(c["position"]) if c["impressions"] else "—",
            n0(p["impressions"]),
            n0(d["impressions"]),
            n0(d["clicks"]),
        ])
    a(md_table(
        ["Calculadora", "Impr. sem.", "Clics sem.", "CTR", "Pos.", "Impr. ant.", "Impr. 30d", "Clics 30d"],
        table,
    ))
    hub = report["calculators"]["hub"]
    hc = hub["current"]
    a("")
    a(
        f"Índice `{HERRAMIENTAS_HUB}`: {n0(hc['impressions'])} impr. / {n0(hc['clicks'])} clics esta semana"
        f" ({n0(hub['days_30']['impressions'])} impr. en 30 días)."
    )
    a("")
    legacy = report["calculators"].get("legacy") or []
    if legacy:
        a("URLs legacy de calculadora **aún con impresiones** (deberían estar en la canónica vía 301):")
        a("")
        for item in legacy:
            a(
                f"- `{item['path']}` → `{item['canonical']}` · "
                f"{n0(item['impressions'])} impr. / {n0(item['clicks'])} clics en 30 días"
            )
        a("")

    a("## Tres acciones de esta semana")
    a("")
    for i, act in enumerate(report["actions"], 1):
        a(f"### {i}. {act['title']}")
        a("")
        a(f"**Por qué:** {act['why']}")
        a("")
        a(f"**Qué hacer:** {act['how']}")
        a("")

    n_hist = m.get("history_weeks") or 0
    a("---")
    a("")
    a(f"Histórico: `{m['snapshot_path']}`" + (f" · {n_hist} semana(s) anterior(es) en `scratch/gsc/`." if n_hist else " · primera semana guardada."))
    a("")
    return "\n".join(lines).rstrip() + "\n"


def print_actions(report: dict, md_path: Path, snap_path: Path) -> None:
    print()
    print("── Tres acciones de esta semana ──")
    for i, act in enumerate(report["actions"], 1):
        print(f"{i}. {act['title']}")
        print(f"   {act['why']}")
    print()
    print(f"✓ Informe: {md_path.relative_to(ROOT)}")
    print(f"  Histórico: {snap_path.relative_to(ROOT)}")


# ── fetch + orquestación ─────────────────────────────────────────

def fetch_payload(session, site: str, windows: dict, data_state: str) -> dict:
    cs, ce = windows["current"]
    ps, pe = windows["previous"]
    ds, de = windows["days30"]
    used = data_state

    def run(start: date, end: date, dims: list[str] | None = None) -> dict:
        body: dict[str, Any] = {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "searchType": "web",
            "aggregationType": "auto",
            "dataState": used,
        }
        if dims:
            body["dimensions"] = dims
        return search_analytics(session, site, body)

    tot_c = run(cs, ce)
    if totals_of(tot_c)["impressions"] == 0 and data_state == "final":
        print("Sin filas en dataState=final; reintento con dataState=all (incluye datos frescos).", file=sys.stderr)
        used = "all"
        tot_c = run(cs, ce)
    tot_p = run(ps, pe)
    tot_30 = run(ds, de)

    queries = run(cs, ce, ["query"])
    pages_c = run(cs, ce, ["page"])
    pages_p = run(ps, pe, ["page"])
    pages_30 = run(ds, de, ["page"])
    query_pages = run(cs, ce, ["query", "page"])

    return {
        "data_state": used,
        "totals_current": totals_of(tot_c),
        "totals_previous": totals_of(tot_p),
        "totals_30d": totals_of(tot_30),
        "queries": normalize_rows(queries, ["query"]),
        "pages_current": normalize_rows(pages_c, ["page"]),
        "pages_previous": normalize_rows(pages_p, ["page"]),
        "pages_30d": normalize_rows(pages_30, ["page"]),
        "query_pages": normalize_rows(query_pages, ["query", "page"]),
    }


def build_report(payload: dict, sitemap: list[str], meta: dict, prev: dict | None) -> dict:
    landings = landing_by_query(payload.get("query_pages") or [])
    wins = analyze_quick_wins(payload["queries"], landings)
    mark_repeat_wins(wins, prev)
    report = {
        "meta": meta,
        "totals_current": payload["totals_current"],
        "totals_previous": payload["totals_previous"],
        "totals_30d": payload["totals_30d"],
        "queries": payload["queries"],
        "pages_current": payload["pages_current"],
        "pages_previous": payload["pages_previous"],
        "pages_30d": payload["pages_30d"],
        "query_pages": payload.get("query_pages") or [],
        "sitemap_urls": sitemap,
        "quick_wins": wins,
        "low_ctr": analyze_low_ctr(payload["pages_current"]),
        "drops": analyze_drops(payload["pages_current"], payload["pages_previous"]),
        "orphans": analyze_orphans(sitemap, payload["pages_30d"]),
        "calculators": analyze_calculators(
            payload["pages_current"], payload["pages_previous"], payload["pages_30d"]
        ),
    }
    report["actions"] = recommend_actions(report)
    return report


def load_previous_snapshot(end: date) -> tuple[dict | None, int]:
    files = sorted(p for p in HIST_DIR.glob("????-??-??.json") if p.stem != end.isoformat())
    n = len(files)
    if not files:
        return None, 0
    try:
        return json.loads(files[-1].read_text(encoding="utf-8")), n
    except (OSError, json.JSONDecodeError):
        return None, n


def synthetic_payload() -> tuple[dict, list[str]]:
    """Datos mínimos para --self-test (no llama a la API)."""
    pages = [
        {"page": "https://www.solucioncanina.es/", "clicks": 6, "impressions": 50, "ctr": 0.12, "position": 3.2},
        {"page": "https://www.solucioncanina.es/blog/condroprotectores/", "clicks": 1, "impressions": 80, "ctr": 0.012, "position": 7.5},
        {"page": "https://www.solucioncanina.es/categoria/condroprotectores/", "clicks": 0, "impressions": 40, "ctr": 0.0, "position": 18.0},
        {"page": "https://www.solucioncanina.es/calculadora-dosis-condroprotector-perros/", "clicks": 2, "impressions": 25, "ctr": 0.08, "position": 9.0},
        {"page": "https://www.solucioncanina.es/calculadora-talla-bozal-perros/", "clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0},
        {"page": "https://www.solucioncanina.es/producto/ejemplo/", "clicks": 0, "impressions": 12, "ctr": 0.0, "position": 22.0},
    ]
    prev_pages = [
        {"page": "https://www.solucioncanina.es/blog/condroprotectores/", "clicks": 3, "impressions": 90, "ctr": 0.033, "position": 8.0},
        {"page": "https://www.solucioncanina.es/categoria/condroprotectores/", "clicks": 1, "impressions": 55, "ctr": 0.018, "position": 11.0},
        {"page": "https://www.solucioncanina.es/calculadora-dosis-condroprotector-perros/", "clicks": 1, "impressions": 20, "ctr": 0.05, "position": 12.0},
    ]
    queries = [
        {"query": "condroprotector perros", "clicks": 0, "impressions": 46, "ctr": 0.0, "position": 8.2},
        {"query": "rampa perro coche", "clicks": 1, "impressions": 30, "ctr": 0.033, "position": 14.0},
        {"query": "bozal talla", "clicks": 0, "impressions": 12, "ctr": 0.0, "position": 19.4},
    ]
    qpages = [
        {**queries[0], "page": pages[1]["page"]},
        {**queries[1], "page": "https://www.solucioncanina.es/categoria/rampas/"},
        {**queries[2], "page": "https://www.solucioncanina.es/calculadora-talla-bozal-perros/"},
    ]
    sitemap = [
        "https://www.solucioncanina.es/",
        "https://www.solucioncanina.es/blog/condroprotectores/",
        "https://www.solucioncanina.es/blog/post-huerfano/",
        "https://www.solucioncanina.es/categoria/condroprotectores/",
        "https://www.solucioncanina.es/calculadora-dosis-condroprotector-perros/",
        "https://www.solucioncanina.es/calculadora-talla-bozal-perros/",
        "https://www.solucioncanina.es/calculadora-talla-cama-ortopedica-perros/",
        "https://www.solucioncanina.es/calculadora-medida-rampa-perros/",
        "https://www.solucioncanina.es/herramientas/",
        "https://www.solucioncanina.es/producto/ejemplo/",
        "https://www.solucioncanina.es/producto/sin-trafico/",
    ]
    payload = {
        "data_state": "final",
        "totals_current": {"clicks": 9, "impressions": 207, "ctr": 9 / 207, "position": 12.4},
        "totals_previous": {"clicks": 7, "impressions": 180, "ctr": 7 / 180, "position": 13.1},
        "totals_30d": {"clicks": 40, "impressions": 900, "ctr": 40 / 900, "position": 28.0},
        "queries": queries,
        "pages_current": pages,
        "pages_previous": prev_pages,
        "pages_30d": pages + [
            {"page": "https://solucioncanina.es/old-slug/", "clicks": 0, "impressions": 15, "ctr": 0.0, "position": 40.0},
        ],
        "query_pages": qpages,
    }
    return payload, sitemap


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Informe semanal accionable de Google Search Console.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Sin clave JSON: python scripts/gsc_weekly_report.py --setup",
    )
    p.add_argument("--setup", action="store_true", help="Imprime la guía de Google Cloud y sale")
    p.add_argument("--credentials", help="Ruta al JSON de la cuenta de servicio")
    p.add_argument("--site", help="Propiedad GSC (sc-domain:… o URL con barra final)")
    p.add_argument("--lag", type=int, default=GSC_LAG_DAYS, help="Días de retraso GSC (defecto: 3)")
    p.add_argument("--end-date", help="Forzar el último día de la ventana (YYYY-MM-DD)")
    p.add_argument("--from-snapshot", help="Regenerar el markdown desde un JSON de scratch/gsc/")
    p.add_argument("--self-test", action="store_true", help="Valida el informe con datos sintéticos")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.setup:
        print(SETUP_GUIDE)
        return 0

    SCRATCH.mkdir(exist_ok=True)
    HIST_DIR.mkdir(parents=True, exist_ok=True)

    if args.self_test:
        payload, sitemap = synthetic_payload()
        today = date(2026, 9, 11)
        cs, ce, ps, pe, d30s, d30e = last_complete_window(today, 3)
        meta = {
            "generated_at": "self-test",
            "site": "sc-domain:solucioncanina.es",
            "client_email": "gsc-semanal@test.iam.gserviceaccount.com",
            "lag_days": 3,
            "current_start": cs.isoformat(),
            "current_end": ce.isoformat(),
            "previous_start": ps.isoformat(),
            "previous_end": pe.isoformat(),
            "days30_start": d30s.isoformat(),
            "days30_end": d30e.isoformat(),
            "data_state": "final",
            "snapshot_path": "scratch/gsc/self-test.json",
            "history_weeks": 0,
        }
        report = build_report(payload, sitemap, meta, None)
        md = render_markdown(report)
        needed = ["## Quick wins", "## CTR bajo", "## Caídas", "## Contenido huérfano", "## Calculadoras", "## Tres acciones"]
        missing = [h for h in needed if h not in md]
        if missing or len(report["actions"]) != 3:
            print("self-test FAIL", missing, len(report["actions"]), file=sys.stderr)
            return 1
        print("self-test ok", f"{len(md)} chars", f"{len(report['quick_wins'])} quick wins")
        return 0

    if args.from_snapshot:
        snap = Path(args.from_snapshot)
        if not snap.is_absolute():
            snap = ROOT / snap
        prev_report = json.loads(snap.read_text(encoding="utf-8"))
        payload = {
            "data_state": (prev_report.get("meta") or {}).get("data_state", "final"),
            "totals_current": prev_report["totals_current"],
            "totals_previous": prev_report["totals_previous"],
            "totals_30d": prev_report["totals_30d"],
            "queries": prev_report.get("queries") or [],
            "pages_current": prev_report.get("pages_current") or [],
            "pages_previous": prev_report.get("pages_previous") or [],
            "pages_30d": prev_report.get("pages_30d") or [],
            "query_pages": prev_report.get("query_pages") or [],
        }
        sitemap = prev_report.get("sitemap_urls") or []
        meta = dict(prev_report.get("meta") or {})
        report = build_report(payload, sitemap, meta, None)
        dated = SCRATCH / f"informe-gsc-{meta.get('current_end', 'replay')}.md"
        latest = SCRATCH / "informe-gsc.md"
        text = render_markdown(report)
        dated.write_text(text, encoding="utf-8")
        latest.write_text(text, encoding="utf-8")
        print(f"✓ Regenerado {latest.relative_to(ROOT)}")
        return 0

    cred_file = credentials_path(args.credentials)
    if cred_file is None or not cred_file.exists():
        print("No encuentro la clave de la cuenta de servicio.", file=sys.stderr)
        print("Guía paso a paso:  python scripts/gsc_weekly_report.py --setup", file=sys.stderr)
        print("Ruta esperada:     scratch/gsc/service-account.json", file=sys.stderr)
        print("Saltar el informe: SKIP_GSC=1 scripts/semanal.sh", file=sys.stderr)
        return 2

    mode = cred_file.stat().st_mode & 0o077
    if mode:
        print(f"Aviso: {cred_file} es legible por grupo/otros. chmod 600 recomendado.", file=sys.stderr)

    session, email = make_session(cred_file)
    site = resolve_site(session, args.site or os.environ.get("GSC_SITE"))
    print(f"GSC · propiedad {site} · {email}")

    if args.end_date:
        end = date.fromisoformat(args.end_date)
        today = end + timedelta(days=args.lag)
    else:
        today = date.today()
    cs, ce, ps, pe, d30s, d30e = last_complete_window(today, args.lag)
    print(f"Ventana {fmt_range(cs, ce)}  (anterior {fmt_range(ps, pe)})")

    windows = {"current": (cs, ce), "previous": (ps, pe), "days30": (d30s, d30e)}
    payload = fetch_payload(session, site, windows, "final")

    try:
        sitemap = load_sitemap()
        print(f"Sitemap · {len(sitemap)} URLs")
    except Exception as exc:
        print(f"Aviso: sitemap no disponible ({exc}). Huérfanos incompletos.", file=sys.stderr)
        sitemap = []

    prev, n_hist = load_previous_snapshot(ce)
    snap_path = HIST_DIR / f"{ce.isoformat()}.json"
    meta = {
        "generated_at": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z"),
        "site": site,
        "client_email": email,
        "lag_days": args.lag,
        "current_start": cs.isoformat(),
        "current_end": ce.isoformat(),
        "previous_start": ps.isoformat(),
        "previous_end": pe.isoformat(),
        "days30_start": d30s.isoformat(),
        "days30_end": d30e.isoformat(),
        "data_state": payload["data_state"],
        "snapshot_path": str(snap_path.relative_to(ROOT)),
        "history_weeks": n_hist,
    }
    report = build_report(payload, sitemap, meta, prev)

    snap_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md = render_markdown(report)
    dated = SCRATCH / f"informe-gsc-{ce.isoformat()}.md"
    latest = SCRATCH / "informe-gsc.md"
    dated.write_text(md, encoding="utf-8")
    latest.write_text(md, encoding="utf-8")
    print_actions(report, latest, snap_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
