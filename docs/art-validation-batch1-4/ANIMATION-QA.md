# Animation QA — all 12 contraband effects

Every production PNG is **1024×512 RGBA**, **2 rows × 4 columns**, **8 square 256px cells**, reading left-to-right then top-to-bottom. No frame-edge pixels above alpha 20 touch the outer 2px safety margin. Frames were checked for alpha density and basic appearance progression, but browser/gameplay playback is **not yet validated**.

| Effect | Original source | Production | Frame ms | Peak (ordinal) | Technical |
|---|---:|---:|---:|---:|---|
| MULT | 1024×512 | 1024×512 | 95 ms | 4/8 | PASS |
| CASH | 1024×512 | 1024×512 | 100 ms | 5/8 | PASS |
| WILD | 1024×512 | 1024×512 | 95 ms | 5/8 | PASS |
| BLOOD-6 | 1024×512 | 1024×512 | 105 ms | 5/8 | PASS |
| ECHO | 2048×1024 | 1024×512 | 105 ms | 5/8 | PASS |
| SHIV | 1024×512 | 1024×512 | 95 ms | 5/8 | PASS |
| WIREBAG | 1024×512 | 1024×512 | 100 ms | 5/8 | PASS |
| GHOST | 1024×512 | 1024×512 | 115 ms | 5/8 | PASS |
| FUSE | 1024×512 | 1024×512 | 90 ms | 5/8 | PASS |
| MAGNET | 1024×512 | 1024×512 | 100 ms | 5/8 | PASS |
| MARK | 1024×512 | 1024×512 | 105 ms | 5/8 | PASS |
| DOUBLE-DOWN | 1024×512 | 1024×512 | 95 ms | 5/8 | PASS |

At 95 ms × 8, total duration was 760 ms. To respect differentiated action feel, manifest values now range **90–115 ms per frame** (720–920 ms across 8 frames). ECHO is 105 ms, GHOST 115 ms, FUSE 90 ms; the other durations are recorded explicitly, never inferred from one global 95ms setting. Actual fit against the scoring overlay must be tested before enabling. One shot, no loops. Reduced motion must bypass animation and preserve all score results.

The full-size ECHO approved Library original (**2048×1024, 512px cells**) is backed up under `Original-Masters/05_Animations/ECHO-highres-library-master-2048x1024.png`. Production is resized once via Lanczos to 1024×512. Original sheets are not overwritten. The 1024×512 ECHO from the earlier combined ZIP is *not* treated as the authoritative master.

**Demonstrations:** `Previews/contraband-animation-preview.html` (browser one-shot replay; relative asset files required), and `Previews/contraband-effect-preview-all-12.gif` (asset-only visual check). These are not Playwright captures of game actions.

**Not yet verified:** whether each of the 12 genuinely fires in game, event dispatch point, overdraw, cancellation, burst overlap, stale timers, phone/landscape FPS, trigger order, game save identity and score parity. Integration should remain a separate, later Cursor task.
