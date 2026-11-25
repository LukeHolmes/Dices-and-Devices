# Gutterbones 1977 — Balance Session Handover (2026-11-25)

**Repo:** `LukeHolmes/Dices-and-Devices` · **Canonical build:** `index.html`

---

## 1. What shipped this session

### Balance analysis (PR #109 — merged)
- Added **`docs/balance-analysis-2026-11-24.md`** — an evidence-based balance analysis grounded in the game's production rules/tuning (not vibes).
- Added **`scripts/balance-ev.cjs`** — a reproducible measurement script (exhaustive 6⁵ single-roll EV per category + an 8 000-iteration opening sim).
- Produces **7 findings (F1–F7)**, each with a proposed fix and exact implementation pointers.

### Quick wins (PR #110 — merged)
Two low-risk fixes from the analysis:

**F5 — Gamble tiers are now EV-neutral:**
- `GutterbonesGamble.TUNING.tiers` (in `index.html`):
  - Soft Touch `winChance` **0.58 → 0.50**
  - Hard Flip `winChance` **0.38 → 0.40**
- Result: Soft / Fair / Hard are now ~0 EV without a flow streak (previously Soft was +10% EV and Hard was −5% EV, so the "safe" tier dominated and the "risky" tier was a trap). The flow bonus (+2%/streak, cap +12%) still makes tiers mildly +EV when hot.

**F3 — Softer first run:**
- `FIRST_RUN_TUNING.openingTarget` **75 → 70** (standard `EARLY_GAME_TUNING.openingTarget` stays 75).

### F1/F2 — Slop + upper rows (direct push to `main`, commit `98a7ea0`)
- Slop (Chance): `sum + 5 chips ×1.22` → `sum ×1.0` (always-valid fallback, no longer dominant).
- Upper rows: ONES–THREES `×1.5 → ×2.0`, FOURS–SIXES `×2.0 → ×2.2` (upper cap `2.5 → 3.0`).
- Upper-section bonus (≥63 upper heat): `+0.5x → +1.0x`.
- Updated tooltips + 10 test files. Verified green: `rules`, `synergy-baseline`, `synergy-chains`, `synergy-stage2/3`, `synergy-tier2`, `synergy-phase6`, `balance-top5-fixes`, `playtest5-economy-sim`, `playtest5-balance-bot`.

### Tests updated
- `tests/gamble.test.cjs` — added "SOFT and HARD tiers are EV-neutral without flow".
- `tests/balance.test.cjs` — `FIRST_RUN_TUNING` assertion now expects 70 (first run) vs 75 (standard).

---

## 2. Verification

- `tests/gamble.test.cjs` — **6/6 pass** (run in-process via `node tests/gamble.test.cjs`).
- `tests/balance.test.cjs` — the changed regex assertion (70 vs 75) verified against `index.html`. The unchanged sim assertions (Street Rat P(≥75) ≥ 0.75, Enforcer ≥ 0.2, R6 anchor 290–320) were **not re-run** this session: `sim-opening.cjs` re-compiles the rules block inside its per-iteration loop, so a direct run is very slow and those assertions were already green in the prior full `test:fast` pass (239/239). Re-run in CI.

---

## 3. Branch / PR / commit map (confirmed on `origin/main`)

| Branch | Role | State |
|---|---|---|
| `main` | live | at `2f62e97` (includes both merges) |
| `docs/balance-analysis-2026-11-24` | analysis doc + EV script | merged → `e4e33ec` (PR #109 → merge `2afe138`) |
| `fix/balance-quick-wins-2026-11-25` | F5 + F3 quick wins | merged → `2d8fbae` (PR #110 → merge `2f62e97`) |
| `main` | this handover | `docs/handover/gutterbones-1977-balance-session-handover-2026-11-25.md` |

---

## 4. Remaining balance work (NOT yet implemented)

From `docs/balance-analysis-2026-11-24.md` (all have exact implementation pointers there):

| # | Issue | Status |
|---|---|---|
| F1 | Slop dominates; upper rows are dead options | **done** (this session) |
| F2 | Upper-section bonus (63) is vestigial | **done** (this session) |
| F3 | First-run target cliff | **done** (this session) |
| F4 | Persona imbalance (Enforcer / Hustler / Counter) | **open** |
| F5 | Gamble tiers EV-monotonic | **done** (this session) |
| F6 | Synergy late-game dominance (unmeasured) | **open** — run `sim-build-dominance.cjs` before tuning |
| F7 | Debt spiral + Debt Collector loop | **open** |

Suggested next: **F4** (persona loadouts — re-run `scripts/sim-opening.cjs` + `scripts/balance-ev.cjs`) and **F6** (run `sim-build-dominance.cjs` before synergy tuning).

---

## 5. Concurrent-activity note ⚠️

This repo is worked on by **multiple agents concurrently**. During this session:

- A parallel session landed a `docs/handover/` **master handover pack** (commit `f55a1ff`) and test-skip work (`627faea`) on `main`.
- The working tree also showed other agents' uncommitted changes (edits to `tests/playtest8/11/15/16/18/19-fixes.test.cjs`, untracked `scripts/_diag_layout.cjs`, `scripts/_diag_buildtag.cjs`).

This session **only committed its own files**:

- analysis: `docs/balance-analysis-2026-11-24.md`, `scripts/balance-ev.cjs`
- quick wins: `index.html`, `tests/balance.test.cjs`, `tests/gamble.test.cjs`

**Run `git status` before landing anything new** and do not sweep unrelated changes into a commit.

---

## 6. Environment notes (DSH / this machine)

- Repo path: `C:\Users\holme\Documents\deepseek-harness\default-workspace\Dices-and-Devices`.
- Node / git / gh run through **Start-Process redirect wrappers** in the workspace root: `_gb_node.ps1`, `_gb_git.ps1`, `_gb_gh.ps1` (they sidestep the sandbox's named-pipe output-capture EPERM).
- **`node --test <files>` fails with `spawn EPERM`** in the sandbox (the test runner spawns a child per file). Run a single test file directly — `node tests/x.test.cjs` executes in-process and exits 0.
- **Pushes, PR create/merge require `danger-full-access`** (Git Credential Manager / gh auth use named pipes).
- Node binary: DSH-bundled `C:\Users\holme\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`.

---

## 7. Next moves (checklist)

- [ ] Confirm CI (`baseline-checks`, `tablet-matchbook`) is green on `2f62e97`.
- [ ] Implement **F1+F2** (Slop/upper-row rebalance) as a coordinated change + test updates.
- [ ] Run `node scripts/sim-build-dominance.cjs` for **F6** before touching synergy caps.
- [ ] Implement **F4** (persona loadouts) and re-run `scripts/sim-opening.cjs` + `scripts/balance-ev.cjs`.
