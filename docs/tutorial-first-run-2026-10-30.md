# Guided first run / tutorial (30 Oct 2026)

**Branch:** `cursor/tutorial-first-run-f4c3`

## Player-facing

- First contract with no save: **Learn the hustle** or **Skip** (straight to alley + legacy first-run overlay if not completed).
- Tutorial run: fixed dice script, in-game coach marks (spotlight + fixer caption), **Skip tutorial** always visible.
- Replay from lineup (**Learn the hustle**), Help dossier, or System menu.
- One-time mechanic toasts after tutorial: first shop, carving, route choice, gamble, side bet.
- Help dossier no longer auto-opens after dismiss when `tutorialCompleted` is set.

## Implementation

| Piece | Location |
|--------|-----------|
| Script | `gutterbones-tutorial` — `ROLL_TABLE`, `STEPS`, `TUNING` |
| Settings | `tutorialCompleted`, `tipSeen*` flags in `gutterbones1977:settings:v1` |
| UI | `FirstRunTutorialChoice`, `TutorialCoachMark`, `data-tutorial` anchors |
| Run hook | `beginContract({ tutorial })` — low quota, skips prologue/story |

## Tests

```bash
npm test          # includes tests/tutorial.test.cjs
npm run test:layout  # + tutorial_choice, tutorial_coach scenarios
npm run check
```

## Layout audit

`?layoutAudit=1` → `openTutorialChoice()`, `openTutorialCoach()`.
