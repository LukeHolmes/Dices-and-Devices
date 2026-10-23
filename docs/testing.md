# Testing and preview

## Normal checks

Requires Node 22+ (verified with Node 24). No packages need installing and no build step is required.

```bash
npm run check
```

This runs 35 rule/save/source tests and the known-issue audit. The audit succeeds only when each observed defect matches its explicit baseline; unexpected errors, newly fixed defects, and changed results fail it. Thus a green check means “baseline reproduced”, not “bug-free”.

```bash
npm run test:known-issues
```

This asserts desired outcomes and intentionally exits nonzero while the 11 defects remain. After a fix, move its desired assertion into the ordinary regression suite and remove its known-failure entry. Do not update broken baselines simply to make CI green.

The action harness executes selected production function bodies, substitutes storage/audio/timers and queues setters against a render snapshot. It fails loudly if source boundaries change. It does not test browser scheduling, React StrictMode, pointer interactions, layout or animation timing.

## Refactor equivalence gate

```bash
node tests/parity.cjs
```

Requires Git history containing the pinned baseline commit (use a full clone). It compares original and extracted score/save output without maintaining a second implementation. This is a Stage 1-only gate: deliberate rule fixes should retire it or narrow it to unaffected rules. It is not part of ongoing CI for that reason.

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
- Start Street Rat; dismiss onboarding; roll, keep a bone, pop a pill and score.
- Compare displayed preview and awarded heat; review the payout explanation.
- Exit/reload and resume a normal save. Exercise CARVING and GAMBLE synthetic fixtures separately; wager/gamble resume defects are currently expected.
- Inspect desktop and narrow mobile layouts, keyboard focus, reduced motion, shop and boss intro.
- Confirm the changed build still reaches victory/bust and clears the active save. Terminal settlement remains a recorded bug.

CI runs `npm run check` with read-only repository permissions. It neither deploys nor modifies saves. A successful local check is not evidence that remote CI has run.
