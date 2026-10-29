# Phase 6e — Opening balance

**Status:** **Merged** — PR [#47](https://github.com/LukeHolmes/Dices-and-Devices/pull/47) → `main` (28 Oct 2026)  
**Base:** Playtest fix plan · **Scope:** `index.html`, `scripts/sim-opening.cjs`, tests

## Tuning changes

| Knob | Before | After |
|------|--------|-------|
| `EARLY_GAME_TUNING.openingTarget` | 130 | **85** |
| Mid curve `flatIncrease` | 42 | **52** |
| Counter quirk copy | “20% higher” | **15% higher** (matches ×1.15) |
| `FIRST_RUN_TUNING` (optional) | — | R1 **70** when `meta.totalRuns === 0`; Enforcer **1 pill** in R1 only |

Mirrored in inline `gutterbones-routes` and Babel catalog (`index.html`).

## Simulation (seed `0x6e202610`, 8000 iterations, first-run category set)

Run locally:

```bash
node scripts/sim-opening.cjs
```

Latest sim table (8000 iters, seed `0x6e202610`, greedy pill use):

| Persona (pills) | P(≥85) | P(≥100) | P(≥130) |
|-----------------|--------|---------|---------|
| Street Rat / Counter (3) | 0.62 | 0.50 | 0.44 |
| Hustler (2) | 0.54 | 0.41 | 0.36 |
| Enforcer (0) | 0.20 | 0.14 | 0.11 |

Back Alley quota **entering round 6** from R1 @85: **297** (legacy reference ~312, within ±10%).

## Verification

- `npm run check` (includes `tests/balance.test.cjs`)
- Manual: new Rat run clears R1 without requiring Full Ride

## Next

**Phase 6f** merged with this stack. See **Phase 7** when ready to split the monolith.
