# Gutterbones 1977 — Batch 5.2 Polish: Grok Bot / Cursor Master Handover

**Version:** 2026-11-19 v1.  **Owner approval:** NOT YET granted for the new Brass Knuckles, ashtray, HUD piece redo, or new full-screen concepts.  **Purpose:** synchronize review artwork into Cursor's workflow and coordinate implementation without overwriting any already approved artwork or affecting the gameplay rules.

## 1. Authoritative sources and immutable guardrails

- **Authoritative approved art bank:** ChatGPT Library `/Projects/Gutterbones/`. The superseded `/Projects/Gutterbones-1977-Art-Project/` is **not** a second art bank.
- **GitHub repository:** <https://github.com/LukeHolmes/Dices-and-Devices>. `index.html` on `main` is the current playable baseline; **do not merge this art handoff directly into main**.
- **Existing newer visual game branch:** `art/visual-overhaul` (characters and scenes), draft PR **#94** / `art/s3-item-icons` (icons), draft PR **#95** / `art/s4-shop-cards` (shop-card geometry). As checked on 19 Nov 2026, #94 and #95 remained draft and `main` was unchanged by the new art.
- **This handover's docs-only branch:** `art/batch52-polish-handoff-2026-11-19`, based on `art/s4-shop-cards`. The branch docs are a tracking index **not a binary artwork delivery**. Cursor must import the delta ZIP separately to gain the actual PNG bytes.
- **Full existing art handover:** `/Projects/Gutterbones/07_UI-Batch5/02_Gameplay-HUD/Transition-Kit-v1/gutterbones-wireframe-transition-handoff-v1.zip` (approved art plus earlier candidates, provenance and README). The existing 8 shop-card PNGs are under `/Projects/Gutterbones/07_UI-Batch5/07_Shop-Cards/` and optimized runtime WebPs are already on the stacked art branch.
- **New polish delta ZIP**: `/Projects/Gutterbones/07_UI-Batch5/02_Gameplay-HUD/Transition-Kit-v2/gutterbones-batch52-polish-delta-v1.zip`. This contains **review-only** new art, exact PNGs, previews, QA, hashes and this handover. Download it to a local work folder and pass it into Cursor.

**Creative lock:** Original 1977 gambling-table wireframe controls the look; 70% believable criminal gaming equipment, 30% underground crime-comic exaggeration. Gritty alley, halftone ink, paper and brass, warm lamp, red felt, dirty ivory dice, little cigarette/rat moments. Never replace original approved dice, hand, rat, portraits, scenes, hardware, consumables, contraband, shop frames or animations with generated stand-ins.

## 2. New asset status and exact filenames

All new art is **REVIEW ONLY**. Use `manifest.csv` (full SHA-256) to check incoming files, not only filenames. Individual Library candidate paths:

- **Brass Knuckles:** `/Projects/Gutterbones/07_UI-Batch5/05_Hardware/Review-Candidates/hardware_brass-knuckles_v1_REVIEW.png` — isolated 1302×1302 RGBA, transparent 24px safe margin. **Not production-approved**. Do not change the hardware catalog to match its appearance; source item behaviour is authoritative.
- **Ashtray:** `/Projects/Gutterbones/05_Animations/Ambient/Review-Candidates/ambient_cigarette-ashtray_v1_REVIEW.png` — isolated 1302×1302 RGBA, transparent 24px safe margin, includes a **painted smoke plume**. **Not production-approved**. Use either this plume as static atmosphere OR an independently placed live smoke sprite, not two overlapping plumes. A smokeless crop or revised prop requires a separate approval.
- **HUD edge redo:** `/Projects/Gutterbones/07_UI-Batch5/02_Gameplay-HUD/Review-Candidates/Polish-Round2/` — **9 individually clipped RGBA pieces** from the same new source sheet. Alpha outside each connected component cleared, each retains original pixels, antialias retained; transparent outer margins verified. The 1448×1086 original atlas is retained as a reference, not runtime art. **Nine-slice support NOT certified**, avoid stretching endcaps/holes or painted rivets.
- **Concept previews:** `references/concept-polish-v1-NOT-PRODUCTION.png` and `concept-polish-v2-NOT-PRODUCTION.png` in delta ZIP. Both contain fabricated example values, icon positions and copy. Do not export a flattened concept as the live UI.

| ZIP-relative file | Status | Source size | SHA-256 prefix |
|---|---|---|---|
| `references/concept-polish-v1-NOT-PRODUCTION.png` | REFERENCE_ONLY | 1672×941 | `aaf9ab0e13f8a9a6…` |
| `references/concept-polish-v2-NOT-PRODUCTION.png` | REFERENCE_ONLY | 1672×941 | `10efc20dad3bd854…` |
| `review-candidates/ambient/ambient_cigarette-ashtray_v1_REVIEW.png` | CANDIDATE_NOT_APPROVED | 1302×1302 | `3528f7b06cab5507…` |
| `review-candidates/hardware/hardware_brass-knuckles_v1_REVIEW.png` | CANDIDATE_NOT_APPROVED | 1302×1302 | `5fe8d5b43e9befd8…` |
| `review-candidates/hud/hud_control-face_red-enamel-blank_v1.png` | CANDIDATE_NOT_APPROVED | 531×225 | `7cc8e4dd752105e5…` |
| `review-candidates/hud/hud_label-backing_paper_v1.png` | CANDIDATE_NOT_APPROVED | 600×285 | `5b9cff0e990f1c8b…` |
| `review-candidates/hud/hud_plays-counter_six-slot_v1.png` | CANDIDATE_NOT_APPROVED | 779×182 | `f6dd37508ac69b51…` |
| `review-candidates/hud/hud_reworked-atlas_original-v1_REVIEW.png` | SOURCE_ATLAS_REVIEW | 1448×1086 | `08b55bd1893dd54e…` |
| `review-candidates/hud/hud_socket-arch_brass_v1.png` | CANDIDATE_NOT_APPROVED | 356×219 | `8d4216e32f766c4e…` |
| `review-candidates/hud/hud_socket-ring_brass_v1.png` | CANDIDATE_NOT_APPROVED | 291×298 | `af2bb6d8f3e4ce67…` |
| `review-candidates/hud/hud_socket-square_ink_v1.png` | CANDIDATE_NOT_APPROVED | 302×252 | `e293e11a2e85b5e9…` |
| `review-candidates/hud/hud_status-chip_paper-blank_v1.png` | CANDIDATE_NOT_APPROVED | 477×245 | `50449d05abd2613d…` |
| `review-candidates/hud/hud_status-gauge_split-blank_v1.png` | CANDIDATE_NOT_APPROVED | 884×220 | `72cd6b8d725a0cf0…` |
| `review-candidates/hud/hud_status-header_long_blank_v1.png` | CANDIDATE_NOT_APPROVED | 1419×258 | `11d0f3346c389007…` |

## 3. Existing art that MUST remain byte-identical

- Dice: `/Projects/Gutterbones/03_Dice/Master/master-bone-die.png`, `03_Dice/Numbered/die-[1..6].png`, `03_Dice/Contraband/*.png`. Five interactive dice only; engine decides face/hold/score, never UI illustration.
- Throwing hand: `/Projects/Gutterbones/05_Animations/Dice-Throw-Hand/Approved-v2-Front-Entry/hand-front-spritesheet-native-rgba.png` (4×2, eight 444px frames, approx 140ms/frame, **front-entry from bottom**). Approved source but browser integration needs gate; never layer with legacy two-image hand.
- Rat: `/Projects/Gutterbones/05_Animations/Ambient/alley-rat-8frame-game-ready.png` (4×2, eight 256px cells, approx 80ms/frame), intended rear environmental lane, occasional only, non-interactive.
- Cigarette/ambient: `/Projects/Gutterbones/05_Animations/Ambient/FX-Collection-v2.1/Spritesheets/` (ember, smoke, cockroach, bills, debris, bulb). Apply `pointer-events:none`, `aria-hidden`, reduced-motion and cosmetic RNG isolation. Do not double-up ashtray smoke.
- Existing 5 playable/6 boss portraits, 8 environment scenes, 13 approved hardware icons, 3 consumables and 8 shop cards are approved and remain untouched. One newly produced Brass Knuckles candidate closes an image gap **only if expressly approved**.

## 4. Cursor intake: branch, layout and stop conditions

**Do not commit binary candidates to runtime `assets/art/` yet.** After manual download of the delta ZIP, use a clean worktree based on `art/batch52-polish-handoff-2026-11-19`:

```bash
git fetch origin
git switch art/batch52-polish-handoff-2026-11-19
mkdir -p art-production/batch-5-2/review
# unzip the downloaded delta ZIP into art-production/batch-5-2/review/
# keep the ZIP's review-candidates/ references/ manifest.csv and qa.json structure
git status --short
```

**GitHub binary sync blocker:** The ChatGPT GitHub connector can write text docs but cannot transfer raw PNG or ZIP files. The user/Cursor/Grok Bot must import the ZIP bytes into the local repo and push a **separate archive-only review commit**. This is not complete until verifying `git ls-files art-production/batch-5-2/review`, SHA-256 matches and a remote GitHub readback. Do **not** claim these new PNGs are already in GitHub because the handover doc is visible there.

After user approves each candidate, plan conversions from isolated source PNG to optimized runtime `assets/art/` paths, with `scripts/art/build-art.mjs` provenance updates and an isolated implementation PR. Do **not** use arbitrary visual filenames to imply new game mechanics. Never change game rules, RNG, item effects, saves, timings, bosses or balance in an art-only PR.

## 5. Assignment map for Grok Bot

| Work package | Owner | Deliverable | Gate |
|---|---|---|---|
| **G0 Intake and provenance** | Grok Bot coordinator | Download both handoffs as needed, verify checksums, ensure no Library duplicates / missing binaries; coordinate Cursor access | Source hashes and clear approved-vs-candidate status |
| **G1 Curate visuals** | Art QA / Cursor | Compare original wireframe to new READY concept. Keep physical tabletop look, no fake score values, review edge cleanup at 40/64/80px | User approval per new asset |
| **G2 Archive** | Cursor | Review-only GitHub PNG sync under `art-production/batch-5-2/review/` on the handoff branch. No active runtime edits | Remote tree verified |
| **G3 Implementation plan** | Cursor UI engineer | Map real current `PlayStatusBar`, `HardwareRail`, `RollHandThrowOverlay`, `AlleyCritterCrawl`, `ScoreRow`, Matchbook and scene art to actual assets; preserve dynamic data | Peer review, no rule changes |
| **G4 Motion compatibility** | Animation specialist | Front-entry hand 8 frames; rat/ashtray/ember/smoke at safe z-layers; cancel on navigation, score focus and modal; motion reduced | Runtime screenshot + interaction evidence |
| **G5 HUD/browser QA** | QA specialist | 1366×768, 1440×900, 1920×1080, 2560×1440, 768×1024, 1024×768, 390×844, 320×568. Validate before roll/held/score/boss/shop return, touch/focus and six sockets | All blocking cases pass |
| **G6 Release readiness** | Grok Bot coordinator | Review PR #94/#95 stacking, CI, roll timing, actual scoring mechanics and no regression before any merge request | Explicit user approval for merging |

**Critical functional truth:** one heat/quota progress relationship, separate cash resource, actual Matchbook categories and locked/spent/preview states, actual 0–6 equipped hardware, real Crooked Cop dampening, valid pill-target/hold/SHUFFLE/re-roll rules. No hardcoded payout amounts. Keep Matchbook on desktop side; mobile score drawer retains five-dice context.

**Cross-branch caution:** Because #95 sits atop #94 and those on `art/visual-overhaul`, run integration and tests on the correct stacked branch; do not merge unrelated `balance/*`, `cursor/r78` or agent harness work during art polish. GitHub `main` is intentionally stable.

## 6. Grok Bot reporting protocol

Grok Bot should send a concise status report after each gate: `PASS/FAIL/BLOCKED`, branch and commit, verified file count and SHA evidence, screenshots by viewport, newly required user approval, and exact next task. Do not claim completion based on generated concept images or a successful Vercel deployment alone. If files unavailable, report the missing filenames and ZIP handoff requirement rather than substituting new art.

## 7. Approval checklist for current images

1. Brass Knuckles silhouette recognizable at 40, 64 and 80px and mechanic-consistent icon mapping. No transparent-edge artefact; no replace of approved art without explicit approval.
2. Ashtray believable near lower-left tabletop and no collision with Roll/pill/Matchbook; decide whether static painted smoke or runtime smoke plume.
3. Nine isolated HUD pieces match original wireframe and shop-card material but remain readable at actual sizes; prevent linear stretching of rivets, slots, circular holes and ink borders.
4. New Matchbook candidate from prior kit remains a separate approval; actual 13 code-driven scoring categories must fit/scroll on phones.
5. Hand and rat maintain their approved source geometry and run under the original code's event semantics; only visual data changes.

**Immediate status:** review kit ready for manual transfer; GitHub docs branch created; PNG binary sync and UI integration are separate pending tasks. Never mark the new art APPROVED until user signs off.