# Gutterbones 1977 — Ambient Animation Complete Pack v2.1

**14 production RGBA spritesheets (8 frames each), 112 frames total.** This is the consolidated version of v1 plus the v2 cockroach pack, including all original source masters, extracted cutouts, three preview groups, dark-background QA montages and technical reports. The earlier v1/v2 originals remain unchanged.

The approved alley rat remains in the existing ChatGPT Library folder `05_Animations/Ambient/` and is intentionally not duplicated here.

## Production use

- `Spritesheets/*.png`: 4 columns x 2 rows, 8 frames; refer to `animation-manifest.json` for **per-effect frame dimensions**. The burning cigarette uses 512x512 cells; the others use 256x256 cells.
- `Source-Masters/` and `Cutouts/`: source/recovery art; do not load these at runtime.
- `Previews/`: editorial QA and animated GIF examples.
- `asset-verification.csv` and `FINAL-ASSET-REPORT.json`: per-asset dimensions, hashes and processing status.

The existing Gutterbones game has **not** been modified. Cash translation/drift and debris movement are controlled by the game engine, not encoded in the frames. Keep sprites behind gameplay controls and respect reduced motion. The existing game has `CashRain`; integrate with it only on a future explicitly authorised implementation pass.

## Review exceptions

- Tungsten bulb source has a minor alpha-at-edge QA warning (13 border pixels across frames); not an automatic reject, but confirm no visible seam at runtime.
- Cockroach loop is generated artwork, alpha-cleaned and technically validated, but still requires final in-game readability review.
- Smoke has low luminance contrast at 64px over black; visually test beneath overlays.

**No merge or deployment is authorised.**