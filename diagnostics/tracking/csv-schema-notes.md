# Run results CSV notes (append-only rows)

## Outcome values (harness)

| `outcome` | Meaning | `stuck_flag` | Counts toward win/bust rate |
|---|---|---|---|
| `WIN` | Natural victory terminal | `0` | yes (win) |
| `BUST` | Natural bust (rap sheet without budget hook) | `0` | yes (bust) |
| `INCOMPLETE:BUDGET` | Step budget exhausted; bot forced forfeit or stalled until cap | `1` | **no** — excluded from balance denominators |
| `INCOMPLETE:<phase>` | Other non-terminal harness stop | `1` | no |

## Correction (2026-11-19)

Rows written **before** harness commit that relabels budget exhaustion recorded `outcome=BUST` with `steps == budget_max_steps` and often `max_round=1`. Those are **measurement relabels**, not gameplay balance changes. Do **not** rewrite historical CSV rows. New batches use `INCOMPLETE:BUDGET` + `terminal_reason=budget_exhausted`.

Repro gate **DEF-M-005** counts only seed pairs where **both** replicates terminated naturally (`WIN`/`BUST`). Budget-stalled pairs are reported separately with their own denominator.