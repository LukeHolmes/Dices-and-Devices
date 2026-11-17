# Ambient FX v2.1 — art-only transfer

The 14 engine-ready transparent PNG spritesheets in `assets/animations/ambient/Spritesheets/` are checked into this branch. `animation-manifest.json` carries exact frame dimensions/timing and references the source art archived in ChatGPT Library.

**Library source archive:** `/Projects/Gutterbones/05_Animations/Ambient/FX-Collection-v2.1/Gutterbones-1977-Ambient-Complete-v2.1.zip`. The full original master PNGs, alpha cutouts, editorial GIFs and QA previews are in that archive and in Library subfolders. They are deliberately not duplicated as large binary sources in GitHub because of connector transfer limits. `source` fields in the animation manifest refer to the full archive, not to files present on the GitHub branch.

**Status:** static art committed, NOT wired into the game. No roll system, existing CashRain, scoring, save, RNG, animation clocks or gameplay code changed. No merge or deployment. This branch is a review branch. Known issues: slight bulb sheet border-pixel alpha; smoke contrast on black; cockroach runtime verification pending.
