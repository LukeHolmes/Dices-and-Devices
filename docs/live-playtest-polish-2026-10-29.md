# Live playtest polish (coldforge deploy)

**Branch:** `cursor/live-playtest-polish-048e`  
**Context:** Feedback from https://coldforge.tech/Dices-and-Devices/ (28–29 Oct 2026)

## Changes

| # | Issue | Fix |
|---|--------|-----|
| 1 | R1 near-miss with empty stash | **25% stash** at run start (= one free **SNIFF**); quota stays **85** |
| 2 | INCARCERATED stamp vs title / unlock toast | Stamp centered on **Hand History** body; **NEW UNLOCKED** waits until stamp animation (~800ms after RAP_SHEET) |
| 3 | Score explanation ~3.5s on HUD | Fixed **1.2s** lifetime, timer cleared on re-score; dismissed on bust/victory/arrest |
| 4 | Side-bet preview vs quota | Preview only with **active wager**; copy: “Side bet: this roll’s best is X, needs Y+” |
| 5 | favicon.ico 404 | **`favicon.ico`** copied from `gutterbones-card.png` |

## Verify

- `npm run check`
- Manual: start run → stash bar shows 25%; lose run → stamp not on header; score popup brief

## Synergy compounding (branch `cursor/compounding-synergies-phased-d315`, Oct 2026)

Full phased plan: [`docs/plans/compounding-synergies-phased-implementation.md`](plans/compounding-synergies-phased-implementation.md).

| Area | Playtest focus |
|------|----------------|
| Chains | Adjacency hands; breakdown stagger on depth ≥2; dev **LOAD MULTI-CHAIN DEMO** |
| Shop/path | Route tags skew stock; build-biased offer after Phase 7 chain history |
| Tier 2–3 | Chain manual faces; Backroom Rig Shop hardware |
| Phase 6 | Blueprint flip gamble; combo meter heat spikes |
| Phase 7 | BUILD INTEL chain avg/peak after chained hands; rap sheet archetype tips |

Automated: `tests/synergy-*.test.cjs` through Phase 7 build tests in `npm run check`.
