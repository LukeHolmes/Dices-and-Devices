# DECISION-20261119 — Park DEF-M-005 reproducibility + pilot

**Decision:** Park DEF-M-005 measurement work and the 100-run pilot on 19 Nov 2026. No instrumented baseline bumps, no pilot, no holdout 55–59 use.

## Gate history (natural-only, seeds 0–9 ×2 on R-main-i + R78-i unless noted)

| Gate | Natural matched | Denominator |
|------|-----------------|-------------|
| v5b | 6 | /20 |
| v6 | 9 | /20 |
| v7 r1 | 4 | /20 |
| v7 r2 | 5 | /20 |
| v7 r3 | **not scored** | /20 (**partial**) |

**v7 r3 partial:** Stopped mid-run. **0/20** reproducibility pairs scored. Log shows 11 individual runs started (R-main-i replicate 0 rid 0–9 + replicate 1 rid 0 only); R78-i not run. Tracking: `diagnostics/tracking/runs/REPRO-DEFM005-20261119-instrumented-v7-r3.csv` (metrics blank; `measurement_valid=0`).

## Main mismatch causes (hypothesis, from v7 cause table)

- **Harness / bot timing:** First trace divergence often with equal gameplay RNG draw counts but different phase (e.g. PLAY vs SHOP around step ~16–18; GAMBLE vs PLAY on gamble paths). Classified predominantly as `harness-timing`, not balance.

## Validity issue (verified)

With **hooks off** (`SIM_SEED_GAME` unset), instrumented baselines **do not** match pin digests at rid 0:

- R-main-i (`807d884` on `7d649ef`) vs R-main pin
- R78-i (`abf7cb8` on `59e11dc`) vs R78 pin

Module-level `gbSimGameplayRandom` call sites change behaviour without hooks. Hook-off identity tests are **skipped** in CI until the next instrumented bump (explicitly **not** done in this park commit).

## Verified (separate from hypothesis)

- Playtest **bridge** job control + Antigravity budget/`quota_wait` behaviour (this branch).
- **DEF-M-007:** Round-clear harness stall fix (prior commits).
- **DEF-M-006:** Budget exhaustion labelling (`INCOMPLETE:BUDGET` / `terminal_reason`).
- v7 harness plumbing: step trace, cause table, gate CSVs for completed runs (r1/r2).

## Blocked

- 100-run **pilot** and 1k/10k batches gated on repro.
- 10–19 confirmation gate.
- Any measurement claim that instrumented SHAs are faithful to pins without hook-off parity.

## Resume prerequisites

1. Hook-off identity tests **pass** for R-main-i and R78-i vs pins `7d649ef` / `59e11dc` (instrumented bump on `baseline/*-instrumented` only).
2. **20/20** natural repro on seeds **0–9 ×2**.
3. Confirmation **10–19 ×2**, then pilot per prior brief.

Evidence to keep: `DEF-M-005-gate-20261119-instrumented-v7.json`, `v7-mismatch-cause-table.json`, `DEF-M-005-v7-findings-20261119.md`.