# DEF-M-005 v6 harness attempt (2026-11-19)

## Changes (harness-only)

- **v6 substreams:** each gameplay draw is `hash(seed, caller, round, phase, index-within-window)`; counters reset per round×phase×caller.
- **Cosmetic isolation:** unknown callers route to cosmetic stream without advancing gameplay indices.
- **Quiescence:** bot awaits virtual-clock settle + play-lock clear before each step (`awaitHarnessQuiescence`).

Shim rev: `2026-11-19-harness-clock-v6` (`tests/sim/harness-determinism-shim.js`).

## Gate `REPRO-DEFM005-20261119-instrumented-v6`

| Metric | Value |
|--------|-------|
| Natural-only repro (both baselines) | **9/20** |
| R-main-i natural | **2/10** |
| R78-i natural | **7/10** |
| Budget stalls (`INCOMPLETE:BUDGET`) | **0/40** |
| Prior v5b natural | 6/20 |

Artifacts:

- `/opt/cursor/artifacts/diagnostics-repro-report.json`
- `/opt/cursor/artifacts/repro-gate-v6.log`
- `diagnostics/tracking/runs/REPRO-DEFM005-20261119-instrumented-v6.csv`
- `diagnostics/tracking/defects/measurement/DEF-M-005-gate-20261119-instrumented-v6.json`

## Sample first divergent draws (natural mismatches)

- **R-main-i rid 1:** global draw #190 — rep A `weightedSortJitter` round 4 `GAMBLE` index 0 vs rep B `gameplay` round 3 `PLAY` index 15 (state path divergence before draw index).
- **R-main-i rid 3:** draw #188 — same count, `weightedSortJitter` `GAMBLE` vs `gameplay` `PLAY`.
- **R78-i rid 2/6/7:** step-trace / cosmetic-timing mismatches with no aligned game-draw log at first step diff.

## Pilot

**Not started** — natural gate remains below 20/20.

## Next hypotheses

- Phase tag at draw time still races React timers; instrumented `__GB_SIM_ROUND__` sync exists but **phase is harness/bot-only** today.
- Default caller `gameplay` multiplexes many die rolls; mismatches may need finer caller tags in instrumented `index.html` (out of scope for harness-only).