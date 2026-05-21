Gutterbones 1977
A browser-native noir dice roguelike built as a single static HTML game.

## Overview

Gutterbones 1977 is the new main direction for the project: a grimy crime-table dice roguelike about dirty cash, pills, carved bones, stash meters, hardware, bosses, debt, and one last getaway.

The game keeps the Yahtzee-inspired scoring skeleton, but reframes the whole experience around a stronger 1970s crime/noir identity. Players roll bones, keep slots, pop pills to reroll individual bones, carve contraband faces into dice, buy hardware in the back alley, and survive escalating jobs until the final raid.

## Features

- Single-file deployment through `index.html`
- Lineup/persona selection with unlockable starts
- Safehouse meta-progression with persistent laundered cash
- Resume Hustle support through browser localStorage
- Yahtzee-style score categories renamed for the theme
- Custom carved bone faces such as Blood 6, Wild, Shiv, Wirebag, Ghost, and Mult
- Hardware items that change scoring and economy
- Stash meter that powers programs such as Bribe, Fix Game, and Launder
- Dirty cash, debt, tolls, pills, and plays
- Bosses with literal rule changes: Loan Shark, Junkie, Crooked Cop, Informant, Bouncer, and The Raid
- Back-alley shop and route choice between jobs
- Score preview badges, trigger notes, risk badges, boss intro messaging, rarity glow, flying score feedback, and hand history
- Procedural Web Audio sound effects

## Gameplay Overview

1. Pick an unlocked persona from The Lineup, or visit the Safehouse to spend laundered cash.
2. Resume an active hustle if a saved run exists, or start a new contract.
3. Roll bones and keep the slots you want.
4. Pop pills to reroll individual bones.
5. Score into payout categories before your plays run out.
6. Spend cash in the back alley on carved faces or hardware.
7. Choose the next job and survive bosses.
8. Beat The Raid to escape, or bank partial Safehouse cash when busted.

## Important Files

```text
index.html                  Main playable Gutterbones 1977 build
gutterbones1977.html         Standalone copy of the Gutterbones fork
dice-and-devises-legacy.html Previous cyberpunk Dice & Devises prototype
README.md                   Project overview
```

## Tech Stack

- React 18 UMD
- ReactDOM UMD
- Tailwind CSS CDN
- Babel Standalone for in-browser JSX
- Web Audio API
- Plain HTML/CSS/JSX
- No build step required

## Run Locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit:

```text
http://localhost:8080/index.html
```

## Deploying / Embedding

The project is static and can be hosted on GitHub Pages, Netlify, Vercel, Itch.io, or any static host.

Example iframe embed:

```html
<iframe src="https://YOUR-HOSTED-LINK/index.html" width="100%" height="900" frameborder="0"></iframe>
```

## Persistence

Gutterbones uses browser `localStorage` for two local save records:

```text
gutterbones1977:run:v1   Active run state for Resume Hustle
gutterbones1977:meta:v1  Safehouse cash, unlocks, and best-run stats
```

Runs autosave during play, shop, and carving. Completed or busted runs clear the active run save after awarding Safehouse cash.

## Future Improvements

- Move to Vite + React + TypeScript once the direction stabilizes
- Extract scoring, faces, hardware, bosses, and personas into data modules
- Add automated tests for score calculation and boss effects
- Expand Safehouse upgrades and unlock economy
- Add balance/debug tooling
- Expand the face pool and boss pool
- Improve mobile/touch ergonomics

## Credits

Design & Development: Luke Holmes

Technologies: React, Tailwind, Babel, Web Audio API

## License

MIT License
