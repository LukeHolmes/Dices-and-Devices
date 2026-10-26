# Stage 1 — reproducible baseline

Reviewed 23 October 2026. Canonical repository: LukeHolmes/Dices-and-Devices.

## Source and rollback

- Sole current playable source: `index.html` on `main`.
- Baseline / rollback commit: `8794488f2e2ecd3f781fa79aed55afa028200927`.
- Isolated working branch: `codex/stage-1-baseline`.
- Public deployment recorded at review: https://auditrelease.vercel.app . Its HTML matched the baseline during review.
- `gutterbones1977.html` is an earlier Gutterbones archive; `dice-and-devises-legacy.html` is the archived cyberpunk prototype. Neither is a second development target. Historical animation and Notion notes are context, not authoritative current rules.

To inspect a rollback without changing an existing checkout:

```bash
git worktree add --detach ../gutterbones-baseline 8794488f2e2ecd3f781fa79aed55afa028200927
```

For an actual deployment rollback, deploy that pinned commit through the existing hosting process. This stage does not change deployment configuration or publish production.

## Changes

Dice resolution, score calculation and save normalization now share one inline, non-JSX helper block. The app calls these helpers with explicit context; tests execute the same code. Algorithms, content, visuals, save version and CDN dependencies are unchanged. No framework migration or extra runtime network request is introduced.

A dependency-free Node harness provides rule assertions, synthetic saves, all six boss fixtures and known-defect probes. Action probes model one React render's state snapshot and queued setters; they do not pretend to reproduce React scheduling. An optional full React/jsdom smoke check covers compilation, mount, contract start, tutorial dismissal, roll completion and autosave.

## Open PR triage

Snapshot from the review; refresh branch comparisons before applying any work. No PR was merged or closed.

| PR | Subject | Relationship to main | Decision |
|---|---|---|---|
| #26 | Contact link | 1 ahead, 0 behind | Small independent change; review destination and placement separately. |
| #21 | Mechanic popups | 1 ahead, 31 behind | Compare with current popup implementation; salvage only missing behaviour. |
| #20 | Popup integration | 1 ahead, 39 behind | Overlaps existing work; do not merge wholesale. |
| #15 | Popups | 1 ahead, 57 behind | Historical overlap; inspect before considering closure. |
| #8 | Animation stages 1–9 | 2 ahead, 91 behind | Old baseline branch; compare desired polish against current game. |
| #7 | Animation stages 1–2 | 0 ahead, 98 behind | No unique commits relative to main at review; candidate for closure after owner review. |

#8 and #7 target the older `cursor/gutterbones1977-baseline-8d0d` branch. Counts above compare their heads with current main, not with their PR base. These recommendations are triage, not claims that every patch has been revalidated.

## Known defects (Phase C — resolved)

GB001–GB011 were fixed in Phase C. Regression coverage: `tests/regression-defects.test.cjs`. See `docs/phase-c-signoff.md`.

Other review findings remain outside the defect harness: autosave during animation, stale scheduled callbacks, route-copy/tuning drift, inventory-order-dependent multiplier stacking, low-value consumable pricing, accessibility, and mobile/performance work.

## Verification and remaining delivery gate

- 35 automated tests passed.
- All 11 defect probes reproduced exactly. Strict desired-behaviour mode fails all 11 as expected.
- 114,608 complete scoring outputs (including explanations/triggers) and 7 save normalization cases matched the pinned original. Coverage includes every ordered standard five-die hand across all 13 categories and additional face, hardware, flow/mastery and hardware-suppression combinations.
- Full Babel compilation and React 18/jsdom contract → roll → autosave smoke passed.
- No visual, mobile, CDN-loading, or real-browser verification of the changed build has been completed. Use the checklist before deployment.
- Phase B merge gate: **complete** — see `docs/phase-b-signoff.md` (CI, production, full manual checklist signed off 26 Oct 2026).
