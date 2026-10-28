# AGENTS.md

## Cursor Cloud specific instructions

This is a **Vite + React 18** app (`src/`) with a thin root `index.html` entry. Game logic lives in `src/systems/` and `src/data/catalog.js`; UI in `src/App.jsx`. Tailwind still loads from CDN. Run `npm install` once for Vite dev/build.

### Running the app

```bash
npm run dev
```

Open `http://localhost:5173/` (or `npm run preview` after `npm run build` on port 8080).

Legacy single-file snapshot: `index.legacy.html` (pre–Phase 7); do not ship it.

### Lint / Test / Build

Run `npm run check` using Node 22+ after `npm install`. Tests import `src/systems/*` and probe action bodies in `src/App.jsx` (no HTML script scraping). `npm run build` emits static `dist/` for deploy. See `docs/testing.md` for the browser checklist.

### Key gotchas

- Production bundles React via Vite; dev still needs CDN Tailwind (and optional Google Fonts). Without connectivity Tailwind may not apply.
- Always use `npm run dev`, `npm run preview`, or a static host — not `file://`.
- **Persona art:** Operator portraits load from `assets/personas/` (`street-rat.png`, `hustler.png`, `enforcer.png`, `card-counter.png`, etc.) when you serve the project root. See `assets/README.md`.
- **Boss art:** Per-boss PNGs under `assets/bosses/` (`bouncer.png`, `crooked-cop.png`, `informant.png`, `loan-shark.png`, `junkie.png`, `the-raid.png`). Same serving rule as personas.
- **Playfield scene:** The dice lane uses `assets/scenes/alley-playfield.png` as a layered background (see `#root-gutterbones .felt-surface` in `index.html`). Replace that file to reskin the alley.
- **Meta descent scene:** Operator lineup and Safehouse use `assets/scenes/stairwell-descent.png` behind the global grain/vignette (`.meta-stairwell-backdrop`). Replace that file to reskin the descent framing.
- **Victory escape scene:** The win screen uses `assets/scenes/the-escape.png` as `.victory-escape-backdrop` (full viewport under the ticket card and cash rain).
- **Shop counting cash:** The Back Alley shop uses `assets/scenes/counting-cash.png` as `.shop-counting-cash-backdrop` behind the shop columns.
- **Busted / rap sheet:** The loss flow’s arrest record (`RAP_SHEET`) uses `assets/scenes/busted.png` as `.rap-busted-backdrop` behind the manila card.
- **Gamble:** `assets/scenes/gamble-double-or-nothing.png` as `.gamble-backdrop` during `GAMBLE`.
- **Carving / The Mod:** `assets/scenes/the-mod-bench.png` as `.carving-mod-backdrop` during `CARVING`.
- **Boss intro:** Shared `assets/scenes/boss-turf-pressure.png` as `.boss-intro-backdrop` under the turf-war card (plus dim layer and blinds).
- **Story panels (Phase 4):** Arc E (Witness) uses `assets/panels/witness/*.png` with captions from `src/systems/story.js`; missing images skip silently. Run saves include `arcId` (default `witness`).
- **Audio:** Procedural Web Audio lives in `assets/audio/gutterbones-audio.js` (`window.GutterbonesAudio`). Settings persist under `gutterbones1977:settings:v1`.
