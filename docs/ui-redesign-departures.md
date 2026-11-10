# UI redesign draft #79 — deliberate departures from the original brief

Presentation-only scope on `data-ui-redesign="1"`. No scoring, quota, economy, or bot changes.

## Implemented with intentional deltas

| Brief item | Departure / note |
|------------|------------------|
| Global SYSTEM affordance | Floating absolute SYSTEM hidden on PLAY under redesign; **SYS** lives in the street ledger cluster (same menu handler) to avoid overlapping the cash badge at 768×1024. |
| Locked payout copy in ledger | Full `CategoryUnlockFooter` block removed from the scroll list. Compact per-row **?** tooltips plus **LOCKED (n)** header control opens `PayoutUnlockInspector` dialog (Escape + backdrop dismiss). Non-redesign builds still use the footer when the flag is off. |
| Hardware rail socket count | Empty placeholder sockets collapse on ≤1024px width; rail shows at most one trailing empty socket on desktop so SLOT labels do not crowd PILL controls (bone SLOT labels are screen-reader-only under redesign). |
| Shop workbench | Top **mercenary shelf** uses live `shopItems` pagination (not a static three-offer mock). Face cards add **INSPECT** → bottom **bone strip** with five bones and face loupe grid before purchase/carve. |
| Carving workbench | Shelf-over-strip column under redesign CSS; carve actions unchanged. |
| Stash program contrast | Ledger stash dock uses higher-contrast paper tokens under redesign scoped CSS (buttons keep existing `handleProgram` wiring). |

## Hand roll overlay (Luke add-on) — not feature-complete

- Production sprites `assets/scenes/hand-closed.png` / `hand-open.png` are **not committed**; runtime probes both and skips overlay until parent art lands (see `assets/scenes/HAND-ROLL-SPRITES.md`).
- Positive animation QA uses **test-only** `tests/fixtures/hand-roll/*.png` (`tests/hand-roll-overlay.test.cjs`) — never ship as final art.
- Animation is cosmetic only: `pointer-events: none`, `aria-hidden`, gated on successful roll in `rollBones` (not pill rerolls / disabled button), cleared on timer + unmount; hidden under `gb-motion-reduce`.

## Still partial vs. aspirational brief

- **Phase 7 Vite module split** remains deferred per `AGENTS.md` (monolith `index.html`).
- **3D alley / deep skeuomorphic hardware** — rail uses flat sockets + adjacency wires only.
- **Route “door” animation** — static door cards, no physics door swing.
- **BUILD INTEL / rap sheet** layout polish is light-touch only (chain-aware copy existed pre-redesign).

## Testing evidence

See PR #79 body: before (`main`) vs after (redesign branch) screenshots, click-path stills, demo webm, `npm run check:fast`, and `LAYOUT_BLOCKING_ONLY=1` layout gate on final tip.
