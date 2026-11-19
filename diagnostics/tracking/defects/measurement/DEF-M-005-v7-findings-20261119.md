# DEF-M-005 v7 findings (2026-11-19)

## Gates (instrumented, seeds 0–9 ×2, natural-only)

| Run | Harness | Natural matched | Notes |
|-----|---------|-----------------|-------|
| v6 | indexed substreams + quiescence | 9/20 | baseline |
| v7 r1 | step trace; missing `__GB_SIM_PHASE__` | 4/20 | first cause table |
| v7 r2 | phase/round restore + canonical hash trace | **5/20** | R-main-i 1/10, R78-i 4/10 |

Budget stalls: 0/40 on both v7 runs.

## First-divergence class (v7 r2)

- **harness-timing** dominates: equal `gameRngDraws` at first trace step, mismatched phase (e.g. PLAY vs SHOP at step ~18; GAMBLE vs PLAY at takeSafeCut).
- Draw log tail mismatches at same `n` usually differ by **phase/caller** (weightedSortJitter in GAMBLE vs rollLane in PLAY), not raw value-only RNG drift.

Cause table artifact: `/opt/cursor/artifacts/v7-mismatch-cause-table.json`.

## Harness follow-ups (not pilot)

- Phase-align quiescence + canonical merge for bot decisions (committed after r2).
- R-main **hook-off** parity vs pin still fails at rid 0 on `807d884` (module `gbSimGameplayRandom` call sites); test skips R-main until next instrumented bump. R78 pair remains asserted.

## Pilot / 10–19

Not run: 0–9 gate below 20/20.