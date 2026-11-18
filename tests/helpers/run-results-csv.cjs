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
};