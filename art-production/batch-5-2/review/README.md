# Gutterbones 1977 — Batch 5.2 Polish Delta v1 (19 November 2026)

**No GitHub game code, production assets, mechanics or existing approvals changed in this package.**

This is a **delta** to `gutterbones-wireframe-transition-handoff-v1.zip`, not a replacement for the approved production art bank. This delta contains:

- `review-candidates/hardware/hardware_brass-knuckles_v1_REVIEW.png` — missing hardware illustration, **unapproved**.
- `review-candidates/ambient/ambient_cigarette-ashtray_v1_REVIEW.png` — separate ashtray prop, **unapproved**, contains a hand-painted smoke plume.
- `review-candidates/hud/hud_reworked-atlas_original-v1_REVIEW.png` — new cleaner material/edge atlas, **unapproved**.
- `review-candidates/hud/hud_*.png` — **nine lossless, exact-pixel isolated** crops from the atlas, unapproved until rendering/edge checks.
- `references/` — two new full-screen visual concepts. **Not production**: they contain inaccurate fixed prices and fake labels; never use as a flattened UI.
- `manifest.csv/json`, `qa.json`, `review-*.jpg` — integrity and previews.
- `handover/GROKBOT_CURSOR_Batch52_Handoff.md` — full task handover, repository branch and exact mapping.

## Source of truth and use

- **Original wireframe** remains the visual master; 70% physical 1977 backroom, 30% underground crime comic.
- **Approved source art** remains under ChatGPT Library `/Projects/Gutterbones/`; do not regenerate or replace the dice, eight-frame front-entry throwing hand, rat, cigarette ember/smoke sprites, portraits, environments, shop cards or approved hardware/consumables.
- GitHub runtime work is on `art/visual-overhaul` -> draft PR #94 `art/s3-item-icons` -> draft PR #95 `art/s4-shop-cards`. These remain *unmerged to `main`* as of the audit.
- A new docs-only GitHub branch, when confirmed, points Cursor to this delta ZIP; the repo cannot directly access this ChatGPT Library automatically.
- Do not silently mark new candidates as approved; do not deploy until gameplay and visual QA.

To inspect: open `review-polish-pieces-contact-sheet.jpg`, then PNG masters. See handover for integration instructions and acceptance gates.
