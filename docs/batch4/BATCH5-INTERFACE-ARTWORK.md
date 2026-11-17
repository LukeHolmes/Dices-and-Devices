# Gutterbones 1977 — Batch 5 Interface Artwork (draft / gated)

> **Not yet approved for production**: refine and freeze this brief only after Batch 4 gameplay integration and its regression gates pass.

## Role and artistic objective

Upgrade the game's paper/ink interface artwork, **not** its underlying interaction patterns, scoring logic or data structures. Use the existing portrait/environment/dice/contraband family. Retain rough 1977 underground crime-comic print: variable black ink, dense halftone, crosshatching, paper wear, misregistration, worn manila stationery, cracked leather, ash, brass, dirty concrete. No modern glassmorphism, polished neon glow or smooth gradients. All UI text remains rendered by code, NOT baked into PNGs.

## Current UI surfaces to inspect before asset generation

| Area | Existing hook / reference | Candidate non-text image asset | Risks and crop constraints |
|---|---|---|---|
| Title/menu | `TitleScreen`, `gb-app-shell` | noir paper/title plate backing | maintain text contrast and start-button tap target |
| Lineup and Case Files | `assets/personas/*.png`, `meta-stairwell-backdrop` | distressed ID-photo corners / case-file frame | portraits already approved; don't add baked labels |
| Dice lane | `felt-surface`, `DICE_ART`, score cues | ink-on-felt overlay, bone slot trims | no covering dice, no fake interactive pips |
| Payout ledger | `score-row`, `GutterbonesPresentation` | manila ledger corners, rubber-stamp accents | numbers and dynamic breakdown always DOM text |
| SHOP | `shop-counting-cash-backdrop` | price-tag/card chrome, receipt fragments | avoid rendering prices into artwork |
| CARVING | `carving-mod-backdrop` | engraved hardware sockets / tool trays | 5-die targeting remains unobstructed |
| GAMBLE | `gamble-backdrop` | worn betting-slip border / stamp impression | odds/wager input stays selectable |
| Safehouse / Meta | `meta-stairwell-backdrop` | dossiers, manila tab dividers | no contrast loss behind controls |
| Boss intro / Intel | boss portraits; `boss-intro-backdrop` | scarred crime-intel evidence frames | readable at desktop/tablet/phone crops |
| Rap sheet / busted | `rap-busted-backdrop` | arrest-file frame, fingerprint backing | keep generated arrest data dynamic |
| Victory | `victory-escape-backdrop` | ticket paper/shabby print trim | ticket fields remain code-driven |
| Global system/help | `gb-modal-fit`, `readable-panel` | inked separator rules, worn badges | keyboard focus/high contrast and modal overflow |

## Design-system constraints

- Approved palette from `docs/design-tokens.md`: `#121113`, `#6e1d24`, `#e8e6e1`, `#d4cfc5`, `#c78b16`, `#ff007f`, `#00ddff`, `#4a3520`, `#8c7a5c` and approved red/shadow accents. 5–6 principal colours per illustration.
- Paper and texture assets must be exportable as transparent overlays or seamless repeating tiles; avoid baked slogans and letters.
- Minimum meaningful interactive target sizes and focus visibility cannot be reduced by decorative art. Respect `gb-motion-reduce`, `readable-panel`, `gb-modal-fit`, no-scroll `gb-screen` layout, tablet and portrait phone.
- Prefer sprite reuse for controls, not dozens of unique full-screen background plates. Reuse one material system with multiple crops and pressed/hover/disabled states handled by CSS.

## Proposed asset inventory (to confirm against actual UI screenshot census)

- **Material kit:** paper grain tile, rough ink vignette, felt wear, stained wood/leather tile; 2× density where helpful.
- **Panel kit:** case-file corners, ledger backing, binder clip, receipt ticket/frame, stamped approval/denial (no readable lettering), dividers.
- **Controls:** brass/bone chip, faceted tab trim, retro toggle/checkbox face, press-state button endcap; one visual grammar for all.
- **Status:** stash/heat/debt abstract markers, route intel edge decorations, subtle nontext boss threat stamp. Keep meaningful values as real text.

## Batch 5 production stages

1. Capture screenshot census at current main gameplay stages and 7 target viewport sizes, annotate safe zones and hitboxes.
2. Approve one representative UI panel and control family as a print-run anchor before mass generation.
3. Generate transparent layered high-resolution sources with named exports and responsive crop layouts.
4. Perform deterministic trim/crop/compression, web-size audits, contrast reviews, and Playwright regressions.
5. Maintain a review-only branch until accepted; no full UI redesign or unapproved gameplay work.

## Hold point

Do not commission the complete Batch 5 asset set until Batch 4 has a verified PASS review report and Luke signs off its visual timing and integration.
