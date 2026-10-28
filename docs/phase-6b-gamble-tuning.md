# Phase 6b — Gamble tiers & flow-weighted odds

**Status:** Complete (implemented on `cursor/phase-6b-gamble-tuning-048e`)  
**Depends on:** Phase 6a (gamble UI clarity)  
**Goal:** Give players **informed agency** on double-or-nothing — not a single opaque 50/50 — via **risk tiers** and a small **flow streak** win bonus.

---

## Design

| Tier | Stake | Base win | Win payout | Loss |
|------|-------|----------|------------|------|
| **Soft Touch** | 65% of base stake | 58% | +stake | −stake |
| **Fair Flip** | 100% base | 50% | +stake | −stake |
| **Hard Flip** | 100% base | 38% | +1.5× stake | −stake |

- **Base stake:** `floor(cash × 0.22)`, min $5, cap $30 (unchanged from 6a).
- **Flow bonus:** +2% win chance per flow streak, cap +12% (all tiers).
- **Safe cut:** unchanged — keep all cash, skip flip.

Implementation: `<script id="gutterbones-gamble">` (`GutterbonesGamble.resolveFlip`, etc.).

---

## Tests

- `tests/gamble.test.cjs` — stake math, tier odds, flow cap, HARD payout.
- Regression: GB010 (resume `gambleStake`) unchanged.

---

## Manual check

1. Clear round 3+ with $20+ → **GAMBLE** shows safe cut + three tier buttons with % and ± amounts.
2. Flow streak &gt; 0 → line shows bonus win odds.
3. Help → **ROUTES & GAMBLE** mentions tiers and flow bonus.
