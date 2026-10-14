#!/usr/bin/env python3
"""Build every app icon from public/icons/safety-prep-list.png (needs Pillow).

The source is a transparent rounded square. Browsers and Android get it as is.
iOS paints transparent pixels black and applies its own rounded mask, so the
apple-touch-icon is cropped to the square and flattened onto the icon's green.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SOURCE = PUBLIC / "icons" / "safety-prep-list.png"
IOS_FILL = (20, 58, 36, 255)
IOS_INSET = 0.025


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.LANCZOS)


def ios_icon(source: Image.Image, size: int) -> Image.Image:
    left, top, right, bottom = source.getchannel("A").point(lambda v: 255 if v > 200 else 0).getbbox()
    side = min(right - left, bottom - top)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    half = side * (1 - IOS_INSET * 2) / 2
    square = source.crop((round(cx - half), round(cy - half), round(cx + half), round(cy + half)))
    flat = Image.new("RGBA", square.size, IOS_FILL)
    flat.alpha_composite(square)
    return resized(flat, size).convert("RGB")


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    (PUBLIC / "icons").mkdir(parents=True, exist_ok=True)
    resized(source, 192).save(PUBLIC / "icons" / "icon-192.png", optimize=True)
    resized(source, 512).save(PUBLIC / "icons" / "icon-512.png", optimize=True)
    ios_icon(source, 180).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    resized(source, 64).save(PUBLIC / "favicon.png", optimize=True)
    resized(source, 32).save(PUBLIC / "favicon-32.png", optimize=True)
    source.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote app icons from", SOURCE.relative_to(PUBLIC.parent))


if __name__ == "__main__":
    main()
