#!/usr/bin/env node
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { summarizeArmFromCsvAndTelem } = require("./exp-report-common.cjs");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");

function fmtPct(rate, label) {
  if (rate === "" || rate == null) return "";
  const pct = `${(rate * 100).toFixed(1)}%`;
  return label === "verified" ? pct : `${pct} (${label})`;
}

function fmtMr(m) {
  if (m.mean === "") return "";
  return `${m.mean.toFixed(2)} [${m.low.toFixed(2)}–${m.high.toFixed(2)}]`;
}

function main() {
  const arms = [
    { batchId: "F1F2-PILOT-c36f3b4-pre", label: "A c36f3b4-pre", cap: 3 },
    { batchId: "F1F2-PILOT-6f4dc92-main", label: "B 6f4dc92-main", cap: 3 },
    { batchId: "F1F2-PILOT-6f4dc92-Bp", label: "B′ 6f4dc92-Bp", cap: 2.5 },
  ];
  const summaries = arms.map((a) =>
    summarizeArmFromCsvAndTelem({
      csvPath: path.join(RUNS, `${a.batchId}.csv`),
      telemPath: path.join(RUNS, `${a.batchId}.telem-v2.jsonl`),
      label: a.label,
      capDefault: a.cap,
      telemVerified: true,
    }),
  );
  const outPath = path.join(ROOT, "diagnostics/tracking/experiments/EXP-F1F2-20261125-pilot-v2.md");
  const lines = [
    "# EXP-F1F2 pilot v2 — telem sidecars (100 runs × 3 arms)",
    "",
    "Pilot outcome rows unchanged (`F1F2-PILOT-*.csv`, harness **7f59b1e** era). Telem from **DEF-M-009** fix: link-observer stub no longer blocks `__GB_SIM_TELEM__.record`.",
    "",
    `Sidecars: \`F1F2-PILOT-*-telem-v2.jsonl\` (harness commits: ${summaries.map((s) => s.harnessCommits.join(",")).filter(Boolean).join("; ") || "pending"}).`,
    "",
    "**Caveats:** DEF-M-005 reproducibility **parked** (tentative). Arm A weaker cross-arm RNG parity (**tentative**).",
    "",
    "| Arm | n | Wins | Win rate Wilson 95% | Mean max_round (bootstrap 95% CI) | R1 clear (telem) | Upper bonus on (median round) | Upper-at-cap share (mean) | Boss clears / enters | INCOMPLETE |",
    "|-----|---|------|-------------------|----------------------------------|------------------|-------------------------------|---------------------------|----------------------|------------|",
  ];
  for (const s of summaries) {
    const wr =
      s.winRate.p === ""
        ? ""
        : `${(s.winRate.p * 100).toFixed(1)}% [${(s.winRate.low * 100).toFixed(1)}–${(s.winRate.high * 100).toFixed(1)}] **verified**`;
    const bc = Object.keys(s.bossClears).length ? JSON.stringify(s.bossClears) : "";
    const be = Object.keys(s.bossEnters).length ? JSON.stringify(s.bossEnters) : "";
    const boss = bc || be ? `${bc || "{}"} / ${be || "{}"} (${s.bossLabel})` : "";
    lines.push(
      `| ${s.label} | ${s.naturalDenominator} | ${s.wins} | ${wr} | ${fmtMr(s.meanMaxRound)} **verified** | ${fmtPct(s.round1ClearRate, s.round1ClearLabel)} | ${s.upperBonusActivationMedianRound === "" ? (s.upperBonusLabel === "tentative" ? "(tentative)" : "") : `${s.upperBonusActivationMedianRound} (${s.upperBonusLabel})`} | ${s.upperAtCapShareMean === "" ? "" : `${(s.upperAtCapShareMean * 100).toFixed(1)}% (${s.upperCapLabel})`} | ${boss} | ${s.incompleteBudget} |`,
    );
  }
  lines.push("", "## DEF-M-009 resolution", "");
  lines.push("- **Verified:** `SIM_LINK_OBSERVER=1` + minimal `__GB_SIM_TELEM__` stub prevented `record()` install; fixed via `gbEnsureSimTelem()` in `index.html` and guarded link-observer attach in `run.cjs`.");
  lines.push("- **Verified:** `tests/diagnostics/f2-scoring-variant.test.cjs` unchanged; pilot v2 sidecars rebuilt without re-appending CSV rows.");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outPath, summaries }, null, 2));
}

if (require.main === module) main();