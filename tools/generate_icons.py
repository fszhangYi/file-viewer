#!/usr/bin/env python3
"""Design File Viewer icons with Cairo; emit PNG / ICO / SVG for Electron + Web."""
from __future__ import annotations

import math
from pathlib import Path

import cairo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "icons"
PUBLIC = ROOT / "public"

SIZES = (16, 24, 32, 48, 64, 128, 256, 512)


def rounded_rect(ctx: cairo.Context, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def paint_icon(ctx: cairo.Context, size: float):
    """Flat app icon: teal tile + document + viewer aperture."""
    s = float(size)
    # Transparent outside; soft tile inset
    margin = s * 0.06
    tile = s - 2 * margin
    radius = tile * 0.22

    # Drop shadow
    ctx.save()
    ctx.translate(s * 0.02, s * 0.03)
    rounded_rect(ctx, margin, margin, tile, tile, radius)
    ctx.set_source_rgba(0.05, 0.12, 0.14, 0.28)
    ctx.fill()
    ctx.restore()

    # Tile fill (teal → deep sea)
    rounded_rect(ctx, margin, margin, tile, tile, radius)
    grad = cairo.LinearGradient(margin, margin, margin + tile, margin + tile)
    grad.add_color_stop_rgb(0.0, 0.12, 0.62, 0.58)  # #1f9e94
    grad.add_color_stop_rgb(1.0, 0.07, 0.30, 0.34)  # #124d57
    ctx.set_source(grad)
    ctx.fill_preserve()

    # Subtle top highlight
    highlight = cairo.LinearGradient(margin, margin, margin, margin + tile * 0.45)
    highlight.add_color_stop_rgba(0.0, 1, 1, 1, 0.18)
    highlight.add_color_stop_rgba(1.0, 1, 1, 1, 0.0)
    ctx.set_source(highlight)
    ctx.fill()

    # Document body
    doc_w, doc_h = tile * 0.42, tile * 0.54
    doc_x = margin + tile * 0.18
    doc_y = margin + tile * 0.22
    fold = doc_w * 0.28
    doc_r = s * 0.03

    ctx.move_to(doc_x + doc_r, doc_y)
    ctx.line_to(doc_x + doc_w - fold, doc_y)
    ctx.line_to(doc_x + doc_w, doc_y + fold)
    ctx.line_to(doc_x + doc_w, doc_y + doc_h - doc_r)
    ctx.arc(doc_x + doc_w - doc_r, doc_y + doc_h - doc_r, doc_r, 0, math.pi / 2)
    ctx.line_to(doc_x + doc_r, doc_y + doc_h)
    ctx.arc(doc_x + doc_r, doc_y + doc_h - doc_r, doc_r, math.pi / 2, math.pi)
    ctx.line_to(doc_x, doc_y + doc_r)
    ctx.arc(doc_x + doc_r, doc_y + doc_r, doc_r, math.pi, 3 * math.pi / 2)
    ctx.close_path()
    ctx.set_source_rgb(0.96, 0.97, 0.95)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.05, 0.2, 0.22, 0.12)
    ctx.set_line_width(max(1.0, s * 0.008))
    ctx.stroke()

    # Fold triangle
    ctx.move_to(doc_x + doc_w - fold, doc_y)
    ctx.line_to(doc_x + doc_w - fold, doc_y + fold)
    ctx.line_to(doc_x + doc_w, doc_y + fold)
    ctx.close_path()
    ctx.set_source_rgb(0.78, 0.86, 0.84)
    ctx.fill()

    # Text lines on document
    ctx.set_source_rgba(0.15, 0.35, 0.38, 0.45)
    ctx.set_line_width(max(1.0, s * 0.035))
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for i, frac in enumerate((0.32, 0.44, 0.56, 0.68)):
        y = doc_y + doc_h * frac
        x0 = doc_x + doc_w * 0.14
        x1 = doc_x + doc_w * (0.72 if i < 3 else 0.52)
        ctx.move_to(x0, y)
        ctx.line_to(x1, y)
        ctx.stroke()

    # Viewer aperture (lens) — amber accent
    cx = margin + tile * 0.68
    cy = margin + tile * 0.62
    R = tile * 0.22
    ctx.arc(cx, cy, R, 0, 2 * math.pi)
    ring = cairo.RadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.1, cx, cy, R)
    ring.add_color_stop_rgb(0.0, 1.0, 0.78, 0.38)  # warm amber
    ring.add_color_stop_rgb(1.0, 0.86, 0.45, 0.12)
    ctx.set_source(ring)
    ctx.fill()

    # Lens glass
    ctx.arc(cx, cy, R * 0.62, 0, 2 * math.pi)
    glass = cairo.RadialGradient(cx - R * 0.2, cy - R * 0.2, 0, cx, cy, R * 0.62)
    glass.add_color_stop_rgba(0.0, 0.85, 0.97, 0.98, 0.85)
    glass.add_color_stop_rgba(0.55, 0.25, 0.55, 0.58, 0.35)
    glass.add_color_stop_rgba(1.0, 0.08, 0.25, 0.28, 0.55)
    ctx.set_source(glass)
    ctx.fill()

    # Specular
    ctx.arc(cx - R * 0.22, cy - R * 0.25, R * 0.16, 0, 2 * math.pi)
    ctx.set_source_rgba(1, 1, 1, 0.55)
    ctx.fill()


def render_png(path: Path, size: int):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    ctx = cairo.Context(surface)
    ctx.set_operator(cairo.OPERATOR_CLEAR)
    ctx.paint()
    ctx.set_operator(cairo.OPERATOR_OVER)
    paint_icon(ctx, size)
    surface.write_to_png(str(path))


def render_svg(path: Path, size: int = 512):
    surface = cairo.SVGSurface(str(path), size, size)
    ctx = cairo.Context(surface)
    paint_icon(ctx, size)
    surface.finish()


def write_ico(path: Path, png_paths: list[Path]):
    from PIL import Image

    images = [Image.open(p).convert("RGBA") for p in png_paths]
    # Pillow ICO: pass all frames; sizes= drives embedded resolutions.
    images[-1].save(
        path,
        format="ICO",
        sizes=[(im.width, im.height) for im in images],
        append_images=images[:-1],
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    pngs = []
    for size in SIZES:
        out = OUT / f"icon-{size}.png"
        render_png(out, size)
        pngs.append(out)
        print(f"wrote {out}")

    master = OUT / "icon.png"
    render_png(master, 512)
    print(f"wrote {master}")

    svg = OUT / "icon.svg"
    render_svg(svg, 512)
    print(f"wrote {svg}")

    # Web public assets
    for name, size in (("favicon-32.png", 32), ("favicon-16.png", 16), ("apple-touch-icon.png", 180)):
        dest = PUBLIC / name
        if size == 180:
            render_png(dest, 180)
        else:
            # copy from generated
            from shutil import copyfile

            copyfile(OUT / f"icon-{size}.png", dest)
        print(f"wrote {dest}")

    ico = PUBLIC / "favicon.ico"
    write_ico(ico, [OUT / "icon-16.png", OUT / "icon-32.png", OUT / "icon-48.png"])
    print(f"wrote {ico}")

    # Electron prefers a single high-res PNG
    from shutil import copyfile

    copyfile(master, OUT / "icon-512.png")
    copyfile(OUT / "icon-256.png", ROOT / "electron" / "icon.png")
    print(f"wrote {ROOT / 'electron' / 'icon.png'}")


if __name__ == "__main__":
    main()
