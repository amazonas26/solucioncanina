#!/usr/bin/env python3
"""Genera pines verticales de Pinterest (1000×1500 PNG) a partir de pines.yaml.

Lee `scripts/pines.yaml` (url, titulo, gancho, plantilla) y escribe PNG en
`scratch/pinterest/`. Las tipografías salen de `public/fonts/` (Inter y
Merriweather en woff2): se descomprimen e instancian a TTF; no se usan
fuentes del sistema.

Plantillas:
  calculadora  — fondo teal a sangre, icono de herramienta, tipografía blanca
  guia         — tarjeta editorial crema sobre teal, icono de documento
  categoria    — cabecera teal + cuerpo crema, retícula de fichas

Uso:
    python scripts/generar_pines.py
    python scripts/generar_pines.py --yaml scripts/pines.yaml --out scratch/pinterest
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import decompress as woff2_decompress
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_YAML = Path(__file__).resolve().parent / "pines.yaml"
DEFAULT_OUT = ROOT / "scratch" / "pinterest"
FONTS_DIR = ROOT / "public" / "fonts"
LOGO_PATH = ROOT / "public" / "logo.png"
DOMAIN = "solucioncanina.es"

PIN_W, PIN_H = 1000, 1500
PLANTILLAS = ("calculadora", "guia", "categoria")

# Marca (global.css): teal del logo, navy del check, neutros.
TEAL = (60, 158, 145)  # #3C9E91
TEAL_400 = (79, 181, 169)
TEAL_600 = (47, 127, 117)
TEAL_700 = (41, 104, 96)
TEAL_800 = (36, 84, 79)
TEAL_SOFT = (213, 240, 236)
TEAL_MIST = (238, 249, 247)
NAVY = (27, 58, 92)  # #1B3A5C
NAVY_800 = (21, 45, 71)
INK = (26, 26, 46)
CREAM = (250, 250, 250)
WHITE = (255, 255, 255)
MUTED = (82, 82, 82)


@dataclass(frozen=True)
class PinSpec:
    url: str
    titulo: str
    gancho: str
    plantilla: str
    slug: str


class BrandFonts:
    """Inter y Merriweather desde public/fonts/, instanciadas por peso."""

    def __init__(self, fonts_dir: Path) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="pines-fonts-")
        self._dir = Path(self._tmp.name)
        inter = self._woff2_to_ttf(fonts_dir / "inter-latin.woff2", "inter-var.ttf")
        merri = self._woff2_to_ttf(fonts_dir / "merriweather-latin.woff2", "merri-var.ttf")
        self.inter_regular = self._weight(inter, 400, "inter-400.ttf")
        self.inter_semibold = self._weight(inter, 600, "inter-600.ttf")
        self.inter_extrabold = self._weight(inter, 800, "inter-800.ttf")
        self.merri_black = self._weight(merri, 900, "merri-900.ttf")

    def face(self, path: Path, size: int) -> ImageFont.FreeTypeFont:
        return ImageFont.truetype(str(path), size=size)

    def _woff2_to_ttf(self, src: Path, dest_name: str) -> Path:
        if not src.is_file():
            raise FileNotFoundError(f"Fuente no encontrada: {src}")
        dest = self._dir / dest_name
        raw = BytesIO()
        with src.open("rb") as fh:
            woff2_decompress(fh, raw)
        raw.seek(0)
        TTFont(raw).save(dest)
        return dest

    def _weight(self, ttf: Path, wght: int, dest_name: str) -> Path:
        dest = self._dir / dest_name
        font = TTFont(ttf)
        if "fvar" in font:
            font = instancer.instantiateVariableFont(font, {"wght": wght})
        font.save(dest)
        return dest


def slug_from_url(url: str) -> str:
    parts = [p for p in url.strip().split("/") if p]
    if not parts:
        raise ValueError(f"URL sin slug: {url!r}")
    return parts[-1]


def norm_plantilla(value: str) -> str:
    s = unicodedata.normalize("NFD", (value or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    aliases = {
        "guias": "guia",
        "guide": "guia",
        "calculadoras": "calculadora",
        "categorias": "categoria",
        "category": "categoria",
        "catalogo": "categoria",
    }
    return aliases.get(s, s)


def load_specs(path: Path) -> list[PinSpec]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise ValueError(f"{path} debe ser una lista YAML con al menos una entrada.")
    specs: list[PinSpec] = []
    for i, raw in enumerate(data, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"Entrada {i} de {path.name} no es un mapeo.")
        missing = [k for k in ("url", "titulo", "gancho", "plantilla") if not str(raw.get(k, "")).strip()]
        if missing:
            raise ValueError(f"Entrada {i} sin campos {', '.join(missing)}.")
        plantilla = norm_plantilla(str(raw["plantilla"]))
        if plantilla not in PLANTILLAS:
            raise ValueError(
                f"Entrada {i}: plantilla {raw['plantilla']!r} inválida "
                f"(usa {', '.join(PLANTILLAS)})."
            )
        url = str(raw["url"]).strip()
        specs.append(
            PinSpec(
                url=url,
                titulo=" ".join(str(raw["titulo"]).split()),
                gancho=" ".join(str(raw["gancho"]).split()),
                plantilla=plantilla,
                slug=slug_from_url(url),
            )
        )
    return specs


def lerp(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))  # type: ignore[return-value]


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    last = max(h - 1, 1)
    for y in range(h):
        px[0, y] = lerp(top, bottom, y / last)
    return strip.resize((w, h), Image.Resampling.BILINEAR)


def wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if font.getlength(trial) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    out: list[str] = []
    for line in lines:
        if font.getlength(line) <= max_width:
            out.append(line)
            continue
        chunk = ""
        for ch in line:
            if chunk and font.getlength(chunk + ch) > max_width:
                out.append(chunk)
                chunk = ch
            else:
                chunk += ch
        if chunk:
            out.append(chunk)
    return _fix_orphan(out, font, max_width)


def _fix_orphan(
    lines: list[str], font: ImageFont.FreeTypeFont, max_width: float
) -> list[str]:
    """Evita una última línea de una sola palabra ('peso' huérfano)."""
    if len(lines) < 2:
        return lines
    last = lines[-1].split()
    prev = lines[-2].split()
    if len(last) != 1 or len(prev) < 2:
        return lines
    candidate_prev = " ".join(prev[:-1])
    candidate_last = f"{prev[-1]} {lines[-1]}"
    if candidate_prev and font.getlength(candidate_last) <= max_width:
        lines[-2] = candidate_prev
        lines[-1] = candidate_last
    return lines


def fit_text(
    text: str,
    font_path: Path,
    max_width: float,
    size_max: int,
    size_min: int,
    max_lines: int,
    line_gap: float = 0.18,
) -> tuple[ImageFont.FreeTypeFont, list[str], float]:
    chosen: tuple[ImageFont.FreeTypeFont, list[str], float] | None = None
    for size in range(size_max, size_min - 1, -2):
        font = ImageFont.truetype(str(font_path), size)
        lines = wrap_lines(text, font, max_width)
        ascent, descent = font.getmetrics()
        line_h = (ascent + descent) * (1 + line_gap)
        if chosen is None or len(lines) <= max_lines:
            chosen = (font, lines, line_h)
        if len(lines) <= max_lines:
            return chosen
    assert chosen is not None
    return chosen


def draw_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    xy: tuple[float, float],
    fill: tuple[int, int, int],
    line_h: float,
    align: str = "left",
    max_width: float | None = None,
) -> float:
    x, y = xy
    for line in lines:
        if align == "center" and max_width is not None:
            tx = x + (max_width - font.getlength(line)) / 2
        else:
            tx = x
        draw.text((tx, y), line, font=font, fill=fill, anchor="lt")
        y += line_h
    return y


def cropped_logo(height: int) -> Image.Image:
    im = Image.open(LOGO_PATH).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    w = max(1, round(im.width * height / im.height))
    return im.resize((w, height), Image.Resampling.LANCZOS)


def paste_center(base: Image.Image, overlay: Image.Image, cx: int, cy: int) -> None:
    x = int(cx - overlay.width / 2)
    y = int(cy - overlay.height / 2)
    base.alpha_composite(overlay, (x, y))


def rounded_rect_layer(
    size: tuple[int, int],
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
    shadow: bool = False,
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    if shadow:
        shade = Image.new("RGBA", size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shade)
        x0, y0, x1, y1 = box
        sd.rounded_rectangle((x0 + 10, y0 + 16, x1 + 10, y1 + 16), radius=radius, fill=(15, 32, 50, 50))
        shade = shade.filter(ImageFilter.GaussianBlur(18))
        layer.alpha_composite(shade)
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill)
    return layer


def circle_layer(size: tuple[int, int], xy: tuple[int, int], r: int, fill: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse((x - r, y - r, x + r, y + r), fill=fill)
    return layer


def make_wrench_icon(size: int, color: tuple[int, int, int]) -> Image.Image:
    """Llave abierta estilizada (plantilla calculadora)."""
    s = 512
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((230, 200, 282, 455), radius=24, fill=255)
    d.ellipse((214, 400, 298, 492), fill=255)
    d.ellipse((236, 422, 276, 470), fill=0)
    d.rounded_rectangle((150, 36, 360, 220), radius=40, fill=255)
    d.rounded_rectangle((210, 16, 300, 150), radius=24, fill=0)
    mask = mask.rotate(-32, resample=Image.Resampling.BICUBIC, center=(s / 2, s / 2))
    colored = Image.new("RGBA", (s, s), (*color, 255))
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(colored, mask=mask)
    return out.resize((size, size), Image.Resampling.LANCZOS)


def make_doc_icon(size: int, ink: tuple[int, int, int], accent: tuple[int, int, int]) -> Image.Image:
    """Documento con líneas (plantilla guía)."""
    s = 256
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((58, 38, 188, 218), radius=18, fill=(*TEAL_SOFT, 255))
    d.rounded_rectangle((70, 28, 200, 208), radius=18, fill=(*WHITE, 255), outline=(*accent, 255), width=8)
    d.polygon([(152, 28), (200, 28), (200, 76)], fill=(*TEAL_SOFT, 255))
    d.line([(152, 28), (152, 76), (200, 76)], fill=(*accent, 255), width=8)
    for i, w in enumerate((92, 78, 64)):
        y = 96 + i * 28
        d.rounded_rectangle((92, y, 92 + w, y + 10), radius=5, fill=(*ink, 255))
    return im.resize((size, size), Image.Resampling.LANCZOS)


def make_grid_icon(size: int, color: tuple[int, int, int]) -> Image.Image:
    """Retícula 2×2 (plantilla categoría)."""
    s = 256
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gap, pad, cell = 16, 40, 80
    for row in range(2):
        for col in range(2):
            x = pad + col * (cell + gap)
            y = pad + row * (cell + gap)
            d.rounded_rectangle((x, y, x + cell, y + cell), radius=16, fill=(*color, 255))
    return im.resize((size, size), Image.Resampling.LANCZOS)


def load_logo() -> Image.Image:
    return cropped_logo(96)


def draw_footer(
    canvas: Image.Image,
    fonts: BrandFonts,
    domain_fill: tuple[int, int, int],
    y: int,
    badge: bool,
) -> None:
    logo = load_logo()
    if badge:
        pad = 18
        bw, bh = logo.width + pad * 2, logo.height + pad * 2
        plate = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ImageDraw.Draw(plate).rounded_rectangle((0, 0, bw - 1, bh - 1), radius=28, fill=(*WHITE, 255))
        plate.alpha_composite(logo, (pad, pad))
        mark = plate
    else:
        mark = logo
    font = fonts.face(fonts.inter_semibold, 28)
    domain_w = font.getlength(DOMAIN)
    gap = 22
    total = mark.width + gap + domain_w
    x = int((PIN_W - total) / 2)
    cy = y
    canvas.alpha_composite(mark, (x, int(cy - mark.height / 2)))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (x + mark.width + gap, cy),
        DOMAIN,
        font=font,
        fill=domain_fill,
        anchor="lm",
    )


def badge_metrics(fonts: BrandFonts, text: str) -> tuple[ImageFont.FreeTypeFont, str, int, int]:
    font = fonts.face(fonts.inter_extrabold, 22)
    label = text.upper()
    pad_x, pad_y = 22, 12
    w = int(font.getlength(label) + pad_x * 2)
    h = 22 + pad_y * 2
    return font, label, w, h


def draw_badge(
    draw: ImageDraw.ImageDraw,
    fonts: BrandFonts,
    text: str,
    xy: tuple[int, int],
    fg: tuple[int, int, int],
    bg: tuple[int, int, int, int],
) -> tuple[int, int, int, int]:
    font, label, w, h = badge_metrics(fonts, text)
    pad_x, pad_y = 22, 12
    x, y = xy
    box = (x, y, x + w, y + h)
    draw.rounded_rectangle(box, radius=22, fill=bg)
    draw.text((x + pad_x, y + pad_y - 1), label, font=font, fill=fg, anchor="lt")
    return box


def draw_ruler(draw: ImageDraw.ImageDraw, x: int, y0: int, y1: int, color: tuple[int, int, int, int]) -> None:
    for i, y in enumerate(range(y0, y1, 18)):
        w = 28 if i % 5 == 0 else 14
        draw.line([(x, y), (x - w, y)], fill=color, width=3)


def render_calculadora(spec: PinSpec, fonts: BrandFonts) -> Image.Image:
    rgb = vertical_gradient((PIN_W, PIN_H), TEAL, TEAL_800)
    canvas = rgb.convert("RGBA")
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (920, -40), 420, (*WHITE, 28)))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (-80, 980), 340, (*NAVY, 28)))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (780, 620), 160, (*WHITE, 18)))

    draw = ImageDraw.Draw(canvas)
    draw_ruler(draw, PIN_W - 36, 120, 1080, (*WHITE, 55))

    draw_badge(draw, fonts, "Calculadora", (72, 72), TEAL_800, (*WHITE, 255))

    icon_bg = circle_layer((PIN_W, PIN_H), (160, 280), 78, (*WHITE, 255))
    canvas.alpha_composite(icon_bg)
    paste_center(canvas, make_wrench_icon(96, TEAL_700), 160, 280)

    draw = ImageDraw.Draw(canvas)
    title_font, title_lines, title_h = fit_text(
        spec.titulo, fonts.merri_black, 840, 78, 52, 4, line_gap=0.08
    )
    hook_font, hook_lines, hook_h = fit_text(
        spec.gancho, fonts.inter_regular, 840, 32, 24, 5, line_gap=0.28
    )
    y = 400
    y = draw_lines(draw, title_lines, title_font, (72, y), WHITE, title_h)
    y += 28
    draw.rounded_rectangle((72, y, 160, y + 8), radius=4, fill=(*WHITE, 230))
    y += 36
    draw_lines(draw, hook_lines, hook_font, (72, y), TEAL_SOFT, hook_h)

    canvas.alpha_composite(
        rounded_rect_layer((PIN_W, PIN_H), (-40, 1280, PIN_W + 40, PIN_H + 80), 48, (*TEAL_MIST, 255))
    )
    draw_footer(canvas, fonts, NAVY, 1396, badge=False)
    return canvas


def render_guia(spec: PinSpec, fonts: BrandFonts) -> Image.Image:
    rgb = vertical_gradient((PIN_W, PIN_H), TEAL_600, TEAL_800)
    canvas = rgb.convert("RGBA")
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (80, 80), 260, (*WHITE, 22)))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (980, 1480), 380, (*NAVY, 40)))
    bar = Image.new("RGBA", (PIN_W, PIN_H), (0, 0, 0, 0))
    ImageDraw.Draw(bar).rectangle((0, 0, 22, PIN_H), fill=(*NAVY, 255))
    canvas.alpha_composite(bar)

    title_font, title_lines, title_h = fit_text(
        spec.titulo, fonts.merri_black, 760, 70, 46, 4, line_gap=0.1
    )
    hook_font, hook_lines, hook_h = fit_text(
        spec.gancho, fonts.inter_regular, 760, 30, 22, 6, line_gap=0.32
    )
    y_title = 280
    y_after_title = y_title + len(title_lines) * title_h
    y_hook = y_after_title + 76
    y_after_hook = y_hook + len(hook_lines) * hook_h
    card_top, card_left, card_right = 64, 56, 944
    card_bottom = int(min(1220, max(840, y_after_hook + 210)))
    card = (card_left, card_top, card_right, card_bottom)
    canvas.alpha_composite(rounded_rect_layer((PIN_W, PIN_H), card, 36, (*TEAL_MIST, 255), shadow=True))

    draw = ImageDraw.Draw(canvas)
    quote = fonts.face(fonts.merri_black, 140)
    draw.text((card_right - 64, card_bottom - 28), "”", font=quote, fill=(*TEAL, 60), anchor="rb")

    draw_badge(draw, fonts, "Guía", (92, 96), WHITE, (*TEAL, 255))
    paste_center(canvas, make_doc_icon(120, NAVY, TEAL), 820, 168)

    draw_lines(draw, title_lines, title_font, (92, y_title), NAVY, title_h)
    bar_y = int(y_after_title + 36)
    draw.rounded_rectangle((92, bar_y, 164, bar_y + 8), radius=4, fill=(*TEAL, 255))
    draw_lines(draw, hook_lines, hook_font, (92, y_hook), MUTED, hook_h)

    draw_footer(canvas, fonts, WHITE, 1360, badge=True)
    return canvas


def render_categoria(spec: PinSpec, fonts: BrandFonts) -> Image.Image:
    canvas = Image.new("RGBA", (PIN_W, PIN_H), (*CREAM, 255))
    header = vertical_gradient((PIN_W, 780), TEAL_400, TEAL_700).convert("RGBA")
    canvas.alpha_composite(header, (0, 0))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (110, 120), 200, (*WHITE, 30)))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (900, 40), 160, (*NAVY, 35)))
    canvas.alpha_composite(circle_layer((PIN_W, PIN_H), (840, 560), 120, (*WHITE, 22)))
    # Onda que separa cabecera teal y cuerpo crema.
    wave = Image.new("RGBA", (PIN_W, PIN_H), (0, 0, 0, 0))
    ImageDraw.Draw(wave).ellipse((-120, 640, 1120, 980), fill=(*CREAM, 255))
    canvas.alpha_composite(wave)

    draw = ImageDraw.Draw(canvas)
    _, _, badge_w, _ = badge_metrics(fonts, "Categoría")
    draw_badge(draw, fonts, "Categoría", ((PIN_W - badge_w) // 2, 72), TEAL_800, (*WHITE, 255))
    paste_center(canvas, make_grid_icon(72, WHITE), PIN_W // 2, 200)

    title_font, title_lines, title_h = fit_text(
        spec.titulo, fonts.merri_black, 840, 68, 46, 4, line_gap=0.1
    )
    y = 260
    draw_lines(
        draw, title_lines, title_font, (80, y), WHITE, title_h, align="center", max_width=840
    )

    hook_font, hook_lines, hook_h = fit_text(
        spec.gancho, fonts.inter_regular, 820, 30, 22, 5, line_gap=0.3
    )
    hook_top = 820
    draw_lines(
        draw, hook_lines, hook_font, (90, hook_top), INK, hook_h, align="center", max_width=820
    )

    # Tres fichas de catálogo, distintas a la tarjeta única de la guía.
    cards_y = 1040
    gap, cw, ch = 24, 260, 150
    total = 3 * cw + 2 * gap
    x0 = (PIN_W - total) // 2
    for i in range(3):
        x = x0 + i * (cw + gap)
        box = (x, cards_y, x + cw, cards_y + ch)
        canvas.alpha_composite(
            rounded_rect_layer((PIN_W, PIN_H), box, 24, (*WHITE, 255), shadow=True)
        )
        cd = ImageDraw.Draw(canvas)
        cd.rounded_rectangle(box, radius=24, outline=(*TEAL_SOFT, 255), width=3)
        cd.rounded_rectangle((x + 24, cards_y + 28, x + 88, cards_y + 92), radius=14, fill=(*TEAL_SOFT, 255))
        cd.rounded_rectangle((x + 108, cards_y + 36, x + cw - 24, cards_y + 52), radius=4, fill=(*TEAL, 180))
        cd.rounded_rectangle((x + 108, cards_y + 64, x + cw - 48, cards_y + 78), radius=4, fill=(*TEAL_SOFT, 255))

    draw_footer(canvas, fonts, NAVY, 1396, badge=False)
    return canvas


RENDERERS = {
    "calculadora": render_calculadora,
    "guia": render_guia,
    "categoria": render_categoria,
}


def render_pin(spec: PinSpec, fonts: BrandFonts) -> Image.Image:
    return RENDERERS[spec.plantilla](spec, fonts)


def save_pin(img: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGBA").save(dest, format="PNG", optimize=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Genera pines verticales de Pinterest.")
    p.add_argument("--yaml", type=Path, default=DEFAULT_YAML, help="Listado de pines (YAML).")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Directorio de salida.")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    yaml_path = args.yaml if args.yaml.is_absolute() else ROOT / args.yaml
    out_dir = args.out if args.out.is_absolute() else ROOT / args.out
    if not yaml_path.is_file():
        print(f"No encuentro {yaml_path}", file=sys.stderr)
        return 1
    try:
        specs = load_specs(yaml_path)
        fonts = BrandFonts(FONTS_DIR)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Generando {len(specs)} pines → {out_dir}")
    for spec in specs:
        dest = out_dir / f"{spec.slug}.png"
        img = render_pin(spec, fonts)
        save_pin(img, dest)
        print(f"  [{spec.plantilla}] {dest}  ({PIN_W}×{PIN_H})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
