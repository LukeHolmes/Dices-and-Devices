# Phase 3 — First-Hour UX (Onboarding, Pills, Category Gates)

**Status:** Complete (merged PR [#34](https://github.com/LukeHolmes/Dices-and-Devices/pull/34), 27 Oct 2026)  
**Depends on:** Phase 1 + Phase 2 on `main`  
**Goal:** A first-time player understands quota, pills, stash, bosses, and locked payout rows before they bust on run 1–2.

---

## 1. Problem statement

| Issue | Evidence in `index.html` | Player impact |
|-------|---------------------------|---------------|
| Pills hidden on desktop | `Bone` PILL button uses `md:opacity-0 md:group-hover:opacity-100` (~1596) | Miss rerolls; think game is unfair |
| Onboarding stops at “score” | `ONBOARDING_STEPS` has 3 steps (~1804–1807) | No quota / plays / debt / stash / boss teaching |
| Locked categories unexplained | Generic “unlock with experience” (~3817–3819) | Feels like cut content, not progression |
| Economy scattered | HUD + popovers + Help Dossier | Cognitive overload without a single “street rules” frame |

**Non-goals for Phase 3:** Balance changes, new bosses, story panels, gamble math, Vite migration.

---

## 2. Success metrics (acceptance)

Manual browser checklist (see §8) plus:

- [x] New tester can state: “I need **heat** ≥ **quota** before **plays** run out.”
- [x] New tester finds **PILL** without Help Dossier on **390px mobile** and **1280px desktop**.
- [x] Locked payout rows show **what** is locked and **when** it unlocks (run count from `ONBOARDING_THRESHOLDS`).
- [x] First boss banner: player knows it is a **rule change**, not flavor.
- [x] `npm run check` stays green; no changes to `GutterbonesRules` scoring unless explicitly scoped.

---

## 3. Work packages (implementation order)

### WP-A — Always-visible pill affordance (P0, ~0.5–1 day)

**Files:** `index.html` — `Bone` component (~1516–1596).

**Changes:**

1. Remove hover-only hiding: make PILL **always visible** when `!rolling && discards > 0` (pass `discards` or `canPill` into `Bone`).
2. Disable styling when no pills left (`opacity-40`, `pointer-events-none`, `aria-disabled`).
3. Minimum touch target **44×44px** on narrow viewports (padding on button, not just text).
4. Keep `onExplainPill` on focus/hover for `MECHANIC_HINTS.PILL`.
5. Optional: first-run pulse on slot 0 PILL once (CSS class, `meta.totalRuns === 0`, dismiss on first pill use — store in `settings` or meta flag `pillHintSeen`).

**Risk:** Low — presentation only.  
**Test:** Visual only + existing GB002 pill logic unchanged.

---

### WP-B — Extend first-run overlay (P0, ~1–1.5 days)

**Files:** `index.html` — `ONBOARDING_STEPS`, `ONBOARDING_BADGES`, `ONBOARDING_KICKERS`, `FirstRunOverlay` (~1804–1843).

**Add steps (suggested 3 new → 6 total, or 2 new → 5):**

| Step | Kicker | Title | Body (short) |
|------|--------|-------|----------------|
| 4 | QUOTA | BEAT THE HEAT | Street **heat** (score) must hit the **quota** before **plays** run out. One payout row per play. |
| 5 | PILL | POP A PILL | **Pills** reroll one bone. Tap **PILL** on a die. Raid boss adds $2 toll (tease only). |
| 6 | STREET | BOSS TURF | Some jobs bring a **boss** — they change rules (quota, tolls, stash, hardware). Read the red banner. |

**Optional step 7 (stash):** SNIFF / BRIBE / FIX / LAUNDER at 25–100% stash — link to `MECHANIC_HINTS`.

**UX rules:**

- Keep **SKIP**; do not block veterans (`meta.totalRuns > 0` can skip showing overlay entirely — already partially via `showFirstRunOverlay` on start).
- Consider showing overlay only when `meta.totalRuns === 0` (verify current `startRun` behavior ~2762).
- Progress dots scale with `ONBOARDING_STEPS.length`.

**Risk:** Low — copy + step count.  
**Test:** Optional `source.test.cjs` assert `ONBOARDING_STEPS.length >= 6`.

---

### WP-C — Category gate clarity (P0, ~1 day)

**Files:** `index.html` — `getAvailableCategories`, `ONBOARDING_THRESHOLDS` (~1330–1350), payout panel (~3807–3822), `UnlockNotification` messages (~2526–2531).

**Changes:**

1. Add pure helper (testable):

   ```javascript
   const getCategoryUnlockInfo = (meta) => ({
     available: getAvailableCategories(meta),
     locked: [...],
     nextThreshold: number | null,
     runsUntilNext: number,
     flavorLine: string,
   });
   ```

2. Replace vague footer with **named locked rows** (collapsed list, max 5 lines):

   - “**Long Run** — unlocks after **5** completed runs (you: **N**).”
   - Map each locked `cat.id` to human name via `CATEGORIES`.

3. Align `UnlockNotification` copy with same thresholds (Quad at 2 runs, all categories at 5 — verify against `BASIC_COMBOS` / `ALL_CATEGORIES` semantics).

4. **Case Files** tab: one line under payouts explaining run-gated sheet (“The fixer doesn’t trust you with the full board yet.”).

**Threshold reference (current):**

| Constant | Value | Effect |
|----------|-------|--------|
| `BASIC_COMBOS` | 2 runs | Adds FOK, SS, LS, Y to sheet |
| `ALL_CATEGORIES` | 5 runs | Full `CATEGORIES` keys |
| `RARE_FACES` | 3 runs | Shop faces (separate; mention in Case Files if touching shop copy) |

**Risk:** Low — no scoring change.  
**Test:** New `tests/onboarding.test.cjs` or extend `rules.test.cjs` with `getCategoryUnlockInfo` exported via test hook — prefer **extracting** `getAvailableCategories` + unlock info to `gutterbones-rules` or a small `gutterbones-onboarding` script block if tests need it without React.

**Minimal test approach:** Duplicate threshold math in test file against documented table (fragile) OR export helpers from inline non-JSX block (preferred).

---

### WP-D — “Street rules” HUD strip (P1, ~0.5–1 day)

**Files:** `index.html` — `PLAY` layout (~3739–3760).

**Changes:**

1. One-line collapsible under heat/quota:  
   `Plays: N · Quota: T · Pills: P` (already partially in HUD — unify wording **heat/quota/plays**).
2. First run only: subtle hint “Tap a payout row after you roll” (dismiss on first `executePayout`).
3. When `activeBoss` set and `meta.totalRuns < 3`: one-time toast “Boss rules active — see banner.”

**Risk:** Low.  
**Test:** Manual.

---

### WP-E — Help Dossier sync (P1, ~0.5 day)

**Files:** `HelpOverlay` (~2074–2100).

Add sections:

- **QUOTA & PLAYS** (heat vs target, invalid hands still cost a play).
- **DEBT & CASH** (one paragraph — points to existing economy).
- **BOSSES** (list mirrors `STREET_INTEL.bosses` short).

**Risk:** None.

---

### WP-F — Optional early full sheet (P2, ~0.5 day, product decision)

**Only if you want less friction for Yahtzee veterans:**

- Meta flag `earlyFullSheetOptIn: boolean` in `gutterbones1977:meta:v1` or settings.
- Lineup checkbox: “I know Yahtzee — show full payout sheet” (default off).
- When true, `getAvailableCategories` returns all keys regardless of `totalRuns`.

**Risk:** Medium for balance perception — gate behind explicit opt-in.  
**Default for Phase 3:** Ship **WP-C copy** first; add WP-F only if playtests still complain.

---

## 4. Engineering approach (low regression)

1. Branch: `cursor/phase-3-first-hour-ux-048e` off latest `main`.
2. **Do not** edit `GutterbonesRules.calculateScore` in Phase 3.
3. Prefer extracting **pure onboarding helpers** into `<script id="gutterbones-onboarding">` (like rules) if unit tests are added.
4. One PR with WP-A → WP-C → WP-D/E; WP-F separate commit if included.
5. Run `npm run check` after each work package.
6. Manual checklist in `docs/testing.md` add subsection “Phase 3 UX” (after implementation).

---

## 5. File touch list

| File | WPs |
|------|-----|
| `index.html` | A–E (primary) |
| `tests/source.test.cjs` | step count / helper exports |
| `tests/onboarding.test.cjs` | optional new |
| `docs/testing.md` | manual checklist |
| `README.md` | one line “first-run tutorial covers quota & pills” |

---

## 6. Accessibility

- PILL button: `aria-label="Reroll this bone (spend 1 pill)"`.
- Locked categories: not `disabled` buttons — text only (already the case).
- Onboarding: focus trap not required for overlay (match current pattern); ensure **Esc** does not conflict with system menu (document: onboarding open → Esc closes menu only when menu open).

---

## 7. Copy deck (canonical strings)

Use everywhere (overlay, Help, locked footer):

- **Heat** = score toward quota (not Safehouse cash).
- **Quota** = minimum heat to clear the round.
- **Plays** = hands left this round.
- **Pills** = single-die rerolls (not stash programs).

Boss one-liner: **“Bosses rewrite the rules for this round’s job.”**

---

## 8. Manual test script (post-implementation)

1. Clear site data / disposable profile.
2. `localhost:8080/index.html` — Street Rat, dismiss or complete onboarding.
3. **Desktop:** confirm PILL visible without hover on each die after roll.
4. **390px viewport:** roll → pill → score; read locked payout footer.
5. Force boss via dev panel (`?dev=1` on localhost) — confirm banner + optional toast.
6. Complete 2 runs (or inject meta `totalRuns: 2`) — Quad unlock notification matches footer.
7. Escape → Help Dossier — quota section present.
8. `npm run check`.

---

## 9. Rollout / merge

- Preview on Vercel; verify production host uses prod React and no dev panel.
- No save version bump unless adding meta flags (WP-F / pillHintSeen).
- If meta fields added: extend `mergeMetaState` with defaults.

---

## 10. Estimated effort

| WP | Effort | Impact |
|----|--------|--------|
| A Pills | Low | High |
| B Onboarding | Low | High |
| C Categories | Low | High |
| D HUD strip | Low | Med |
| E Help | Low | Med |
| F Early sheet | Low | Med (optional) |

**Total:** ~3–5 focused days solo, or **one Cloud Agent pass** for A–C plus checklist for D–E.

---

## 11. After Phase 3

1. **Phase 5** — missing portraits (Counter, Bouncer, Crooked Cop).  
2. **Phase 4** — Witness arc (10 panels).  
3. **Phase 6a** — route/gamble UI clarity (no RNG change).

---

*Owner decision before build:* include **WP-F early full sheet** (yes/no) and whether onboarding is **6 or 7** steps (include stash programs or defer to Help only).
