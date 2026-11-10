# Underworld Heat (H1–H10) — backlog design assessment

**Status:** Design backlog only — **not implemented**, **not in scope for PR #78** (builder win rate, organic chain links, CI, save versioning groundwork).

**Implementation order (repo / #78 — not Luke’s Heat spec):** (1) base-game win / organic **link** balance confidence, (2) already-planned **audio**, (3) **save versioning / migration** (required before Heat). Heat remains backlog until those gates clear; do not stack difficulty on the current sim investigation.

**Principles for any future implementation:**

- **Heat 0** = today’s rules (no modifier bundle).
- Run-start **selectable Heat** locked for that run; visible **modifier summary** before contract.
- **Cumulative** config object (H1…H10 toggles or tier unlocks), unit-tested per tier where possible.
- **Versioned saves:** `gutterbones1977:meta:v1` / `gutterbones1977:run:v1` today — Heat needs `meta.underworldHeatUnlocked`, `settings.selectedHeat`, optional `run.heatTier` in a bumped schema with `normalizeSavedRun` migration (see `GutterbonesRules.normalizeSavedRun` in `index.html`).
- Preserve **dice probabilities** unless a tier explicitly and testably changes generation (avoid hidden rigging).

---

## Verified production mechanics (do not assume)

| Topic | Code reality | Notes for Heat design |
|--------|----------------|------------------------|
| **Stash** | 0–100 **percentage meter**; programs subtract `p.cost` from stash (`handleProgram`). | Programs: SNIFF **25**, BRIBE **60**, FIX **80**, LAUNDER **100** (`PROGRAMS` in `index.html`). Help text: “25% STASH”, not dollars. |
| **Carving** | Faces bought in **shop with gold** (`handlePurchase` → `CARVING` → `executeCarve`). | **Carving does not spend Stash.** Duplicate faces on one die are allowed today (no per-duplicate fee). |
| **Pills** | Per-**persona** `pills` (0–3); `discards` initialized from persona (+ bonuses). | “Start with 0 pills” = persona override or global Heat rule on `setDiscards` at run start — not current default. |
| **Shop prices** | `shopListPrice`: `item.cost * pow(1.045, round-1)` × route discount. | +20% Heat = multiply on `scaled` or on base `item.cost` — define once, test against `shopListPrice`. |
| **Quotas** | `GutterbonesRoutes.projectNextRound` + debt penalty from round 4 (`debtPenaltyMultiplier` ~1.35 cap). | Global +10% = multiply `grown` target or post-projection — stacks with existing relief/tuning; **do not tune via #78**. |
| **Between-job “toll”** | `handleAdvanceCore`: **late carry sink** from round **8+** if gold > 56: `min(18, floor(gold * 0.05))` — not a flat +$5. | H1 “+$5 between jobs” is a **new** rule or reskin of sink; document which. |
| **Unpaid debt** | Debt spikes from shop loans/tolls → **quota penalty** next round (not APR-style interest). | H6 “interest doubles” has **no** direct analogue — map to `debtPenaltyMultiplier` / `registerDebtSpike` behavior or reject. |
| **Loan Shark** | **$2** roll toll ($1 extra if debt); UI “IOU” — **no** 35%/50% round-clear drain in code. | H7 drain % **unverified** in repo; do not implement from proposal text alone. |
| **Crooked Cop** | `crookedCopHardwareMult` **0.68** (~32% dampen); boss copy says 55%. | No separate “adjacency tax” — only hardware dampen in `calculateScore`. H7 needs new effect or relabel dampen. |
| **Hardware “slots”** | `inventory` array — **no max length** in rules today. | H9 “one fewer slot” requires new cap + sell/drop UX. |
| **The Raid (R10)** | Boss `applyTarget` ×**1.5** (copy mentions ~×1.38); pill toll $2 under raid; clear R10 → escape / victory flow. | **No “fourth phase”** or separate quota spike entity — round loop is PLAY → SHOP/CARVING/GAMBLE. H10 needs phased design + sim evidence, not a single ×N multiplier. |
| **Mod Bench** | Carving is `CARVING` after face purchase in-run shop — not a separate named “Mod Bench” phase before Raid. | H10 “no Mod Bench before Raid” = policy on shop/carving access on round 10 — define precisely. |

---

## Tier-by-tier assessment (Luke proposal → fit / departure)

### H1 — Between-job toll +$5

- **Intent:** Tax carrying cash between rounds.
- **Fit:** Partial — late carry sink already taxes gold on shop advance (round 8+, %, capped).
- **Departure:** Flat **+$5** every job is simpler but hits early runs harder than today’s round-8+ % sink.
- **Alternative:** Add `heatTuning.carryFlatTax: 5` stacked with existing sink (with floor/cap), or replace sink tier table at Heat ≥1.
- **Risk:** Low if applied only on `beginShopAdvance`; watch broke players soft-locking in shop (same class as builder bot shop stall — test with sim).

### H2 — Hardware / carved-face shop +20%

- **Intent:** Rich-get-richer pressure on rig building.
- **Fit:** Good — single multiplier in `shopListPrice` scoped to `!item.type` (HW) vs `item.type` (faces).
- **Test:** `tests/routes.test.cjs` / economy fixtures with `heatTier: 2`.

### H3 — Base quotas +10% all rounds

- **Intent:** Global difficulty bump.
- **Fit:** Good mechanically; **bad timing** until organic builder win band and link telemetry stable (PR #78).
- **Alternative:** Apply only from round 3+ to preserve round-1 onboarding; keep Heat 0 identical to current shipped curve.

### H4 — Stash program costs +2 Stash

- **Proposal wording issue:** Costs are **percentage points** (25/60/80/100), not “+2 Stash” currency.
- **Compatible reading:** **+2 percentage points** per program (SNIFF 27, BRIBE 62, …) — modest, testable.
- **Wrong reading:** +2 absolute stash dollars — **invalid** (stash is 0–100 meter).
- **Risk:** At low stash, +2 on SNIFF barely matters; at 100 cap, BRIBE/LAUNDER timing shifts slightly.

### H5 — Start with zero pills

- **Fit:** Requires overriding persona `pills` at `beginContract` when `heat >= 5`.
- **Risk:** **High** for Enforcer (already 0), breaks tutorial first-run pill hints; synergy chains rely on discards for adjacency hunts — confirm with sim50 after link fix.
- **Alternative:** −1 pill min 0, or zero pills only for Heat ≥5 **non-tutorial** runs.

### H6 — Unpaid end-job debt interest doubles

- **Fit:** Poor label match — today “debt” increases **quota** via `debtPenaltyApplied`, not compounding IOU interest.
- **Compatible alternative:** Double `debtPenaltyMultiplier` cap/effect for Heat ≥6, or add end-of-round `debt *= 1.1` (new mechanic — needs UI copy).
- **Risk:** Quota death spiral + shop loans; test with `registerDebtSpike` traces.

### H7 — Loan Shark drains 50% vs stated 35%; Crooked Cop adjacency tax ↑

- **Fit:** **Unverified** — no 35%/50% drain in current Loan Shark implementation (roll tolls only).
- **Action before spec:** Locate design source or implement explicit **round-clear skims** with named percentages; separate from roll toll.
- **Crooked Cop:** Lower `crookedCopHardwareMult` (e.g. 0.68 → 0.55) is consistent; “adjacency tax” would be **new** (e.g. chip tax on blood ripple) — design + tests required.

### H8 — Duplicate carved faces on same die +3 Stash per duplicate

- **Fit:** **Wrong currency** if interpreted as stash program points; carving is **gold** shop purchase, not stash.
- **Compatible alternatives:**
  - On `executeCarve`, if faceId already on that die: charge **+3 stash** (or +$3 gold) — new rule.
  - Or block duplicate carve (hard cap) at Heat ≥8 — clearer UX.
- **Risk:** Low if fee is gold; stash fee only matters when player has stash during carve (carve happens in shop — stash usually from prior hands).

### H9 — One fewer hardware slot

- **Fit:** **New system** — `inventory.max` (e.g. 4 → 3) with purchase blocked or force sell.
- **Risk:** Soft-lock if boss path + builder bot expect ENGINE+FUSE_BOX+CROWBAR; tie to UI sell loop (`getHardwareSellValue` exists).

### H10 — Raid R10 fourth phase, large quota spike, no preceding Mod Bench

- **Fit:** **Requires phased design** — current R10 is one boss-adjusted target + raid pill toll + victory path.
- **Do not:** Arbitrary global quota ×N without step-up sim (playtest20, sim:50).
- **Proposal sketch:**
  1. **Phase A (round 10 enter):** boss intro only, no shop carve unlock flag.
  2. **Phase B:** elevated target (stack on `applyTarget`, not duplicate multipliers).
  3. **Phase C:** optional mid-round constraint (e.g. hardware disabled 1 hand).
  4. **Phase D:** escape window / clear card — reuse existing victory, no new phase id without `RUN_PHASES` migration.
- **“No Mod Bench”:** Disable `CARVING` transition from shop when `round === 10 && heat >= 10` — explicit, testable flag.

---

## Unlock / progression (proposal only — not decided)

Options to document before coding:

1. **Meta ladder:** `meta.maxHeatCleared` + 1 unlocks next tier for selection at lineup.
2. **Victory-gated:** Beat Heat *n* at Heat 0 unlocks Heat *n+1* optional.
3. **Separate “Ascension” toggle** on lineup card with preview of cumulative modifiers.

All require **persistent meta field** and migration default `heatUnlocked: 0` (Heat 0 always available).

---

## Deadlock / softlock risks (cumulative)

| Combination | Risk |
|-------------|------|
| H5 + H3 + H2 | Shop cannot afford HW/faces → stuck in shop (mitigate: refresh rules, minimum gold grants, or forced streets). |
| H9 + builder chains | Cannot hold ENGINE+FUSE_BOX+support HW — revisit sim targets before enabling. |
| H10 shop ban + low pills | No carve, no pills, quota spike — bust only (acceptable if telegraphed). |
| Informant + high stash costs | Already freezes programs; Heat stash costs compound — test boss × Heat matrix. |

---

## Relationship to PR #78 (current work)

PR #78 stays focused on:

- Organic **acquisition → carve → adjacency → reroll → payout** (earliest broken link: shop UI bypass + `countCarvedFace` using `face.id`, shop leaving before chain kit).
- **`builder-seeded-links`** honest pass (no `prepareCarvedPayout` in sim).
- Quota relief **reverted** to baseline until links + matched-seed evidence justify measured tuning.
- **polish-step5-layout** root cause: per-test browser launch (mitigation: shared browser — not infra flake alone).

**No Heat constants, flags, or quota changes** should land on `#78`.

---

## Suggested implementation phases (future)

1. **Schema:** `HEAT_TUNING` frozen object + `meta.heatProgress` + run snapshot field; migration tests in `tests/saves.test.cjs`.
2. **UI:** Lineup Heat selector + summary panel (reuse run modifier / blueprint disclosure patterns).
3. **Tiers 1–3:** Economy/quota hooks only; sim:50 at Heat 0 vs 3 comparison.
4. **Tiers 4–7:** Stash/pill/debt/boss — each with rules unit tests.
5. **Tiers 8–10:** Inventory cap + R10 phased script; boss matrix playtests.

---

## Open questions for Luke

1. H1: Flat $5 **every** shop advance vs extend existing round-8+ % sink?
2. H4: Confirm **+2 percentage points** on program costs?
3. H7: Source of 35%/50% Loan Shark drain — new mechanic or external doc?
4. H8: Fee on duplicate carve in **gold**, **stash**, or hard ban?
5. Heat unlock: meta ladder vs optional challenge per run?
6. H10: Accept multi-step R10 spec workshop before any quota numbers?

*Document authored from codebase audit of `index.html` / `gutterbones-routes` / shop-boss tuning — November 2026.*
