# Playtest 4 fixes (29 Oct 2026)

**Branch:** `cursor/playtest4-fixes-f4c3`

## Summary

| # | Issue | Fix |
|---|--------|-----|
| 1 | Carving screens used cream numbered tiles; values felt wrong | `CarvingDieTile` uses `assets/dice` pip PNGs (same as playfield); bone picker shows live `die.value` + carved overlay |
| 2 | Side-bet HUD line persisted with no bet | Pre-roll copy only when `!hasRolled && !activeWager` |
| 3 | Opening stash / SNIFF unclear; pills dropped 3→2 | Free opening reroll via `rerollBoneSlot(..., { consumePill: false })`; **SNIFF program no longer calls `popPill`**; banner + stamp |
| 4 | INCARCERATED / loss panel layout @ 1280×800 | Stamp top-right on Hand History; loss overlay only in `PLAY`; rap sheet scroll cap |
| 5 | Load 404 | `favicon.ico` linked in `<head>` (browser default request) |
| 6 | Balance | R1 quota **90**; smoother `ROUND_CURVE_TUNING` (early rounds 4, lower flat steps); tighter `ECONOMY_TUNING` stash/cash |
| 7 | Polish | Stronger held-die glow; score breakdown moved down; brief Pills currency hint |

## Tuning constants

| Constant | Before | After |
|----------|--------|-------|
| `EARLY_GAME_TUNING.openingTarget` | 85 | **90** |
| `ROUND_CURVE_TUNING.earlyMaxRound` | 3 | **4** |
| `ROUND_CURVE_TUNING.early.flatIncrease` | 28 | **22** |
| `ROUND_CURVE_TUNING.mid.flatIncrease` | 52 | **44** |
| `ECONOMY_TUNING.stashFillRate` | 2 (inline) | **1.55** |
| `ECONOMY_TUNING.stashFillCap` | 60 | **46** |
| `ECONOMY_TUNING.hustleCashDivisor` | 140 | **175** |

Back Alley quota from R1 @90: **112 → 134 → 156 → 200** (R2–R5), R6 **244**.

## Verify

```bash
npm run check
python3 -m http.server 8080
```

Manual: new run → FREE SNIFF banner, pills unchanged; side-bet line gone after first roll; carve after shop purchase shows pip dice; bust screen layout at 1280×800.
