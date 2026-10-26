# Phase B — merge and deployment gate

Stage 1 **Phase A** lands the reproducible baseline (PR #27). **Phase B** confirms CI, preview, and the manual browser checklist before promoting production.

## Phase A completion criteria

| Gate | Command / link | Status (26 Oct 2026) |
|------|----------------|----------------------|
| Unit + save + source tests | `npm run check` | Pass (35/35) |
| Known-defect audit | `npm run audit:known-issues` | Pass (GB001–GB011 reproduced) |
| Refactor parity | `node tests/parity.cjs` | Pass (114608 score cases) |
| Optional React smoke | See `docs/testing.md` | Pass |
| GitHub Actions | [Baseline checks on PR #27](https://github.com/LukeHolmes/Dices-and-Devices/pull/27) | Pass |
| Vercel preview (branch) | `https://auditrelease-lyuv1lyro-holmeslukej-2774s-projects.vercel.app` (commit `ddee2d8`) | Ready |
| Production | `auditrelease.vercel.app` → `main` @ `26f57d8` | Auto-promoted 26 Oct 2026 |

## Manual browser checklist (`docs/testing.md`)

| Item | Result | Notes |
|------|--------|-------|
| Lineup / Safehouse / art | Pass | |
| Street Rat + tutorial dismiss | Pass | |
| Roll, keep, score + heat preview | Pass | Pills: hover a die (desktop) or tap bone — **PILL** control is on each bone |
| Resume normal mid-run save | Pass | |
| CARVING / GAMBLE fixtures | Automated + inject helper | `node scripts/dump-fixture-save.cjs carving` then paste into console (below) |
| Mobile ~390px | Pass | |
| Console (exclude CDN/Babel warnings) | Pass | |
| Victory / bust end-to-end | Not run this pass | Terminal settlement still GB009; schedule before production promote |
| Shop / boss intro | Not run this pass | Spot-check before promote |

### Inject a synthetic save in the browser

```bash
node scripts/dump-fixture-save.cjs carving
```

In DevTools on the game origin:

```javascript
localStorage.setItem('gutterbones1977:run:v1', '<paste JSON here>');
location.reload();
```

Fixtures: `normal`, `wager`, `gamble`, `carving`. Wager/gamble resume bugs (GB006, GB010) are **expected** until Stage 2 fixes.

## Production promote (remaining Phase B)

1. ~~Merge PR #27 to `main`.~~ **Done** (merge commit `26f57d8`, 26 Oct 2026).
2. Confirm CI green on `main` after each push.
3. ~~Promote Vercel production~~ **Auto-deployed** to `26f57d8` on merge.
4. Smoke `https://auditrelease.vercel.app/index.html` — confirm `gutterbones-rules` script present (Stage 1 build).
5. Rollback pin remains `8794488` in git history if production must revert.

## Phase C pointer

After merge, begin GB007 → GB006/010 → scoring/pill fixes per `docs/stage-1-baseline.md`.
