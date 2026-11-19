#!/usr/bin/env python3
"""Export look-and-feel runtime WebP from verified handoff PNG masters."""
from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
HANDOFF = Path(os.environ.get("GB_HANDOFF_DIR", "/tmp/gb-art-parts/handoff"))
MANIFEST = HANDOFF / "manifest.csv"
OUT_DIR = REPO / "assets" / "art" / "look-and-feel"
MASTER_DIR = REPO / "art-production" / "look-and-feel-pass" / "approved-sources"

EXPORTS = [
    {
        "manifest_path": "approved/05_Animations/Dice-Throw-Hand/hand-front-spritesheet-native-rgba.png",
        "out": "hand-front-spritesheet.webp",
        "max_w": 888,
        "quality": 82,
    },
    {
        "manifest_path": "approved/05_Animations/Ambient-Rat/alley-rat-8frame-horizontal.png",
        "out": "alley-rat-8frame.webp",
        "max_w": 1280,
        "quality": 82,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/burning-cigarette-ember-8frame.png",
        "out": "cigarette-ember-8frame.webp",
        "max_w": 1024,
        "quality": 80,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/cigarette-smoke-rise-8frame.png",
        "out": "cigarette-smoke-rise-8frame.webp",
        "out_w": 512,
        "quality": 78,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/tungsten-bulb-flicker-8frame.png",
        "out": "tungsten-bulb-flicker-8frame.webp",
        "out_w": 512,
        "quality": 80,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/cockroach-crawl-8frame.png",
        "out": "cockroach-crawl-8frame.webp",
        "out_w": 512,
        "quality": 80,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/debris-rag-scrap-8frame.png",
        "out": "debris-rag-scrap-8frame.webp",
        "out_w": 384,
        "quality": 78,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/debris-betting-slip-8frame.png",
        "out": "debris-betting-slip-8frame.webp",
        "out_w": 384,
        "quality": 78,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/cash-bill-one-8frame.png",
        "out": "cash-bill-one-8frame.webp",
        "out_w": 384,
        "quality": 78,
    },
    {
        "manifest_path": "candidates/ambient-fx-v2.1/cash-betting-slip-8frame.png",
        "out": "cash-betting-slip-8frame.webp",
        "out_w": 384,
        "quality": 78,
    },
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest_hashes() -> dict[str, str]:
    out = {}
    with MANIFEST.open(newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or row[0].startswith("#") or row[0] == "path":
                continue
            rel = row[0].strip()
            if len(row) > 2:
                out[rel] = row[2].strip().lower()
    return out


def scale_image(img: Image.Image, spec: dict) -> Image.Image:
    w, h = img.size
    if "max_w" in spec:
        mw = spec["max_w"]
        if w <= mw:
            return img
        nh = max(1, round(h * (mw / w)))
        return img.resize((mw, nh), Image.Resampling.LANCZOS)
    ow = spec.get("out_w", w)
    if ow >= w:
        return img
    nh = max(1, round(h * (ow / w)))
    return img.resize((ow, nh), Image.Resampling.LANCZOS)


def main() -> int:
    if not MANIFEST.is_file():
        print(f"missing manifest: {MANIFEST}", file=sys.stderr)
        return 1
    hashes = load_manifest_hashes()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    report = []

    for spec in EXPORTS:
        rel = spec["manifest_path"]
        src = HANDOFF / rel
        expected = hashes.get(rel)
        if not src.is_file():
            print(f"missing source {rel}", file=sys.stderr)
            return 1
        actual = sha256_file(src)
        if expected and actual != expected:
            print(f"sha256 mismatch {rel}\n expected {expected}\n actual   {actual}", file=sys.stderr)
            return 1
        master_name = rel.replace("/", "__")
        master_dest = MASTER_DIR / master_name
        if not master_dest.exists():
            master_dest.write_bytes(src.read_bytes())

        img = Image.open(src).convert("RGBA")
        scaled = scale_image(img, spec)
        out_path = OUT_DIR / spec["out"]
        scaled.save(out_path, "WEBP", quality=spec["quality"], method=6)
        report.append(
            {
                "out": str(out_path.relative_to(REPO)),
                "bytes": out_path.stat().st_size,
                "source": rel,
                "sha256": actual,
                "dimensions": list(scaled.size),
            }
        )

    total = sum(r["bytes"] for r in report)
    summary_path = OUT_DIR / "webp-byte-report.json"
    summary_path.write_text(json.dumps({"files": report, "total_bytes": total}, indent=2) + "\n")
    print(json.dumps({"files": report, "total_bytes": total}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())