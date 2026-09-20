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
    En eliminar una fitxa s'afegeix un **301** cap a `/categoria/<slug>/` a
    `deploy/nginx/redirects.conf` (dos blocs: amb i sense barra final) i a
    `vercel.json`. Idempotent: si el source ja existeix, no es duplica. Si la
    categoria queda buida (o el producte no en té), el destí és `/productos/`.
    Al final: **nombre total eliminat**, **desglossament per categoria**
    (secció), **redirects creats** i, si algun post MDX del blog enllaça una
    fitxa eliminada (`/producto/<slug>/` o `productosRecomendados`), **avís
    amb la llista de fitxers** per corregir-los abans del deploy (el
    comprovador d'enllaços del build fallaria). En CAPTCHA o error de xarxa
    **no** s'elimina res. El snippet de nginx **no** viatja amb
    `./deploy/deploy.sh`: cal copiar-lo al VPS a mà (l'avís final mostra el
    comandament).
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
from _common import amazon_scrape_url as _amazon_scrape_url  # noqa: E402

ROOT = Path(__file__).parent.parent
ARTICULOS_DIR = ROOT / "src" / "content" / "articulos"
BLOG_DIR = ROOT / "src" / "content" / "blog"
IMAGES_DIR = ROOT / "public" / "images" / "articulos"
NGINX_REDIRECTS_PATH = ROOT / "deploy" / "nginx" / "redirects.conf"
VERCEL_JSON_PATH = ROOT / "vercel.json"
# Comandament que ja s'usa per pujar el snippet (el rsync de deploy.sh no el toca).
NGINX_VPS_SYNC_CMD = "rsync -avz deploy/nginx/redirects.conf jan@ion:/tmp/"
PRODUCTOS_FALLBACK_DEST = "/productos/"

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


# ---------------------------------------------------------------------------
# Posts MDX que enllacen fitxes eliminades (avís pre-deploy)
# ---------------------------------------------------------------------------

# href="/producto/slug/", markdown ](/producto/slug/), AffiliateBox link=…
_PRODUCTO_HREF_RE = re.compile(r"/producto/([A-Za-z0-9][A-Za-z0-9-]*)")
_FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---", re.DOTALL)
_YAML_LIST_ITEM_RE = re.compile(r"^[ \t]+-[ \t]+(.+?)\s*$")


def _frontmatter_block(text: str) -> str:
    m = _FRONTMATTER_RE.match(text)
    return m.group(1) if m else ""


def _yaml_list_items_for_key(frontmatter: str, key: str) -> list[str]:
    """Ítems d'una clau YAML en bloc (`- slug`) o inline (`[a, b]`)."""
    m = re.search(
        rf"^{re.escape(key)}:[ \t]*(?:\[([^\]]*)\][ \t]*$|[ \t]*$)",
        frontmatter,
        re.MULTILINE,
    )
    if not m:
        return []
    if m.group(1) is not None:
        items: list[str] = []
        for part in m.group(1).split(","):
            s = part.strip().strip("'\"").strip()
            if s:
                items.append(s)
        return items
    items = []
    after = frontmatter[m.end() :]
    if after.startswith("\r\n"):
        after = after[2:]
    elif after.startswith("\n"):
        after = after[1:]
    for line in after.splitlines():
        if not line.strip():
            break
        lm = _YAML_LIST_ITEM_RE.match(line)
        if not lm:
            break
        raw = lm.group(1).strip()
        if raw.startswith("{") or ":" in raw:
            break
        items.append(raw.strip("'\""))
    return items


def extract_mdx_product_refs(text: str) -> set[str]:
    """Slugs citats al cos (`/producto/<slug>/`) i a `productosRecomendados`."""
    refs: set[str] = set()
    for m in _PRODUCTO_HREF_RE.finditer(text):
        refs.add(m.group(1).rstrip("/").lower())
    fm = _frontmatter_block(text)
    if fm:
        for item in _yaml_list_items_for_key(fm, "productosRecomendados"):
            slug = item.strip().strip("/").lower()
            if slug:
                refs.add(slug)
    return refs


def find_mdx_posts_linking(target_slugs: set[str]) -> dict[str, list[str]]:
    """Retorna `{slug: [rutes relatives]}` per als posts MDX que citen aquests slugs."""
    wanted = {s.strip("/").lower() for s in target_slugs if s}
    if not wanted or not BLOG_DIR.is_dir():
        return {}
    hits: dict[str, set[str]] = {s: set() for s in wanted}
    for path in sorted(BLOG_DIR.rglob("*.mdx")):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        rel = path.relative_to(ROOT).as_posix()
        for slug in extract_mdx_product_refs(text) & wanted:
            hits[slug].add(rel)
    return {s: sorted(files) for s, files in hits.items() if files}


def report_mdx_links_to_removed(
    removed_aliases: dict[str, set[str]],
    *,
    dry_run: bool,
) -> None:
    """Imprimeix els posts MDX que enllacen fitxes eliminades (o que s'eliminarien)."""
    if not removed_aliases:
        return
    all_aliases: set[str] = set()
    for aliases in removed_aliases.values():
        all_aliases.update(a.strip("/").lower() for a in aliases if a)
    by_slug = find_mdx_posts_linking(all_aliases)

    grouped: list[tuple[str, list[str], list[str]]] = []
    all_files: set[str] = set()
    for folder, aliases in sorted(removed_aliases.items()):
        files: set[str] = set()
        alias_list = sorted({a.strip("/").lower() for a in aliases if a})
        for a in alias_list:
            files.update(by_slug.get(a, []))
        if files:
            grouped.append((folder, alias_list, sorted(files)))
            all_files.update(files)
    if not grouped:
        return

    print("\n" + "!" * 60)
    if dry_run:
        print("⚠  POSTS MDX QUE ENLLACEN FITXES QUE S'ELIMINARIEN")
        print("   Actualitzeu-los abans de desplegar si confirmeu l'eliminació.")
    else:
        print("⚠  POSTS MDX QUE ENLLACEN FITXES ELIMINADES")
        print("   Corregiu-los abans del deploy (el comprovador d'enllaços del build fallarà).")
    print()
    for i, (folder, alias_list, files) in enumerate(grouped):
        if i:
            print()
        print(f"  Fitxa: {folder}")
        extra = [a for a in alias_list if a != folder]
        if extra:
            print("    URL: " + ", ".join(f"/producto/{a}/" for a in extra))
        for f in files:
            print(f"    · {f}")
    print()
    print(f"  Fitxers a revisar ({len(all_files)}):")
    for f in sorted(all_files):
        print(f"    {f}")
    print("!" * 60)


# ---------------------------------------------------------------------------
# Redirects 301 en eliminar una fitxa (nginx + vercel.json)
# ---------------------------------------------------------------------------

_NGINX_LOCATION_RE = re.compile(r"location\s*=\s*(\S+)\s*\{")


def _norm_path(path: str) -> str:
    """`/producto/foo/` i `/producto/foo` es consideren el mateix source."""
    p = (path or "").strip()
    if len(p) > 1:
        p = p.rstrip("/")
    return p or "/"


def product_redirect_slugs(data: dict, folder: str) -> list[str]:
    """Slugs a redirigir: URL pública (`slug` JSON) i, si és diferent, la carpeta."""
    folder = (folder or "").strip().strip("/")
    public = (data.get("slug") or "").strip().strip("/")
    if not public:
        public = _slugify(data.get("nombre") or "") or folder
    out: list[str] = []
    seen: set[str] = set()
    for s in (public, folder):
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _nginx_sources(text: str) -> set[str]:
    return {_norm_path(m.group(1)) for m in _NGINX_LOCATION_RE.finditer(text)}


def _vercel_sources(data: dict) -> set[str]:
    out: set[str] = set()
    for r in data.get("redirects") or []:
        src = r.get("source") if isinstance(r, dict) else None
        if isinstance(src, str):
            out.add(_norm_path(src))
    return out


def _remaining_categorias(*, excluding_folders: set[str] | None = None) -> set[str]:
    skip = excluding_folders or set()
    cats: set[str] = set()
    for p in ARTICULOS_DIR.glob("*/index.json"):
        if p.parent.name in skip:
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        c = (d.get("categoria") or "").strip()
        if c:
            cats.add(c)
    return cats


def _live_product_slugs() -> set[str]:
    live: set[str] = set()
    for p in ARTICULOS_DIR.glob("*/index.json"):
        live.add(p.parent.name)
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        s = (d.get("slug") or "").strip().strip("/")
        if s:
            live.add(s)
    return live


def _dest_for_categoria(categoria: str, remaining: set[str]) -> str:
    cat = (categoria or "").strip()
    if not cat or cat == "Sense categoria":
        return PRODUCTOS_FALLBACK_DEST
    if cat not in remaining:
        return PRODUCTOS_FALLBACK_DEST
    slug = _slugify(cat)
    if not slug:
        return PRODUCTOS_FALLBACK_DEST
    return f"/categoria/{slug}/"


def _nginx_pair(source_no_slash: str, dest: str) -> str:
    if not dest.endswith("/"):
        dest += "/"
    return (
        f"location = {source_no_slash} {{\n"
        f"    return 301 {dest};\n"
        f"}}\n"
        f"location = {source_no_slash}/ {{\n"
        f"    return 301 {dest};\n"
        f"}}\n"
    )


def apply_deleted_product_redirects(
    candidates: list[tuple[str, str]],
    *,
    dry_run: bool,
    excluding_folders: set[str] | None = None,
) -> tuple[list[tuple[str, str]], bool]:
    """Afegeix 301 producte→categoria a nginx i vercel.json, sense duplicar.

    `candidates` és una llista `(slug_url, categoria)`. Retorna
    `(nous [(source, dest)], s'ha modificat nginx)`.
    En dry-run, `excluding_folders` simula les fitxes que s'esborrarien
    per calcular el destí (categoria vs `/productos/`).
    """
    created: list[tuple[str, str]] = []
    nginx_modified = False
    if not candidates:
        return created, nginx_modified

    remaining = _remaining_categorias(
        excluding_folders=excluding_folders if dry_run else None
    )
    live = _live_product_slugs()

    ordered: list[tuple[str, str]] = []
    seen: set[str] = set()
    for slug, cat in candidates:
        slug = (slug or "").strip().strip("/")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        ordered.append((slug, cat))

    nginx_text = ""
    nginx_srcs: set[str] = set()
    if NGINX_REDIRECTS_PATH.is_file():
        nginx_text = NGINX_REDIRECTS_PATH.read_text(encoding="utf-8")
        nginx_srcs = _nginx_sources(nginx_text)
    else:
        print(f"  ⚠ no trobo {NGINX_REDIRECTS_PATH}")

    vercel_data: dict | None = None
    vercel_srcs: set[str] = set()
    if VERCEL_JSON_PATH.is_file():
        try:
            vercel_data = json.loads(VERCEL_JSON_PATH.read_text(encoding="utf-8"))
            vercel_srcs = _vercel_sources(vercel_data)
        except json.JSONDecodeError as e:
            print(f"  ⚠ vercel.json invàlid: {e}")
            vercel_data = None
    else:
        print(f"  ⚠ no trobo {VERCEL_JSON_PATH}")

    nginx_blocks: list[str] = []
    vercel_new: list[dict] = []

    for slug, cat in ordered:
        # En dry-run la fitxa encara és al disc; el check només té sentit
        # després d'un esborrat real (p. ex. el refill ha recreat el mateix slug).
        if not dry_run and slug in live:
            print(f"  ⚠ skip redirect /producto/{slug}: encara existeix al catàleg")
            continue
        dest = _dest_for_categoria(cat, remaining)
        if not dest.endswith("/"):
            dest += "/"
        source = f"/producto/{slug}"
        source_n = _norm_path(source)
        added_any = False

        if source_n not in nginx_srcs:
            nginx_blocks.append(_nginx_pair(source, dest))
            nginx_srcs.add(source_n)
            added_any = True
        if vercel_data is not None and source_n not in vercel_srcs:
            vercel_new.append(
                {
                    "source": source,
                    "destination": dest,
                    "permanent": True,
                }
            )
            vercel_srcs.add(source_n)
            added_any = True
        if added_any:
            created.append((source, dest))

    if dry_run:
        return created, False

    if nginx_blocks:
        new_text = nginx_text.rstrip() + "\n\n" + "\n".join(nginx_blocks)
        if not new_text.endswith("\n"):
            new_text += "\n"
        NGINX_REDIRECTS_PATH.write_text(new_text, encoding="utf-8")
        nginx_modified = True

    if vercel_data is not None and vercel_new:
        redirects = vercel_data.setdefault("redirects", [])
        redirects.extend(vercel_new)
        VERCEL_JSON_PATH.write_text(
            json.dumps(vercel_data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    return created, nginx_modified


def _find_new_products_script() -> Path:
    return Path(__file__).resolve().parent / "find_new_products.py"


def _refill_supported_categories() -> set[str]:
    """Categories per les quals `find_new_products.py` té `CATEGORY_QUERIES`."""
    try:
        import find_new_products as fnp  # noqa: PLC0415

        return set(fnp.CATEGORY_QUERIES.keys())
    except Exception:
        return set()


def _current_slugs() -> set[str]:
    return {p.name for p in ARTICULOS_DIR.iterdir() if p.is_dir()}


def _ollama_up() -> bool:
    """Comprova si Ollama respon a localhost:11434."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=2)
        return r.status_code == 200
    except requests.RequestException:
        return False


def _run_editorial_pipeline_for(new_slugs: list[str]) -> None:
    """Per cada slug nou, executa fetch_reviews → classify_reviews → generate_reviews_v2.

    Si Ollama no està engegat, només es fa el fetch i s'avisa que cal generar
    l'editorial més tard. La generació no és bloquejant per al refill.
    """
    if not new_slugs:
        return
    scripts_dir = Path(__file__).resolve().parent
    only_arg = f"--only={','.join(new_slugs)}"

    print("\n" + "=" * 60)
    print(f"EDITORIAL PIPELINE ({len(new_slugs)} nou/s)")
    for s in new_slugs:
        print(f"  · {s}")

    # 1) fetch_reviews — sempre, fins i tot si Ollama no està up
    print("\n  ▶ fetch_reviews.py")
    proc = subprocess.run(
        [sys.executable, str(scripts_dir / "fetch_reviews.py"), only_arg, "--force"],
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(f"     ⚠ fetch_reviews ha acabat amb codi {proc.returncode}")

    # 2 + 3) Classificació i generació editorial necessiten Ollama
    if not _ollama_up():
        print(
            "\n  ⚠ Ollama no respon a http://localhost:11434 — salto classify+generate.\n"
            "    Executa manualment quan Ollama estigui engegat:\n"
            f"      python scripts/classify_reviews.py {only_arg}\n"
            f"      python scripts/generate_reviews_v2.py {only_arg}"
        )
        return

    print("\n  ▶ classify_reviews.py")
    proc = subprocess.run(
        [sys.executable, str(scripts_dir / "classify_reviews.py"), only_arg],
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(f"     ⚠ classify_reviews ha acabat amb codi {proc.returncode}")

    print("\n  ▶ generate_reviews_v2.py")
    proc = subprocess.run(
        [sys.executable, str(scripts_dir / "generate_reviews_v2.py"), only_arg],
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(f"     ⚠ generate_reviews_v2 ha acabat amb codi {proc.returncode}")


def maybe_refill_deleted(
    removed_by_cat: Counter[str],
    *,
    dry_run: bool,
    do_refill: bool,
) -> None:
    """Per cada secció amb N eliminacions, crida find_new_products per buscar N candidats nous.

    Si s'afegeixen productes nous, després executa el pipeline editorial
    (fetch_reviews + classify_reviews + generate_reviews_v2) restringit als
    slugs nous, perquè quedin amb pros/contras/analisi de seguida.
    """
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

    before = _current_slugs()
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

    after = _current_slugs()
    new_slugs = sorted(after - before)
    _run_editorial_pipeline_for(new_slugs)


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
    redirect_candidates: list[tuple[str, str]] = []
    removed_folders: set[str] = set()
    removed_aliases: dict[str, set[str]] = {}

    for json_path in products:
        data = load_json(json_path)
        slug = json_path.parent.name
        name = data.get("nombre", slug)
        url = data.get("linkAmazon", "")

        print(f"[{slug}]")

        if not url:
            print("  SKIP: sense linkAmazon")
            failed.append((name, "sense URL"))
            continue

        # Scraping SEMPRE amb URL neta (sense ?tag=): visitar Amazon amb el tag
        # des d'un script genera clics d'afiliat falsos (risc de ban + dades brutes).
        scrape_url = _amazon_scrape_url(url)
        print(f"  URL: {scrape_url}")

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
            scrape_url,
            session,
            review_count_json=_coerce_review_count_json(data.get("valoracionesCount")),
        )
        delete_reason = new_data.pop("_delete_reason", None)

        if delete_reason:
            cat_raw = (data.get("categoria") or "").strip()
            cat = cat_raw or "Sense categoria"
            label = {
                "no_disponible": "no disponible a Amazon",
                "valoracio_baixa": f"valoració < {MIN_CATALOG_RATING}",
                "pocs_reviews": f"menys de {MIN_CATALOG_REVIEWS} valoracions",
            }.get(delete_reason, delete_reason)
            alias_list = product_redirect_slugs(data, slug)
            for url_slug in alias_list:
                redirect_candidates.append((url_slug, cat_raw))
            removed_folders.add(slug)
            removed_aliases[slug] = set(alias_list)
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

    # Després del refill: si la categoria encara té productes, el 301 hi apunta;
    # si ha quedat buida, /productos/ (evita destí 404 al link-checker).
    created_redirects, nginx_redirects_changed = apply_deleted_product_redirects(
        redirect_candidates,
        dry_run=dry_run,
        excluding_folders=removed_folders,
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
    if created_redirects:
        verb = "s'haurien creat" if dry_run else "creats"
        print(f"Redirects 301 {verb} ({len(created_redirects)}):")
        for src, dest in created_redirects:
            print(f"  · {src} → {dest}")
    elif n_removed:
        print("Redirects 301: cap de nou (ja existien o sense destí).")

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

    report_mdx_links_to_removed(removed_aliases, dry_run=dry_run)

    if dry_run:
        print("\n[DRY RUN] Cap canvi al disc: ni JSON actualitzats ni carpetes eliminades.")
        if args["refill_deleted"]:
            print("         (--refill-deleted: les crides a find_new_products només s'han llistat més amunt.)")
        if created_redirects:
            print("         (redirects 301: només llistats; no s'ha tocat nginx ni vercel.json.)")

    if nginx_redirects_changed:
        print("\n" + "!" * 60)
        print("⚠  El snippet de nginx NO es desplega amb ./deploy/deploy.sh")
        print("   ni amb semanal.sh (aquest només fa commit + rsync de dist/).")
        print("   Còpia'l al VPS a mà:")
        print()
        print(f"   {NGINX_VPS_SYNC_CMD}")
        print()
        print("   Al VPS, instal·la el snippet i recarrega nginx:")
        print("   sudo install -m 644 /tmp/redirects.conf \\")
        print("     /etc/nginx/snippets/solucioncanina-redirects.conf \\")
        print("     && sudo nginx -t && sudo systemctl reload nginx")
        print("!" * 60)


if __name__ == "__main__":
    main()
