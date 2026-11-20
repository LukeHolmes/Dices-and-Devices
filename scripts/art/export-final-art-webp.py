#!/usr/bin/env python3
"""Final-art pass: Nightclub Backroom + atlas icon WebPs; updates RUNTIME-MANIFEST."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path

from PIL import Image, ImageChops

REPO = Path(__file__).resolve().parents[2]
HANDOFF = Path(os.environ.get("GB_HANDOFF_DIR", "/tmp/gb-art-parts/handoff"))
ATLAS_MANIFEST = HANDOFF / "atlas_extraction_manifest.json"
STAGING = REPO / "art-production/final-art-pass/atlas-extractions"
OUT_SCENES = REPO / "assets/art/scenes"
OUT_ATLAS = REPO / "assets/art/batch-5-2/atlas"
MANIFEST_PATH = REPO / "assets/art/batch-5-2/RUNTIME-MANIFEST.json"

EDGE_CROP_CLEAN = {
    "hud_statusplate_ink_v1.png",
    "hud_statusplate_felt_v1.png",
    "hud_statusplate_paper-worn_v1.png",
    "hud_statusplate_paper-clean_v1.png",
    "hud_progressbar_ink_v1.png",
}

SCENES = [
    {
        "source": "approved/02_Environments/nightclub-backroom.png",
        "out": OUT_SCENES / "nightclub-backroom.webp",
        "max_w": 1672,
        "quality": 78,
    },
]

ATLAS = [
    ("ui_topbar_segmented-ink_v1.png", "ui-topbar-segmented-ink.webp", 720),
    ("hud_statusplate_ink_v1.png", "hud-statusplate-ink.webp", 200),
    ("hud_statusplate_felt_v1.png", "hud-statusplate-felt.webp", 185),
    ("hud_statusplate_paper-worn_v1.png", "hud-statusplate-paper-worn.webp", 176),
    ("hud_statusplate_paper-clean_v1.png", "hud-statusplate-paper-clean.webp", 181),
    ("hud_progressbar_ink_v1.png", "hud-progressbar-ink.webp", 682),
    ("hud_plays-counter_v1.png", "hud-plays-counter-atlas.webp", 702),
    ("hud_progressbar_paper_v1.png", "hud-progressbar-paper.webp", 734),
    ("ui_badge_laurel_v1.png", "ui-badge-laurel.webp", 313),
    ("ui_badge_starburst_v1.png", "ui-badge-starburst.webp", 226),
    ("ui_badge_round_v1.png", "ui-badge-round.webp", 238),
    ("ui_dossier_clipboard_v1.png", "ui-dossier-clipboard.webp", 661),
    ("ui_control_button-left_v1.png", "ui-control-button-left.webp", 167),
    ("ui_control_button-right_v1.png", "ui-control-button-right.webp", 169),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def clean_edge_crop(im: Image.Image, pad: int = 12) -> Image.Image:
    im = im.convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return im
    cropped = im.crop(bbox)
    # soften 1px fringe halo on opaque edge
    a = cropped.split()[3]
    a = a.point(lambda p: 0 if p < 8 else min(255, p))
    cropped.putalpha(a)
    w, h = cropped.size
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.paste(cropped, (pad, pad), cropped)
    return canvas


def to_webp(src: Path, dest: Path, max_w: int, quality: int) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.width > max_w:
        ratio = max_w / im.width
        im = im.resize((max_w, max(1, int(im.height * ratio))), Image.Resampling.LANCZOS)
    im.save(dest, "WEBP", quality=quality, method=6)
    return dest.stat().st_size


def main() -> int:
    STAGING.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []

    for spec in SCENES:
        master = HANDOFF / spec["source"]
        if not master.is_file():
            print(f"missing master {master}", file=__import__("sys").stderr)
            return 1
        master_sha = sha256_file(master)
        nbytes = to_webp(master, spec["out"], spec["max_w"], spec["quality"])
        rel = spec["out"].relative_to(REPO).as_posix()
        rows.append(
            {
                "bytes": nbytes,
                "sha": sha256_file(spec["out"]),
                "out": rel,
                "source": f"gutterbones-approved-assets-v1/{spec['source']}",
                "masterSha256": master_sha,
                "category": "scene",
            }
        )

    for src_name, out_name, max_w in ATLAS:
        handoff_png = HANDOFF / "candidates/atlas_extractions" / src_name
        staged = STAGING / src_name
        shutil.copy2(handoff_png, staged)
        work = staged
        if src_name in EDGE_CROP_CLEAN:
            cleaned = clean_edge_crop(Image.open(staged))
            cleaned.save(staged)
        master_sha = sha256_file(work)
        out_path = OUT_ATLAS / out_name
        nbytes = to_webp(work, out_path, max_w, 85)
        rel = out_path.relative_to(REPO).as_posix()
        rows.append(
            {
                "bytes": nbytes,
                "sha": sha256_file(out_path),
                "out": rel,
                "source": f"gutterbones-approved-assets-v1/candidates/atlas_extractions/{src_name}",
                "masterSha256": master_sha,
                "category": "atlas-icon",
            }
        )

    existing = json.loads(MANIFEST_PATH.read_text())
    outs = {r["out"] for r in rows}
    kept = [a for a in existing.get("assets", []) if a.get("out") not in outs]
    merged = kept + [{k: v for k, v in r.items() if k != "category"} for r in rows]
    manifest = {
        **existing,
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "finalArtPass": {
            "handoffDir": str(HANDOFF),
            "sceneAssets": [r for r in rows if r["category"] == "scene"],
            "atlasIconAssets": [r for r in rows if r["category"] == "atlas-icon"],
            "atlasEdgeCleaned": sorted(EDGE_CROP_CLEAN),
        },
        "assets": merged,
        "totalBytes": sum(int(a.get("bytes", 0)) for a in merged),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"exported": len(rows), "totalBytes": manifest["totalBytes"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())