# Phase 5 — Roster portraits (Counter, Bouncer, Crooked Cop)

**Status:** Complete  
**Depends on:** Phase 4 on `main`  
**Goal:** No placeholder mugshots on core cast — every default persona and standard boss has `portraitSrc`.

## Changes

| Role | File | `index.html` |
|------|------|----------------|
| The Counter | `assets/personas/card-counter.png` | `PERSONAS.CARD_COUNTER.portraitSrc` |
| The Bouncer | `assets/bosses/bouncer.png` | `BOSSES.BOUNCER.portraitSrc` |
| Crooked Cop | `assets/bosses/crooked-cop.png` | `BOSSES.CROOKED_COP.portraitSrc` |

Placeholders ship until grindhouse art replaces files (same filenames — no code change).

## Verification

- `npm run check` — `Phase 5 roster portraits wired and on disk`
- Manual: `docs/testing.md` Phase 5 bullet

## Next

- **Phase 6a** — route/gamble UI clarity (no RNG change)
- Art pass: replace Counter / Bouncer / Crooked Cop PNGs per `docs/art-direction.md`
