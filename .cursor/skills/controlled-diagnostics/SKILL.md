---
name: controlled-diagnostics
description: Run reproducible Gutterbones balance or progression investigations with scripts and evidence, without silently modifying the rules. Use for baseline comparison, seeded simulations, progression and chain analysis.
---

# Controlled Gutterbones diagnostics

1. Confirm this is an investigation, not permission to change game mechanics. Record branch and exact rule, policy and diagnostic commits.
2. Read AGENTS.md, docs/testing.md and the experiment's existing CSV/JSON/Markdown tracking conventions. Preserve historical results and unknown values.
3. State the hypothesis, baseline, scenario, policy profile, seed plan, budget, coverage denominator, measures and decision threshold before execution. Do not use holdouts 55–59 without explicit authorization.
4. Prefer deterministic Node scripts and existing fixtures to AI-driven gameplay. Use npm run check:fast initially. Choose deeper browser, simulation or layout tests only if the evidence gap requires them.
5. For each result, record scenario, seed, execution mode, exact source commits, coverage, outcome, measurement validity and evidence. Mark verified versus reported versus hypothesis explicitly.
6. Distinguish a broken metric from an actual balance defect. If instrumentation is suspect, recommend fixing measurement first and defer tuning.
7. Produce a decision summary: what was verified, what remains unknown, rejected explanations, proposed next experiment, and the separate approval required for rule changes.

Do not modify balance, consume protected holdouts, merge or deploy as part of a diagnostics-only session.
