# Findings

## Verified

- Holdout rids 55–59 are locked in `tests/fixtures/holdout-seeds-lock.json` (2026-11-11) but `tests/sim/run.cjs` on `main` had no server-side guard before this harness branch.
- `WP2_RID_OFFSET` was ignored by `tests/sim/run.cjs` on `main` / R78 prior to this branch.
- Pilot rid window `0-49,60-109` excludes holdouts 55–59.

## Reported

- PR #78: 0/50 wins on rids 0–49 with prior harness persona index 4 (Grinder fallback), not Street Rat.
- Nightly workflow: eight successful post-lock nightly runs (11–18 Nov 2026) each executed rids 0–499 including 55–59 on `main`.

## Hypotheses

- Bit-for-bit cross-baseline comparability requires identical harness commit, policy revision, viewport rotation, and seeded game RNG (validated via `scripts/diagnostics-repro-check.cjs` on this branch).