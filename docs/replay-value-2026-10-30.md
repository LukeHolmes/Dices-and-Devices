# Replay value (30 Oct 2026)

**Branch:** `cursor/replay-value-f4c3` (stacked on `cursor/tutorial-first-run-f4c3`, PR #56)

## Shipped

- **Run modifiers (8):** scoring hooks plus mid-run behavior for Risk Bone (roll toll), Sacrifice (pre-score blank + play penalty), Stash Interest (shop entry payout).
- **Routes:** GRIND ROUTE and HIGH WIRE (gated by play unlocks).
- **Daily run:** UTC date seed, two modifiers, deterministic shop/roll RNG via `mulberry32`, one attempt per UTC day, share string copied on run end (clipboard + on-screen banner).
- **Records & Unlocks:** six play-affecting unlocks; rewards sync into persona, modifier shop pool, and route filters on meta load and after each run.
- **Grinder persona:** Hold Charge + Straight Focus at contract start when unlocked.
- **Layout audit:** `records_unlocks` scenario via `__GB_LAYOUT_AUDIT__.openRecords()`.
- **Tests:** `tests/replay-value.test.cjs` (modifiers, daily, unlocks, balance sanity vs R1@90).

```bash
npm run check
```
