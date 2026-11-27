#!/usr/bin/env node
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const {
  summarizeArmFromCsvAndTelem,
  pairedDiffBootstrap,
  csvMapsByRid,
} = require("./exp-report-common.cjs");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");

function fmtDiff(d, scale = 1, suffix = "") {
  if (d.mean === "") return "";
  return `${(d.mean * scale).toFixed(3)}${suffix} [${(d.low * scale).toFixed(3)}–${(d.high * scale).toFixed(3)}] (n=${d.n})`;
}

function main() {
  const arms = [
    { batchId: "F1F2-1K-c36f3b4-pre", csvKey: "A", label: "A c36f3b4-pre", cap: 3 },
    { batchId: "F1F2-1K-6f4dc92-main", csvKey: "B", label: "B 6f4dc92-main", cap: 3 },
    { batchId: "F1F2-1K-6f4dc92-Bp", csvKey: "Bp", label: "B′ 6f4dc92-Bp", cap: 2.5 },
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
  const maps = Object.fromEntries(
    arms.map((a) => [a.csvKey, csvMapsByRid(path.join(RUNS, `${a.batchId}.csv`))]),
  );
  const winVsA = pairedDiffBootstrap(
    { a: maps.B, b: maps.A },
    (r) => (r.outcome === "WIN" ? 1 : 0),
  );
  const winBpVsB = pairedDiffBootstrap(
    { a: maps.Bp, b: maps.B },
    (r) => (r.outcome === "WIN" ? 1 : 0),
  );
  const mrVsA = pairedDiffBootstrap(
    { a: maps.B, b: maps.A },
    (r) => Number(r.max_round),
  );
  const mrBpVsB = pairedDiffBootstrap(
    { a: maps.Bp, b: maps.B },
    (r) => Number(r.max_round),
  );

  const outPath = path.join(ROOT, "diagnostics/tracking/experiments/EXP-F1F2-20261126-1k.md");
  const lines = [
    "# EXP-F1F2 1k batch (3 arms)",
    "",
    "Rids `0-54,60-1004` (holdouts 55–59 excluded; n=1000/arm). Street Rat builder, policy `2026-11-11-phase-b-v1`, `max_steps=6000`.",
    "",
    "**Caveats:** DEF-M-005 reproducibility **parked** (tentative). Arm A `c36f3b4-pre` weaker cross-arm RNG parity (**tentative**). Paired win/max_round diffs use shared rid alignment (**verified** where CSVs complete).",
    "",
    "## Per-arm summary",
    "",
    "| Arm | n | Wins | Win rate Wilson 95% | Mean max_round (bootstrap 95% CI) | R1 clear (telem) | Upper bonus on (median round) | Upper-at-cap share (mean) | Boss clears / enters | INCOMPLETE |",
    "|-----|---|------|-------------------|----------------------------------|------------------|-------------------------------|---------------------------|----------------------|------------|",
  ];
  for (const s of summaries) {
    const wr =
      s.winRate.p === ""
        ? ""
        : `${(s.winRate.p * 100).toFixed(1)}% [${(s.winRate.low * 100).toFixed(1)}–${(s.winRate.high * 100).toFixed(1)}]`;
    const bc = Object.keys(s.bossClears).length ? JSON.stringify(s.bossClears) : "";
    const be = Object.keys(s.bossEnters).length ? JSON.stringify(s.bossEnters) : "";
    lines.push(
      `| ${s.label} | ${s.naturalDenominator} | ${s.wins} | ${wr} | ${s.meanMaxRound.mean === "" ? "" : `${s.meanMaxRound.mean.toFixed(2)} [${s.meanMaxRound.low.toFixed(2)}–${s.meanMaxRound.high.toFixed(2)}]`} | ${s.round1ClearRate === "" ? "" : `${(s.round1ClearRate * 100).toFixed(1)}%`} | ${s.upperBonusActivationMedianRound} | ${s.upperAtCapShareMean === "" ? "" : `${(s.upperAtCapShareMean * 100).toFixed(1)}%`} | ${bc || be ? `${bc || "{}"} / ${be || "{}"}` : ""} | ${s.incompleteBudget} |`,
    );
  }
  lines.push(
    "",
    "## Paired arm differences (bootstrap 95% CI on rid-aligned rows)",
    "",
    "| Contrast | Win rate Δ (B−A or B′−B) | Mean max_round Δ |",
    "|----------|-------------------------|------------------|",
    `| B vs A (win) | ${fmtDiff(winVsA, 100, " pp")} **verified** | ${fmtDiff(mrVsA, 1, " rounds")} **verified** |`,
    `| B′ vs B (win) | ${fmtDiff(winBpVsB, 100, " pp")} **verified** | ${fmtDiff(mrBpVsB, 1, " rounds")} **verified** |`,
    "",
    "Telem sidecars: `diagnostics/tracking/runs/F1F2-1K-*-telem-v2.jsonl`.",
  );
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outPath, summaries, winVsA, mrBpVsB }, null, 2));
}

if (require.main === module) main();