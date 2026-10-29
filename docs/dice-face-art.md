# Dice face art (PLAY lane)

**Branch:** `cursor/dice-face-art-048e`

Standard bones use PNG faces under `assets/dice/` (preloaded in `<head>`). Carved/contraband faces keep the overlay on a blank die texture.

- **Roll:** ~720ms 3D tumble per die, staggered 40–60ms; blank face until settle; logic unchanged.
- **Hold:** brass drop-shadow + 4px lift (no bob animation).
- **Pill:** single-slot tumble only.
- **Shuffle:** FLIP-style 250ms slot glide.
- **Reduced motion:** instant face update, no tumble/spin.
