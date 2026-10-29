# Phase 7 — Vite build & module split

**Status:** In progress on branch `cursor/phase-7-vite-split-048e` ([PR #44](https://github.com/LukeHolmes/Dices-and-Devices/pull/44)) — **do not merge to `main` yet.**  
**Blocker:** [coldforge.tech](https://coldforge.tech/Dices-and-Devices/) uses **GitHub Pages** (static files from `main`). Phase 7 needs a **Pages deploy workflow** (`vite build` → publish `dist/`) before merge, or production breaks.  
**Production:** Keep shipping the monolith `index.html` on `main` until that workflow lands.  
**Depends on:** Phases 1–6f and 4b on `main` (Oct 2026)  
**Goal:** Move from a **~5k-line `index.html` + CDN Babel** to a **maintainable Vite app** with the same player-facing behavior, **green `npm run check`**, and a **static deploy artifact** for GitHub Pages / Vercel.

**Roadmap context:** Extracted logic already lives in inline scripts (`gutterbones-rules`, `onboarding`, `story`, `routes`, `gamble`, `audio`). Phase 7 **lifts** those into real modules instead of adding features.

---

## 0. Where the game stands (pre–Phase 7)

| Shipped | Player / dev impact |
|---------|---------------------|
| 1–2 | Prod React, dev gate, Web Audio + settings |
| 3 | Onboarding, PILL UX, category unlock copy |
| 4 + 4b | Story overlay; **5 random arcs** (Witness PNGs only) |
| 5 | Counter + boss portrait wiring |
| 6a–6b | Route/gamble/wager clarity; gamble **tiers** + flow odds |
| Tests | **71** Node tests via HTML block parsing |

**Still thin on content:** 40 story panels (arcs A–D) have captions but no `assets/panels/{setup,debt,inside,borough}/` art — runs work, visuals are caption-first.

**Parallel track (not Phase 7):** Panel art production + **Phase 4.1** boss-intersection beats (`docs/phase-4-story-mvp.md`) — art/design led.

---

## 1. Problem statement

| Issue | Evidence | Impact |
|-------|----------|--------|
| Monolith HTML | `index.html` ~5,016 lines | Hard to review, merge conflicts, slow agent/human navigation |
| Runtime Babel | `text/babel` block in browser | Extra load, harder to lint/typecheck, CI can’t compile JSX natively |
| Test fragility | `tests/helpers/game.cjs` slices `<script id="…">` by string | Breaks when script order or boundaries shift (see 6a `getBossAdjustedTarget` incident) |
| Duplicate tuning | Routes/gamble tuning mirrored in inline scripts vs Babel catalog | Drift risk (mitigated by tests today, not by structure) |
| Deploy ambiguity | Single `index.html` + relative assets | Works on Vercel; no source maps, no tree-shake, no dev HMR |

**Non-goals for Phase 7**

- New gameplay, balance, bosses, or story arcs  
- Replacing grindhouse PNGs or generating the 40 missing panels  
- Rewriting `GutterbonesRules.calculateScore` algorithm  
- Fixing optional browser-only edge cases unless a test is added as part of loader migration  

---

## 2. Success metrics (acceptance)

- [ ] `npm run dev` — Vite HMR; game playable at localhost with same CDN fonts/React **or** bundled React (decision below).
- [ ] `npm run build` — outputs `dist/` (or `dist/index.html`) suitable for static host; **no** runtime Babel in production bundle.
- [ ] `npm run check` — **all 71+ tests** pass without reading inline `<script id="…">` blocks (import modules directly).
- [ ] Manual: `docs/testing.md` checklist on **built** `dist` (or dev server) — story, shop routes, gamble tiers, saves.
- [ ] CI (Baseline checks) runs `npm run check` unchanged or with `npm run build` smoke step documented.
- [ ] `index.html` at repo root either **deprecated** with redirect note or becomes thin shell that loads `dist` — document in README + AGENTS.md.

---

## 3. Target architecture

```
/
├── index.html              # thin entry OR legacy redirect during transition
├── vite.config.js
├── package.json            # vite, @vitejs/plugin-react (devDeps)
├── src/
│   ├── main.jsx            # ReactDOM.createRoot, mount App
│   ├── App.jsx             # current App component (from Babel block)
│   ├── components/         # optional: StoryPanelOverlay, RouteChoiceCard, …
│   ├── data/               # PERSONAS, PATHS, BOSSES, … (from definitions slice)
│   ├── rules/
│   │   └── gutterbones-rules.js
│   ├── systems/
│   │   ├── onboarding.js
│   │   ├── story.js
│   │   ├── routes.js
│   │   └── gamble.js
│   └── styles/             # optional: extract critical CSS from index head
├── public/
│   └── assets/             # move or symlink existing assets/
└── tests/                  # import from src/systems/*.js
```

**Production React:** Prefer **bundled React 18** from npm in Phase 7 (drop CDN `document.write` bootstrap) while keeping `window.__GUTTERBONES_DEV__` behavior via Vite `define` or env.

**Audio:** Keep `public/assets/audio/gutterbones-audio.js` as script or convert to ES module in a follow-up commit within Phase 7.

---

## 4. Work packages (implementation order)

### WP-A — Vite scaffold (P0, ~0.5 day)

- Add `vite`, `@vitejs/plugin-react`, `npm run dev` / `build` / `preview`.
- `publicDir: 'public'` with `assets/` copied from current tree.
- Minimal `src/main.jsx` renders “hello” then delete once App migrates.
- **Risk:** None. **Test:** build produces `dist/index.html`.

### WP-B — Pure modules first (P0, ~1 day)

Migrate **without JSX** (lowest risk):

1. `src/systems/rules.js` ← `gutterbones-rules`  
2. `onboarding.js`, `story.js`, `routes.js`, `gamble.js`  
3. Export same public APIs (`GutterbonesStory.pickRandomArcId`, etc.)

Update `tests/helpers/game.cjs` to `require('../src/systems/rules.js')` etc. Remove `block()` parsing for migrated files.

**Risk:** Medium — test loader is the contract. **Test:** full `npm test` after each file.

### WP-C — Data catalog (P0, ~1 day)

Move `PERSONAS` … `BOSSES` block (definitions slice in tests) to `src/data/catalog.js` (or split by domain).

Keep **one** `GAMBLE_TUNING` re-export from `gamble.js` for Help copy.

**Risk:** Medium if action-body extraction boundaries move. **Test:** regression + rules tests.

### WP-D — App + components (P0, ~1–2 days)

- Move Babel `App` and components to `src/App.jsx` + `src/components/*`.
- Replace inline `<script id="…">` tags in HTML with nothing — Vite entry only.
- Port bootstrap: branding, dev panel gate, Tailwind (keep CDN Tailwind in Phase 7 **or** add `@tailwindcss/vite` — **recommend keep CDN** for minimal CSS diff).

**Risk:** High for UI regressions. **Test:** manual checklist + optional `runtime-smoke.cjs` update.

### WP-E — Test harness cleanup (P0, ~0.5 day)

- `createGame()` imports actions from `src/app/actions/` or continues VM slice until WP-F.
- `source.test.cjs`: assert built `dist` contains no `text/babel`; assert module files exist.
- Update AGENTS.md: `npm run dev` / `build` / `preview`.

**Risk:** Low.

### WP-F — Action bodies (P1, ~1 day, optional in 7.0)

Today: `actionSource('calculateScore')` extracts from App. **Target:** export named functions from `src/app/gameActions.js` used by both App and tests.

Eliminates regex boundary bugs permanently.

**Risk:** Medium. Can ship 7.0 without WP-F if tests still pass via re-export.

### WP-G — Deploy & CI (P0, ~0.5 day)

- Vercel: output directory `dist`, build command `npm run build`.
- Ensure `assets/panels/**` and personas copy to `dist`.
- Root `index.html` strategy: serve built file or 302 — align with existing `auditrelease.vercel.app`.

**Risk:** Path breakage for panel URLs — verify `assets/panels/witness/prologue.png` in preview.

---

## 5. Migration strategy (low regression)

1. Branch: `cursor/phase-7-vite-split-048e`.  
2. **Land WP-A → WP-B → tests green** before touching JSX.  
3. One PR acceptable; **prefer two PRs:** (1) modules + tests, (2) App move + build.  
4. Keep `index.html` on `main` working until PR merges — use feature flag branch only.  
5. Do **not** change save keys or `RUN_SAVE_VERSION` in Phase 7.

---

## 6. File touch list (expected)

| Area | Files |
|------|--------|
| Build | `vite.config.js`, `package.json`, `.gitignore` (`dist/`) |
| Source | `src/**` (new), slim `index.html` |
| Tests | `tests/helpers/game.cjs`, `tests/source.test.cjs`, possibly all `*.test.cjs` imports |
| Docs | `AGENTS.md`, `README.md`, `docs/testing.md` |
| CI | `.github/workflows/*` if build step added |

---

## 7. Accessibility & UX

No intentional UX changes. Verify after build:

- Story skip (click / Space)  
- Reduced motion on panels  
- Mobile 390px shop route scroll  

---

## 8. Manual test script (post-implementation)

1. `npm run build && npm run preview`  
2. Fresh profile → onboarding → full run to shop (route cards)  
3. Round 3+ gamble tiers  
4. Two runs → different story arc prologue  
5. Resume save  
6. `npm run check`  

---

## 9. Estimated effort

| WP | Effort | Impact |
|----|--------|--------|
| A Scaffold | Low | Enables all |
| B Pure modules | Medium | High (tests) |
| C Catalog | Medium | High |
| D App/JSX | High | High |
| E Tests | Low | High |
| F Actions export | Medium | Med |
| G Deploy | Low | High |

**Total:** ~4–6 focused days solo, or **two Cloud Agent passes** (B+C then D+E+G).

---

## 10. Alternatives (if Phase 7 is deferred)

| Option | ID | Best when |
|--------|-----|-----------|
| **Story panel delivery** | 4c / art | Marketing/replay need visuals before refactor |
| **Boss story beat** | 4.1 | Code-only ~1 day; 5 boss panel templates |
| **Settlement audit** | 8 | Re-verify GB009 in browser + add E2E if drift found |
| **Animation polish** | — | See Notion animation plan; after art or parallel |

**Recommendation:** Start **Phase 7 WP-A/B** immediately (tests stop scraping HTML). Run **panel art** on a separate branch/track — filenames already match `GutterbonesStory.panelFile`.

---

## 11. Owner decisions before build

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Bundled vs CDN React | npm / CDN | **Bundled** in Vite prod |
| Tailwind in 7.0 | CDN / PostCSS | **CDN** (smaller diff) |
| Single vs stacked PRs | 1 / 2 | **2 PRs** (modules, then UI) |
| `index.html` root after merge | Delete / thin shell | **Thin shell** loading built bundle for one release, then remove |
| WP-F action exports | 7.0 / 7.1 | **7.1** if schedule tight |

---

## 12. After Phase 7

1. **Phase 4c** — ship PNGs into `public/assets/panels/*` (no code).  
2. **Phase 4.1** — boss approach panel hook in `handleAdvance`.  
3. **TypeScript** (optional 7.5) — gradual JSDoc or `.ts` on systems only.  
4. **Steam / itch packaging** — built `dist` zip.

---

*Phase 7 is **engineering velocity**; player-visible “next wow” is still **story art** (4c) unless paired in parallel.*
