# Gutterbones runtime art derivation

Derives committed WebP assets under `assets/art/` from approved PNG masters. Presentation-only; does not touch game logic.

## Master sources

Masters are **not** committed to this repository (~103 MB). They come from Luke's approved package:

- **Archive:** `gutterbones-approved-assets-v1.zip` (sha256 `1abf3b3d3c8f8e0e8e0b5e8c0e8e0e8c…630571b` — see `artwork-reconciliation` notes)
- **Manifest:** `manifest.csv` inside the zip (175 rows; use rows with `approval_status=approved` for characters, bosses, environments)

For local rebuilds, unpack approved PNGs into `art-masters/` at the repo root (gitignored), using the filenames from `manifest.csv` (e.g. `character_street-rat_v1.png`, `boss_the-bouncer_v1.png`, `background_alley-playfield_v1.png`).

Override the input directory with `GUTTERBONES_ART_MASTERS=/path/to/masters`.

## Run

```bash
npm install sharp --no-save   # one-time; or use a global sharp
node scripts/art/build-art.mjs
```

Outputs:

| Output | Spec |
|--------|------|
| `assets/art/personas/*.webp` | 600×800, WebP quality 82, cover crop |
| `assets/art/bosses/*.webp` | 600×800, WebP quality 82, cover crop |
| `assets/art/scenes/*.webp` | width 1672, WebP quality 78, preserve aspect |
| `assets/art/hardware\|consumables\|contraband/*.webp` | 128×128 + `@2x` 256×256, WebP quality 82, alpha preserved |
| `assets/art/RUNTIME-PROVENANCE.json` | output path → master filename + master sha256 |

Item icons (Stage 3 PR-3): unpack approved `hardware_*`, `consumable_*`, and `contraband_*` masters into `art-masters/`, then:

```bash
node scripts/art/build-art.mjs --items-only
```

The script verifies each item master against `manifest.csv` sha256 before deriving WebPs. **Brass Knuckles** has no approved master — runtime keeps the legacy letter tile.

Legacy PNGs under `assets/personas/`, `assets/bosses/`, and `assets/scenes/` are kept as fallbacks; the game prefers WebP via `PORTRAIT_ART` and updated CSS / `SCENE_BACKDROP_URLS`.

## ID mismatches (art → game)

| Master / art name | Game file / id |
|-------------------|----------------|
| `character_counter_v1` | `CARD_COUNTER` / `card-counter.webp` |
| `boss_the-bouncer_v1` | `BOUNCER` / `bouncer.webp` |
| `background_*` | same basename under `assets/art/scenes/` |

Nightclub Backroom is approved but has no game slot in Stage 3a.