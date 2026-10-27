# Phase 4 — Story MVP (Arc E: The Witness)

**Status:** Planned (not on `main`; draft implementation in [PR #35](https://github.com/LukeHolmes/Dices-and-Devices/pull/35))  
**Depends on:** Phase 1–3 on `main` (ship hygiene, audio, first-hour UX — merged Oct 2026)  
**Goal:** A run feels like it has a **plot**, not only mechanics — grindhouse comic beats at natural pauses, skippable, save-safe, **no scoring/rule changes**.

**Canonical design:** `docs/story-arcs.md` (Arc E table, timing, file layout, §7 implementation notes).  
**Art spec:** `docs/art-direction.md` + `assets/ART_EXPORT_FILENAMES.md`.

---

## 1. Problem statement

| Issue | Evidence today | Player impact |
|-------|----------------|---------------|
| No narrative layer in runs | Loop is quota → shop → boss → repeat | Feels like a skinned Yahtzee; low emotional hook |
| Strong written arcs, zero delivery | 50-panel spec in `story-arcs.md`, no `assets/panels/` on `main` | Marketing and review promise “crime comic” that does not show up |
| Replay story value unused | 5 arcs designed; none selectable | Missed retention lever after UX is fixed (Phase 3) |

**Non-goals for Phase 4**

- Random selection across all five arcs (Phase 4b / later)  
- Boss-intersection panels (1.5s beat before `BossIntro`) — defer to Phase 4.1  
- Captions baked into PNGs (game renders text overlay)  
- Balance, gamble math, new bosses, Vite split  
- Full 50-panel production (Witness **10** only)

---

## 2. Success metrics (acceptance)

Manual browser checklist (§9) plus:

- [ ] New run: after **OFFER CONTRACT**, prologue panel appears with Witness caption before round 1 play (skippable).
- [ ] After shop path pick entering rounds **2–8**, matching `{arc}-rN` panel shows before `PLAY`.
- [ ] **Bust:** arc bust panel before `RAP_SHEET`; **Victory:** arc victory panel before `VICTORY` ticket.
- [ ] **Resume:** mid-run reload does **not** replay prologue; same `arcId`, correct next beat from `round`.
- [ ] Missing PNG (404): panel **skipped silently** — run continues.
- [ ] `prefers-reduced-motion`: shorter hold, no Ken Burns; still readable caption.
- [ ] `npm run check` green; **`GutterbonesRules.calculateScore` unchanged**.

---

## 3. Scope: Arc E only (10 panels)

| # | File | Trigger | Caption (in data, not on PNG) |
|---|------|---------|--------------------------------|
| 1 | `assets/panels/witness/prologue.png` | Run start | *"Wrong alley. Wrong minute."* |
| 2 | `r2.png` | Enter round 2 | *"They don't know your face yet."* |
| 3 | `r3.png` | Enter round 3 | *"The headline was a question, not a fact."* |
| 4 | `r4.png` | Enter round 4 | *"Two people looking for you. Different reasons."* |
| 5 | `r5.png` | Enter round 5 | *"Every car could be the one."* |
| 6 | `r6.png` | Enter round 6 | *"Now you have a price."* |
| 7 | `r7.png` | Enter round 7 | *"Talk and you're free. Talk and you're dead."* |
| 8 | `r8.png` | Enter round 8 | *"New face. Same trouble."* |
| 9 | `bust.png` | Quota fail | *"They found you first."* |
| 10 | `victory.png` | Round 10 clear | *"Somebody else's problem now."* |

**Round 9 (The Raid):** no arc transition panel per `story-arcs.md` — boss intro carries that beat.

**Hold times (default / reduced motion)**

| Kind | Default | Reduced motion |
|------|---------|----------------|
| Prologue | 2500 ms | 1000 ms |
| Round r2–r8 | 1800 ms | 1000 ms |
| Bust | 1200 ms | 1000 ms |
| Victory | 2000 ms | 1000 ms |

---

## 4. Work packages (implementation order)

### WP-A — Story data module (P0, ~0.5 day)

**Deliverable:** `<script id="gutterbones-story">` before the Babel block (same pattern as `gutterbones-onboarding`).

**API (frozen for tests):**

```javascript
GutterbonesStory.DEFAULT_ARC_ID // 'witness'
GutterbonesStory.getProloguePanel(arcId)
GutterbonesStory.getRoundTransitionPanel(arcId, roundNumber) // 2–8 only
GutterbonesStory.getBustPanel(arcId)
GutterbonesStory.getVictoryPanel(arcId)
GutterbonesStory.getReducedMotionHold()
```

**Risk:** Low — pure data.  
**Test:** `tests/story.test.cjs` eval script block.

---

### WP-B — `StoryPanelOverlay` UI (P0, ~1 day)

**Files:** `index.html` — React component + CSS (`storyKenBurns`, fade in/out).

**Behavior (match `story-arcs.md` §1):**

- Full-viewport overlay, `z-index` above playfield, below dev panel if needed.
- Image + **bottom caption bar** (`font-mono`, italic, `#e8e6e1` on `bg-black/70`).
- Typewriter caption ~30 ms/char unless reduced motion (show full line).
- Ken Burns on image unless reduced motion.
- **Skip:** click/tap anywhere, **Space**, **Enter**; hint line “TAP OR SPACE TO SKIP”.
- **`onError` on `<img>`:** treat as skip (404-safe).

**Engineering note:** Overlay is **outside** the main `App` closure — use `window.setTimeout` / `setInterval`, not `scheduleInterval` from `App`.

**Risk:** Low–medium (timers, z-index vs onboarding `z-[600]` — story at `z-[650]`, first-run overlay after prologue).

---

### WP-C — Run state & saves (P0, ~0.5 day)

**Fields**

- `arcId: string` on serialized run (default `'witness'`).
- Optional later: `storyPanelsSeen: string[]` — **not required for MVP** (round number selects panel).

**Touch points**

- `serializeRun` / `resumeRun` / `GutterbonesRules.normalizeSavedRun` — default missing `arcId` to `'witness'`.
- `RUN_SAVE_VERSION`: **no bump** if only adding optional field with default (old saves load fine).

**Risk:** Low — additive save field.

---

### WP-D — Trigger wiring (P0, ~1 day)

**Helper in App:** `playStoryBeat(panel, onDone)` — queue overlay then callback.

| Event | When | Then |
|-------|------|------|
| Prologue | End of `startRun`, before first-run overlay | `setPhase('PLAY')`; show `FirstRunOverlay` if `meta.totalRuns === 0` |
| Round transition | End of `handleAdvance`, before `PLAY` | Panel for **next** round index (2–8) |
| Bust | After bust cinematic delay, before `RAP_SHEET` | Bust panel → rap sheet |
| Victory | After round-10 clear, before `VICTORY` | Victory panel → victory screen |

**Do not show story when**

- Resuming a save (skip prologue; transitions still OK when advancing rounds after load).
- `arcId` unknown / future arcs not implemented — fall back to no-op.

**Interaction with Phase 3**

- Block **Escape** system menu while `storyBeat` active (same as boss intro / onboarding).
- First-run overlay waits until prologue dismissed (`!storyBeat`).

**Risk:** Medium — ordering with existing `scheduleTimeout` bust/victory cinematics; test both reduced motion paths.

---

### WP-E — Art pipeline (P0 for ship perception, parallel track)

**MVP code merge:** placeholder PNGs under `assets/panels/witness/` (duplicate scene PNG OK for CI “file exists” tests).

**Ship-quality art (your “tomorrow” pass):**

1. Generate per `docs/story-arcs.md` Arc E subject column + `art-direction.md` (cold cyan, rain, noir framing).
2. Export names exactly: `prologue.png`, `r2.png` … `r8.png`, `bust.png`, `victory.png`.
3. **No caption text in images** — captions stay in `gutterbones-story`.
4. Target aspect: ~16:9 or 3:2, readable on mobile letterbox.

**Risk:** None for code if placeholders exist; art swap is asset-only PR.

---

### WP-F — Tests & docs (P0, ~0.5 day)

| Test | Purpose |
|------|---------|
| `tests/story.test.cjs` | Panel lookup by round / endings |
| `tests/source.test.cjs` | Script order (rules → onboarding → **story** → babel); `StoryPanelOverlay`; panel paths exist |
| `tests/fixtures/runs.cjs` | `arcId: 'witness'` on synthetic saves |
| `docs/testing.md` | Manual story bullets |
| `AGENTS.md` | Panel path serving note |

**Risk:** Low.

---

### WP-G — Optional polish (P2, product decision)

| Feature | Notes |
|---------|--------|
| **Settings: “Story panels” off** | Persist in `gutterbones1977:settings:v1`; skip `playStoryBeat` |
| **Random arc** | `pickArc()` on `startRun` when arcs B–E exist — Phase 4b |
| **Boss approach panel** | Extra beat when `path.boss` — Phase 4.1 |
| **Case Files “Archive”** | One line: “Each contract deals a different street story.” |

Default Phase 4: **skip WP-G** unless playtests want mute stories.

---

## 5. Engineering approach (low regression)

1. Branch: `cursor/phase-4-story-mvp-048e` off latest `main`.
2. **Do not** change scoring, bosses, or shop generation in this phase.
3. Story is **non-blocking** — failure = skip panel, never block payout or save.
4. One PR: WP-A → D + placeholders (WP-E) + WP-F; art replacement PR can follow without code.
5. Reuse or close [PR #35](https://github.com/LukeHolmes/Dices-and-Devices/pull/35) after rebasing onto `main` post–Phase 3.
6. Run `npm run check` after each WP.

---

## 6. File touch list

| File / path | WPs |
|-------------|-----|
| `index.html` | A, B, D (CSS, component, triggers) |
| `assets/panels/witness/*.png` | E |
| `tests/story.test.cjs` | F |
| `tests/source.test.cjs` | F |
| `tests/helpers/game.cjs` | F (only if action tests need story — usually not) |
| `tests/fixtures/runs.cjs` | F |
| `docs/testing.md` | F |
| `AGENTS.md` | F |
| `docs/story-arcs.md` | reference only |

---

## 7. Accessibility

- Overlay: `role="dialog"`, `aria-label="Story panel"`.
- Skip affordance visible; keyboard Space/Enter (not only pointer).
- Reduced motion: no Ken Burns; shorter auto-advance.
- Captions are real text (screen reader reads caption region).

---

## 8. Rollout / merge

- No CDN changes beyond new static PNGs.
- Verify prod host: panels load from same origin as `index.html`.
- **Save compatibility:** additive `arcId` only.
- After merge: optional Vercel preview smoke — prologue + skip + one round transition.

---

## 9. Manual test script (post-implementation)

1. Clear site data / disposable profile.  
2. `python3 -m http.server 8080` → `http://localhost:8080/index.html?dev=1`.  
3. Street Rat → **OFFER CONTRACT** → prologue image + caption → skip → onboarding (if first run) → roll.  
4. Clear quota or dev-advance to shop → pick path → **round 2** panel before play.  
5. Dev panel: force bust or play to fail → bust panel → rap sheet.  
6. (Optional) dev/smoke victory → victory panel → escape ticket.  
7. Start run, reload mid-round → resume **without** prologue.  
8. Rename/delete one PNG → that beat skips, run continues.  
9. Enable **Reduce motion** in system menu → shorter panel, no drift.  
10. `npm run check`.

---

## 10. Estimated effort

| WP | Effort | Impact |
|----|--------|--------|
| A Data | Low | High |
| B Overlay | Medium | High |
| C Saves | Low | High |
| D Triggers | Medium | High |
| E Art (placeholders) | Low | Med |
| E Art (final Witness 10) | Medium–High | High |
| F Tests/docs | Low | High |
| G Optional | Low | Low |

**Code-only MVP:** ~1–2 focused days (or one Cloud Agent pass + manual QA).  
**Final art:** parallel; swap assets without code changes.

---

## 11. After Phase 4

1. **Phase 5** — portraits: Counter, Bouncer, Crooked Cop (`PERSONAS` / `BOSSES` `portraitSrc`).  
2. **Phase 4b** — random arc picker + next arc data modules (Setup, Blood Debt, …).  
3. **Phase 6a** — route/gamble UI clarity (no RNG change).  
4. **Art backlog** — replace Witness placeholders; then generate arcs B–D per priority in `story-arcs.md` §8.

---

## 12. Owner decisions before build

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Merge draft PR #35 vs fresh branch | Rebase #35 / rewrite | Rebase #35 if diff matches WP-A–F; else single clean branch |
| Placeholders in repo | Yes / no | **Yes** — unblocks CI and QA before final art |
| Story mute setting (WP-G) | Ship / defer | **Defer** until panels exist in prod |
| First-run overlay vs prologue order | Prologue first | **Prologue first** (cinematic hook, then tutorial) |

---

*Phase 4 addresses Top 10 problem **#2 (Story)** from the low-risk roadmap. Phase 3 must stay green; story must never block mechanics.*
