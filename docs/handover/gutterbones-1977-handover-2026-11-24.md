# Gutterbones 1977 — Session Handover (2026-11-24)

Repo: `LukeHolmes/Dices-and-Devices` · Live: https://auditrelease.vercel.app
Status: **new art + new visual style is merged and pushed live to `main`.**

---

## 1. What shipped today

Landed the full art stack onto `main` and pushed it to `origin/main`.

- Merge commit: `976ea41` — "Merge art stack: new WebP art and look-and-feel visual style into main"
- `main` == `origin/main` == `976ea41` (working tree clean)
- Source branch merged in: `fix/antigravity-art-gates-2026-11-20` (tip `2f0ce37`, 81 commits ahead of the pre-art `main`)
- Pre-art `main` was `c62da55` ("fix: R9 Junkie deferred payout + play watchdog #100")

### What the merge contains
- **Personas (WebP):** street-rat, hustler, card-counter, enforcer, grinder
- **Bosses (WebP):** bouncer, crooked-cop, informant, loan-shark, junkie, the-raid
- **Scenes (WebP):** alley-playfield, stairwell-descent, counting-cash, the-mod-bench, gamble-double-or-nothing, busted, the-escape, **nightclub-backroom (new)**
- **Shop:** 9-slice card frames (standard/rare/dangerous), price tags, section headers, dividers, selected/sold overlays
- **HUD chrome:** matchbook ledger, label backing, status chips, plays counter, sockets, control faces
- **Icons:** dice faces / contraband, hardware, consumables (128/256px WebP)
- **Look-and-feel animations:** alley rat, hand-front roll spritesheet, cigarette ember/smoke, cockroach, tungsten flicker, debris, cash
- Wired via `PORTRAIT_ART`, `FACE_SYMBOL_ART`, `ITEM_ART`, `SHOP_CARD_ART`, scene CSS, and preloads in `index.html` (~8.5k lines changed across ~199 files).

---

## 2. Verification done

- **Merge conflict:** only `package.json` (the two `test:fast` lists). Resolved to keep **both** main's `tests/repro-r9-junkie-payout-during-reroll.test.cjs` and the art branch's `tests/art-animation-guard.test.cjs`.
- **Conflict markers:** none left in the tree.
- **Assets:** `scripts/check-index-assets.cjs` → **ok (49 paths)** — every `assets/art/*` referenced in `index.html` exists on disk.
- **R9 fix preserved:** its regression test passes.
- **`test:fast`:** **237 / 239 pass.** The 2 failures are the known `WP3 seed-0 CARVING` sim pair (`sim-wp3-carve-exit`, `sim-wp3-carve-targets`) — pre-existing on `main` (documented in PR #102), **not** introduced by this merge. All new art tests pass.

### NOT yet run (tomorrow)
- Full Playwright/layout suite (`npm run check` → `test:playwright` + `test:layout` + `audit:known-issues`). Needs `playwright` browsers installed; heavy.
- CI on the push has not been checked yet (workflows: `baseline-checks.yml`, `tablet-matchbook.yml`, `nightly-full-replay.yml`).
- Vercel deploy flip not yet confirmed.

---

## 3. Branch map (state as of handover)

| Branch | Role | vs `main` |
|---|---|---|
| `main` | **live, new style** | = `976ea41` |
| `fix/antigravity-art-gates-2026-11-20` | art tip (merged) | 1 behind (missing pre-art `c62da55`) |
| `art/final-art-pass` | draft PR #103 | part of the stack above |
| `art/batch52-production` | base of #103 | merged into the stack |
| `art/visual-overhaul`, `art/s3-item-icons`, `art/s4-shop-cards`, `art/batch52-polish-handoff-2026-11-19`, `art/look-and-feel-pass` | earlier art stages | all absorbed |
| `release/main-full-audit` | release polish on **old** style (no `assets/art/`) | separate line, not merged |
| local `art/continue` | local checkout of `fix/antigravity-art-gates-2026-11-20` | = art tip |

---

## 4. Open items / decisions for tomorrow

1. **Review-only candidates (NOT approved per handoff doc):** Brass Knuckles redo, ashtray, and the 9-piece HUD edge redo — see `art-production/batch-5-2/review/` and `docs/art-handoff/GB1977-Batch52-Polish-GrokBot-Cursor-2026-11-19.md`. These are archive-only; they did **not** need to ship.
   - ⚠️ **Flag:** the merged branch wires `assets/art/batch-5-2/hardware/brass-knuckles.webp` into `ITEM_ART.BRASS_KNUCKLES`, but the handoff doc says that redo is "review-only / not production-approved". Confirm whether this icon is intended to ship or should fall back to the letter/old icon.
2. **Confirm CI** on the push and **confirm Vercel** flips the live site to the new look.
3. **Run the full browser/layout check** if you want the complete gate (`npm run check`), or at least `test:playwright` + the blocking layout viewports.
4. **Process note:** this was landed as a **direct push** to `main` (by request), not via the repo's usual PR-first flow. The handoff doc marked `main` "intentionally stable" — flagging for awareness; a record PR is open (see §5).

---

## 5. Record PR

A PR was opened for the landing as a reviewable record (the merge itself is already on `main`, so its diff may read as already-merged).

---

## 6. Environment notes (DSH / this machine)

- **git / node / npm** require a `Start-Process` + `-RedirectStandardOutput/-RedirectStandardError` wrapper (the DSH file sandbox blocks native-command output capture via named pipes — EPERM). Helpers live in the workspace: `_gb_git.ps1`, `_gb_node.ps1`.
- **Node:** DSH-bundled Node **v24.21.0** at `C:\Users\holme\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe` (system `node` on PATH is old).
- **Tests & git push** need `danger-full-access` (child-process spawn + Git Credential Manager signal pipe are blocked otherwise).
- **GitHub credentials:** Git Credential Manager has `git:https://github.com` and `gh:github.com:LukeHolmes` stored — push/PR work under `danger-full-access`.

---

## 7. Tomorrow's first moves (checklist)

- [ ] Check GitHub Actions status on `976ea41` (baseline-checks, tablet-matchbook).
- [ ] Confirm https://auditrelease.vercel.app shows the new style.
- [ ] Decide on the Brass Knuckles icon (approved vs fallback).
- [ ] If going further: run `test:playwright` + `test:layout` (install Playwright browsers first).
- [ ] Decide next art batch vs. release polish (see `release/main-full-audit` if a separate release line is still wanted).
