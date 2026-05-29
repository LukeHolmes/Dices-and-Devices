# Where to drop your final art (exact paths & filenames)

All paths are **relative to the project root** (the folder that contains `index.html`).

```
Dices-and-Devices/
├── index.html
└── assets/
    ├── personas/          ← operator mugshots (lineup, Case Files, RAP)
    ├── bosses/            ← boss portraits (intro, banner, intel, Case Files)
    └── scenes/              ← full-screen / panel backdrops (CSS references)
```

Use **these exact filenames** (lowercase, hyphens) so you can **overwrite** placeholders without touching code.

---

## `assets/personas/` (operators)

| Filename | Character |
|----------|-----------|
| `street-rat.png` | The Street Rat |
| `hustler.png` | The Hustler |
| `enforcer.png` | The Enforcer |
| `card-counter.png` | The Counter *(file optional today — not yet wired in `PERSONAS`; ask to hook `portraitSrc` after you add it)* |

Recommended: **~720×480** or similar wide mug, PNG.

---

## `assets/bosses/` (bosses)

| Filename | Boss |
|----------|------|
| `informant.png` | The Informant |
| `loan-shark.png` | The Loan Shark |
| `junkie.png` | The Junkie |
| `the-raid.png` | The Raid (final) |

**Optional** (no `portraitSrc` in code yet — add when you have art; then we wire names in `BOSSES`):

| Suggested filename | Boss |
|--------------------|------|
| `bouncer.png` | The Bouncer |
| `crooked-cop.png` | Crooked Cop |

Recommended: **~720×480**, PNG.

---

## `assets/scenes/` (environment plates)

| Filename | Where it appears |
|----------|------------------|
| `alley-playfield.png` | PLAY — dice lane (`.felt-surface`) |
| `stairwell-descent.png` | LINEUP + SAFEHOUSE — meta backdrop |
| `counting-cash.png` | SHOP — Back Alley |
| `gamble-double-or-nothing.png` | GAMBLE — Double or nothing |
| `the-mod-bench.png` | CARVING — The Mod |
| `the-escape.png` | VICTORY — Greyhound / escape |
| `busted.png` | RAP_SHEET — bust / arrest record |
| `boss-turf-pressure.png` | Boss intro overlay (shared) |

Recommended: **~900–1280 px wide**, landscape PNG, optimized for web.

---

## GitHub links (repo + folders)

**Repository**

- https://github.com/LukeHolmes/Dices-and-Devices

**Browse `assets/` on GitHub** (after your branch is merged to `main`, swap `main` for your branch name if needed)

- https://github.com/LukeHolmes/Dices-and-Devices/tree/main/assets
- https://github.com/LukeHolmes/Dices-and-Devices/tree/main/assets/personas
- https://github.com/LukeHolmes/Dices-and-Devices/tree/main/assets/bosses
- https://github.com/LukeHolmes/Dices-and-Devices/tree/main/assets/scenes

**GitHub Pages** (only after you enable Pages for this repo; URL pattern is usually)

- `https://lukeholmes.github.io/Dices-and-Devices/`  
  Confirm under **Settings → Pages** — GitHub shows the exact URL once deployed.

There is **no separate “image CDN link”** required: Pages serves `index.html` and the `assets/` folder together. Drop files in the paths above, commit, push, redeploy Pages.
