# Diagnostics tracking (append-only)

This tree stores deterministic sim batches, experiment metadata, and defects. Unknown metrics stay **blank** in CSV rows (never guessed).

## Layout

- `runs/<batch_id>.csv` — one row per game run
- `experiments/` — experiment JSON registry
- `findings.md` — verified / reported / hypotheses
- `decisions.md` — approver decisions (Luke)
- `deferred-balance-changes.md` — balance ideas held back pending evidence
- `holdout-consumption-log.csv` — holdout rid 55–59 consumption audit
- `defects/gameplay/` and `defects/measurement/` — separate defect kinds

## Harness pins (pilot)

| Field | Value |
|---|---|
| R-main rules | `main` @ `7d649ef894dda8c3dbad77760e5fd3ecc943b4ba` |
| R78 rules | PR #78 head `59e11dcf92db3fccba1e44f9ac57f801710577d0` |
| Policy revision (both) | `2026-11-11-phase-b-v1` |
| Profile | Street Rat + safe cut (`SIM_STREET_RAT_PROFILE=1`) |
| Pilot rids | `0-49` and `60-109` (100 per baseline) |
| Holdouts | `55-59` blocked unless `HOLDOUT_APPROVAL_ID` is set |