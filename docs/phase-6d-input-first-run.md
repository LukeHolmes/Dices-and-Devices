# Phase 6d — Input & first-run UX

**Status:** Shipped on branch `cursor/phase-6d-input-first-run-048e` (stacked on 6c)  
**Base:** Playtest fix plan · **Scope:** `index.html` + tests

## Fixes

| # | Area |
|---|------|
| 2 | Stable payout row height; `transition-colors` only |
| 3 | `rollLockRef`, 300ms roll debounce, queued payout after settle |
| 6 | Help Dossier once after first-run overlay (`seenHelpDossier`) |
| 7 | Shuffle mode instruction banner |
| 10 | Pre-roll “Hit THROW” callout on empty felt |
| 11 | Invalid score `reason` in rules + row tooltips / BUST copy |

## Verification

- `npm run check`
- Manual: double-click roll, payout during roll, first-run dossier

## Next

**Phase 6e** — opening balance (`docs/phase-6e-opening-balance.md`).
