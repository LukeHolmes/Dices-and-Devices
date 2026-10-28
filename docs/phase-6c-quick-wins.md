# Phase 6c — Quick wins (playtest polish)

**Status:** Complete (PR #45)  
**Base:** `main` @ d7a32b8 · **Scope:** `index.html` only (pre–Phase 7)

## Goals

| # | Fix |
|---|-----|
| 5 | Safehouse unlock labels use display names, not raw IDs |
| 4 | INCARCERATED stamp anchored top-right; no Hand History overlap |
| 9 | Score resolution overlay cleared / gated when entering bust or victory |
| 8a | Favicon → `gutterbones-card.png` |
| 8b | Story panels caption-only when arc art missing (`PANEL_ART_AVAILABLE`) |
| 12 | Counter portrait TODO; UI placeholder via Street Rat + tint (no new PNG) |

## Verification

- `npm run check`
- Browser: Safehouse, bust flow, non-witness arc prologue (no panel 404s)

## Next

**Phase 6d** — input & first-run UX (`docs/phase-6d-input-first-run.md`).
