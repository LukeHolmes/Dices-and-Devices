# Phase C — known defect fixes

**Status: complete** (26 Oct 2026). All GB001–GB011 items from Stage 1 baseline are fixed and locked in `tests/regression-defects.test.cjs`.

| ID | Fix summary |
|----|-------------|
| GB001 | Opening roll no longer consumes pills; rerolls still require discards. |
| GB002 | Pill reroll resolves carved faces like a full roll. |
| GB003 | SNIFF aborts before charging stash when no pills remain. |
| GB004 | Full Ride requires five scoring bones. |
| GB005 | Centerpiece duplicates gold-face cash bonus. |
| GB006 | Resume restores `activeWager`. |
| GB007 | Saves without `personaId` + five dice rejected. |
| GB008 | Debt paydown payment capped to amount needed. |
| GB009 | Victory/bust Safehouse cash uses `settlementCash` (hustle included; lost side bet not double-charged). |
| GB010 | Resume restores `gambleStake`. |
| GB011 | Junkie six→one rule applies on pill rerolls. |

## Verification

```bash
npm run check          # 48 tests
npm run check:release  # same (parity gate retired post–Phase C)
```

Stage 1 parity (`node tests/parity.cjs`) intentionally diverges from pin `8794488` after these fixes.

## Next

Balance polish, mobile UX, and feature work from README — no open baseline defect queue.
