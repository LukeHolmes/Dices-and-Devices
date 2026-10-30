# Gutterbones design tokens (2026-10-30)

Single source of truth for the monolith UI until Phase 7 module split. Values map to `#root-gutterbones` CSS variables and Tailwind `gutter.*` theme keys in `index.html`.

## Color

| Token | Hex / value | Use |
|-------|-------------|-----|
| `ink` | `#121113` | App background, modal shells |
| `felt` | `#6e1d24` | Alley playfield base |
| `paper` | `#e8e6e1` | Payout sheet, manila panels |
| `cash` | `#c78b16` | Currency accents, shop gold |
| `neon` | `#ff007f` | Primary CTA, heat emphasis |
| `cyan` | `#00ddff` | HUD intel, focus rings |
| `bone` | `#d4cfc5` | Die lane labels |
| `gold-ui` | `#d6b85c` | Body default text on dark |

Readable panels: `readable-panel` / `gb-type-panel` — dark gradient, cyan border, soft inset highlight.

## Typography

| Role | Stack | Usage |
|------|-------|--------|
| Display / shout | `Impact`, Arial Black (`font-marker`) | ROLL 'EM, boss names, stamps |
| Body | Georgia (`font-serif` default on root) | Fixer copy, lore |
| Data | `Courier New` (`font-mono`) | HUD, payouts, settings |

**Rule:** at most two display faces in a screen (marker + mono); body serif for paragraphs only.

## Spacing scale

`4 / 8 / 12 / 16 / 24 / 32` px — prefer Tailwind `1/2/3/4/6/8` or `--gb-pad: clamp(0.35rem, 1.6vmin, 1.25rem)` for viewport-safe gutters.

## Radii & shadows

- Cards: `rounded-xl` (12px) + `border-2` or `border-4` ink/neon
- Modals: `gb-modal-fit` — max `100dvh`, no outer scroll
- Elevation: `shadow-2xl` + colored border (neon/cyan/cash) rather than heavy blur stacks

## Motion

See [`motion-system.md`](motion-system.md): `--t-fast`, `--t-med`, `--t-slow`, easings, `gb-motion-reduce`.

## Textures

- **Paper:** payout sheet `#e8e6e1` + dashed rules (`score-row`)
- **Felt:** `felt-surface` + `alley-playfield.png` layer
- **Meta descent:** `meta-stairwell-backdrop` / `stairwell-descent.png`

## Side HUD

Run intel / modifiers use fixed `absolute` anchors (`top-16 right-4`, `bottom-4 left-4` on lg+) — do not reflow between PLAY, SHOP, CARVING.
