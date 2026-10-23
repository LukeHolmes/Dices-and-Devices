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

## Known defects carried forward

`tests/known-issues.cjs` contains both the observed result and the desired result for each deterministic reproduction.

| ID | Current defect | Intended follow-up |
|---|---|---|
| GB001 | Zero-pill Enforcer cannot opening-roll | Separate opening roll eligibility from reroll resources. |
| GB002 | Pill reroll ignores carved faces | Use a consistent face resolver. |
| GB003 | SNIFF spends stash when reroll cannot happen | Validate before charging; settle intended pill cost. |
| GB004 | Full Ride accepts fewer than five scoring bones | Require a genuine five-bone full house. |
| GB005 | Centerpiece does not repeat gold face bonus | Apply the documented copied-face behaviour. |
| GB006 | Resume discards an already paid wager | Preserve wager state. |
| GB007 | Empty object accepted as resumable save | Validate shape, version and five dice. |
| GB008 | Debt payment can exceed debt owed | Cap charge at the actual payable debt. |
| GB009 | Terminal award omits hustle cash and subtracts lost stake twice | Use one settled cash total throughout. |
| GB010 | Resume clears gamble stake | Preserve the pending gamble. |
| GB011 | Pill reroll bypasses Junkie six-to-one rule | Apply boss rules consistently. |

Other review findings remain outside this focused harness: autosave during animation, stale scheduled callbacks, route-copy/tuning drift, inventory-order-dependent multiplier stacking, low-value consumable pricing, accessibility, and mobile/performance work. Passing Stage 1 checks does not resolve these.

## Verification and remaining delivery gate

- 35 automated tests passed.
- All 11 defect probes reproduced exactly. Strict desired-behaviour mode fails all 11 as expected.
- 114,608 complete scoring outputs (including explanations/triggers) and 7 save normalization cases matched the pinned original. Coverage includes every ordered standard five-die hand across all 13 categories and additional face, hardware, flow/mastery and hardware-suppression combinations.
- Full Babel compilation and React 18/jsdom contract → roll → autosave smoke passed.
- No visual, mobile, CDN-loading, or real-browser verification of the changed build has been completed. Use the checklist before deployment.
- GitHub connection is read-only (`push: false`); branch creation returned HTTP 403, “Resource not accessible by integration.” The local branch is prepared; remote branch, PR, hosted preview, and remote CI remain pending write access. Existing production remains untouched.
