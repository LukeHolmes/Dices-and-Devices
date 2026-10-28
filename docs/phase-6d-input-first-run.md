# Phase 6d — Input & first-run UX

**Status:** **Merged** — PR [#46](https://github.com/LukeHolmes/Dices-and-Devices/pull/46) → `main` (28 Oct 2026)  
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

Playtest fix plan **6c–6f** complete on `main`. **Phase 7** (Vite split) is tracked separately (PR #44).
