#!/usr/bin/env node
"use strict";

function buildTelemSidecarLine(r, { capDefault = 3, harnessCommit = "", telemVersion = "v2" } = {}) {
  const t = r.telem || {};
  const hands = t.hands || [];
  const validHands = hands.filter((h) => h.valid);
  const upperAfter = hands.filter((h) => h.isUpper && h.valid && h.upperBonusActiveBefore);
  const upperAtCap = upperAfter.filter((h) => Number(h.categoryMult) >= capDefault - 0.01);
  const round1Cleared = (t.roundEvents || []).some((e) => e.kind === "round_cleared" && e.round === 1);
  return {
    rid: r.rid,
    seed: r.seed,
    outcome: r.outcome,
    max_round: r.maxRound,
    harness_commit: harnessCommit,
    telem_version: telemVersion,
    round1_cleared: round1Cleared,
    upper_bonus_activation: t.upperBonusActivation || null,
    upper_at_cap_share: upperAfter.length ? upperAtCap.length / upperAfter.length : null,
    upper_after_bonus_hands: upperAfter.length,
    slop_pick_share: validHands.length
      ? validHands.filter((h) => h.isSlop).length / validHands.length
      : null,
    boss_clears: t.bossClears || {},
    boss_enters: t.bossEnters || {},
    gamble_choices: (t.gambleChoices || []).length,
    early_debt_events: (t.earlyDebtEvents || []).length,
  };
}

module.exports = { buildTelemSidecarLine };