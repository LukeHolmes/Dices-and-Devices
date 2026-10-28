# Testing and preview

## Normal checks

Requires Node 22+ (verified with Node 24). No packages need installing and no build step is required.

```bash
npm run check
```

This runs automated tests including `tests/regression-defects.test.cjs` (former GB001–GB011) and `tests/onboarding.test.cjs`. A green check means rules, saves, onboarding gates, and defect regressions all pass.

```bash
npm run audit:known-issues
```

Runs the same defect regression file (alias for CI compatibility).

The action harness executes selected production function bodies, substitutes storage/audio/timers and queues setters against a render snapshot. It fails loudly if source boundaries change. It does not test browser scheduling, React StrictMode, pointer interactions, layout or animation timing.

## Refactor equivalence gate

```bash
node tests/parity.cjs
```

Requires Git history containing the pinned baseline commit (use a full clone). **Retired from `npm run check:release` after Phase C** — intentional bug fixes diverge from commit `8794488`. Run manually only when verifying refactor equivalence on untouched rules.

## Optional React smoke check

Install tooling into a temporary directory outside the project:

```bash
npm install --prefix /tmp/gutterbones-test-tools --no-audit --no-fund @babel/standalone@7.28.4 react@18.3.1 react-dom@18.3.1 jsdom@26.1.0
GUTTERBONES_TEST_DEPS=/tmp/gutterbones-test-tools/node_modules node tests/runtime-smoke.cjs
```

This compiles the entire JSX, mounts React and exercises contract start, tutorial skip, rolling and autosave using a simulated DOM. It uses script semantics for the shared lexical binding. It does not load remote CSS/fonts/art or replace a browser test. The temporary tools are not runtime dependencies.

## Local preview and manual checklist

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://localhost:8080/index.html . CDN access is required. Use a disposable browser profile so test runs do not overwrite personal saves. Stop the server with Ctrl-C. Do not deploy an archive HTML file.

Before publishing, check:

- Lineup and Safehouse render, artwork loads, console has no exceptions.
- Start Street Rat; walk through all six onboarding steps (quota, pill, boss); roll, keep a bone, pop a pill without hovering (PILL badge visible on each die), and score.
- On a fresh profile, confirm locked payout rows show run-count unlock copy in the payout footer; after two completed runs, FOK unlocks.
- Open Help → QUOTA & PLAYS and HEAT BOSSES; Case Files → ARCHIVE → payout progression blurb.
- Start a new run: Witness prologue panel (caption + image) before round 1; skip with Space; after shop path pick, round-2 story beat; bust/victory show arc ending panels before rap sheet / victory ticket.
- Case Files / lineup: Counter shows `card-counter.png` when unlocked; dev panel force **BOUNCER** or **CROOKED_COP** — boss intro and banner show portrait (not color block fallback).
- Compare displayed preview and awarded heat; review the payout explanation.
- Exit/reload and resume a normal save. Exercise CARVING and GAMBLE synthetic fixtures separately; wager/gamble resume defects are currently expected. Generate injectable saves with `npm run dump:save -- [normal|wager|gamble|carving|bust|victory]` (see `docs/phase-b-signoff.md`).
- **Shop routes:** each NEXT JOB card shows next quota number, modifier bullets, and boss thumbnail on turf war; Run Intel lists three-route compare.
- **Gamble (round 3+, $5+ cash):** safe cut; three flip tiers (Soft / Fair / Hard) show stake, win %, ± payout; flow streak shows odds bonus.
- **Side bets:** stake buttons show win payout; after rolling, best preview heat vs threshold.
- Open Help → **ROUTES & GAMBLE** section.
- Inspect desktop and narrow mobile layouts, keyboard focus, reduced motion, shop and boss intro.
- Confirm the changed build still reaches victory/bust and clears the active save. Terminal settlement remains a recorded bug.

CI runs `npm run check` with read-only repository permissions. It neither deploys nor modifies saves. A successful local check is not evidence that remote CI has run.
