# Phase 6f — QA pass (unverified playtest items)

**Status:** Shipped on branch `cursor/phase-6f-qa-pass-048e` (stacked on 6e)  
**Base:** Playtest fix plan § Phase 6f

## Verified on `index.html`

| Item | Result | Notes |
|------|--------|-------|
| Shop “LOAN” / debt purchases | **Pass (+ copy)** | `handlePurchase` adds debt via `registerDebtSpike` when `gold < cost`; button label `LOAN`. Added alley explainer for credit buys. |
| Round cash feedback | **Pass (+ copy)** | Hustle cash per scored hand (`ECONOMY_TUNING`); path `reward` on route pick. Fixer line now calls out **quota cleared** when entering shop/gamble. |
| Win / victory flow | **Pass (automated)** | GB009 terminal settlement still covered in `tests/regression-defects.test.cjs`; victory uses `the-escape.png` backdrop + `awardLaunderedCash`. |
| Mute / volume settings | **Pass** | Menu `SOUND MUTED/ON` + volume cycle; persisted in `gutterbones1977:settings:v1`. |

## Docs

- Addendum appended to `docs/playtest-pass-2026-10-28.md`.

## Verification

- `npm run check` (81 tests with 6f source test)

## Stack note

Includes **6c–6e** until prior PRs merge. Merge order: **#45 → #46 → #47 → this PR**.
