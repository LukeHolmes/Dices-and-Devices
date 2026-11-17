# Gutterbones 1977 — Ambient FX visual QA v2

File-level checks completed; no game implementation tested. Tested on black, felt-red and tobacco-brown UI-like backgrounds at 48, 64, 80 px. These montages show frames 1,4,7, not live in-game captures.

## Structural/visibility checks

| Effect | Source cell | Edge contamination | Distinct frames | Minimum contrast at 64px | Flag |
|---|---:|---:|---:|---:|---|
| cash-bill-one | 256x256 | 0 | 8 | 210.0 | No structural flags |
| cash-bill-five | 256x256 | 0 | 8 | 207.0 | No structural flags |
| cash-bill-ten | 256x256 | 0 | 8 | 211.0 | No structural flags |
| cash-bill-twenty | 256x256 | 0 | 8 | 212.0 | No structural flags |
| cash-dollar-token | 256x256 | 0 | 8 | 210.0 | No structural flags |
| cash-betting-slip | 256x256 | 0 | 8 | 230.0 | No structural flags |
| cigarette-smoke-rise | 256x256 | 0 | 8 | 20.0 | No structural flags |
| burning-cigarette-ember | 512x512 | 0 | 8 | 203.0 | No structural flags |
| tungsten-bulb-flicker | 256x256 | 13 | 8 | 127.05 | OPAQUE_PIXELS_TOUCH_CELL_EDGE |
| debris-torn-paper | 256x256 | 0 | 8 | 214.0 | No structural flags |
| debris-betting-slip | 256x256 | 0 | 8 | 215.0 | No structural flags |
| debris-rag-scrap | 256x256 | 0 | 8 | 150.0 | No structural flags |
| debris-newspaper | 256x256 | 0 | 8 | 211.0 | No structural flags |
| cockroach-crawl | 256x256 | 0 | 8 | n/a | No structural flags |

**Method:** contrast = 99th percentile of per-pixel max RGB difference versus ink-black #121113 after each frame is composited and resampled to 64x64. It is a screening indicator, NOT a perceptual readability guarantee. Border pixels use alpha >32 and outer 3px of each frame.

## Editorial visual findings

- The existing sheets have not been changed; their original quality, art direction and timing remain intact.
- Smoke: ink texture can blend into dark background. Review the three background contact sheets at actual size, and if necessary use slightly lower/upper intensity in game, not a global opaque white glow.
- Bulb: the light halo must not obscure controls; place behind panels only.
- Cash: use as occasional payout or victory feedback, not continuous full-screen rain.
- Debris: low-rate ambience and sparse sprites; prevent occlusion of tappable UI.
- Cigarette: keep anchored to props; frame animation is ember only.
- Cockroach: new generated source has an RGB white canvas. It has been alpha-cleaned, downscaled and aligned into 8 equal 256x256 frames. No source overwritten. Walking pose loop is an art candidate pending viewing in actual game.

## Integration guardrails

- Runtime: sprite frames are 4 columns x 2 rows, row-major; do not treat 512x512 cigarette cells as 256x256.
- Cache decoded textures; cap simultaneous active animations; always `pointer-events:none` and `aria-hidden=true`.
- Use transforms/opacity to move layers; never change RNG, scoring, saves, or balance.
- Respect settings reduced motion, offscreen/visibility and mobile performance.
- Keep separate ambient layer below gameplay controls; the game engine controls X/Y travel, NOT the spritesheet itself.
- Use existing alley rat pack as-is.

Status: REVIEW REQUIRED for art direction and live game testing. No merge/deploy.