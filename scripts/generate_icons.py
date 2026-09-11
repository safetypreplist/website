#!/usr/bin/env python3
"""Write simple forest-green PWA icons (PNG) without extra packages."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
(ROOT / "icons").mkdir(parents=True, exist_ok=True)

FOREST = (0x1E, 0x2A, 0x1F)
CREAM = (0xF4, 0xF0, 0xE5)
TERRACOTTA = (0xC7, 0x5A, 0x2B)
MOSS = (0x55, 0x6B, 0x2F)


def png(size: int, maskable: bool = False) -> bytes:
    rows = []
    pad = 40 if maskable else 8
    for y in range(size):
        row = [0]
        for x in range(size):
            nx = x / (size - 1)
            ny = y / (size - 1)
            in_safe = pad / size <= nx <= 1 - pad / size and pad / size <= ny <= 1 - pad / size
            r, g, b = FOREST
            # mountain
            peak = 0.62 - abs(nx - 0.5) * 0.55
            if ny > 0.42 and ny < peak + 0.18:
                r, g, b = MOSS
            if ny > 0.72:
                r, g, b = (0x14, 0x1D, 0x16)
            # cream shield-ish circle
            cx, cy = 0.5, 0.46
            d = ((nx - cx) ** 2 + (ny - cy) ** 2) ** 0.5
            if 0.16 < d < 0.20:
                r, g, b = CREAM
            if ((nx - 0.72) ** 2 + (ny - 0.28) ** 2) ** 0.5 < 0.045:
                r, g, b = TERRACOTTA
            if not in_safe and maskable:
                r, g, b = FOREST
            row += [r, g, b, 255]
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    (ROOT / "icons" / "icon-192.png").write_bytes(png(192))
    (ROOT / "icons" / "icon-512.png").write_bytes(png(512))
    (ROOT / "icons" / "icon-maskable-512.png").write_bytes(png(512, True))
    (ROOT / "apple-touch-icon.png").write_bytes(png(180))
    print("Wrote PWA icons")


if __name__ == "__main__":
    main()
