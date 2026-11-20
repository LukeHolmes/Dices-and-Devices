#!/usr/bin/env python3
"""Crop smear off approved matchbook ledger master; export runtime WebP (master untouched)."""
from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
MASTER = REPO / "art-production" / "batch-5-2" / "approved-sources" / "ui_matchbook_blank-ledger_v1.png"
OUT = REPO / "assets" / "art" / "batch-5-2" / "ui" / "matchbook-blank-ledger-cropped.webp"
# Top smear band in approved art — crop before export so rows need no mask/patch.
CROP_TOP_FRAC = 0.145
QUALITY = 84


def main() -> int:
    if not MASTER.is_file():
        print(f"missing master: {MASTER}", file=__import__("sys").stderr)
        return 1
    im = Image.open(MASTER).convert("RGBA")
    w, h = im.size
    top = max(1, int(round(h * CROP_TOP_FRAC)))
    cropped = im.crop((0, top, w, h))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(OUT, format="WEBP", quality=QUALITY, method=6)
    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()[:16]
    print(f"wrote {OUT.relative_to(REPO)} {cropped.size[0]}x{cropped.size[1]} sha256:{digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())