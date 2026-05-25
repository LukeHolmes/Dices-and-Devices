# AGENTS.md

## Cursor Cloud specific instructions

This is a single-file browser game (`index.html`) with zero build tools, no `package.json`, and no installable dependencies. React 18, Babel, and Tailwind CSS are loaded from CDNs at runtime.

### Running the app

Serve the project root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in Chrome.

### Lint / Test / Build

There are no linters, test suites, or build steps configured. All code lives in a single `<script type="text/babel">` block inside `index.html`. Manual browser testing is the only verification method.

### Key gotchas

- The app requires internet access to load CDN resources (React, Babel, Tailwind, Google Fonts). Without connectivity the page will not render.
- Opening `index.html` via `file://` may fail in some browsers due to CORS restrictions on CDN scripts; always use an HTTP server.
- **Persona art:** Operator portraits load from `assets/personas/` (`street-rat.png`, `hustler.png`, `enforcer.png`, etc.) when you serve the project root. See `assets/README.md`.
- **Boss art:** Optional per-boss PNGs under `assets/bosses/` (e.g. `informant.png`, `loan-shark.png`, `junkie.png`, `the-raid.png`). Same serving rule as personas.
- **Playfield scene:** The dice lane uses `assets/scenes/alley-playfield.png` as a layered background (see `#root-gutterbones .felt-surface` in `index.html`). Replace that file to reskin the alley.
- **Meta descent scene:** Operator lineup and Safehouse use `assets/scenes/stairwell-descent.png` behind the global grain/vignette (`.meta-stairwell-backdrop`). Replace that file to reskin the descent framing.
