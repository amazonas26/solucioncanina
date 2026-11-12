#!/usr/bin/env python3
"""
Baixa una foto de Pexels o Unsplash, la retalla, la desa en WebP sota `public/`
i n'apunta el crèdit a `src/data/fotos.json` (el web el mostra al peu de la foto).

Només fotos de llicència lliure per a ús comercial (Pexels License, Unsplash
License); res d'Unsplash+ ni de bancs generats amb IA.

Ús:
    # Pexels: n'hi ha prou amb la URL de la fitxa (o l'id numèric)
    python scripts/foto.py https://www.pexels.com/photo/titol-29249412/ /images/blog/slug.webp \\
        --autor "Nom" --alt "Descripció de la foto"

    # Unsplash: la URL directa (images.unsplash.com/photo-…) i la de la fitxa
    python scripts/foto.py "https://images.unsplash.com/photo-…" /images/fotos/nom.webp \\
        --url https://unsplash.com/photos/… --autor "Nom" --alt "…"

Opcions:
    --ratio 16:9      proporció del retall (per defecte 16:9; «original» no retalla)
    --focus 0.5,0.4   centre del retall en fraccions (x, y) de la foto original
    --ancho 1600      amplada final en píxels
    --calidad 74      qualitat WebP
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
from pathlib import Path

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
REGISTRO = ROOT / "src" / "data" / "fotos.json"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def origen(src: str, url: str | None) -> tuple[str, str, str]:
    """(fuente, url de descàrrega, url de la fitxa)."""
    m = re.search(r"pexels\.com/photo/(?:[^/]*-)?(\d+)/?", src) or re.fullmatch(r"(\d+)", src)
    if m:
        pid = m.group(1)
        descarga = f"https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=2400"
        ficha = url or (src if src.startswith("http") else f"https://www.pexels.com/photo/{pid}/")
        return "Pexels", descarga, ficha
    if "images.unsplash.com" in src:
        if not url or "unsplash.com/photos/" not in url:
            sys.exit("Unsplash: cal --url amb la fitxa (https://unsplash.com/photos/…)")
        base = src.split("?", 1)[0]
        if "plus.unsplash.com" in base or "premium_photo" in base:
            sys.exit("Unsplash+ no té llicència lliure: tria una altra foto.")
        return "Unsplash", f"{base}?fm=jpg&q=90&w=2400", url
    sys.exit(f"No reconec l'origen: {src}")


def retallar(im: Image.Image, ratio: str, focus: tuple[float, float]) -> Image.Image:
    if ratio == "original":
        return im
    a, b = (float(x) for x in ratio.split(":"))
    objetivo = a / b
    w, h = im.size
    if w / h > objetivo:  # massa ample: retallem els costats
        nw, nh = round(h * objetivo), h
    else:  # massa alta: retallem a dalt i a baix
        nw, nh = w, round(w / objetivo)
    cx, cy = focus[0] * w, focus[1] * h
    x = min(max(0, round(cx - nw / 2)), w - nw)
    y = min(max(0, round(cy - nh / 2)), h - nh)
    return im.crop((x, y, x + nw, y + nh))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("destino", help="Ruta pública, p. ex. /images/blog/slug.webp")
    ap.add_argument("--autor", required=True)
    ap.add_argument("--alt", required=True)
    ap.add_argument("--url", help="Fitxa de la foto (obligatòria per a Unsplash)")
    ap.add_argument("--ratio", default="16:9")
    ap.add_argument("--focus", default="0.5,0.5")
    ap.add_argument("--ancho", type=int, default=1600)
    ap.add_argument("--calidad", type=int, default=74)
    args = ap.parse_args()

    if not args.destino.startswith("/images/") or not args.destino.endswith(".webp"):
        sys.exit("El destí ha de ser /images/….webp")
    fuente, descarga, ficha = origen(args.src, args.url)

    r = requests.get(descarga, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(r.content))).convert("RGB")
    fx, fy = (float(v) for v in args.focus.split(","))
    im = retallar(im, args.ratio, (fx, fy))
    if im.width > args.ancho:
        im = im.resize((args.ancho, round(im.height * args.ancho / im.width)), Image.LANCZOS)

    out = PUBLIC / args.destino.lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=args.calidad, method=6)

    registro = json.loads(REGISTRO.read_text()) if REGISTRO.exists() else {}
    registro[args.destino] = {
        "alt": args.alt,
        "autor": args.autor,
        "fuente": fuente,
        "url": ficha,
        "ancho": im.width,
        "alto": im.height,
    }
    REGISTRO.write_text(json.dumps(dict(sorted(registro.items())), ensure_ascii=False, indent=2) + "\n")
    print(f"{args.destino}  {im.width}×{im.height}  {out.stat().st_size // 1024} KB  · {args.autor} / {fuente}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
