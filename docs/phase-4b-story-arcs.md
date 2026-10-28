# Phase 4b — Random story arc picker

**Status:** Complete (branch `cursor/phase-4b-story-arcs-048e`)  
**Depends on:** Phase 4 Witness MVP on `main`  
**Goal:** Each run deals one of **five** story arcs (data + random pick); panels work for all arcs (Witness art on disk; others caption-first until PNGs land).

## Changes

- `GutterbonesStory.ARCS` — setup, debt, inside, borough, witness (captions from `docs/story-arcs.md`).
- `pickRandomArcId(random)` on **OFFER CONTRACT**; `arcId` persisted on saves.
- Case Files → **ARCHIVE** lists all arcs.
- Fixer line names the arc at run start.

## Art

Only `assets/panels/witness/` ships PNGs. Other arcs skip broken images fast (`StoryPanelOverlay` onError) but still show captions.

## Tests

- `tests/story.test.cjs` — five arcs, random picker, setup paths.

## Manual

- Start several runs — prologue caption/title should vary by arc.
- Resume mid-run — same `arcId`, no prologue replay.

## Next

- **Phase 7** — Vite / module split (`docs/phase-7-module-split.md`).
- **Parallel:** panel PNGs for `setup`, `debt`, `inside`, `borough`; optional **Phase 4.1** boss approach beats.
