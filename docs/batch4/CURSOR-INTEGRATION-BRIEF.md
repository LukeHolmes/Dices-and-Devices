# Gutterbones 1977 — Batch 4 integration handoff (Cursor)

**Branch:** `cursor/batch4-contraband-animation-integration-20261117`  
**Repository:** `LukeHolmes/Dices-and-Devices`  
**Status:** branch scaffold; **not yet integrated into gameplay, not accepted for merge**.  
**Authority:** `AGENTS.md` (single-file `index.html` app), `ANIMATION_PLAN.md`, `docs/motion-system.md`, `docs/testing.md`.

## Goal

Integrate the twelve approved, 8-frame contraband effects as *presentation-only cues* on genuine committed scoring/activation events. Preserve the current dice pipeline, rule code, random streams, scoring, autosaves, and existing motion/overlay timing. **No Vite split; no gameplay change. No merge, no deploy.**

## Source assets and reproducible validation

1. Download/extract `Gutterbones-1977-Contraband-Animations.zip` from the ChatGPT project Library (`/Projects/Gutterbones-1977-Art-Project/05_Animations/`). The ZIP contains all 12 sheets and the source manifest. Do **not** substitute older ECHO 2048×1024 art: the approved production normalized ECHO is **1024×512**.
2. `node scripts/import-contraband-assets.cjs <path-to-extracted-archive> --dry-run`, then without `--dry-run` once reviewed. This copies files to `assets/animations/contraband/` (use `--overwrite` only when intentionally replacing them).
3. `node scripts/validate-contraband-assets.cjs --report=docs/batch4/asset-qa.json`; verify all 12 PASS, 1024×512 RGBA, 2 rows × 4 columns, 8 frames of 256×256, negligible edge alpha (<=2), low first/last frame opacity, stable position.
4. Keep original PNGs in a source-art folder outside runtime `assets/`; use reviewed **lossless** optimization only. Compare original/optimized pixels or hashes and document byte savings; no lossy quantization without approval.

## Confirmed existing architecture (from repository)

- `index.html` is the production React/Babel monolith. `AGENTS.md` forbids a forced architecture split.
- Shared pure rules live in `<script id="gutterbones-rules">`; React app in `<script type="text/babel">`.
- Action probes identify `rollBones`, `rerollBoneSlot`, `popPill`, `calculateScore`, `executePayout`, `serializeRun` and `persistRun` (`tests/helpers/game.cjs`).
- `calculateScore` returns `triggers`, `synergyEvents`, `explanationSteps` and payout metadata; the app has a score breakdown/presentation lifecycle. **Preview score is NOT an activation.**
- Existing `DICE_ART`, roll-hand overlays, stingers, `GutterbonesPresentation`, staggered score overlays and `getScoreOverlayLifetimeMs` must stay intact.
- `gb-motion-reduce` and `reducedMotion` gate motion; `pointer-events:none`, `aria-hidden` are mandatory.
- Existing dev demos **LOAD SYNERGY DEMO LANE** and **LOAD MULTI-CHAIN DEMO** allow deterministic chain QA.

## Renderer scaffold delivered

`assets/animations/contraband-fx.js` exports `GutterbonesContrabandFx.createRenderer()` in a normal script (no build). This DOM-only adapter:

- draws an 8-frame 4×2 spritesheet as a fixed overlay centred above an existing die DOM node, without modifying the die or React tree;
- uses `requestAnimationFrame` (95ms/frame), no pending `setTimeout` chain, and `cancel`, `cancelAll`, `destroy` to avoid dangling tasks;
- deduplicates event IDs, replaces any existing effect on the same die, caps simultaneous overlays at 5, and ignores disconnected anchors;
- respects `prefers-reduced-motion` and the explicitly supplied `reducedMotion` flag;
- preloads assets when asked; does **not** call rules, RNG, storage or game state.

Run `node --test tests/contraband-fx.test.cjs` after cherry-picking/reading this scaffold. Tests check full frame progression, duplicate suppression, reduced motion, cancellation and concurrency (6 tests passed in isolation at creation).

## Exact Cursor implementation sequence

**A. Baseline and evidence**

- Check out the branch. Record HEAD SHA, Node version, and current `npm run check:fast` baseline before modifications. Do not confuse existing known-issue repro PASS with a fixed bug. Inspect `index.html` score resolution, `executePayout`, `GutterbonesPresentation`, pending queue refs, cleanup lifecycle, face definitions and current dice DOM anchors.
- Audit the exact set of face IDs and scoring trigger IDs before wiring. Candidate mapping requires source verification: `MULT_FACE`→mult, `GOLD_FACE`→cash, `WILD_FACE`→wild, `BLOOD_6`→blood-6, `ECHO_FACE`→echo, `SHIV_FACE`→shiv, `WIREBAG_FACE`→wirebag, `GHOST_FACE`→ghost, `FUSE_FACE`→fuse, `MAGNET_FACE`→magnet, `MARK_FACE`→mark, `DOUBLE_DOWN_FACE`→double-down. If any source identifier differs, update mapping to actual production ID, not inferred display text.

**B. Visual integration**

- Load `assets/animations/contraband-fx.js` once in `index.html` before the React app script using the existing asset-base mechanism, then instantiate one renderer for the lifetime of the mounted gameplay surface. Preload the twelve PNGs after the UI becomes interactive (defer if necessary).
- Add a **read-only presentation event adapter** on **committed, valid payout results**, not on renders, hover previews, simulation fixtures, intermediate `calculateScore` calls, or held/rolled dice alone. Use actual `triggers`/`synergyEvents`/`explanationSteps`/category marks to identify which effect *really fired*. Do not fire all visible carved faces indiscriminately.
- Build stable one-shot event tokens from the current UI's ephemeral score-commit sequence plus die slot and confirmed effect. Tokens must not be persisted; repeated React renders must not replay the effect. Multiple eligible effects on one slot should queue deterministically or choose a documented priority, never visually stack.
- Resolve the actual five die DOM anchors as mounted by the PLAY component; overlay must be independent of React markup, not block clicks, and not obscure score breakdown. Do not add fields to run saves or change rule outputs.
- Call `cancelAll()` at phase changes, new roll, run load/reset, teardown, and reduced-motion activation. Verify `destroy()` on unmount and `visibilitychange` when backgrounded. Fix any repeated-event invocation before adding timing hacks.
- Align animation reveal with existing scoring cascade/presentation timing; 760ms default should not extend or block scoring UI. If slow/fast pacing needs alignment, derive it from existing presentation settings and preserve completion ordering.

**C. Demo and QA**

- Create a DEV-ONLY deterministic animation gallery/test hook that invokes the renderer with each of the twelve approved effects without granting score, changing RNG or touching saves. Do not expose it in production without DEV gating. Capture desktop (1366×768, 1920×1080), tablet (768×1024, 1024×768), and mobile (360×640, 390×844, 412×915) browser screenshots and a short animated demonstration or video including all 12 triggers. Use existing Playwright patterns and attach evidence in `docs/batch4/evidence/` or PR artifact storage.
- In ordinary gameplay, exercise one genuine valid activation for each effect (when possible via fixture/dev lane); assert no effect on invalid score/previews. Check repeated scoring, reset, resume, near-simultaneous triggers, fast pacing, background/foreground, reduced motion and pointer accessibility.
- Run `node --test tests/contraband-fx.test.cjs`, `node scripts/validate-contraband-assets.cjs`, `npm run check:fast`, `npm test`, `npm run test:layout` (or all four blocking shards first), `npm run audit:known-issues`. Document browser/network/CDN prerequisites; do not claim tests ran merely because a script exists.
- Compare seeded outcomes (total, chips/cash, category marks, chainDepth, RNG, outcome, saved-run normalization) to baseline for matching fixtures. The renderer must have zero observable effects on any of these.

**D. Review / release gate**

- Produce `docs/batch4/REVIEW-REPORT.md` with verified SHA, asset checks and sizes, actual code anchors, per-effect trigger evidence, screenshots/video links, pass/fail/blocked test commands, browser matrix, performance observations, known issues, and a reproducible rollback plan.
- Do not merge or deploy. Keep a draft PR optional; request Luke's explicit approval for any merge or release.
- **Only after Batch 4 is genuinely green**, finalize `docs/batch4/BATCH5-INTERFACE-ARTWORK.md` from the game's actual UI surfaces, with inventory, integration targets, art brief, mobile crops, performance budget and approved style. That document is currently a gated draft.

## Completion requirements

ALL: 12/12 production assets imported and validated; correct post-commit events wired; no score/RNG/save changes; effect lifecycle and reduced-motion tests pass; real device-size screenshots and all-twelve demonstration captured; regression suite and browser checks documented; reviewer approves report. One failure means the branch is not ready.

## Efficiency policy

Read `AGENTS.md` once; inspect source only at required event seams. Use the existing test harness and scripts rather than regenerating reports manually. Batch identical asset checks and Playwright screenshots. Do not use expensive agents for deterministic PNG checks, file copies, hash comparisons, or scripted assertions. No unrelated refactors.
