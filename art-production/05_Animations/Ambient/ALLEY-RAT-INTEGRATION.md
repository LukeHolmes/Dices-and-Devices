# Gutterbones 1977 — Alley Rat Ambient Animation

Files:
- `alley-rat-8frame-game-ready.png`: authoritative 1024×512, 4 columns × 2 rows, 256×256 frames, RGBA
- `alley-rat-8frame-horizontal.png`: alternative 2048×256 horizontal strip for one CSS `steps(8)` animation
- `alley-rat-80px-loop.webp`: transparent 80×80 animated WebP; loop 8 frames / 640 ms
- `alley-rat-preview.apng`: 160×160 APNG high-fidelity preview
- `alley-rat-preview.gif`: 160×160 GIF compatibility preview
- `alley-rat-size-reference.png`: shows 50/80/100px containers on the current game's felt-red swatch

## Recommended in-game settings

- Desktop: **80px square animation container** (art occupies about 74×34px); optional 100px on spacious screens.
- Mobile: **50–60px square animation container** (art occupies about 46–55px wide).
- Loop frame rate: **12.5 FPS** (80ms per frame); cycle **640ms**.
- Animation is stationary within a frame. The stage positions the rat using `transform: translate3d(...)`.
- Use as an occasional ambient element on the backmost playfield decoration layer, behind dice and UI.
- Respect `prefers-reduced-motion` and Gutterbones `gb-motion-reduce` mode.

## CSS sprite strip example

```css
.gb-rat {
  --rat-size: 80px;
  width: var(--rat-size);
  height: var(--rat-size);
  background: url('/assets/ambient/alley-rat-8frame-horizontal.png') 0 0 / 800% 100% no-repeat;
  animation: gb-rat-legs 640ms steps(8, end) infinite;
  pointer-events: none;
}
@keyframes gb-rat-legs {
  from { background-position-x: 0%; }
  to   { background-position-x: 114.285714%; }
}
@media (max-width: 640px) { .gb-rat { --rat-size: 55px; } }
@media (prefers-reduced-motion: reduce) { .gb-rat { animation: none; } }
.gb-motion-reduce .gb-rat { animation: none; }
```

`background-position-x: 114.285714%` is intentional: with an 8-column strip stretched to 800% of the viewport, it advances precisely one full 8-frame cycle in eight discrete steps.

A separate parent stage element should translate the rat from offscreen to offscreen. Do not change the sprite frame's anchor or scroll the image inside its own frame.

Do not treat large export dimensions of portrait/background plates as screen-size comparisons: the only meaningful gameplay scale is CSS-rendered pixels at actual viewport sizes. The final relative size must be visually checked against the dice lane and HUD on desktop and mobile after placement.