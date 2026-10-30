# Pro polish (2026-10-30)

Branch: `cursor/pro-polish` (stacked on `cursor/release-prep-f4c3` / promote PR **#58**).

**Merge order:** Luke should merge **#58 (promote to main)** first, then retarget this PR’s base to `main`.

## Summary

UX and juice pass for playtest readiness: faster, staggered dice rolls; payout sheet stability; screen transitions; shop route layout; unified panel styling; art preload/fade; score card polish; held-die clarity; title/lineup stability; tutorial spotlight cut-outs; roll-ready glow-only pulse for stable automation clicks.

## Checklist (request items)

| # | Area | Change |
|---|------|--------|
| 1 | Roll | ~0.6–1s tumble, per-die land + `dieThud`, staggered settle (no long blank lane) |
| 2 | Payouts | Fixed row height; BUST reason in tooltip/title only; 240ms scoring input lock on payout |
| 3 | Transitions | `transitionToPhase` fade/slide; clears stamps, flow chips, floating numbers; waits for heat tally before round-end screens |
| 4 | Shop routes | Auto-height cards; `gb-route-list` styled scroll (no default white box) |
| 5 | Type/panels | `gb-type-panel` shared with `readable-panel`; HUD side panels unchanged in layout |
| 6 | Art / Case Files | Scene preload links + `scene-backdrop-fade`; Case Files min-height + open animation; boss `NO PHOTO` placeholder |
| 7 | Score card | FILED stamp offset; no inner scroll; tap/auto dismiss unchanged; flow display rounded; stamp bounce |
| 8 | Held die | Lift/glow/`HELD` label; hold tick tone; ROLL 'EM copy unified |
| 9 | Main menu | Title actions grid (no stray scroll); lineup RESUME slot reserved; button active states; locked card contrast |
| 10 | Tutorial | Box-shadow spotlight cut-out; Free Sniff banner moved below heat; onboarding kicker stable height |
| — | Automation | `rollReadyPulse` uses glow only (no transform) |

## Verification

- `npm run check` (layout audit + Node tests)
- Manual: roll in alley, payout BUST tooltip, round-end → shop transition, tutorial spotlight, title/lineup with/without save

## Out of scope

- Phase 7 Vite split (#44) — unchanged.
