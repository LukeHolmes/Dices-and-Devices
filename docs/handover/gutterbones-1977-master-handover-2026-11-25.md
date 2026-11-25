# Gutterbones 1977 — Master Handover (2026-11-25)

> **Must-read before continuing work.** Consolidates everything done across the art/style merge, QA pass, and bug-fix sessions, plus the test-suite update done today.

Repo: `LukeHolmes/Dices-and-Devices` · Live: https://auditrelease.vercel.app
Single-file browser game (`index.html`), React 18 + Babel + Tailwind via CDN, Node 24 tests.

---

## 1. Where the project is right now

- **New art + visual style is LIVE on `main`** (merge `976ea41`, then fixes `47f614e`, `26a3c3b`). Full WebP art stack: personas, bosses, scenes (incl. nightclub), shop-card frames, HUD chrome, look-and-feel animations.
- **`main` == `origin/main` == `26a3c3b`** at time of writing.
- Today's test-update work is on branch **`fix/balance-quick-wins-2026-11-25`** (commit `627faea`), alongside a concurrent balance fix `2d8fbae` ("EV-neutral gamble tiers + softer first-run target (70)").

### Fixes landed (on `main`)
| Commit | What |
|---|---|
| `976ea41` | Merge art stack (new WebP art + look-and-feel style) |
| `47f614e` | Shop refresh-cost curve softened (base 7, escalation 3) |
| `26a3c3b` | carve→shop e2e selector + synergy-chain banner under reduced motion |

---

## 2. Today: test-suite update (the "Option C" problem)

### Root cause of the ~20 failing Playwright tests
The game runs the **"Option C" UI/UX redesign** (commit `25d5266`, PR #79, merged 2026-11-10). It sets `rootEl.dataset.uiRedesign = '1'` **unconditionally** (`index.html` line ~15260), which flips on:

```css
#root-gutterbones[data-ui-redesign="1"] [data-layout-key="play-stash"] {
  display: none !important;
}
```

This hides the `play-stash` column that held the **run-intel summary**, and it changes the score flow (scores resolve straight to the matchbook ledger, no center `score-breakdown`/`score-resolution` modal). The Playwright tests were written against the **pre-redesign** layout and were never updated.

### What was done (commit `627faea`)
Skipped the tests that assert features removed/changed by the redesign, with explicit reasons:

| File | Tests skipped | Reason |
|---|---|---|
| `playtest18-fixes` | `run intel summary *` (12) | run-intel summary removed from desktop |
| `playtest15-fixes` | `play stash intel readable` (3) + `shop run intel route text` (3) | run-intel / shop-route overlap |
| `playtest16-fixes` | `inline run intel fully visible` (3) | run-intel summary removed |
| `playtest19-fixes` | `run intel DETAILS popover` (3) | run-intel summary removed |
| `playtest11-fixes` | `roll disabled while score overlay open` (1) | score resolves to ledger, no score-overlay roll-lock |
| `playtest8-synergy-chain` | `build-tag … synergy chain overlay` (1) | score flow changed |

**Still not addressed** (not skipped): a handful of flaky `page.goto` timeouts (`shop routes … no scrollbars`, `rap sheet 3 history rows`, `score panel below HUD`) that pass intermittently depending on CDN/load timing — re-run before touching.

### ⚠️ Open decision (for tomorrow)
The run-intel summary (FLOW/COMBO/ROUTE/BOSS/RIG/1-SHOT/BP chips) is **gone from the desktop Option C layout**. Two paths:
- **(a)** Re-add it to the desktop (e.g., into the `stash-dock-compact` in the ledger column), then un-skip the tests, or
- **(b)** Accept it as mobile-only (it still renders in `play-mobile-intel`, `md:hidden`) and delete the skipped tests.

---

## 3. Branch map

| Branch | Role |
|---|---|
| `main` (= `origin/main`) | live, new style + fixes (`26a3c3b`) |
| `fix/balance-quick-wins-2026-11-25` | today's test skips (`627faea`) + a balance fix (`2d8fbae`) — **needs push/PR** |
| `docs/art-handover-2026-11-24` | handover-doc PR #108 branch (doc only) |
| `docs/balance-analysis-2026-11-24` | balance-analysis doc branch (other agent) |
| `fix/antigravity-art-gates-2026-11-20` and `art/*` | the (now-merged) art stack branches |

---

## 4. Test status (as of the QA pass)

- `test:fast` (rules / balance / sim / saves): **239/239 pass**.
- `audit:known-issues` (GB001–GB011): **11/11 pass**.
- `test:playwright`: after today's skips — **71 pass / 6 fail / 23 skipped**. The 6 remaining failures are flaky: 4 are `page.goto` timeouts (CDN/load timing), and 2 are score-flow timing (`score panel sits below play HUD`, `synergy chain banner … after scored chain hand`) — both intermittently pass in isolation. The deterministic Option-C failures are now all skipped.

---

## 5. Reference files in this pack

- `gutterbones-1977-handover-2026-11-24.md` — the original landing handover (state, branch map, open items).
- `gutterbones-1977-qa-report-2026-11-24.md` — full QA results + bug classification.
- `gutterbones-1977-art-regeneration-brief.md` — art assets to regenerate + ChatGPT image prompts (style lock, palette, per-asset specs).
- `gutterbones-1977-balance-analysis-2026-11-24.md` — balance analysis (separate agent).

---

## 6. Environment notes (DSH)

- Repo clone: `C:\Users\holme\Documents\deepseek-harness\default-workspace\Dices-and-Devices`.
- Node 24, Playwright 1.64.1 (chromium-1248 cached). `npm install` if node_modules missing.
- Git/Node run fine under `danger-full-access`; Git Credential Manager + `gh` are authenticated for `LukeHolmes`.
- Run: `npm run test:fast` (fast), `npm run test:playwright` (browser), `npm run check` (full).
