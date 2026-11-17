# Gutterbones 1977 — Batch 1–4 art QA v1.1 (17 November 2026)

**State: REVIEW REQUIRED — artwork preparation only, not gameplay integration.**

- Main is unchanged. No merge, deployment, gameplay balance, scoring, RNG, progression, or save changes.
- Source-of-truth: ChatGPT file Library `/Projects/Gutterbones-1977-Art-Project/07_Art-Validation-v1.1/`.
- Full backup archive: `Gutterbones-1977-Art-QA-Complete-v1.1.zip`; production-only transfer: `Gutterbones-1977-Production-Assets-v1.1.zip`.
- 4 approved playable portraits; 1 approved boss (Bouncer); 5 newly created **unapproved boss candidates**. Loan Shark was independently generated; Junkie, Crooked Cop, Informant and The Raid were extracted from a multi-panel print-style study and upscaled. **The Raid composition needs a multi-officer review.** Do not import them over live boss assets pending explicit approval.
- 8 environment sources, corrected master-based dice 1–6, 12 contraband symbols and 12 4×2 spritesheets validated at file level. Not tested in actual gameplay.
- 50 production files, 72 catalog entries, 12/12 animation sheets technical checks, 37.3% aggregate before/after export reduction on comparable files.
- The main-branch `assets/bosses/crooked-cop.png` and `assets/bosses/informant.png` are identical Git blobs; preserve originals pending review.
- `nightclub-backroom` is NOT a replacement for the on-main `boss-turf-pressure.png` scene.
- Game remains a single `index.html` app; no module split or dice-system replacement.

**Files here are QA and mapping records only; binary production assets remain in the versioned Library ZIP until review.** Do not claim new images are checked into Git merely because manifest paths are present. The approved asset import and any animation event wiring are separate tasks, and may not commence without sign-off.

See [readiness](READINESS.md), [boss review](BOSS-CANDIDATES.md), [asset manifest](production-asset-manifest.json), and [integration mapping](INTEGRATION-MAP.md).
