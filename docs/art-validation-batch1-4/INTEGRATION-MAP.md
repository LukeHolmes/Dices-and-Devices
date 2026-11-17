# Non-production artwork integration map — Gutterbones 1977 v1.1

**STOP: Asset creation and validation are underway. Do not implement, merge, or deploy game changes until approved.**

Source: ChatGPT Library `/Projects/Gutterbones-1977-Art-Project/07_Art-Validation-v1.1/`.
Archive: `Gutterbones-1977-Art-QA-Complete-v1.1.zip`.
Transfer: `Gutterbones-1977-Production-Assets-v1.1.zip`.

## Destinations after approval

| Validated package export | GitHub game reference | Comment |
|---|---|---|
| `Production/01_Characters/Playable/street-rat.webp` | `assets/personas/street-rat.png` | WebP needs deliberate path change or retain original PNG |
| `.../hustler.webp`, `.../enforcer.webp` | `assets/personas/hustler.png`, `enforcer.png` | Same |
| `.../counter.webp` | `assets/personas/card-counter.png` | Different stem, do not overlook |
| `Production/01_Characters/Bosses/the-bouncer.webp` | `assets/bosses/bouncer.png` | Existing approved portrait |
| `Production/01_Characters/Bosses/{loan-shark,junkie,crooked-cop,informant,the-raid}.webp` | Corresponding `assets/bosses/*.png` | **UNAPPROVED CANDIDATES. DO NOT REPLACE YET** |
| `Production/02_Environments/{scene}.webp` | `assets/scenes/{scene}.png` | Seven used scenes, one optional |
| `Production/02_Environments/nightclub-backroom.webp` | No existing direct equivalent | **NOT** `assets/scenes/boss-turf-pressure.png` |
| `Production/03_Dice/Numbered/die-{1..6}.png` | `assets/dice/die-{1..6}.png` | Consistent master geometry, validate gameplay size |
| `Production/03_Dice/Master/master-bone-die.png` | Separate candidate for `assets/dice/die-blank.png` | Compare before replacement |
| `Production/03_Dice/Contraband/*.png` | New proposed `assets/contraband/*.png` | Static icon overlay only |
| `Production/05_Animations/*-8frame-spritesheet.png` | New proposed `assets/animations/` | 1024×512 RGBA, 2×4, 8 frames |
| `Production/05_Animations/animation-manifest.json` | New proposed `assets/animations/animation-manifest.json` | Explicit per-effect duration; ECHO 105ms |

## Compatibility gates when integration is later authorised

- Repository remains single-file `index.html`; respect `AGENTS.md` and existing React/Babel CDN setup. Do not start Vite refactor.
- No gameplay logic, probabilities, RNG, scoring, economy, progression, or save-state changes.
- Existing die roll/tumble, score breakdown/stagger, audio and `gb-motion-reduce` remain authoritative.
- Animation renderer is a cosmetic, pointer-events-none, aria-hidden overlay keyed to actual committed score/face activation events; no effects on preliminary previews or fake triggers.
- Cancel stale timers on re-roll, unmount, phase transition, run end; cap simultaneous overlays and reuse decoded textures.
- Run `npm run check`, cross-viewport Playwright at 1366×768, 1920×1080, 768×1024, 1024×768, 390×844 and 844×390; test reduced motion, iPad/tablet input, actual score equivalence and save parity.
- Capture **actual game-triggered** video/images for all 12 effects. The existing preview GIF only validates sheet playback, not gameplay.
- Do not merge or deploy unless user explicitly approves.

## Existing main discrepancies

- `assets/bosses/crooked-cop.png` and `assets/bosses/informant.png` share an identical Git blob SHA; replacement requires visual approval.
- `nightclub-backroom.png` has no existing assigned game use. `boss-turf-pressure.png` stays untouched.
