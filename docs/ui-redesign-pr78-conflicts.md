# UI redesign PR — likely merge conflicts with balance PR #78

This branch (`cursor/gutterbones-ui-ux-redesign-dab9`) is **presentation-only**. It touches the same monolith `index.html` as gameplay/balance work on PR #78. Expect conflicts in these regions:

| Area | Layout keys / selectors | Notes |
|------|-------------------------|--------|
| Play HUD | `[data-layout-key="play-hud"]`, `.street-ledger-*`, `.boss-warrant-stamp` | Replaces scattered pills with Street Ledger strip + quota bar |
| Play grid | `[data-layout-key="play-phase-grid"]`, `play-ledger-column`, `play-alley` | 7/5 desktop split; hardware rail in alley |
| Payout rows | `ScoreRow`, `.payout-tier-*`, `PayoutReceiptPopover` | Matchbook opacity tiers; consolidated heat pill |
| Bones | `Bone`, `bone-loupe-*`, `HardwareRail` | Face loupe + held tray groove (presentation) |
| Stash | `stash-program-*`, `.stash-dock-compact` | Programs docked under ledger on desktop |
| Round clear | `[data-layout-key="round-clear-card"]`, `.round-clear-receipt` | Thermal receipt styling (same math lines) |
| Routes | `RouteChoiceCard`, `.route-door-card` | Noir door cards (same route data) |
| Root hook | `data-ui-redesign="1"` on `#root-gutterbones` | Scoped CSS block before `</style>` |

**Do not** merge stash-tax or balance deltas from the brief — none were implemented here.

When integrating with #78, prefer #78 for scoring/economy logic and this branch for JSX/CSS in the table above.
