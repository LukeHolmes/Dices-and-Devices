# Gutterbones 1977

A browser-native 1970s crime/noir dice roguelike built as a single static HTML game.

## Overview

**Gutterbones 1977 is the main project.** The canonical playable build is `index.html`; everything else in the repo is supporting documentation or historical reference.

The game keeps a Yahtzee-inspired scoring skeleton, but rebuilds it as a grimy crime-table roguelike about dirty cash, pills, carved bones, stash programs, hardware, debt, bosses, and one last getaway. Players roll bones, keep slots, pop pills to reroll individual bones, carve contraband faces into dice, buy gear in the back alley, take risky side action, and survive escalating jobs until **The Raid**.

## Current Game

- **Primary file:** `index.html`
- **Format:** single-file React/Tailwind/Babel browser game
- **Genre:** dice roguelike / crime noir
- **Setting:** 1970s gutter-crime underworld
- **Runtime:** static HTML served by any web server
- **Build step:** none

## Gameplay Loop

1. Pick an unlocked persona from **The Lineup**, or visit **The Safehouse** to spend laundered cash.
2. Resume an active hustle if a saved run exists, or start a new contract.
3. Roll five bones, keep the slots you want, and pop pills for single-bone rerolls.
4. Score into payout categories before your plays run out.
5. Build heat, cash, stash, flow, and hand mastery across the round.
6. Decide whether to take side bets or double-or-nothing pressure.
7. Spend dirty cash in **The Back Alley** on carved faces, hardware, consumables, refreshes, debt paydown, or sell-backs.
8. Choose the next job route and survive boss rule changes.
9. Beat **The Raid** to escape, or get busted and bank a partial Safehouse cut.

## Major Systems

### Runs and scoring

- Yahtzee-style payout rows rethemed as crime payouts.
- Score preview popups, trigger badges, flying score feedback, and hand history.
- Per-category hand mastery levels that add chips over repeated use.
- Flow streak multiplier for consecutive valid hands.
- Big-hand score resolution overlay and high-score stingers.

### Bones and contraband faces

Bones start with standard numeric faces and can be carved with contraband faces:

- `+1 MULT`
- `+$2 CASH`
- `WILD`
- `BLOOD 6`
- `ECHO`
- `THE SHIV`
- `WIREBAG`
- `GHOST`

Faces can add chips, modify multipliers, generate or drain cash, copy adjacent slots, destroy neighboring bones, or change straight/scoring risk.

### Economy and pressure

- Dirty cash, debt, tolls, pills, plays, stash, and quota pressure.
- Debt can spike future quotas unless managed.
- Stash powers programs such as **SNIFF**, **BRIBE**, **FIX GAME**, and **LAUNDER**.
- Optional **Insane Contract** mode adds harder street terms: higher quota, more debt pressure, weaker stash gain, extra roll tolls, and fewer plays.

### Shop, routes, and side action

- Weighted Back Alley shop offers carved faces, hardware, and tactical consumables.
- Shop refreshes, hardware sell-back, and debt paydown controls.
- Tactical consumables such as Second Wind, Smelling Salts, and Dirty Wad.
- Route choices between jobs, including safer standard hustles and higher-pressure reward routes.
- Side wagers before a hand and a double-or-nothing gate between rounds.

### Personas and Safehouse

- Persistent Safehouse cash and best-run stats.
- Unlockable personas and starting loadouts.
- Permanent Safehouse upgrades for personas, rare faces, danger faces, and higher-end hardware.
- Onboarding unlocks gradually expose more payout rows and rarer contraband.

### Bosses

Bosses change the rules instead of acting as simple flavor text:

- **The Bouncer** increases quota.
- **The Loan Shark** charges roll tolls.
- **The Junkie** twists sixes into ones.
- **Crooked Cop** disables hardware.
- **The Informant** freezes stash.
- **The Raid** is the final high-pressure escape job.

### Presentation

- Noir paper/felt visual language with flicker, grain, vignette, light leak, smoke, rarity glow, and boss banners.
- Three-act bone roll feel with per-bone variation, verdict glow, kept-bone motion, cash rain, POW bursts, and cinematic bust/victory screens.
- Silent-by-design presentation with reduced-motion support.

## Important Files

```text
index.html                    Canonical playable Gutterbones 1977 build
gutterbones1977.html           Earlier standalone Gutterbones fork; not the current canonical build
dice-and-devises-legacy.html   Archived cyberpunk Dice & Devises prototype
ANIMATION_PLAN.md              Historical polish plan; many ideas are now implemented in index.html
docs/notion/                   Notion-ready project notes
README.md                      Project overview
```

## Tech Stack

- React 18 UMD
- ReactDOM UMD
- Tailwind CSS CDN
- Babel Standalone for in-browser JSX
- Plain HTML/CSS/JSX
- No build step required

## Run Locally

Serve the project root with a static HTTP server:

```bash
python3 -m http.server 8080
```

Then visit:

```text
http://localhost:8080/index.html
```

Opening `index.html` directly may work in some browsers, but serving over HTTP is recommended because the game loads React, Babel, Tailwind, and fonts from CDNs.

## Deploying / Embedding

The project is static and can be hosted on GitHub Pages, Netlify, Vercel, Itch.io, or any static host.

Example iframe embed:

```html
<iframe src="https://YOUR-HOSTED-LINK/index.html" width="100%" height="900" frameborder="0"></iframe>
```

## Persistence

Gutterbones uses browser `localStorage` for local save records:

```text
gutterbones1977:run:v1           Active run state for Resume Hustle
gutterbones1977:meta:v1          Safehouse cash, unlocks, and best-run stats
```

Runs autosave during play, shop, carving, and gambling phases. Completed or busted runs clear the active run save after awarding Safehouse cash.

## Future Improvements

- Decide whether `gutterbones1977.html` should be resynced, removed, or clearly kept as a legacy snapshot.
- Move to Vite + React + TypeScript if the project outgrows the single-file format.
- Extract scoring, faces, hardware, bosses, personas, and tuning into data modules.
- Add automated tests for score calculation, boss effects, persistence, and economy edge cases.
- Add balance/debug tooling for quotas, shop offers, debt pressure, and run outcomes.
- Expand Safehouse upgrades, face pool, boss pool, route variety, and consumables.
- Continue improving mobile/touch ergonomics.

## Credits

Design & Development: Luke Holmes

Technologies: React, Tailwind, Babel

## License

MIT License
