# Gutterbones 1977 — Balance Analysis

**Date:** 2026-11-24 · **Repo:** `Dices-and-Devices` · **Canonical build:** `index.html`
**Author:** automated balance pass (root agent)

---

## 0. Method & sources

This analysis is grounded in the game's **actual production rules and tuning**, not vibes:

- Read the scoring engine (`calculateScore`) in the inline `gutterbones-rules` script.
- Read the live tuning constants (`ECONOMY_TUNING`, `BOSS_TUNING`, `SHOP_AGENCY_TUNING`, `FLOW_TUNING`, `SYNERGY_TUNING`, `GAMBLE_TUNING`, `PERSONAS`, `FACE_DATABASE`, `DEVISES`, `BOSSES`, `PATHS`) in `index.html`.
- Ran a **deterministic script** against production `calculateScore`: `scripts/balance-ev.cjs` (committed alongside this doc). It (1) exhaustively evaluates all 6⁵ = 7 776 single-roll hands per category, and (2) runs an 8 000-iteration opening sim at quota 75 with the greedy hold strategy used by the repo's own `scripts/sim-opening.cjs`.
- Cross-checked against the repo's own playtest docs (`docs/playtest*.md`, `docs/phase-6*.md`, `docs/plans/compounding-synergies-*.md`) and the balance/economy test suite (`tests/balance*.test.cjs`, `tests/playtest5-*.test.cjs`, `tests/routes.test.cjs`, `tests/synergy-*.test.cjs`).

**Assumptions (stated explicitly):**

- The single-roll EV table models one fresh roll with no rerolls, no carved faces, no flow, no mastery. It therefore *understates* combo categories (TOK/FH/SS/LS/Y) relative to the real game, where you get up to 3 rolls + pills. It is used only to rank *relative* category value and to expose dead options.
- The opening sim uses the limited "first-run" category sheet (upper rows + TOK + FH + Slop), the greedy keep/hold strategy from `sim-opening.cjs`, and does **not** model the Enforcer's Blood 6 starting face. So the Enforcer number is a *lower bound*.

---

## 1. The model (condensed)

**Scoring (per hand):** 5 bones (dice). Roll, keep, reroll (pills), then score into one of 13 payout rows. Each row costs one play. `total = floor(chips × mult × flowMult)`, then faces/hardware/synergy are layered in.

| Row | Base chips | Mult | Note |
|---|---|---|---|
| ONES–THREES | sum of matching | ×1.5 | upper cap ×2.5 |
| FOURS–SIXES | sum of matching | ×2.0 | upper cap ×2.5 |
| TOK (Triad) | 20 | ×2 | 3-of-a-kind |
| FOK (Quad) | 35 | ×3 | 4-of-a-kind |
| FH (Full Ride) | 30 | ×3 | 3+2 |
| SS (Short Run) | 30 | ×2 | 4-straight |
| LS (Long Run) | 40 | ×3 | 5-straight |
| Y (Jackpot) | 50 | ×5 | 5-of-a-kind |
| C (Slop) | sum + 5 | ×1.22 | **always valid** |

**Economy:** dirty cash (hustle +$ per hand = `max(1, min(7, floor(heat/72)))`), round-clear cash, debt (`shortageToDebtRatio 0.82`, quota penalty `+1.5×debt` cap 120 from round 4), stash (programs SNIFF 25 / BRIBE 60 / FIX 80 / LAUNDER 100). Stash gain per hand = `min(46, (heat/currentQuota) × 100 × 1.55)`.

**Progression:** opening target 75; round curve `flatIncrease` 22 (early) / 52 (mid) / 52 (late) / 78 (extreme); R6 anchor ≈ 290–320; bosses and routes add multiplicative twists.

**Synergy:** Balatro-style chains, hard-capped `maxChainBonusMultPerHand = 6`, `debtCollectorMaxMult = 4`, `maxChainPasses = 8`.

---

## 2. Measured results

### 2.1 Single-roll category EV (production rules, fresh 5 dice)

| Category | P(valid) | E[heat] incl. misses | E[heat] when valid | Max |
|---|---|---|---|---|
| **C (Slop)** | **1.000** | **26.9** | **26.9** | 42 |
| SIXES | 0.598 | 10.0 | 16.7 | 60 |
| SS | 0.154 | 9.3 | 60.0 | 60 |
| TOK | 0.213 | 8.5 | 40.0 | 40 |
| FIVES | 0.598 | 8.3 | 13.9 | 50 |
| FOURS | 0.598 | 6.7 | 11.1 | 40 |
| LS | 0.031 | 3.7 | 120.0 | 120 |
| THREES | 0.598 | 3.5 | 5.9 | 22 |
| FH | 0.039 | 3.5 | 90.0 | 90 |
| TWOS | 0.598 | 2.5 | 4.2 | 15 |
| FOK | 0.020 | 2.1 | 105.0 | 105 |
| ONES | 0.598 | 1.0 | 1.7 | 7 |
| Y | 0.001 | 0.2 | 250.0 | 250 |

### 2.2 Opening clear rate @75 (greedy hold, 8 000 iters)

| Pills | Plays | P(clear ≥ 75) |
|---|---|---|
| 0 | 4 | **0.733** |
| 1 | 4 | 0.931 |
| 2 | 4 | 0.981 |
| 3 | 4 | 0.992 |
| 2 | 5 | 0.994 |

### 2.3 Documented numbers (from the repo's own sims)

- `docs/phase-6e-opening-balance.md`: at target **85**, Street Rat/Counter (3 pills) P(≥85) = **0.62**, Hustler (2) = **0.54**, Enforcer (0) = **0.20**.
- `tests/balance.test.cjs` (passing): Street Rat P(≥75) ∈ [0.75, 1]; Enforcer P(≥75) ≥ 0.20.

---

## 3. Findings

### F1 — Slop is the "one right answer"; the upper rows are dead options

**Evidence:** Slop is the only always-valid row and has the highest single-roll EV (26.9). ONES caps at 7 heat (always worse than Slop's *minimum*); TWOS/THREES are only marginally better when you have 4–5 of them. Even SIXES only beats Slop with 3+ sixes (36 heat).

**Why it matters:** For any non-set hand, banking Slop is strictly correct. ONES–FOURS are effectively never worth scoring, which collapses the Yahtzee decision space into "make a set, else Slop." That's the classic *dead option / one-right-answer* failure.

**Fix:** Lower Slop's floor and make the low upper rows pay off when concentrated.
- Slop: `chips = sum + 5; mult ×1.22` → `chips = sum + 0; mult ×1.0` (EV 26.9 → 17.5) — keeps Slop as the guaranteed fallback but no longer the best play on a normal hand.
- Upper mults: ONES–THREES ×1.5 → ×2.0; FOURS–SIXES ×2.0 → ×2.2 (cap stays 2.5). This makes "hold 3+ of a number" a real payoff.
- Net effect: SIXES×3 (36) stays competitive, FOURS×3 (26) now beats Slop, and ONES×4 (8×... still weak) — so pair with F2 below for the low rows.

### F2 — The upper-section bonus (63) is vestigial

**Evidence:** `runUpperHeat ≥ 63` grants only `+0.5x` mult, and only on upper rows (already capped at ×2.5). Reaching 63 requires scoring all six upper rows with ≥3-of-a-kind each — i.e. spending ~6 of your ~40 hands on the game's worst rows — for a reward worth ~2–10 heat per subsequent upper hand.

**Why it matters:** The entire Yahtzee "chase the upper bonus" tension is absent. The bonus is a trap, not a strategy.

**Fix:** Make the bonus a real payoff that competes with set-hunting. Options (pick one):
- (a) Flat reward: +$25 cash + 1 pill on crossing 63. Simple, economy-visible, no mult math.
- (b) +2.0x to the *next* upper hand (one-shot "hot section").
Either way the low rows become a slower-but-safer line vs the variance of Y/FOK.

### F3 — Opening target sits on a cliff, and first-run/standard drift

**Evidence:** Lowering the target 85 → 75 moves the 0-pill clear rate from ~0.20 (phase-6e) to ~0.73 (this run). A 10-heat change is a ~50-point swing for pill-light personas — the knob is extremely sensitive at this range. Separately, `FIRST_RUN_TUNING.openingTarget` and `EARLY_GAME_TUNING.openingTarget` are both 75 today, but the design docs describe first-run as 70; the "70" special-case has silently eroded.

**Why it matters:** A cliff means small future changes cause wild difficulty swings, and the intended "first run is softer" guard is no longer in effect.

**Fix:**
- Restore a real first-run gap: `FIRST_RUN_TUNING.openingTarget` 75 → **70** (matches `docs/phase-6e-opening-balance.md`), keep `EARLY_GAME_TUNING.openingTarget` at 75.
- Re-anchor the sensitivity problem by tying the target to pill count: expose `FIRST_RUN_TUNING.enforcerRound1Pills: 1` and consider folding it into the persona baseline (see F4), so the 0-pill cliff is not the thing being balanced against.

### F4 — Persona imbalance: Enforcer underpowered, Hustler/Counter questionable

**Evidence:** Opening clear rate is dominated by pill count (0.73 / 0.93 / 0.98 / 0.99). The Enforcer (0 pills, +1 Blood 6, $10) is structurally behind even before its Blood 6 start is credited, and its compensation does not close a ~20-point round-1 gap. The Hustler starts with $50 vs Street Rat's $22 (a +$28 head start) whose only downside is stash ×0.5 — a stat that barely matters in round 1. The Counter pays +15% quota for a +$1-per-pill trinket.

**Why it matters:** Persona choice should be a play-style tradeoff, not a solved difficulty ladder. Right now "more pills = better," and two of the five personas look like traps or near-free wins.

**Fix (tune, don't redesign):**
- Enforcer: pills 0 → **1** (baseline), keep Blood 6 start. Or keep 0 pills but give **5 plays** (mirrors Grinder's upside) and cash 10 → 18.
- Counter: quota penalty ×1.15 → **×1.10**, and make Black Book grant **+$2** per pill (it's the whole identity).
- Hustler: cash 50 → **40** (still +$18 over Street Rat) so the "starts rich" edge is real but not run-defining.
- Re-run `sim-opening.cjs` after each change and keep Enforcer P(≥75) ≥ 0.85 and Street Rat ≥ 0.95 (targets, not just floors).

### F5 — Gamble tiers are EV-monotonic the wrong way

**Evidence (exact from `gutterbones-gamble` TUNING):**

| Tier | stake | win% | winMult | lossMult | EV (× base stake) |
|---|---|---|---|---|---|
| Soft Touch | 0.65 | 0.58 | 1 | 1 | **+0.104** |
| Fair Flip | 1.0 | 0.50 | 1 | 1 | 0.000 |
| Hard Flip | 1.0 | 0.38 | 1.5 | 1 | **−0.050** |

**Why it matters:** The "safe" tier has the best EV and the "risky" tier has the worst EV *and* the highest variance. An EV-rational player should always take Soft and never take Hard — Hard Flip is a strictly dominated choice. Risk tiers should differ in **variance, not expectation**, so the pick expresses risk appetite.

**Fix (make each tier ~EV-neutral, variance-only):**
- Soft Touch: `winChance` 0.58 → **0.50** (EV 0 at 0.65 stake).
- Hard Flip: `winChance` 0.38 → **0.40** (0.40 × 1.5 = 0.60 = loss side → EV 0).
- Fair stays 0.50.
- The existing flow bonus (+2%/streak, cap +12%) then makes all three mildly +EV when you're hot — an acceptable reward for flow, and it no longer *inverts* the tier ordering.

### F6 — Synergy/late-game dominance is an open, unmeasured risk

**Evidence:** `docs/plans/compounding-synergies-phased-implementation.md` explicitly *defers* the rounds 7–10 quota rebalance ("use caps on chain mult if sim shows round-10 trivializes"). Caps exist (`maxChainBonusMultPerHand 6`, `debtCollectorMaxMult 4`, Blood Pact ×3, Weighted Core +20 on Triad), but there is **no published late-round win-rate** and the `scripts/sim-build-dominance.cjs` check has no recorded green result.

**Why it matters:** Mult chains scale multiplicatively against a mostly-additive quota curve; if a MULT_ENGINE or BLOOD_RISK build reliably clears R8–10 with slack, the late game is solved and run variety dies.

**Fix — measure before you tune:**
1. Run `scripts/sim-build-dominance.cjs` (it flags any archetype winning at >2× the mean) and a rounds-7–10 heat sim with synergies on.
2. If late rounds trivialize: lower `maxChainBonusMultPerHand` 6 → 4 and/or `debtCollectorMaxMult` 4 → 3, and/or raise `ROUND_CURVE_TUNING.extreme.flatIncrease` 78 → 88.
3. Keep the caps in `tests/synergy-stage3-caps.test.cjs` as the guardrail.

### F7 — Debt is harsh and double-edged (potential degenerate loop)

**Evidence:** Missing a round converts 82% of the shortfall to debt (`ceil(shortage × 0.82)`), then debt adds `+1.5×debt` to next-round quota (cap 120) from round 4 unless you have the Shady Ledger. Meanwhile the Debt Collector hardware rewards the same debt with `+0.5x` mult per $1 (cap 4x), and Shady Ledger removes the quota penalty at the cost of −1 play.

**Why it matters:** A stumble becomes a debt spiral (+15 quota per $10 debt), which is punishing for new/weak runs; simultaneously the Debt Collector + Shady Ledger combo can make *holding* debt strictly beneficial, which is degenerate (debt as a resource, not a cost).

**Fix:**
- `shortageToDebtRatio` 0.82 → **0.60** and `debtQuotaPenaltyRatio` 1.5 → **1.2** (cap 120 → **80**) to soften the spiral.
- Keep Debt Collector but verify the debt→mult loop with the sim bot: if a "stack debt + Debt Collector" build dominates, add a debt *ceiling* on the mult source (e.g. Debt Collector only counts debt up to 8) rather than nerfing the whole item.

---

## 4. Priority & risk

| # | Fix | Effort | Risk | Do first? |
|---|---|---|---|---|
| F5 | Gamble tier EV | trivial (3 constants) | none | ✅ quick win |
| F3 | First-run 70 vs 75 | trivial (1 constant + test) | none | ✅ |
| F1+F2 | Slop / upper rows | medium (scoring + tooltips + 3 test files) | medium (touches baseline) | ✅ core scoring |
| F4 | Persona loadouts | small (5 lines + sim re-run) | low | ✅ |
| F6 | Synergy late-game | measure-first | low to act, high to skip | ⏳ run the sim |
| F7 | Debt curve | small (2 constants + routes test) | low | after F6 |

F1+F2 change canonical baseline scores (`C [1,2,3,4,5]`, `five 6s ≈ 60–75`, etc.), so they must be done as a coordinated change with the test updates below, not piecemeal.

---

## 5. Implementation plan

All references are to `Dices-and-Devices/index.html` (line numbers current as of this pass). Update the matching test files in the same commit.

### 5.1 F5 — Gamble tiers (3 constants)
- `index.html` `<script id="gutterbones-gamble">` `TUNING.tiers` (~L8744): SOFT `winChance: 0.58 → 0.50`; HARD `winChance: 0.38 → 0.40`.
- Tests: `tests/gamble.test.cjs` — update tier-odds and flow-cap assertions to the new win rates; keep the "finite stakes / +1.5× hard payout" structure.

### 5.2 F3 — First-run target
- `index.html` `FIRST_RUN_TUNING.openingTarget` (L10028) `75 → 70`. Leave `EARLY_GAME_TUNING.openingTarget` (L10033) at 75.
- Tests: `tests/balance.test.cjs` — the "first-run opening target == standard R1 quota" regex currently expects *both* to be 75; change it to assert 70 (first-run) vs 75 (standard).

### 5.3 F1+F2 — Slop / upper rows (coordinated)
- `index.html` `calculateScore` switch (L7357–7385):
  - `C` case: `chips = sum + 5` → `sum + 0`; `mult *= 1.22` → `mult *= 1.0`.
  - Upper mults (L7405–7406): ONES–THREES `*1.5 → *2.0`; FOURS–SIXES `*2.0 → *2.2`.
  - Upper bonus (L7407–7414): replace `mult += 0.5` with the F2 reward (e.g. grant a one-shot +$25/+1 pill flag; surface in HUD).
- `index.html` `CATEGORY_RULE_TOOLTIPS` (L10320–10334): update ONES–SIXES mult text and `C` ("sum of faces +5 chips ×1.22" → new values).
- Tests (all encode current baselines, update in lockstep):
  - `tests/synergy-baseline.test.cjs` `STANDARD_PAYOUTS` (`C [1,2,3,4,5] = 24` → 15; `SIXES [6,6,1,2,3] = 24` → recompute).
  - `tests/balance-top5-fixes.test.cjs` tooltip-match cases (`C [1,2,3,4,5] = 24`, `five 6s ≈ 60–75`).
  - `tests/rules.test.cjs` frozen baseline ("Slop 15, Triad 40" — Slop will change).
  - `tests/playtest5-economy-sim.test.cjs` (`calculateScore("C", [1,2,3,4,5])` used as a chain probe; re-derive expected total).

### 5.4 F4 — Persona loadouts
- `index.html` `PERSONAS` (L9481–9487):
  - `ENFORCER`: `pills: 0 → 1` (and/or `plays: 4 → 5`, `cash: 10 → 18`).
  - `CARD_COUNTER`: keep ×1.15 in code but see `EARLY_GAME_TUNING.counterOpeningMultiplier` (L10034) `1.15 → 1.10`; buff Black Book via its `+$1` → `+$2` handler.
  - `HUSTLER`: `cash: 50 → 40`.
- Re-run `scripts/sim-opening.cjs` and `scripts/balance-ev.cjs` to confirm the clear-rate targets in F4.

### 5.5 F7 — Debt curve
- `index.html` `ECONOMY_TUNING.shortageToDebtRatio` (L9994) `0.82 → 0.60`.
- `index.html` `BOSS_TUNING.debtQuotaPenaltyRatio` (L10014) `1.5 → 1.2`, `debtQuotaPenaltyCap` (L10015) `120 → 80`. Mirror in `gutterbones-routes` `BOSS_TUNING` (L8275).
- Tests: `tests/routes.test.cjs` debt-pressure assertion (recompute expected nextTarget for debt 20); `tests/synergy-stage3-caps.test.cjs` Debt Collector cap case (unchanged cap 4, but the debt *input* fixtures may need re-derivation).

### 5.6 F6 — measure, then act
- Run `node scripts/sim-build-dominance.cjs` and a rounds-7–10 heat sim; only if a build clears late rounds with slack, lower `SYNERGY_TUNING.maxChainBonusMultPerHand` (L10096) 6 → 4 and/or `debtCollectorMaxMult` (L10097) 4 → 3.
- `tests/synergy-stage3-caps.test.cjs` already pins the caps; update the constants there in lockstep.

---

## 6. Housekeeping notes (not balance bugs, but found while auditing)

- **Test-vs-production drift:** `tests/playtest5-economy-sim.test.cjs` models hustle cash as `floor(heat/60)` cap 6, but production is `floor(heat/72)` cap 7 (`ECONOMY_TUNING.hustleCashDivisor 72`, `hustleCashCap 7`). Production is slightly *stingier* at high heat. Align the test model with production (or extract the hustle formula so both share one source).
- **Upper bonus ceiling:** the upper cap `Math.min(mult, 2.5)` (L7413) currently caps the ×2.2 proposal too; if upper rows should reach ×2.5 with the bonus, lift the cap or re-scope the bonus as non-mult (recommended in F2).

---

## 7. Suggested order of operations

1. **Quick wins first:** F5 (gamble) + F3 (first-run target) — trivial, low-risk, immediately fixes a dominated choice and restores the intended onboarding ramp.
2. **Core scoring:** F1+F2 together with their 4 test files, then re-run `npm run check`.
3. **Personas:** F4, re-run `sim-opening.cjs` to confirm the spread.
4. **Measure synergy:** F6 sim; act only if it shows late-game slack.
5. **Debt:** F7 last (it interacts with Debt Collector; do it with the F6 data in hand).
