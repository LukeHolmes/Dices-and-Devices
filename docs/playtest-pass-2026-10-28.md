# Playtest pass — 28 Oct 2026 (Europe/Dublin)

**Build:** `main` through Phase 6b (`09afd7f` merge) + Phase 4b branch work  
**Automated:** `npm run check` — **68/68** pass (pre-4b); re-run after 4b merge expected **72/72**.

## Checklist (from `docs/testing.md`)

| Item | Result | Notes |
|------|--------|-------|
| Lineup / Safehouse load, no console errors | Pass | Spot-checked during agent QA |
| Onboarding + PILL visible | Pass | Prior phase 3 QA |
| Locked payout unlock copy | Pass | Automated onboarding tests |
| Help + Case Files | Pass | ROUTES & GAMBLE + bosses present |
| Witness story beats | Pass | Phase 4; 4b extends to all arcs |
| Portraits (Counter, Bouncer, Cop) | Pass | Phase 5 |
| Shop route quota telegraph | Pass | Phase 6a |
| Gamble tiers + flow bonus | Pass | Phase 6b screenshot on file |
| Side bet win payout + preview heat | Pass | Phase 6a |
| Resume / fixtures | Pass | GB006, GB010 in regression suite |
| Terminal settlement (GB009) | Known issue | Still documented, not fixed this pass |

## Follow-ups

- Replace placeholder story art for arcs A–D under `assets/panels/{setup,debt,inside,borough}/`.
- Optional: dev “force arc” for QA (not required for ship).
