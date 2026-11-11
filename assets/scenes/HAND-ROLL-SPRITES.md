# Hand roll throw sprites (draft PR #79)

**Status: committed** — `hand-closed.png` / `hand-open.png` (768×768 RGBA, wrist anchor 226×432). Overlay probes both and stays hidden if either fails to load.

| File | Frame |
|------|--------|
| `hand-closed.png` | Fist rattling bones (pre-release) |
| `hand-open.png` | Fingers open at release (crossfade peaks ~54–72% of `handThrowSweep`, ~1.36s normal) |

While the throw runs, `play-alley` temporarily allows `overflow: visible` via `:has(.animate-gutter-hand)` so the wrist/sleeve are not clipped at the alley rim.

**Do not** drop the noir reference JPG (`hand-roll-reference.jpg` from Luke) into the repo as these sprites — it is a full-scene illustration, not a transparent cut-out. Export two **transparent PNGs** cropped to the hand (noir ink, amber rim light) using the reference for composition only.

Suggested export size: ~512–768px wide, hand anchored bottom-left in frame so `transform-origin: 18% 82%` reads correctly in-play.
