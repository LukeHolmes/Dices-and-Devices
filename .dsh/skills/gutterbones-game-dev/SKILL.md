---
name: gutterbones-game-dev
description: Gutterbones 1977 (Dices-and-Devices) development conventions. Use when working on this specific browser Yahtzee roguelite: balance, dice scoring, save state, game UI, or its build/test setup.
---

# Gutterbones 1977 — Project Skill

Project-specific guidance for **Gutterbones 1977**, a gritty 1970s New York-inspired Yahtzee roguelite. Repository: `LukeHolmes/Dices-and-Devices`.

## First: read the real rules — do not invent

- Before any balance, scoring, or probability work, read the actual game rules and data from the repository (scoring tables, dice logic, unlock/progression config, save format). Never assume standard Yahtzee rules are unchanged by the roguelite layer, and never invent numbers.
- Locate the tunable values (scores, costs, probabilities, progression thresholds) and the files that define them before proposing any change.
- If a rule is ambiguous or not found, say so and ask, rather than assuming.

## Apply the general skills

- `probability-modelling` — for dice odds, expected values, and Monte Carlo simulation of scoring/decisions.
- `roguelite-game-design` — for difficulty/progression curves, synergy analysis, and economy; use its "read rules first, simulate, report distributions" discipline.
- `playwright-testing` — for browser E2E and visual regression of the game UI.
- `performance-optimization` — for browser-game frame rate, re-render, and asset costs.
- `frontend-development` / `ui-ux-review` / `accessibility-testing` — for the UI.
- `testing-strategy` — for unit tests of scoring logic vs integration tests of the game loop.

## Project-specific concerns

- **Save-state integrity** — verify save/load round-trips exactly (no lost state, no NaN/corruption), and that versioned saves migrate or fail safely.
- **Randomness** — the RNG must be seedable so simulation and tests are deterministic; verify dice results are drawn from the intended distribution, not an off-by-one or biased helper.
- **Browser constraints** — keep the game responsive at target viewports; watch for layout thrash and unbounded re-renders.
- **Theme** — the 1970s gritty New York style is part of the product; keep UI changes consistent with it (see the repo's design assets/conventions).

## Guardrails

- This skill describes *process*; it does not contain game rules or balance targets. Read those from the repo each time.
- Do not modify production code during a skills-setup or unrelated task; only change game code when that is the actual request.
- Keep any simulation/analysis scripts small, deterministic, and saved where they can be re-run.

Original text.
