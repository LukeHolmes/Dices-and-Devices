# Gutterbones motion system (P1 foundation)

## CSS timing tokens

Defined on `#root-gutterbones`:

| Token | Default | Use |
|-------|---------|-----|
| `--t-fast` | 120ms | Button squash, micro feedback |
| `--t-med` | 240ms | Input locks, row reveals |
| `--t-slow` | 400ms | Score tile count-up steps |
| `--ease-out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | Exits, panel fades |
| `--ease-out-back` | cubic-bezier(0.34, 1.45, 0.64, 1) | Die settle, stamp slam |
| `--ease-in-out-cubic` | cubic-bezier(0.65, 0, 0.35, 1) | HUD fills |

## Reduced motion

When the player enables **Reduced motion** in settings (or `prefers-reduced-motion: reduce`), the root gets class `gb-motion-reduce`:

- All `--t-*` collapse to **1ms** in CSS.
- Transform animations become **opacity-only** or instant state changes.
- Screen shake, stamp overshoot, and die tumble trails are disabled in JS via the same `reducedMotion` flag.

## Performance

- Prefer **transform** and **opacity** only for 60fps juice.
- `will-change` is applied sparingly on `.bone-die-tumble` and `.gb-screen-transition-*` during active animation only.
- Avoid layout-affecting animations on the payout sheet (fixed row height).

## Sound bus

`assets/audio/gutterbones-audio.js` exposes category gains (`ui`, `dice`, `score`, `hud`) with voice pooling (max 16) and ±4% pitch jitter on tones. Dice landings use `dieThud(landIndex)`; score moments use `scoreTick` + `stampThunk`.

## Perf notes (P1 target)

Roll pipeline (5 dice, normal speed): expect **~850–1100ms** wall time; main thread work is timer-driven state updates, not per-frame layout. Chrome Performance: long tasks should stay under **50ms** except Babel/React commit on payout click.
