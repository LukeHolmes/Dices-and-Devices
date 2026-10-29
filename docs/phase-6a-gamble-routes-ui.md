# Phase 6a — Route & Gamble UI Clarity

**Status:** Complete (implemented on `cursor/phase-6a-gamble-routes-ui-048e`)  
**Depends on:** Phases 1–5 on `main` (UX, audio, story, portraits)  
**Goal:** Players treat **route picks**, **double-or-nothing**, and **side wagers** as informed choices — not opaque coin flips — **without changing RNG or balance constants** in this phase.

**Roadmap context:** Top 10 problem **#10** (gamble/route fatigue). Phase **6b** (optional later) may tune `GAMBLE_TUNING` / weighted odds after playtests; **6a is presentation + shared projection math only**.

---

## 1. Problem statement

| Issue | Evidence in `index.html` | Player impact |
|-------|---------------------------|---------------|
| Route rewards vague | Shop path buttons show `desc` only (~4425); `describeRouteEffects` omits debt, guardrails, boss quota (~1450) | “+20% quota” on card ≠ actual next quota after curve/guardrails |
| Gamble feels spiteful | `resolveGamble`: `Math.random() < 0.5` (~3555–3577); UI says “50/50” but not what **safe cut** means | Players think both buttons gamble |
| Side bet opaque | Play strip: “$X on Y+ heat” (~4183–4197); payout `stake * 1.75` (~3258–3268) not shown | Can’t judge EV vs board state |
| Intel underused | `RunIntelPanel` lists route names only in shop (~2323–2324); no per-path numbers | Power users open dev panel to guess |
| Copy drift | Static path `desc` (e.g. PAWN “+20% quota”) vs `ROUND_CURVE_TUNING.pathModWeight` scaling (~3801) | Trust erosion |

**Non-goals for Phase 6a**

- Changing `GAMBLE_TUNING`, `WAGER_TUNING`, `PATHS` mods, or `resolveGamble` probability  
- Phase 6b “choose your risk” gamble tiers or flow-weighted odds  
- New routes, bosses, or shop items  
- Vite / file split (optional extract to `gutterbones-routes` script for tests only)

---

## 2. Success metrics (acceptance)

Manual browser checklist (§10) plus:

- [ ] On **SHOP**, each route card shows **next round quota** (number), **Δ plays / pills / cash / stash** when applicable, and **boss** block when present.
- [ ] Player can explain **TAKE SAFE CUT** = keep all cash, skip flip; **FLIP IT** = 50% win +$stake / 50% lose $stake (constants unchanged).
- [ ] Side bet UI shows **win payout** for each stake button (e.g. “$10 → +$18 if ≥110 heat” using live `wagerThreshold`).
- [ ] Optional: before first roll, UI hints **best preview heat** on board vs wager threshold (read-only from `calculateScore` max category).
- [ ] `npm run check` green; **`GutterbonesRules.calculateScore` unchanged**; gamble/resume tests (GB006, GB010) still pass.

---

## 3. Work packages (implementation order)

### WP-A — Pure route projection helper (P0, ~1 day)

**Problem:** `handleAdvance` (~3792–3850) computes `nextTarget`, hands, discards with debt, insane contract, guardrails, boss path relief — none of this is reusable for shop UI today.

**Deliverable:** `<script id="gutterbones-routes">` (mirror onboarding/story pattern) exporting:

```javascript
GutterbonesRoutes.projectNextRound({
  path,
  round,           // current round before advance
  target,          // current quota
  debt,
  insaneContract,
  hasLedger,       // inventory contains SHADY_LEDGER
  personaPlays,
  personaPills,
})
// → {
//   nextRound,
//   nextTarget,           // base target stored on advance (pre-boss display layer)
//   nextTargetDisplay,    // optional: getBossAdjustedTarget(nextTarget, path.boss, nextRound)
//   nextHands,
//   nextDiscards,
//   effectLines: string[], // human bullets for UI
//   warnings: string[],    // e.g. debt penalty applied
// }
```

**Rules**

1. **Single source of truth:** Implement projection by **lifting** the arithmetic from `handleAdvance` into shared functions; `handleAdvance` calls the same helper so UI and gameplay cannot diverge.
2. Include `describeRouteEffects` bullets **plus** computed quota delta vs current target, debt penalty line, guardrail clamp note when min/max binding applies.
3. Boss on path: append line from `BOSSES` + note that `applyTarget` applies during the round (Bouncer +50%, etc.).

**Risk:** Medium if refactor botches advance — mitigate with unit tests on fixed fixtures.  
**Test:** `tests/routes.test.cjs` with table cases (BACK ALLEY, PAWN, SAFEHOUSE, boss turf, round 9 raid path).

---

### WP-B — Route card telegraph (P0, ~1 day)

**Files:** `index.html` — SHOP “NEXT JOB” column (~4424–4425), optional `RouteChoiceCard` component.

**UI per path button**

| Row | Content |
|-----|---------|
| Title | Existing `path.name` |
| Flavor | Short `path.desc` (keep) |
| **Quota** | `Next quota: ~{nextTargetDisplay}` (mono, bold) |
| **Modifiers** | Bulleted `effectLines` from WP-A |
| Boss | Existing boss footer + `BossPortrait` thumbnail (variant `intel`) |

**Mobile:** Ensure cards scroll; min touch height 44px (match Phase 3 PILL).

**Run Intel (shop):** Pass `paths` through WP-A to show **three-line compare** (quota / plays / boss) instead of name-only “Upcoming: …”.

**Risk:** Low once WP-A is tested.  
**Test:** Manual + optional `source.test.cjs` assert `RouteChoiceCard` or `projectNextRound`.

---

### WP-C — Double-or-nothing clarity (P0, ~0.5 day)

**Files:** `GAMBLE` phase block (~4344–4360).

**Copy / layout (no RNG change)**

```
Stake on table: ${gambleStake}  (from ~22% cash, cap $30 — show formula read-only)
┌─────────────────────┬─────────────────────┐
│ TAKE SAFE CUT       │ FLIP IT             │
│ Keep all ${gold}.   │ 50%: +${stake}      │
│ Enter shop.         │ 50%: −${stake}      │
└─────────────────────┴─────────────────────┘
Round ≥3 gate: if skipped, one line why gamble didn't appear (dev-only tooltip optional).
```

- Align fixer line bucket `FIXER_LINES.gamble` with UI (already “Fifty-fifty”).
- After resolve, keep existing stamps (`DOUBLE`, `BUSTED BET`).

**Risk:** None.  
**Test:** Manual; inject save `npm run dump:save -- gamble`.

---

### WP-D — Side wager clarity (P0, ~0.5–1 day)

**Files:** Play side-bet strip (~4182–4199), `placeSideWager` / `executePayout` wager branch (~3384–3275).

**UI changes**

1. For each stake button, show: **`Win +$${payout}`** where  
   `payout = max(stake + 1, round(stake * WAGER_TUNING.payoutMultiplier))` (mirror production formula).
2. Subline: **`Need ${wagerThreshold}+ heat this round`** (already computed ~2736).
3. **Optional (recommended):** When `hasRolled`, show `Best preview: ${maxValidCategoryTotal}` vs threshold (green/red); when not rolled, “Roll first to preview heat.”

**Help cross-link:** One sentence in Help Dossier (WP-E).

**Risk:** Low; preview is read-only.  
**Test:** Existing wager tests + manual round-1 bet.

---

### WP-E — Help Dossier: ROUTES & GAMBLE (P1, ~0.5 day)

**Files:** `HelpOverlay` section list (~2074+ area).

Add collapsible or static section:

- **ROUTES** — Each path id (BACK ALLEY, PAWN, …) with plain-language tradeoffs; note boss paths from round 4+ even rounds.
- **DOUBLE OR NOTHING** — When it appears (round ≥3, cash ≥ $5); safe cut vs flip.
- **SIDE BETS** — Threshold scales by round; payout multiplier 1.75×; lost stake already paid when placing bet.

Reuse `STREET_INTEL` tone where possible.

**Risk:** None.

---

### WP-F — Dev / QA affordances (P2, ~0.25 day)

- Dev panel: optional “Preview route math” readout for selected path (uses WP-A).
- Extend `runDevSmokeChecks` with `projectNextRound(PATHS[0], …)` sanity (finite numbers).

**Risk:** None (dev-only).

---

### WP-G — Optional polish (defer unless quick)

| Item | Notes |
|------|--------|
| Gamble **decline forever this run** | Meta flag — product call |
| Route **recommended** badge | Heuristic (low debt → PAWN) — risks bad AI advice |
| Animated quota tick on hover | Nice-to-have; respect reduced motion |

**Default 6a:** Skip WP-G.

---

## 4. Engineering approach (low regression)

1. Branch: `cursor/phase-6a-gamble-routes-ui-048e` off `main`.
2. **Step 1:** WP-A + tests (no UI) — green `npm run check`.
3. **Step 2:** Refactor `handleAdvance` to call WP-A; run full regression + manual one shop advance.
4. **Step 3:** WP-B → WP-D UI; WP-E copy.
5. **Do not** edit `resolveGamble` random branch except comments.
6. One PR preferred; split WP-E doc-only commit optional.

---

## 5. File touch list

| File | WPs |
|------|-----|
| `index.html` | A (script + refactor advance), B–D (UI), E (Help), F (dev) |
| `tests/routes.test.cjs` | A (new) |
| `tests/helpers/game.cjs` | A (load routes script if action tests need it — likely not) |
| `tests/source.test.cjs` | script order, component names |
| `docs/testing.md` | §10 checklist |
| `docs/phase-5-portraits.md` | link “next: 6a” (already) |

---

## 6. Constants reference (read-only in 6a)

Document in Help/UI; **do not change values in 6a**:

| Constant | Location | Meaning |
|----------|----------|---------|
| `GAMBLE_TUNING.minRound` | 3 | First gamble eligibility |
| `GAMBLE_TUNING.stakeRate` | 0.22 | Stake = floor(cash × rate), capped |
| `GAMBLE_TUNING.stakeCap` | 30 | Max gamble stake |
| `WAGER_TUNING.baseThreshold` | 110 | Round 1 side-bet heat floor |
| `WAGER_TUNING.roundThresholdStep` | 8 | +8 heat per round |
| `WAGER_TUNING.payoutMultiplier` | 1.75 | Win payout scale |
| `PATHS[].mod` | 1–1.4 | Scaled by `ROUND_CURVE_TUNING.pathModWeight` |

---

## 7. Accessibility

- Route cards: `aria-label` including quota number (“Safehouse Cut, next quota about 180, plus one play”).
- Gamble buttons: explicit outcomes in accessible name, not color alone.
- Side bet disabled state: reason (`aria-disabled` + “Not enough cash”).

---

## 8. Rollout / merge

- No save version bump unless adding optional “gamble hints dismissed” in settings (defer).
- Verify mobile SHOP scroll with expanded route cards.
- Production: no dev-only strings in player UI.

---

## 9. Manual test script (post-implementation)

1. `localhost:8080/index.html?dev=1`, clear storage.  
2. Play to **round 3+** with **$20+** cash — confirm **GAMBLE** shows stake formula and both outcomes.  
3. **Safe cut** → shop, cash unchanged; **Flip** → observe ±stake (50% — run twice if needed).  
4. **Round 1:** side bet buttons show payout amounts; place $10 bet; roll and score — confirm stamp / cash matches Help text.  
5. **Shop:** compare three routes — quota numbers differ; pick **TURF WAR** when offered — boss thumbnail + boss quota note.  
6. **Resume** gamble save: `npm run dump:save -- gamble` — inject, confirm UI still correct.  
7. `npm run check`.

---

## 10. Estimated effort

| WP | Effort | Impact |
|----|--------|--------|
| A Projection | Medium | High |
| B Route cards | Medium | High |
| C Gamble UI | Low | High |
| D Side bet UI | Low–Med | Med–High |
| E Help | Low | Med |
| F Dev | Low | Low |

**Total:** ~2–4 focused days solo, or **one Cloud Agent pass** (A→B→C→D) + checklist.

---

## 11. After Phase 6a

1. **Phase 6b** (optional) — weighted gamble or player-chosen risk tiers; requires playtest + `GAMBLE_TUNING` tests.  
2. **Phase 4b** — additional story arcs.  
3. **Art** — Witness + portrait swaps (parallel).  
4. **Phase 7** — Vite / module split (`gutterbones-routes` already extracted in 6a helps).

---

## 12. Owner decisions before build

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Extract `gutterbones-routes` script | Yes / inline in Babel | **Yes** — testable like onboarding |
| Show boss-adjusted quota on route card | Base only / display adjusted | **Display adjusted** when `path.boss` set |
| Best-heat preview for side bet (WP-D) | Ship / defer | **Ship** — high clarity, low risk |
| Refactor `handleAdvance` in same PR as UI | Same / split PRs | **Same PR** after tests lock projection |

---

*Phase 6a addresses roadmap item **6a (UI clarity)** only. If players still hate variance after clarity, schedule **6b** with explicit design sign-off.*
