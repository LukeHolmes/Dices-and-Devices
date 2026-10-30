# Pro polish (2026-10-30)

Three sequential PRs off **`main`** (merge **P1 → P2 → P3**). Do not merge Phase 7 Vite split (**#44**).

| PR | Branch (working) | Items |
|----|------------------|-------|
| **P1** | `cursor/pro-polish-p1-f4c3` | Shared foundation + **1, 2, 7, 8** (core feel) |
| **P2** | `cursor/pro-polish-p2-f4c3` | **3, 4, 5, 6** (flow, shop, tokens, preload/modals) |
| **P3** | `cursor/pro-polish-p3-f4c3` | **9, 10** (main menu, tutorial) |

## P1 — shared foundation

- **Motion:** CSS vars `--t-fast` (120ms), `--t-med` (240ms), `--t-slow` (400ms); easings `--ease-out-expo`, `--ease-out-back`, `--ease-in-out-cubic`. See [`docs/motion-system.md`](motion-system.md).
- **Reduced motion:** Settings toggle + `prefers-reduced-motion` → root class `gb-motion-reduce` (collapsed motion; short screen fades kept).
- **Sound bus:** `assets/audio/gutterbones-audio.js` — pooled voices (16), per-category gain (`ui`, `dice`, `score`, `hud`, `ambient`), ±4% pitch jitter, `dieThud(i)`, `holdTick` / `holdRelease`, `scoreTick`, `stampThunk`, `uiClick`, `hudDelta`.
- **Perf:** Dice juice uses `transform` / `opacity` on die images; `will-change` only on rolling slots. Target 60fps — spot-check alley roll in Performance panel (transform-heavy frames ~16ms on desktop audit VM).

## P1 — checklist

| # | Area | Delivered in P1 |
|---|------|-----------------|
| 1 | Roll | Staggered tumble/land, per-die `dieThud`, lane focus anim, roll-btn squash, last-die camera nudge, speed via settings, pill reroll uses same thud path |
| 2 | Payouts | Fixed row height; BUST in title + long-press tooltip (touch); valid-row accent; preview tint on dice; **150ms** input lock; keys **1–9** / **↑↓** + **Enter** |
| 7 | Score moment | Breakdown tiles reveal in sequence + rising `scoreTick`; FILED stamp after tiles + `stampThunk`; **1.4s** base dismiss window; flow shown to 2 decimals |
| 8 | Feedback | Held lift/brass rim/`HELD`; hold/release tones; ROLL 'EM copy; roll-ready **glow-only** pulse |

## Verification (each PR)

- `npm run check` (Node tests + no-scroll layout audit + known-issues audit)
- Manual smoke: roll alley, score hand, payout keyboard, reduced motion on/off
- PR body: before/after capture for roll + score (P1); shop transition (P2); tutorial (P3); brief perf note

## P2 — checklist (branch `cursor/pro-polish-p2-f4c3`)

| # | Area | Delivered |
|---|------|-----------|
| 3 | Transitions | `transitionToPhase` / `runPhaseTransition`; **ROUND CLEARED** skippable card (700ms) before shop when quota cleared |
| 4 | Shop routes | Styled `gb-route-list` scroll (from P1 base); card layout in alley shop |
| 5 | Tokens | [`docs/design-tokens.md`](design-tokens.md) |
| 6 | Assets/modals | Scene preload + fade classes; modal fit shell (`gb-modal-fit`) |

## P3 — checklist (branch `cursor/pro-polish-p3-f4c3`)

| # | Area | Delivered |
|---|------|-----------|
| 9 | Main menu | Title grid / no stray scroll / button press states (P1 base); neon title flicker |
| 10 | Tutorial | SVG mask spotlight, pulsing ring, progress dots, Back, fade-in caption positioning |
