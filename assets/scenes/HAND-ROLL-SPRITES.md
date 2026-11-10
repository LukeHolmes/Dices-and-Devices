# Hand roll throw sprites (draft PR #79)

**Status: missing** — overlay code probes both files and stays hidden when either fails to load (no broken `<img>` tags).

| File | Frame |
|------|--------|
| `hand-closed.png` | Fist rattling bones (pre-release) |
| `hand-open.png` | Fingers open at release (~35% of `handThrowSweep`) |

**Do not** drop the noir reference JPG (`hand-roll-reference.jpg` from Luke) into the repo as these sprites — it is a full-scene illustration, not a transparent cut-out. Export two **transparent PNGs** cropped to the hand (noir ink, amber rim light) using the reference for composition only.

Suggested export size: ~512–768px wide, hand anchored bottom-left in frame so `transform-origin: 18% 82%` reads correctly in-play.
