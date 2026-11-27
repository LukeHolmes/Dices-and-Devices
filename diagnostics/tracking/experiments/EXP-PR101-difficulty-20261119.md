# EXP-PR101-difficulty-20261119

Rules: **OLD** `7d649ef` (pre-PR #101) vs **NEW** `df7b4e2` (post-PR #101 merge). Harness: seeded Street Rat + safe-cut gambit, policy `2026-11-11-phase-b-v1`, 12 000 steps, rids 0–49 & 60–109 (holdouts 55–59 excluded). No LLM.

## Verified

- Batch CSVs: `diagnostics/tracking/runs/DIFF-PR101-20261119-old.csv`, `...-new.csv` (100 runs each; holdouts 55–59 not used; budget exclusions 0)
- Mean **max round** before terminal outcome is **lower** on OLD (5.17) than NEW (6.62); bootstrap CIs do not overlap ([4.78–5.56] vs [6.19–7.06])
- Bust distribution shifts later on NEW (heavy mass at rounds 8–9 vs OLD peak round 5)

## Tentative (DEF-M-005 non-repro adds noise)

Small win-rate deltas are **not conclusive** without 20/20 repro on harness timing.

### Win rate (95% Wilson on scored runs)

| Arm | Wins | Denominator (excl. budget) | Rate | 95% CI |
|-----|------|------------------------------|------|--------|
| OLD | 0 | 100 | 0.0% | [0.0%, 3.7%] |
| NEW | 0 | 100 | 0.0% | [0.0%, 3.7%] |

Two-proportion test (win rate OLD vs NEW): Δ=n/a, z=n/a, two-sided p=n/a.

### Mean max round (bootstrap 95% CI, scored runs)

| Arm | Mean | 95% CI |
|-----|------|--------|
| OLD | 5.17 | [4.78, 5.56] |
| NEW | 6.62 | [6.19, 7.06] |

### Boss clear rate (cleared / entered, Wilson per boss id)

Telemetry `roundEvents` was empty in this batch (un-paced harness); boss columns left `{}` in CSV — **not verified** this run.

### Bust round distribution (scored busts)

OLD: `{"1":7,"2":6,"3":9,"4":7,"5":27,"6":13,"7":19,"8":11,"9":1}`

NEW: `{"1":9,"3":1,"4":2,"5":6,"6":20,"7":16,"8":35,"9":10,"10":1}`

### Salts offer share (runs with R1–4 shop visit where kit stock listed SMELLING_SALTS; may under-count full shop)

| Arm | Offer share | Denominator (shop visits r1–4) | 95% CI |
|-----|-------------|-----------------------------------|--------|
| OLD | blank/n/a | 0 | n/a |
| NEW | blank/n/a | 0 | n/a |

### Budget exclusions

| Arm | Excluded INCOMPLETE:BUDGET | Total runs |
|-----|---------------------------|------------|
| OLD | 0 | 100 |
| NEW | 0 | 100 |

## Decision summary

**Verified:** POST-#101 rules (`df7b4e2`) let seeded Street Rat runs survive **~1.5 more rounds on average** before bust vs pre-#101 (`7d649ef`), with busts clustering later. **Win rate 0%** on both arms (n=100); Wilson upper bound ~3.7% each — no measurable win shift.

**Tentative:** Boss clear rates, Salts offer share, and HIGHWIRE counters need richer shop/boss telemetry (or paced harness) to populate; treat as unknown this run. DEF-M-005 harness non-repro means micro-deltas need caution; pilot/1k batches remain blocked.

