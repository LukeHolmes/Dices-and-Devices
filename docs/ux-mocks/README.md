# Dice space & control-panel UX audit (mock-only)

Branch: `cursor/ux-dice-space-audit`. **No gameplay or `index.html` changes** — documentation, capture scripts, and static layout mocks only.

Luke’s brief: the hand reads well, but dice need more breathable space and the play control panel hides too much decision-critical state.

## How to reproduce captures

```bash
cd /path/to/Dices-and-Devices
npm install   # Playwright already in package.json devDeps
node docs/ux-mocks/scripts/capture-baseline.cjs
node docs/ux-mocks/scripts/capture-mocks.cjs   # alias → capture-proposals.cjs
```

**High-fidelity mocks (v2):** `capture-proposals.cjs` loads production `index.html` with a post-roll fixture, freezes the **real hand** sprite (`freezeRollHandThrowAt`), and injects proposal CSS via `data-ux-mock="a|b|c"`. Dice faces, pill badges, alley `alley-playfield.png`, and hand PNGs are unchanged from main.

Outputs:

| Artifact | Location |
|----------|----------|
| **Before** (main build) | `baseline/*.png`, `baseline/measurements.json` |
| **Mocks A/B/C (high-fidelity)** | `mock-screenshots/option-{a,b,c}_*.png`, `mock-screenshots/proposal-measurements.json` |
| **Proposal CSS (mock-only)** | `proposals/option-{a,b,c}.css`, `proposals/shared.css` — injected by Playwright, **not** loaded by `index.html` |
| **HTML index pages** | `option-a-tray-plus-strip.html`, etc. — thumbnails + capture instructions |

Viewports: **390×844**, **1366×768**, **1920×1080**. Moments: run start, before roll, after roll (payout rows lit), shop (`shopBusy` fixture), control panel with LOG + RUN INTEL details + MODS drawer open.

---

## 1. Audit — dice area measurements

We measure two layers:

1. **`play-alley`** — felt tray container (art + hand + actions).
2. **`play-dice-lane`** — the five dice row (actual legibility target).

### Summary table (typical PLAY hand, before roll)

| Viewport | Control strip (`play-hud`) height | Alley container (% viewport / px) | **Dice row** (% viewport / px) | Notes |
|----------|-----------------------------------|-----------------------------------|-------------------------------|--------|
| 390×844 | ~262px (**31%** height) | **65%** area / 378×567 | **2.7%** / 220×40 | Payouts on **PAYOUTS** tab; alley is full-width single column |
| 1366×768 | ~184px (**24%**) | **41%** area / 773×552 (58% width) | **1.9%** / 340×58 | Ledger uses remaining 40% width |
| 1920×1080 | ~184px (**17%**) | **45%** area / ~1100×620 | **1.8%** / 453×80 | Same 7/5 grid split |

When drawers open (`05-control-panel-revealed`), alley share drops to **~44%** (390×844) and **~28%** (1366×768) because HUD + overlays consume vertical space before the grid.

**Diagnosis in one line:** the tray *looks* large (50–70% of column height) but the **dice row occupies under 3% of the viewport** on every breakpoint; chrome (HUD, dock tabs, post-roll coach text, side-bet row, RUN INTEL, hand sprite) eats the felt.

---

## 2. Hidden / tucked control-panel information

| UI surface | How it’s hidden | Need frequency (per hand) | Decision impact |
|------------|-----------------|---------------------------|-----------------|
| **Quota progress & heat vs target** | Visible on strip (good) | **Every hand** | Critical — kept visible |
| **Plays / pills** | Visible on strip (good) | **Every hand** | Critical |
| **Flow multiplier** | Small text on quota line | **Most hands** (affects preview) | High for scoring choices |
| **Best preview heat / category** | Coach banner + PAYOUTS tab on phone; desktop in ledger tint | **Every hand after roll** | **Critical** — primary scoring decision |
| **Full payout math / chain depth** | Hover/long-press receipt on row; breakdown overlay after score | **Every scored hand** | High for learning & chains |
| **Locked category rules** | `?` on locked rows | Occasional | Low–medium (meta) |
| **Side bet stakes & threshold** | Dedicated row under HUD; active bet detail in small type | Optional pre-roll | Medium when used |
| **RUN INTEL chips** (route, combo, boss, rig…) | Stash column + **DETAILS** overlay; collapsed on short heights | **Most hands** for vets | High for route/boss planning |
| **Hardware / boss modifier text** | **MODS (n)** toggle; boss desc hidden `gb-hud-compact-hide` on small widths | **Every hand** with rig/boss | **Critical** when modifiers change math |
| **Chain-link status** | Dice-lane links + breakdown only after score | When chaining | High for synergy builds |
| **Next threat / route** | `NextThreatBadge` mobile-only strip | Between rounds | Medium |
| **Hand history** | **LOG** drawer | Occasional | Low during hand |
| **Face / upgrade intel** | Loupe on die, upgrade intel modal | Carve/shop moments | Medium |
| **Pill rules** | Hidden popover / first-run toasts | When learning pills | Medium early, low later |
| **Programs (stash)** | **STASH** tab mobile / column desktop | Between scores inside hand | Medium |
| **SYS menu** | Modal | Rare | Low |

**What hurts most:** on phone, **scoring requires leaving the alley tab**; **best preview** and **valid row highlights** live behind **PAYOUTS** while the coach banner repeats that fact. **Flow, combo spike, route/boss rig details** sit behind **DETAILS** / stash intel — relevant during the same post-roll window when players pick a line.

**Fine tucked away:** LOG, SYS, lore-grade help, locked-row `?`, long boss flavor text (if chip shows boss id).

---

## 3. Proposal mock metrics (post-roll, production render)

Compared to **baseline** `03-after-roll-rows-lit` on **390×844** (PAYOUTS tab required for scores; dock visible):

| Metric | Baseline main | Proposals A/B/C (overlay CSS) |
|--------|---------------|--------------------------------|
| Dice bbox (% viewport, bone union) | **2.67%** | **~2.5%** bbox *but* ~1.28–1.34× visual scale + 1.1× die art — reads larger in PNGs |
| Dice lane clipped | no | **no** (all captures) |
| Hand sprite visible | roll animation only | **yes** (frozen open grip, production assets) |
| Payout rows on phone w/o tab switch | no | **yes** (ledger under alley; option C adds horizontal chip row) |
| RUN INTEL on phone w/o STASH tab | no | **yes** (inline strip above alley) |
| MODS / hardware names | toggle | **chip** (panel collapsed in mocks) |
| Alley tray % viewport | 65% (payouts hidden) | **~41%** — trade: smaller tray, **full decision surface on one screen** |

Full per-option numbers: `mock-screenshots/proposal-measurements.json`.

---

## 4. Layout options (reorganize only — no rule changes)

### Option A — Expanded tray + slim always-visible strip

- Collapse HUD to one strip: plays, pills, quota/bar, flow, cash/debt, best-preview chip.
- Move side bets + RUN INTEL chips into stash or a single “INTEL” chevron **below** the strip (not above the tray).
- Phone: optional **one-line payout peek** (best category + heat); full matchbook unchanged on PAYOUTS tab / desktop column.
- Enlarge dice lane scale (~1.25–1.4×) and reduce hand overlay overlap via layout, not art deletion.

| Pros | Cons | Build size |
|------|------|------------|
| Maximum dice legibility; keeps all numbers visible in strip | Requires careful strip density on 360px width | **Medium** (~3–5 days): CSS grid + HUD component refactor, dock tab rethink |

Capture: `mock-screenshots/option-a_{390x844,1366x768,1920x1080}.png` · CSS: `proposals/option-a.css`

### Option B — Split control panel (primary + secondary drawer)

- **Primary:** quota, plays, pills, cash, best preview.
- **Secondary drawer:** RUN INTEL, MODS, side bets, programs — one consistent “intel drawer” instead of three patterns (DETAILS, MODS, tabs).

| Pros | Cons | Build size |
|------|------|------------|
| Clearest separation of “act now” vs “context” | Still one extra tap for intel-heavy players | **Medium-large** (~5–7 days): state for drawer + mobile/desktop parity |

Capture: `mock-screenshots/option-b_*.png` · CSS: `proposals/option-b.css` (DETAILS drawer open in capture)

### Option C — Phase-aware control surface

- **Pre-roll:** strip shows plays/pills/quota; hide side bets; emphasize ROLL.
- **Post-roll:** auto-surface best preview + horizontal payout chips (shortcut into same `executePayout` rows).
- **Shop/carve:** existing phase shells unchanged.

| Pros | Cons | Build size |
|------|------|------------|
| Surfaces the right data at the right moment; can combine with A’s strip | More state machine / QA surface; chips must stay in sync with ledger | **Large** (~7–10 days): phase hooks + chip UI + tests |

Capture: `mock-screenshots/option-c_*.png` · CSS: `proposals/option-c.css` (magenta best-play banner + horizontal payout chips on phone)

---

### Trade-offs (flow, depth, fun)

| | Flow | Depth | Fun |
|---|------|-------|-----|
| **A** | Best — one screen, fewer tab hops | All numbers kept; strip is dense on 360px | More time on alley art + real dice |
| **B** | Good — intel drawer adds one scroll | Best for veterans (DETAILS always handy) | Slightly more “panel” feel |
| **C** | Fastest score commit on phone (chips) | Chip row is shorthand; full ledger still there | Strongest “best line” callout; horizontal scroll learning curve |

None of the proposals remove rules, categories, intel fields, or animations — **layout and visibility only**.

---

## 5. Recommendation

**Ship Option A first, steal Option C’s “best preview” line on post-roll.**

Rationale:

1. Fixes the core phone pain (**dice tiny + payouts off-tab**) without a new interaction model.
2. Preserves the matchbook hand and all depth — only chrome reflow.
3. Option C’s chips can be a thin follow-up (read-only mirrors of ledger rows) once the strip exists.

Option B is a solid alternative if you prefer a single “intel drawer” metaphor over a denser strip.

---

## 6. Screenshot index (before)

| Moment | 390×844 | 1366×768 | 1920×1080 |
|--------|---------|----------|-----------|
| Run start | `baseline/01-run-start_390x844.png` | `…_1366x768.png` | `…_1920x1080.png` |
| Before roll | `02-before-roll_*` | | |
| After roll (rows lit) | `03-after-roll-rows-lit_*` | | |
| Shop | `04-shop_*` | | |
| Panel revealed | `05-control-panel-revealed_*` | | |

Full metrics: `baseline/measurements.json`.

---

## 7. Next implementation steps (when approved)

1. Prototype Option A strip behind a feature flag in `index.html` (layout only).
2. Add layout tests for dice-lane min height / `% viewport` budgets (extend polish-step pattern).
3. User test on 390×844: time-to-score without tab switch vs baseline.
