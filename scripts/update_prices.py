#!/usr/bin/env python3
"""
Actualitza el catàleg amb el que mostra ara Amazon.es (una petició per producte).

Per cada producte (`src/content/articulos/<slug>/index.json`) llegeix la fitxa
/dp/{ASIN}/ (sense tag d'afiliat) amb `amazon.AmazonClient` i en treu, en una
sola passada (`amazon.parse_product_page`):
    * preu actual                 -> `precio`
    * preu tatxat + badge -NN%    -> `precioOriginal`, `descuentoPct` (només si
                                     Amazon mostra tots dos i són coherents)
    * compres el mes passat       -> `ventas` (si Amazon ja no ho mostra, es treu)
    * nota i nº de valoracions    -> `valoracion`, `valoracionesCount` (la real,
                                     encara que sigui baixa: la web amaga < 3,7)
    * títol                       -> `nombre` («Nombre en Amazon», sense la marca)
    * imatge principal            -> `imagen`, NOMÉS si falta (JPEG ≤ 1000 px)
    * «Acerca de este producto»   -> `descripcion`, NOMÉS si falta
i apunta la data a `src/data/precios-consultados.json` («Precio consultado el …»).

Per defecte NO elimina res:
    * No disponible / la fitxa ja no existeix (404): es treu el preu (la web
      l'amaga a totes les llistes) i es posa `disponible: false` a la fitxa.
      Quan torna a tenir preu, es treu la marca.
    * Nota < 3,7 o < 10 valoracions, ASIN canviat, canvi de preu > 50 % no
      confirmat en una segona lectura, preu no llegit: van a «A revisar» de
      l'informe, perquè ho decideixi una persona.
Amb `--prune`, el comportament antic: elimina les fitxes que no compleixen
(carpeta + imatges), crea els 301 a nginx/vercel.json i avisa dels posts que
les enllacen. `--refill-deleted` implica `--prune` i, per cada categoria amb
baixes, crida `find_new_products.py` per substituir-les.

Robustesa (vegeu `amazon.AmazonClient`): visita inicial a la portada, pausa
aleatòria entre peticions, reintents amb espera i aturada neta després de
3 CAPTCHA seguits (no es toca res del que no s'ha pogut llegir).

Informe de cada execució: `scratch/productos/informe-AAAAMMDD-HHMM.md`
(i `scratch/productos/ultimo.md`), fora de git.

Codis de sortida: 0 = bé; 3 = aturat per CAPTCHA (tornar-ho a provar més tard).

Ús:
    python scripts/update_prices.py                 # tot el catàleg
    python scripts/update_prices.py --dry-run       # llegeix Amazon, no escriu res
    python scripts/update_prices.py --only=<carpeta> --limit=5
    python scripts/update_prices.py --no-images     # no baixa imatges que faltin
    python scripts/update_prices.py --prune [--refill-deleted]
"""

from __future__ import annotations

import copy
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from amazon import (  # noqa: E402
    AmazonBlocked,
    AmazonClient,
    FetchResult,
    ProductPage,
    _euro_str,
    _parse_eur,
    parse_product_page,
)
from _common import extract_asin as _extract_asin  # noqa: E402
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
# Data de l'última consulta de preu per producte (slug → AAAA-MM-DD). La web la
# mostra al costat del preu («Precio en Amazon.es consultado el …»).
PRECIOS_CONSULTADOS_PATH = ROOT / "src" / "data" / "precios-consultados.json"

# Mateixa política que `find_new_products.py`: no mostrar ni persistir notes baixes.
MIN_CATALOG_RATING = 3.7
MIN_CATALOG_REVIEWS = 10



# ---------------------------------------------------------------------------
# Eliminació de productes (no disponible / valoració baixa / poques ressenyes)
# ---------------------------------------------------------------------------

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

# Un canvi de preu més gran que això (±50 %) es torna a llegir abans d'aplicar-lo:
# sol ser una variant o un mòdul de la pàgina mal llegit, no un canvi real.
CAMBIO_PRECIO_SOSPECHOSO = 0.5

MOTIVOS_BAJA = {
    "no_disponible": "no disponible a Amazon",
    "valoracio_baixa": f"valoració < {MIN_CATALOG_RATING}",
    "pocs_reviews": f"menys de {MIN_CATALOG_REVIEWS} valoracions",
}


@dataclass
class Resultado:
    """Què ha passat amb un producte en aquesta execució."""

    estado: str = "ok"  # "ok" | "no_disponible" | "sin_oferta" | "sin_precio" | "asin_cambiado"
    cambios: list[str] = field(default_factory=list)
    avisos: list[tuple[str, str]] = field(default_factory=list)  # (tipus, text) per revisar
    motivo_baja: str | None = None  # criteri d'eliminació; només s'aplica amb --prune
    fecha_consulta: bool = False  # preu (o no disponibilitat) llegit avui a Amazon
    precio_antes: str | None = None
    precio_despues: str | None = None
    oferta_antes: int | None = None
    oferta_despues: int | None = None
    vuelve_disponible: bool = False
    imagen_nueva: bool = False
    descripcion_nueva: bool = False


def _corto(value, n: int = 60) -> str:
    s = str(value)
    return s if len(s) <= n else s[: n - 1] + "…"


def _set(data: dict, key: str, value, cambios: list[str]) -> None:
    """Escriu (o treu, si `value` és None) un camp i apunta el canvi."""
    old = data.get(key)
    if value is None:
        if key in data:
            data.pop(key)
            cambios.append(f"{key}: {_corto(old)} -> (ja no es mostra)")
    elif old != value:
        data[key] = value
        cambios.append(f"{key}: {'—' if old is None else _corto(old)} -> {_corto(value)}")


def _imagen_ok(data: dict) -> bool:
    rel = (data.get("imagen") or "").lstrip("/")
    return bool(rel) and (ROOT / "public" / rel).is_file()


def _marcar_no_disponible(data: dict, r: Resultado) -> None:
    """Sense preu a la web (s'amaga a totes les llistes) i `disponible: false` per a la fitxa."""
    for key in ("precio", "precioOriginal", "descuentoPct", "ventas"):
        _set(data, key, None, r.cambios)
    _set(data, "disponible", False, r.cambios)
    r.estado = "no_disponible"
    r.motivo_baja = "no_disponible"
    r.fecha_consulta = True


def actualizar_producto(
    data: dict,
    page: ProductPage | None,
    *,
    folder: str,
    asin: str,
    client: AmazonClient,
    dry_run: bool,
    imagenes: bool,
) -> Resultado:
    """Aplica a `data` tot el que mostra ara la fitxa d'Amazon. `page=None` = 404."""
    r = Resultado(precio_antes=data.get("precio"), oferta_antes=data.get("descuentoPct"))

    if page is None:
        _marcar_no_disponible(data, r)
        r.avisos.append(("no_existeix", "La fitxa ja no existeix a Amazon (404): substituir o retirar el producte."))
        return r

    if page.asin and page.asin != asin:
        # Les dades serien d'un altre producte: no es toca res fins que algú ho revisi.
        r.estado = "asin_cambiado"
        r.avisos.append((
            "asin",
            f"Amazon serveix l'ASIN {page.asin} en lloc de {asin} (variant o producte substituït): "
            "no s'ha actualitzat res; revisar l'enllaç.",
        ))
        r.precio_despues = r.precio_antes
        r.oferta_despues = r.oferta_antes
        return r

    # Preu, oferta, disponibilitat i vendes: només el que Amazon mostra ara mateix.
    if page.unavailable:
        _marcar_no_disponible(data, r)
    elif page.price is not None:
        aplicar = True
        anterior = _parse_eur(data.get("precio") or "")
        if anterior and abs(page.price - anterior) / anterior > CAMBIO_PRECIO_SOSPECHOSO:
            segona = client.fetch_product(asin)
            confirmat = parse_product_page(segona.html).price if segona.status == "ok" else None
            if confirmat != page.price:
                aplicar = False
                r.avisos.append((
                    "precio",
                    f"Canvi de preu {anterior:.2f}€ → {page.price:.2f}€ no confirmat en una segona lectura "
                    f"({confirmat}); es manté l'anterior.",
                ))
        if aplicar:
            _set(data, "precio", _euro_str(page.price), r.cambios)
            oferta = page.offer
            _set(data, "precioOriginal", _euro_str(oferta[0]) if oferta else None, r.cambios)
            _set(data, "descuentoPct", oferta[1] if oferta else None, r.cambios)
            if data.get("disponible") is False:
                _set(data, "disponible", None, r.cambios)
                r.vuelve_disponible = True
            r.fecha_consulta = True
        _set(data, "ventas", page.monthly_sales, r.cambios)
    elif page.no_featured_offer:
        # Es pot comprar (venedors externs), però Amazon no dona preu: la web en treu
        # el preu vell i mostra «Ver precio en Amazon». No és «no disponible».
        for key in ("precio", "precioOriginal", "descuentoPct"):
            _set(data, key, None, r.cambios)
        _set(data, "disponible", None, r.cambios)
        _set(data, "ventas", page.monthly_sales, r.cambios)
        r.estado = "sin_oferta"
        r.fecha_consulta = True
    else:
        r.estado = "sin_precio"
        r.avisos.append(("sin_precio", "No s'ha pogut llegir el preu (i Amazon no diu que estigui esgotat): es manté l'anterior."))

    # Valoració real encara que sigui baixa: la web ja amaga les estrelles < 3,7.
    if page.rating is not None:
        _set(data, "valoracion", round(page.rating, 1), r.cambios)
    if page.rating_count is not None:
        _set(data, "valoracionesCount", int(page.rating_count), r.cambios)
    reviews = page.rating_count if page.rating_count is not None else _coerce_review_count_json(data.get("valoracionesCount"))
    if r.motivo_baja is None:
        if page.rating is not None and page.rating < MIN_CATALOG_RATING:
            r.motivo_baja = "valoracio_baixa"
            r.avisos.append(("nota", f"Nota {page.rating} a Amazon (< {MIN_CATALOG_RATING}): decidir si es manté al catàleg."))
        elif reviews is not None and reviews < MIN_CATALOG_REVIEWS:
            r.motivo_baja = "pocs_reviews"
            r.avisos.append(("nota", f"Només {reviews} valoracions a Amazon (< {MIN_CATALOG_REVIEWS})."))

    # «Nombre en Amazon» de la fitxa, sense la marca al davant.
    if page.title and len(page.title) >= 15:
        _set(data, "nombre", _strip_brand_prefix(page.title, data.get("marca")), r.cambios)

    # Descripció: només si no n'hi ha (no trepitja text editorial).
    if not data.get("descripcion") and page.description:
        _set(data, "descripcion", page.description, r.cambios)
        r.descripcion_nueva = True

    # Imatge: només si falta o el fitxer no hi és.
    if imagenes and page.image_url and not _imagen_ok(data):
        r.imagen_nueva = True
        if dry_run:
            r.cambios.append("imagen: (es baixaria de la fitxa d'Amazon)")
        else:
            try:
                client.download_image(page.image_url, IMAGES_DIR / folder / "imagen.jpg")
                _set(data, "imagen", f"/images/articulos/{folder}/imagen.jpg", r.cambios)
            except Exception as e:  # noqa: BLE001 — una imatge no ha d'aturar l'execució
                r.imagen_nueva = False
                r.avisos.append(("imagen", f"No s'ha pogut baixar la imatge: {e}"))

    r.precio_despues = data.get("precio")
    r.oferta_despues = data.get("descuentoPct")
    return r


# ---------------------------------------------------------------------------
# Informe de l'execució (scratch/productos/, fora de git)
# ---------------------------------------------------------------------------

INFORMES_DIR = ROOT / "scratch" / "productos"


class Informe:
    def __init__(self, *, dry_run: bool, prune: bool) -> None:
        self.inicio = datetime.now()
        self.dry_run = dry_run
        self.prune = prune
        self.productos: list[tuple[str, str, Resultado]] = []
        self.fallos: list[tuple[str, str, str]] = []
        self.eliminados: list[tuple[str, str, str]] = []
        self.bloqueado: str | None = None

    @staticmethod
    def _nombre(slug: str, data: dict) -> str:
        return data.get("nombreCorto") or data.get("nombre") or slug

    def producto(self, slug: str, data: dict, r: Resultado) -> None:
        self.productos.append((slug, self._nombre(slug, data), r))

    def fallo(self, slug: str, data: dict, motivo: str) -> None:
        self.fallos.append((slug, self._nombre(slug, data), motivo))

    def eliminado(self, slug: str, data: dict, motivo: str) -> None:
        self.eliminados.append((slug, self._nombre(slug, data), motivo))

    def markdown(self, *, total: int, peticiones: int) -> str:
        P = self.productos
        con_cambios = [p for p in P if p[2].cambios]
        no_disp = [p for p in P if p[2].estado == "no_disponible"]
        revisar = [(s, n, a) for s, n, r in P for a in r.avisos]
        out = [f"# Actualització de productes · {self.inicio:%Y-%m-%d %H:%M}", ""]
        if self.dry_run:
            out += ["> **Prova (`--dry-run`)**: no s'ha escrit res al catàleg.", ""]
        if self.bloqueado:
            out += [f"> ⛔ **Execució aturada**: {self.bloqueado} Torna-ho a provar d'aquí unes hores.", ""]
        out += [
            "| Revisats | Amb canvis | Sense canvis | No disponibles | A revisar | No llegits | Peticions a Amazon |",
            "|---|---|---|---|---|---|---|",
            f"| {len(P)} de {total} | {len(con_cambios)} | {len(P) - len(con_cambios)} | {len(no_disp)} "
            f"| {len(revisar)} | {len(self.fallos)} | {peticiones} |",
            "",
        ]

        canvis_preu = []
        for s, n, r in P:
            a, d = _parse_eur(r.precio_antes or ""), _parse_eur(r.precio_despues or "")
            if a and d and abs(a - d) >= 0.01:
                canvis_preu.append((abs(d - a) / a, n, a, d))
        if canvis_preu:
            out += ["## Preus que han canviat", "", "| Producte | Abans | Ara | Canvi |", "|---|---|---|---|"]
            for pct, n, a, d in sorted(canvis_preu, reverse=True):
                out.append(f"| {n} | {a:.2f} € | {d:.2f} € | {'+' if d > a else '−'}{pct:.0%} |")
            out.append("")

        noves = [(n, r.oferta_despues) for s, n, r in P if r.oferta_despues and not r.oferta_antes]
        acabades = [n for s, n, r in P if r.oferta_antes and not r.oferta_despues]
        if noves or acabades:
            out += ["## Ofertes", ""]
            out += [f"- 🟢 Nova: **{n}** (−{pct} %)" for n, pct in noves]
            out += [f"- ⚪ Acabada: {n}" for n in acabades]
            out.append("")

        if no_disp:
            out += ["## No disponibles a Amazon", "", "La web n'amaga el preu i la fitxa ho indica. Si dura setmanes, substituir-los.", ""]
            out += [f"- {n} (`{s}`)" for s, n, r in no_disp]
            out.append("")
        sin_oferta = [p for p in P if p[2].estado == "sin_oferta"]
        if sin_oferta:
            out += [
                "## Sense preu destacat a Amazon",
                "",
                "Només «Ver todas las opciones de compra» (venedors externs): la web en treu el preu i "
                "mostra «Ver precio en Amazon». Si dura, potser convé una alternativa.",
                "",
            ]
            out += [f"- {n} (`{s}`)" for s, n, r in sin_oferta]
            out.append("")
        tornen = [n for s, n, r in P if r.vuelve_disponible]
        if tornen:
            out += ["## Tornen a estar disponibles", ""] + [f"- {n}" for n in tornen] + [""]

        if revisar:
            out += ["## A revisar (decisió editorial)", ""]
            out += [f"- **{n}** (`{s}`): {texto}" for s, n, (_, texto) in revisar]
            out.append("")

        afegits = [(n, r) for s, n, r in P if r.imagen_nueva or r.descripcion_nueva]
        if afegits:
            out += ["## Imatges i descripcions afegides", ""]
            for n, r in afegits:
                que = " i ".join(x for x, ok in (("imatge", r.imagen_nueva), ("descripció", r.descripcion_nueva)) if ok)
                out.append(f"- {n}: {que}")
            out.append("")

        if self.eliminados:
            out += ["## Eliminats (`--prune`)", ""] + [f"- {n} (`{s}`): {m}" for s, n, m in self.eliminados] + [""]

        if self.fallos:
            out += ["## No s'han pogut llegir", "", "Es manté tot com estava; es tornaran a provar a la propera execució.", ""]
            out += [f"- {n} (`{s}`): {m}" for s, n, m in self.fallos]
            out.append("")
        return "\n".join(out)

    def escribir(self, *, total: int, peticiones: int) -> Path:
        INFORMES_DIR.mkdir(parents=True, exist_ok=True)
        texto = self.markdown(total=total, peticiones=peticiones)
        sufijo = "-prova" if self.dry_run else ""
        path = INFORMES_DIR / f"informe-{self.inicio:%Y%m%d-%H%M}{sufijo}.md"
        path.write_text(texto + "\n", encoding="utf-8")
        (INFORMES_DIR / "ultimo.md").write_text(texto + "\n", encoding="utf-8")
        return path


# ---------------------------------------------------------------------------
# IO
# ---------------------------------------------------------------------------

def load_precios_consultados() -> dict[str, str]:
    try:
        return json.loads(PRECIOS_CONSULTADOS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_precios_consultados(fechas: dict[str, str]) -> None:
    """Desa les dates, sense els productes que ja no existeixen."""
    vivos = _live_product_slugs()
    fechas = {k: v for k, v in sorted(fechas.items()) if k in vivos}
    PRECIOS_CONSULTADOS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRECIOS_CONSULTADOS_PATH.write_text(
        json.dumps(fechas, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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
    refill_deleted = "--refill-deleted" in argv
    args = {
        "dry_run": "--dry-run" in argv,
        "refill_deleted": refill_deleted,
        # Substituir eliminats només té sentit si s'elimina.
        "prune": "--prune" in argv or refill_deleted,
        "imagenes": "--no-images" not in argv,
        "only": None,
        "limit": None,
    }
    for a in argv:
        if a.startswith("--only="):
            args["only"] = a.split("=", 1)[1]
        if a.startswith("--limit="):
            try:
                args["limit"] = int(a.split("=", 1)[1])
            except ValueError:
                pass
    return args


def main() -> int:
    # Línia a línia també quan la sortida va a un fitxer o al journal (timer de systemd).
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    args = parse_args(sys.argv[1:])
    dry_run = args["dry_run"]
    prune = args["prune"]

    products = sorted(ARTICULOS_DIR.glob("*/index.json"))
    if args["only"]:
        products = [p for p in products if p.parent.name == args["only"]]
    if args["limit"]:
        products = products[: args["limit"]]
    print(f"Trobats {len(products)} productes.\n")

    client = AmazonClient()
    informe = Informe(dry_run=dry_run, prune=prune)

    updated = []
    failed = []
    removed_by_cat: Counter[str] = Counter()
    removed_by_reason: Counter[str] = Counter()
    n_removed = 0
    redirect_candidates: list[tuple[str, str]] = []
    removed_folders: set[str] = set()
    removed_aliases: dict[str, set[str]] = {}
    precios_consultados = load_precios_consultados()
    hoy = date.today().isoformat()

    for n_item, json_path in enumerate(products, 1):
        data = load_json(json_path)
        slug = json_path.parent.name
        name = data.get("nombre", slug)
        asin = _extract_asin(data.get("linkAmazon", ""))

        print(f"[{n_item}/{len(products)}] {slug}")

        if not asin:
            print("  SKIP: linkAmazon sense ASIN")
            failed.append((name, "sense ASIN"))
            informe.fallo(slug, data, "linkAmazon sense ASIN")
            continue

        # Scraping SEMPRE amb URL neta (sense ?tag=): visitar Amazon amb el tag
        # des d'un script genera clics d'afiliat falsos (risc de ban + dades brutes).
        print(f"  URL: {_amazon_scrape_url(data['linkAmazon'])}")

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

        original = copy.deepcopy(data)
        try:
            res = client.fetch_product(asin)
            if res.status in ("ok", "no_existeix"):
                try:
                    page = parse_product_page(res.html) if res.status == "ok" else None
                    resultado = actualizar_producto(
                        data, page, folder=slug, asin=asin, client=client,
                        dry_run=dry_run, imagenes=args["imagenes"],
                    )
                except AmazonBlocked:
                    raise
                except Exception as e:  # noqa: BLE001 — una fitxa rara no atura el catàleg
                    data = copy.deepcopy(original)
                    res = FetchResult("error", detail=f"no s'ha pogut processar la fitxa ({type(e).__name__}: {e})")
        except AmazonBlocked as e:
            informe.bloqueado = str(e)
            informe.fallo(slug, data, "CAPTCHA: execució aturada")
            failed.append((name, "CAPTCHA (execució aturada)"))
            print(f"  ⛔ {e}")
            break

        if res.status not in ("ok", "no_existeix"):
            motiu = {"captcha": "CAPTCHA d'Amazon", "error": "error"}.get(res.status, res.status)
            if res.detail:
                motiu = f"{motiu}: {res.detail}"
            print(f"  -> NO TROBAT ({motiu})")
            failed.append((name, motiu))
            informe.fallo(slug, data, motiu)
            # Encara així pot ser que tinguem canvis de nombre/slug a guardar.
            if (name_changed or slug_added) and not dry_run:
                save_json(json_path, data)
            continue

        if prune and resultado.motivo_baja:
            cat_raw = (original.get("categoria") or "").strip()
            cat = cat_raw or "Sense categoria"
            label = MOTIVOS_BAJA.get(resultado.motivo_baja, resultado.motivo_baja)
            alias_list = product_redirect_slugs(original, slug)
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
            removed_by_reason[resultado.motivo_baja] += 1
            n_removed += 1
            informe.eliminado(slug, original, label)
            continue

        if resultado.fecha_consulta:
            precios_consultados[data.get("slug") or _slugify(data.get("nombre") or slug)] = hoy
        informe.producto(slug, data, resultado)

        if resultado.cambios or name_changed or slug_added:
            if not dry_run:
                save_json(json_path, data)
            print("  -> ACTUALITZAT")
            if name_changed:
                print("     · nombre netejat (marca treta)")
            if slug_added:
                print("     · slug preservat al JSON")
            for line in resultado.cambios:
                print(f"     · {line}")
            updated.append((name, resultado.cambios or ["(neteja nombre/slug)"]))
        else:
            print("  -> sense canvis")
        if resultado.estado == "no_disponible":
            print("  · NO DISPONIBLE a Amazon: la web n'amaga el preu")
        elif resultado.estado == "sin_oferta":
            print("  · Sense preu destacat a Amazon (només altres venedors): la web n'amaga el preu")
        for _, texto in resultado.avisos:
            print(f"  ⚠ {texto}")

    if not dry_run:
        save_precios_consultados(precios_consultados)
        print(f"Dates de consulta de preu desades a {PRECIOS_CONSULTADOS_PATH}")

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

    path = informe.escribir(total=len(products), peticiones=client.requests_made)
    print(f"\nInforme: {path.relative_to(ROOT)}")
    if informe.bloqueado:
        print(f"⛔ {informe.bloqueado} Torna-ho a provar d'aquí unes hores.")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
