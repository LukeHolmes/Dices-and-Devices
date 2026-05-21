# Gutterbones 1977

> A browser-native noir dice roguelike — single-file static HTML game.

**Owner:** Luke Holmes
**Status:** Active development
**Repository:** Gutterbones1977
**Primary build:** `index.html`
**Genre:** Dice roguelike / crime noir
**Setting:** 1970s gutter-crime underworld

---

## 1. Project Definition

### What it is

Gutterbones 1977 is a single-file browser game written in React (UMD) + Tailwind + Babel Standalone, with a Web Audio soundtrack. There is no build step — `index.html` is the whole game.

It is a Yahtzee-inspired dice roguelike reskinned and rebuilt around a 1970s crime/noir identity. Players run "hustles" (runs) made of jobs, roll bones (dice), score into payout categories, manage dirty cash, debt, pills, hardware and a stash meter, fight bosses with literal rule changes, and try to survive The Raid.

### Core pillars

1. **Grimy noir identity, not abstract dice.** Everything is reframed — dice are bones, scoring categories are payouts, rerolls are pills, the shop is a back alley.
2. **Yahtzee-style scoring skeleton, roguelike progression.** Recognizable hand math, but warped by carved faces, hardware, and boss rules.
3. **Single-file deploy.** No build pipeline. Ships as `index.html` to GitHub Pages / itch / iframe embeds.
4. **Meta-progression via the Safehouse.** Laundered cash persists between runs and powers persona unlocks and upgrades.
5. **Run continuity.** Active runs autosave to `localStorage` so the player can Resume Hustle.

### Game systems (current)

- **Lineup / personas** — unlockable starting characters.
- **Safehouse meta-progression** — persistent laundered cash, unlocks, best-run stats.
- **Resume Hustle** — localStorage-backed run save.
- **Bones (dice) with carved faces** — Blood 6, Wild, Shiv, Wirebag, Ghost, Mult, etc.
- **Payout categories** — Yahtzee-style score slots themed to crime payouts.
- **Pills** — single-bone rerolls.
- **Hardware** — items that modify scoring and economy.
- **Stash meter** — fuels programs: Bribe, Fix Game, Launder.
- **Economy** — dirty cash, debt, tolls, pills, plays.
- **Bosses with rule changes** — Loan Shark, Junkie, Crooked Cop, Informant, Bouncer, and The Raid.
- **Back-alley shop** — buy carved faces and hardware between jobs.
- **Route choice between jobs.**
- **Feedback layer** — score preview badges, trigger notes, risk badges, boss intro messaging, rarity glow, flying score feedback, hand history.
- **Procedural Web Audio SFX.**

### Persistence keys (localStorage)

```text
gutterbones1977:run:v1   Active run state for Resume Hustle
gutterbones1977:meta:v1  Safehouse cash, unlocks, best-run stats
```

Runs autosave during play, shop, and carving. Completed or busted runs clear the active save after awarding Safehouse cash.

### Tech stack

- React 18 (UMD)
- ReactDOM (UMD)
- Tailwind CSS (CDN)
- Babel Standalone (in-browser JSX)
- Web Audio API
- Plain HTML/CSS/JSX
- No build step

### Repository layout

```text
index.html                    Main playable Gutterbones 1977 build
gutterbones1977.html           Standalone copy of the Gutterbones fork
dice-and-devises-legacy.html   Previous cyberpunk Dice & Devises prototype
README.md                      Project overview
docs/notion/                   Notion-ready project documents
```

### How to run

Open `index.html` directly, or:

```bash
python3 -m http.server 8080
# then http://localhost:8080/index.html
```

Static-hostable on GitHub Pages, Netlify, Vercel, itch.io, or via iframe embed.

---

## 2. Project Timeline / Tasks Completed

Reverse-chronological, grouped by milestone. Sources: git history across `main`, `cursor/gutterbones1977-baseline-8d0d`, `cursor/ux-balance-improvements-8d0d`, and `cursor/gutterbones-animation-plan-915e`.

### Milestone 0 — Legacy prototype (pre-Gutterbones)

Originally the repo shipped a cyberpunk dice prototype called **Dice & Devises**.

- `5b4f224` Initial commit.
- `f067193` Update README.
- `8e6d450` Add files via upload (early Dice & Devises assets).
- `a1e86af` Rename `dicesanddevices (2).html` → `index.html`. Establishes the single-file deploy convention.

The legacy build is preserved as `dice-and-devises-legacy.html`.

### Milestone 1 — Scoring & UX polish on the legacy build

- `d086137` **Add scoring UX and balance improvements** _(branch `cursor/ux-balance-improvements-8d0d`)_ — tightens the Yahtzee-style scoring loop, improves readability, balances early values. This is the last big pass before the noir pivot.

### Milestone 2 — The Gutterbones 1977 pivot

The project re-identifies as a 1970s crime noir dice roguelike.

- `28ad5da` **Add Gutterbones 1977 standalone fork** — introduces `gutterbones1977.html` as a parallel build with the new identity: bones, carved faces, dirty cash, stash meter, pills, hardware, bosses, back-alley shop, route choice.
- `d6dbc0d` **Promote Gutterbones as main game** — Gutterbones 1977 becomes the canonical `index.html`. The cyberpunk prototype is archived as `dice-and-devises-legacy.html`.

### Milestone 3 — Meta-progression & persistence

- `249daf9` **Add Safehouse progression and run persistence** — introduces:
  - Safehouse hub with laundered cash, persona unlocks, best-run stats.
  - `gutterbones1977:meta:v1` save record.
  - Active run autosave under `gutterbones1977:run:v1`.
  - Resume Hustle flow on launch.
  - Partial Safehouse cash payout on bust; full clear of active save on completion/bust.

### Milestone 4 — Stability fixes

- `08efde0` **Fix bone roll animation crash** — eliminates a crash in the roll animation path.
- `b7d26ce` **Fix stale face state on rerolls** _(current HEAD of `cursor/gutterbones1977-baseline-8d0d`)_ — fixes a bug where carved face state could go stale when individual bones were rerolled with pills.

### Milestone 5 — Vibe & animation polish (planning)

- `d638ff8` **Plan: vibe & animation polish for Gutterbones 1977** _(branch `cursor/gutterbones-animation-plan-915e`)_ — design/plan commit scoping the next polish pass: bone roll feel, hand-resolution animations, payout flourishes, boss intro cinematics, and ambient noir vibe.

---

## 3. Task Board (suggested Notion database structure)

Recommended properties when this is turned into a Notion database:

| Property      | Type        | Notes                                                                 |
| ------------- | ----------- | --------------------------------------------------------------------- |
| Task          | Title       | Short, action-style.                                                  |
| Status        | Select      | Done · In progress · Planned · Blocked                                |
| Milestone     | Select      | M0 Legacy · M1 Scoring/UX · M2 Pivot · M3 Meta · M4 Stability · M5 Polish · M6 Refactor |
| Area          | Multi-select| Scoring · Bones/Faces · Hardware · Bosses · Safehouse · Persistence · Audio · UI/UX · Animation · Build |
| Commit        | URL / Text  | Git SHA when applicable.                                              |
| Branch        | Text        | Source branch.                                                        |
| Notes         | Text        | One-line context.                                                     |

### Seed rows — completed work

| Task                                              | Status | Milestone        | Area                          | Commit    | Branch                                  |
| ------------------------------------------------- | ------ | ---------------- | ----------------------------- | --------- | --------------------------------------- |
| Initial repo & legacy Dice & Devises prototype    | Done   | M0 Legacy        | Build                         | 5b4f224   | main                                    |
| Update README                                     | Done   | M0 Legacy        | Build                         | f067193   | main                                    |
| Upload early Dice & Devises assets                | Done   | M0 Legacy        | UI/UX                         | 8e6d450   | main                                    |
| Establish single-file deploy via `index.html`     | Done   | M0 Legacy        | Build                         | a1e86af   | main                                    |
| Scoring UX & balance pass on legacy build         | Done   | M1 Scoring/UX    | Scoring · UI/UX               | d086137   | cursor/ux-balance-improvements-8d0d     |
| Stand up Gutterbones 1977 fork                    | Done   | M2 Pivot         | Bones/Faces · Hardware · Bosses · UI/UX | 28ad5da | cursor/gutterbones1977-baseline-8d0d    |
| Promote Gutterbones as main game (`index.html`)   | Done   | M2 Pivot         | Build                         | d6dbc0d   | cursor/gutterbones1977-baseline-8d0d    |
| Add Safehouse progression                         | Done   | M3 Meta          | Safehouse                     | 249daf9   | cursor/gutterbones1977-baseline-8d0d    |
| Add run persistence (`run:v1`, `meta:v1`)         | Done   | M3 Meta          | Persistence                   | 249daf9   | cursor/gutterbones1977-baseline-8d0d    |
| Add Resume Hustle flow                            | Done   | M3 Meta          | Persistence · UI/UX           | 249daf9   | cursor/gutterbones1977-baseline-8d0d    |
| Fix bone roll animation crash                     | Done   | M4 Stability     | Animation · Bones/Faces       | 08efde0   | cursor/gutterbones1977-baseline-8d0d    |
| Fix stale face state on rerolls                   | Done   | M4 Stability     | Bones/Faces                   | b7d26ce   | cursor/gutterbones1977-baseline-8d0d    |
| Plan: vibe & animation polish                     | Done   | M5 Polish        | Animation · Audio · UI/UX     | d638ff8   | cursor/gutterbones-animation-plan-915e  |

### Seed rows — planned / from README "Future Improvements"

| Task                                                          | Status  | Milestone        | Area               |
| ------------------------------------------------------------- | ------- | ---------------- | ------------------ |
| Execute vibe & animation polish pass                          | Planned | M5 Polish        | Animation · Audio  |
| Migrate to Vite + React + TypeScript                          | Planned | M6 Refactor      | Build              |
| Extract scoring, faces, hardware, bosses, personas to modules | Planned | M6 Refactor      | Scoring · Refactor |
| Automated tests for score calc and boss effects               | Planned | M6 Refactor      | Scoring · Bosses   |
| Expand Safehouse upgrades & unlock economy                    | Planned | M3 Meta          | Safehouse          |
| Add balance / debug tooling                                   | Planned | M6 Refactor      | Build · UI/UX      |
| Expand carved face pool                                       | Planned | M2 Pivot ongoing | Bones/Faces        |
| Expand boss pool                                              | Planned | M2 Pivot ongoing | Bosses             |
| Improve mobile / touch ergonomics                             | Planned | M5 Polish        | UI/UX              |

---

## 4. Suggested Notion workspace structure

When importing into Notion, the recommended layout is:

```
Gutterbones 1977 (workspace / top-level page)
├── 📄 Project Definition         ← Sections 1 of this doc
├── 🗂  Tasks (database)           ← Section 3 (use the schema above)
├── 🧭 Timeline                   ← Section 2 (milestones M0–M5)
├── 🎮 Game Design
│     ├── Bones & Carved Faces
│     ├── Payout Categories
│     ├── Hardware
│     ├── Bosses
│     └── Safehouse & Meta
├── 🛠  Tech Notes                 ← Tech stack, persistence keys, file map
└── 🗒  Changelog                  ← Mirror of Section 2
```

This file is structured so each `##` section maps cleanly to a Notion sub-page.
