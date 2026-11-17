---
name: art-asset-integration
description: Integrate approved externally generated Gutterbones artwork, die engravings and frame animations while preserving the 1970s crime-comic style. Use for PNG/sprite import and game rendering QA.
---

# Approved Gutterbones asset intake

1. Read AGENTS.md, assets/README.md and the existing asset path references. Confirm supplied art is approved and its intended destination (persona, boss, scene, die-face overlay, story panel, animation frame).
2. Inspect image dimensions, alpha channel, transparency edges, file sizes, color palette and intended render size. Reject mis-sized or opaque overlays instead of silently changing game style. Do not invent replacement art.
3. Use stable, descriptive filenames and preserve current paths/compatibility. Do not overwrite originals without an explicit replacement request and a branch-level backup via Git history.
4. Separate artwork from animation logic. For moving dice or effects, prefer CSS transforms/sprite frames/Canvas compositing where appropriate; honor reduced-motion settings and avoid changing scoring or input semantics.
5. Test actual render at small die-face sizes (about 40–64 px for symbols), high-DPI desktop and mobile. Check edge clipping, alignment, loading, transparency, performance and fallback behaviour.
6. Prefer a scripted asset manifest/dimension checker plus repeatable browser screenshots over subjective agent redraw iterations.
7. Report assets added/replaced, affected code paths, previews, file size impact, commands run and unresolved visual issues.

This skill does not authorize gameplay changes, unapproved style rewrites, merges or deployment.
