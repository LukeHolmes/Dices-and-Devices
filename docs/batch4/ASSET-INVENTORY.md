# Gutterbones 1977 — Batch 4 asset inventory

**Source:** Approved ChatGPT Library art archive; assets are not yet copied into the repository branch.
**Validation:** PNG inspection with Node 22 built-in zlib; source report `/mnt/data/Gutterbones-Batch4-Node-QA.json`; all 12 PASS.

| Effect | Approved PNG | Bytes | SHA-256 (prefix) |
|---|---|---:|---|
| MULT | `mult-8frame-spritesheet.png` | 513,611 | `8561f6fb50de` |
| CASH | `cash-8frame-spritesheet.png` | 182,721 | `7f28f2898e48` |
| WILD | `wild-8frame-spritesheet.png` | 182,987 | `33eacda7fbd4` |
| BLOOD-6 | `blood-6-8frame-spritesheet.png` | 205,888 | `a4b5905c5aa5` |
| ECHO | `echo-8frame-spritesheet.png` | 229,586 | `a981fce645c1` |
| SHIV | `shiv-8frame-spritesheet.png` | 129,501 | `7993362451df` |
| WIREBAG | `wirebag-8frame-spritesheet.png` | 230,683 | `a256c17fe673` |
| GHOST | `ghost-8frame-spritesheet.png` | 221,155 | `b1b93f8ed10b` |
| FUSE | `fuse-8frame-spritesheet.png` | 119,093 | `573b5da19d57` |
| MAGNET | `magnet-8frame-spritesheet.png` | 243,836 | `ab5065efa4fb` |
| MARK | `mark-8frame-spritesheet.png` | 199,161 | `029688fbbe23` |
| DOUBLE-DOWN | `double-down-8frame-spritesheet.png` | 235,730 | `e07540ffc3b0` |

**Format:** Each PNG is RGBA, non-interlaced, 1024×512, in 2 rows of 4 frames, 256×256 each, 95ms/frame (~760ms per one-shot). First/last frame alpha sufficiently low; edge alpha ≤2/255 on all frame borders (below visible threshold).

**Storage:** ChatGPT Library `/Projects/Gutterbones-1977-Art-Project/05_Animations/Gutterbones-1977-Contraband-Animations.zip`. Extract files before importing.

**Important:** `assets/animations/contraband/` is deliberately empty on the GitHub scaffold branch until the approved binary ZIP is imported through Cursor; `README.md` here is not evidence that binaries were committed.
