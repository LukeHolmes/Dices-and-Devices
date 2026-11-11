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

## Test harness reuse from #78 (test-only on #79)

Without touching branch `cursor/sim-win-rate-f4c3`:

| Change | Why |
|--------|-----|
| `polish-step5-layout.test.cjs` shared Chromium browser + 90s navigation timeouts | Prior failures: `toast @ 844×390` hit **reload timeout** after ~80 sequential browser launches (resource churn), not a toast layout assertion failure. |
| `repro-r13` r14 waits + `focusPlayPayoutsTab` retry | Prior failures: `scoreFirstPayoutRow()` returned false at 1024×768 because roll wasn’t settled and payouts dock wasn’t focused for redesign play chrome (functional E2E gap, not gameplay). |

**Hand overlay:** `tests/hand-roll-overlay.test.cjs` serves `tests/fixtures/hand-roll/*.png` — positive animation coverage only in tests; production sprites still absent.
