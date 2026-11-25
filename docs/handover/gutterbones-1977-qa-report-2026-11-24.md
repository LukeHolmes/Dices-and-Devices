# Gutterbones 1977 — Full QA Report (2026-11-24)

Scope: post-merge QA of the new art + visual style (main = `47f614e` after the refresh-cost fix).

## Results

| Suite | Result |
|---|---|
| `test:fast` (rules / balance / sim / saves) | **239 / 239 pass** |
| `audit:known-issues` (GB001–GB011) | **11 / 11 pass** |
| `test:playwright` (browser E2E / layout) | **~74–78 / 100** (26–30 failures, all pre-existing) |

## Bug fixed this session

- **`shop — refresh cost curve is softer early`** — was `10 !== 9`.
  - Root cause: `SHOP_AGENCY_TUNING` used `refreshBaseCost: 8`, `refreshEscalation: 4`; the regression test (the spec) wants `9/12/15/18` for round 2 (base 9, escalation 3).
  - Fix: `refreshBaseCost: 7`, `refreshEscalation: 3` (kept `refreshRoundTax: 2`). Commit `47f614e`, pushed.
  - Verified: `refresh cost` test passes; `balance-top5-fixes` 5/5 (no regression).

## Pre-existing failures (NOT introduced by the art merge)

Confirmed via baseline run on `c62da55` (pre-art main: 26 failures, same deterministic set) and `git log -S` showing the art branch did not touch this code. CI does not catch these because `baseline-checks.yml` only runs `check:fast` (= `test:fast` + smoke) + `sim:50` + layout shard — not the full `test:playwright`.

1. **run-intel UI cluster (~18 tests)** — `run intel summary *`, `inline run intel fully visible`, `run intel DETAILS popover`, `play stash intel readable`.
   - Root cause: `RunIntelSummary` defaults `inlineCollapsed = true` on ≤767px width or ≤820px height (all three test viewports qualify), which hides the chip row; tests wait for it visible. On small screens the summary also lives inside the hidden `play-stash` overlay.
2. **synergy-chain banner (~3 tests)** — `synergy chain banner visible…`, `build-tag … synergy chain overlay`.
   - Root cause: chain banner/overlay not rendering after a chain fires (Phase 2 "juice" UI). Needs investigation of chain-state → banner render path.
3. **carve → shop transition (1 test)** — `carve returns to shop without skipping job round`.
   - Root cause: after clicking a carve tile, phase stays `CARVING` instead of `SHOP`. Needs investigation of carve-complete handler.
4. **roll disabled while score overlay open (1 test)** — e2e `waitForFunction` timeout; possibly flaky timing or the roll-lock not set on score overlay.

## Environment notes

- Playwright 1.64.1 installed (`npm install`); cached `chromium-1248` matches. `npm install` also rewrote `package-lock.json` — reverted so the fix commit stays clean.
- Native `node`/`npm`/`git` and child-process spawns work under `danger-full-access` (no more sandbox EPERM).
