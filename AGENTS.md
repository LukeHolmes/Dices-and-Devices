# AGENTS.md

## Cursor Cloud specific instructions

This is a single-file browser game (`index.html`) with no build step or runtime package dependencies. `package.json` provides dependency-free Node test commands. React 18, Babel, and Tailwind CSS are loaded from CDNs at runtime.

### Running the app

Serve the project root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in Chrome.

### Lint / Test / Build

Run `npm run check` using Node 22+; no install is needed. Pure rules live in the inline `gutterbones-rules` script and JSX remains in the Babel block. Tests execute production helpers and selected action bodies. Known-issue audit success means existing failures were reproduced, not fixed. See `docs/testing.md` for strict checks, limitations, and the browser checklist. There is no build or linter step.

### Key gotchas

- The app requires internet access to load CDN resources (React, Babel, Tailwind, Google Fonts). Without connectivity the page will not render.
- Opening `index.html` via `file://` may fail in some browsers due to CORS restrictions on CDN scripts; always use an HTTP server.
- **Persona art:** Operator portraits load from `assets/personas/` (`street-rat.png`, `hustler.png`, `enforcer.png`, etc.) when you serve the project root. See `assets/README.md`.
- **Boss art:** Optional per-boss PNGs under `assets/bosses/` (e.g. `informant.png`, `loan-shark.png`, `junkie.png`, `the-raid.png`). Same serving rule as personas.
- **Playfield scene:** The dice lane uses `assets/scenes/alley-playfield.png` as a layered background (see `#root-gutterbones .felt-surface` in `index.html`). Replace that file to reskin the alley.
- **Meta descent scene:** Operator lineup and Safehouse use `assets/scenes/stairwell-descent.png` behind the global grain/vignette (`.meta-stairwell-backdrop`). Replace that file to reskin the descent framing.
- **Victory escape scene:** The win screen uses `assets/scenes/the-escape.png` as `.victory-escape-backdrop` (full viewport under the ticket card and cash rain).
- **Shop counting cash:** The Back Alley shop uses `assets/scenes/counting-cash.png` as `.shop-counting-cash-backdrop` behind the shop columns.
- **Busted / rap sheet:** The loss flow’s arrest record (`RAP_SHEET`) uses `assets/scenes/busted.png` as `.rap-busted-backdrop` behind the manila card.
- **Gamble:** `assets/scenes/gamble-double-or-nothing.png` as `.gamble-backdrop` during `GAMBLE`.
- **Carving / The Mod:** `assets/scenes/the-mod-bench.png` as `.carving-mod-backdrop` during `CARVING`.
- **Boss intro:** Shared `assets/scenes/boss-turf-pressure.png` as `.boss-intro-backdrop` under the turf-war card (plus dim layer and blinds).
