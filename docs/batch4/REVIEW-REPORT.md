# Gutterbones 1977 — Batch 4 review report (OPEN / NOT APPROVED)

**Target branch:** `cursor/batch4-contraband-animation-integration-20261117`  
**Date:** 2026-11-17  
**Status:** INCOMPLETE — does not authorise merge or deployment.

## Evidence completed in this preparation pass

| Check | Result | Evidence |
|---|---|---|
| All 12 approved spritesheets available in ChatGPT Library | PASS | Project folder `05_Animations`, zipped archive |
| Image dimensions, RGBA, frame grid, transparency, edge alpha | PASS 12/12 | `Gutterbones-Batch4-Node-QA.json`; script `scripts/validate-contraband-assets.cjs` |
| One-shot sheet demo, all 12 effects | PASS (asset-level only) | `Gutterbones-Batch4-Animation-Demo.gif` (not gameplay footage) |
| Renderer frame progression, cancellation, dedupe, reduced motion and concurrency | PASS 6/6 isolated tests | `node --test tests/contraband-fx.test.cjs` |
| Git feature branch created | PASS | `cursor/batch4-contraband-animation-integration-20261117` |
| Existing game architecture sampled | PASS (docs/tests inspection) | `AGENTS.md`, `docs/testing.md`, `docs/motion-system.md`, `tests/helpers/game.cjs`, `tests/synergy-tier2.test.cjs` |

## Outstanding blockers / acceptance work for Cursor

| Gate | Status | Notes |
|---|---|---|
| Approved PNG binaries imported into `assets/animations/contraband/` on branch | NOT RUN | GitHub text-only connector cannot upload PNGs; Cursor imports ZIP and commits binaries |
| Script added to monolith `index.html`, instantiation and event wiring | NOT RUN | Inspect exact production event seam before changing the large HTML file |
| Correct event mapping for all 12, committed effects only | NOT RUN | Validate rules trigger IDs against production, verify rerender suppression |
| End-to-end genuine activation + reroll/score/chain/teardown timing | NOT RUN | Test with Playwright and deterministic dev fixtures |
| Regression baseline / `npm run check:fast` / `npm test` / `npm run test:layout` | NOT RUN | Requires repo checkout + CDN/browser environment; avoid unsupported PASS claim |
| Desktop/tablet/mobile gameplay video and screenshots | NOT RUN | Asset-level GIF is not equivalent to in-game capture |
| Save, RNG, scoring parity against baseline | NOT RUN | Must pass before approval |
| Lossless production optimization and byte-size comparison | NOT RUN | Protect original approved art and revalidate optimized copies |
| Batch 5 interface inventory and visual brief final approval | GATED | Draft exists; finish after Batch 4 passes |

## Safety / rollback

- Only feature branch changes permitted. No writes to main, no PR merge, no deployment.
- Renderer is presentation-only. If a defect occurs, unload the renderer script and event adapter, remove `assets/animations/contraband` imports; all existing dice and game rules must continue unchanged.
- Never mutate `Math.random`, `GutterbonesRules.calculateScore`, `normalizeSavedRun`, `serializeRun`, or stored schema for visual effects.
- Keep reduced-motion behaviour, pointer interactions and `GutterbonesPresentation` lifecycle intact.
