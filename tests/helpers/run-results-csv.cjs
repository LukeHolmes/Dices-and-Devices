"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const CSV_COLUMNS = [
  "run_id",
  "batch_id",
  "experiment_id",
  "job_id",
  "baseline_label",
  "branch",
  "rules_commit",
  "policy_commit",
  "policy_revision",
  "diagnostics_commit",
  "harness_commit",
  "scenario",
  "rule_experiment_arm",
  "profile",
  "persona_id",
  "strategy",
  "gamble_policy",
  "viewport",
  "rid",
  "seed",
  "budget_max_steps",
  "replicate_index",
  "holdout_flag",
  "holdout_approval_id",
  "started_at",
  "ended_at",
  "wall_ms",
  "outcome",
  "terminal_reason",
  "max_round",
  "steps",
  "final_score",
  "final_gold",
  "wins_flag",
  "stuck_flag",
  "legal_decisions",
  "legal_coverage_pct",
  "organic_link_count",
  "chain_depth_peak",
  "replay_digest",
  "replay_match",
  "measurement_valid",
  "measurement_notes",
  "evidence_path",
  "runner_host",
  "os",
  "node_version",
  "playwright_version",
  "chromium_version",
  "llm_calls",
];

function escapeCsv(value) {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToLine(row) {
  return CSV_COLUMNS.map((col) => escapeCsv(row[col])).join(",");
}

function ensureCsvHeader(filePath) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${CSV_COLUMNS.join(",")}\n`, "utf8");
}

function appendRunRows(filePath, rows) {
  ensureCsvHeader(filePath);
  const lines = rows.map(rowToLine).join("\n");
  fs.appendFileSync(filePath, `${lines}\n`, "utf8");
}

function isNaturalTermination(outcome) {
  return outcome === "WIN" || outcome === "BUST";
}

function isBudgetExhaustion(result) {
  const outcome = result?.outcome;
  if (outcome === "INCOMPLETE:BUDGET") return true;
  if (result?.reason === "budget_exhausted" || result?.terminalReason === "budget_exhausted") return true;
  if (
    result?.steps >= result?.budget_max_steps
    && result?.detail
    && String(result.detail).includes("budget")
  ) return true;
  return false;
}

function normalizeRunOutcome(result, { budgetMaxSteps } = {}) {
  const budget = budgetMaxSteps ?? result?.budget_max_steps ?? result?.maxSteps;
  const exhausted = budget != null && (result?.steps || 0) >= budget;
  const forfeitBudget =
    exhausted
    && (
      result?.reason === "budget_exhausted"
      || result?.detail === "sim_forfeit_escape"
      || String(result?.detail || "").startsWith("budget_cap_forfeit")
      || (result?.outcome === "BUST" && exhausted && (result?.maxRound || 1) <= 1)
    );
  if (forfeitBudget || result?.outcome === "INCOMPLETE:BUDGET") {
    return {
      outcome: "INCOMPLETE:BUDGET",
      terminal_reason: result?.terminalReason || result?.reason || "budget_exhausted",
      stuck_flag: "1",
      measurement_valid: "0",
      measurement_notes: "budget_exhaustion_not_natural_bust",
    };
  }
  if (result?.outcome === "WIN" || result?.outcome === "BUST") {
    return {
      outcome: result.outcome,
      terminal_reason: result?.reason || result?.terminalReason || "",
      stuck_flag: result?.stuck ? "1" : "0",
      measurement_valid: "",
      measurement_notes: "",
    };
  }
  const incomplete = String(result?.outcome || "").startsWith("INCOMPLETE:")
    ? result.outcome
    : result?.outcome
      ? `INCOMPLETE:${result.outcome}`
      : "INCOMPLETE:UNKNOWN";
  return {
    outcome: incomplete,
    terminal_reason: result?.reason || result?.terminalReason || result?.detail || "incomplete",
    stuck_flag: "1",
    measurement_valid: "0",
    measurement_notes: "non_terminal_outcome",
  };
}

function digestRunResult(result) {
  const payload = {
    outcome: result.outcome,
    maxRound: result.maxRound,
    steps: result.steps,
    hands: result.telem?.hands,
    roundEvents: result.telem?.roundEvents,
    gold: result.telem?.gold,
    score: result.telem?.score,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function blankMetricsRow(partial) {
  const row = Object.fromEntries(CSV_COLUMNS.map((c) => [c, ""]));
  for (const [k, v] of Object.entries(partial)) {
    if (CSV_COLUMNS.includes(k)) row[k] = v == null ? "" : v;
  }
  return row;
}

module.exports = {
  CSV_COLUMNS,
  appendRunRows,
  digestRunResult,
  blankMetricsRow,
  ensureCsvHeader,
  isNaturalTermination,
  isBudgetExhaustion,
  normalizeRunOutcome,
};