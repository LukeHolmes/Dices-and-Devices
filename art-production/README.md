# Gutterbones 1977 — approved artwork source staging

This folder archives the newest Gutterbones character art and the alley-rat ambient animation. It intentionally does **not** replace existing runtime game assets.

## Characters

Approved boss portraits (900×1200, high-quality WebP): **Loan Shark, Junkie, Crooked Cop, Informant, The Raid** in `01_Characters/Bosses/`.

**The Grinder** portrait is a **review candidate**, in `01_Characters/Playable/Review-Candidates/`; it was generated but not explicitly approved. Do not treat it as a finished playable-character image.

The original, uncompressed 1086×1448 PNG portrait exports remain unchanged in ChatGPT Library:
`/Projects/Gutterbones-1977-Art-Project/01_Characters/`.

## Rat animation

In `05_Animations/Ambient/`: transparent 1024×512 2×4 PNG spritesheet, 2048×256 eight-frame strip, animated WebP, GIF/APNG previews, size comparison and integration notes.

Recommended: 80px desktop container, 50–60px mobile, 80ms/frame. No UI obstruction; respect reduced-motion.

## Source/QA

The matching original-resolution sources and rat pack are available in the Library as:
`00_Project-Docs/Gutterbones-1977-GitHub-Import-Bundle.zip` (SHA256: `ecf5e2f3688298d03d03beeb9da42894637cc9e9bcab1262cede4db29221961f`).

See `APPROVED-ASSET-MANIFEST.json` for paths, git blob digests and approval states.

## Safe implementation

- Existing approved Street Rat, Hustler, Enforcer, Counter, Bouncer portraits remain unchanged.
- The existing runtime `assets/` tree is unchanged. Replace placeholder game assets only in a later **separately reviewed** integration PR.
- Validate fit at native/mobile/tablet UI sizes; check sprite transparency, texture preservation, performance, and reduced-motion support.
- Do not merge/archive Grinder into active playable assets until approved.
