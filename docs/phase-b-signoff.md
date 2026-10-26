# Phase B — merge and deployment gate

**Status: complete** (26 Oct 2026, Europe/Dublin). Stage 1 baseline is on `main`; production and manual gates signed off below.

Stage 1 **Phase A** lands the reproducible baseline (PR #27, merged `26f57d8`). **Phase B** confirms CI, preview/production, and the full manual browser checklist in `docs/testing.md`.

## Phase A completion criteria

| Gate | Command / link | Status |
|------|----------------|--------|
| Unit + save + source tests | `npm run check` | Pass (37/37 after bust/victory fixtures) |
| Known-defect audit | `npm run audit:known-issues` | Pass (GB001–GB011 reproduced) |
| Refactor parity | `npm run check:release` | Pass |
| Optional React smoke | `docs/testing.md` | Pass |
| GitHub Actions | Baseline checks on `main` | Pass |
| Production | [auditrelease.vercel.app](https://auditrelease.vercel.app/index.html) (`gutterbones-rules` present) | Pass |

## Manual browser checklist

| Item | Result | Artifact |
|------|--------|----------|
| Lineup / Safehouse / art | Pass | `checklist-1-lineup-safehouse-artwork.webp` |
| Street Rat + tutorial dismiss | Pass | `checklist-2-street-rat-tutorial-dismissed.webp` |
| Roll, keep, score + heat preview | Pass | `checklist-3-score-preview-heat-calculation.webp` |
| Pill reroll (hover die → **PILL**) | Pass | `phase-b-pill-reroll.webp` |
| Resume normal mid-run save | Pass | `checklist-4-resume-hustle-save-restored.webp` |
| CARVING fixture (browser inject) | Pass | `phase-b-carving.webp` |
| GAMBLE fixture (browser inject) | Pass | `phase-b-gamble.webp` |
| Boss intro (Ctrl+Shift+D → force boss) | Pass | `phase-b-boss-intro.webp` |
| Back Alley shop | Pass | `phase-b-shop.webp` |
| Mobile ~390px | Pass | `checklist-6-mobile-layout-390px-playfield.webp` |
| Console (no game errors) | Pass | `checklist-7-console-no-errors.webp` |
| Production smoke | Pass | `phase-b-production-smoke.webp` |
| Victory end-to-end (cinematic) | Pass | `phase-b-victory.webp` — terminal cash may still reflect **GB009** |
| Bust end-to-end (rap sheet) | Pass | `phase-b-bust.webp` |

Artifacts live under `/opt/cursor/artifacts/` on the Cloud Agent run and in PR #27 walkthrough where attached.

### Injectable saves

```bash
npm run dump:save -- carving   # or: gamble, wager, bust, victory, normal
```

Browser:

```javascript
localStorage.setItem('gutterbones1977:run:v1', '<paste JSON>');
location.reload();
```

- **bust** — last hand below quota; score a small payout to trigger rap sheet.
- **victory** — round 10, one hand left; score **Sixes** to trigger escape (GB009 may affect Safehouse cash math).

## Merge and production (done)

1. PR #27 merged to `main` (`26f57d8`).
2. CI green on merge commits.
3. Vercel production auto-deployed Stage 1 build.
4. Production HTML verified to include inline `gutterbones-rules`.
5. Git rollback pin: `8794488` if revert required.

## Phase C (next)

Fix known defects starting with **GB007** → **GB006/GB010** → pill/scoring issues per `docs/stage-1-baseline.md`. Use `npm run test:known-issues` while fixing.
