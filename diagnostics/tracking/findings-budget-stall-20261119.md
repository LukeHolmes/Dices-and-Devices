# Findings — budget stall mislabel (2026-11-19)

## VERIFIED — DEF-M-006 (measurement)

Budget exhaustion after `forceForfeitRun` was recorded as `outcome=BUST` with `terminal_reason` blank. Fixed in harness: `INCOMPLETE:BUDGET`, `terminal_reason=budget_exhausted`, `stuck_flag=1`.

## VERIFIED — DEF-M-007 (measurement)

Round-1 “stall” on R78-i was not a gameplay soft-lock. After quota clear, `roundClearVisible` showed **CONTINUE** (`round-clear-continue`) but the seeded-builder branch only dismissed overlays and never called `finishRoundClear`, repeating for the full step budget.

Evidence:

- `/opt/cursor/artifacts/stall-probe-rid0.json` — last 30 steps: `phase=PLAY`, `roundClear=true`, single button CONTINUE
- `/opt/cursor/artifacts/stall-probe-rid1.json` — same pattern
- `/opt/cursor/artifacts/stall-probe-rid0-fixed.json` — after harness fix: natural `BUST`, `max_round=6`, `steps=78`

## REPORTED — seeds 0–9 gate denominators (instrumented)

| Baseline | Batch | Budget stalls `steps=budget ∧ max_round=1` | Budget share | Raw pair repro (legacy) | Natural-only pair repro |
|---|---|---:|---:|---:|---:|
| R-main-i | v5 (pre-fix) | 0/20 | 0% | 2/10 | n/a (mislabeled) |
| R78-i | v5 | **20/20** | **100%** | 10/10 | n/a |
| R-main-i | v5b (post-fix) | **0/20** | 0% | 4/10 | **4/10** |
| R78-i | v5b | **0/20** | 0% | 2/10 | **2/10** |

Pilot remains blocked on **DEF-M-005** natural termination repro (6/20 on v5b), not budget stalls.

## TENTATIVE — pilot validity

Substream RNG (v5) remains **HYPOTHESIS** for unhooked gameplay; it is measurement-only. R-main-i natural repro still dominated by cosmetic-timing / substream draw-index coupling (see v5b gate mismatches).

## DEFERRED

No balance or rules changes. All fixes are harness / tracking / bridge only.