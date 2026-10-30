# Gutterbones 1977 — release checklist

Use before linking from [coldforge.tech](https://coldforge.tech/) or [lukeholmes.github.io](https://lukeholmes.github.io/). Do **not** edit the coldforge.tech repo from this game project; drop the public URL here when the landing page is updated separately.

## Pre-flight

- [ ] `npm run check` green (unit + layout + known-issues audit)
- [ ] Serve root over HTTP (`python3 -m http.server 8080`) and smoke: title → lineup → one round → shop
- [ ] Settings: sound, volume, reduced motion, dice speed, colorblind toggles persist after reload
- [ ] Reset save (settings panel) clears meta/run/settings and returns to title
- [ ] Daily run: one attempt per UTC day; share string on end screen after daily
- [ ] Tutorial completes once; `tutorial_complete` analytics event on production host only

## Analytics (production hosts)

GoatCounter loads only when **not** on localhost (`__GUTTERBONES_DEV__`). Events:

| Event | When |
| --- | --- |
| `run_start` | Contract begins (normal run) |
| `daily_start` | Daily contract begins |
| `run_end/r{N}` | Run ends (victory or bust), `{N}` = last round |
| `tutorial_complete` | Guided tutorial finished |

Verify in GoatCounter → `coldforge.goatcounter.com` after a production deploy.

## Meta / PWA

- [ ] `manifest.json` and icons resolve at site root
- [ ] OG/Twitter tags point at `gutterbones-card.png` (replace with 1200×630 export if you ship a dedicated social card)

## Press kit

See [`docs/press/README.md`](press/README.md) for GIF/MP4 capture notes and bundled PNGs.

## Deploy

- [ ] Static host serves `index.html`, `assets/`, `manifest.json`, `favicon.ico`, `gutterbones-card.png`
- [ ] HTTPS enabled (CDN scripts and GoatCounter require network)
- [ ] Note final public URL in coldforge.tech hub (external repo)
