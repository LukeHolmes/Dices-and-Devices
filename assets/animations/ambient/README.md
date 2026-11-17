# Ambient FX — Production Art v2.1

**No gameplay code changed. Review branch only, not merged or deployed.**

- `Spritesheets/`: 14 production RGBA PNG eight-frame sheets. Each is 4 columns × 2 rows. Read `animation-manifest.json` for per-effect frame sizes (the cigarette uses 512×512 cells).
- `Source-Masters/`: six optimized WebP artwork references. The **exact original PNG masters** are safely preserved in the ChatGPT Library package.
- `Cutouts/`: 11 optimized WebP object references. Exact original PNG cutouts are in the Library.
- `Previews/`: 12 GIF/JPEG/PNG visual previews (editorial review only).
- `Reports/`: per-effect source conversion and QA documentation.
- `ambient-animation-preview.html`: standalone viewer, not installed or linked to the game.

**Persistent Library originals:** `/Projects/Gutterbones/05_Animations/Ambient/FX-Collection-v2.1/`

**QA:** File-level and 48–80px dark/felt/brown readability montage checks done; in-game effects, alpha compositing and mobile performance remain to be tested. Slight tungsten bulb edge pixels and faint smoke contrast must be verified with actual backgrounds.

**Engineering:** The engine handles falling cash movement, drifting debris and scurrying roaches separately from sprite frame playback. Reuse existing CashRain. Avoid pointer interception, timer leaks and any RNG/scoring/save changes. Reduced motion must suppress ambient motion. Do not merge or deploy without approval.
