#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function wilson(wins, n, z = 1.96) {
  if (!n) return { p: "", low: "", high: "" };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function bootstrapMean(values, reps = 2500) {
  if (!values.length) return { mean: "", low: "", high: "" };
  const n = values.length;
  const samples = [];
  for (let r = 0; r < reps; r += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += values[Math.floor(Math.random() * n)];
    samples.push(s / n);
  }
  samples.sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return { mean, low: samples[Math.floor(0.025 * reps)], high: samples[Math.floor(0.975 * reps)] };
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[s.length / 2] : (s[m - 1] + s[m]) / 2;
}

function readTelem(batchId) {
  const p = path.join(RUNS, `${batchId}.telem.jsonl`);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").trim().split(/\n/).filter(Boolean).map((l) => JSON.parse(l));
}

function summarizeArm(batchId, label) {
  const csv = path.join(RUNS, `${batchId}.csv`);
  const rows = parseCsv(fs.readFileSync(csv, "utf8"));
  const telem = readTelem(batchId);
  const natural = rows.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
  const wins = natural.filter((r) => r.outcome === "WIN").length;
  const w = wilson(wins, natural.length);
  const maxRounds = natural.map((r) => Number(r.max_round)).filter(Number.isFinite);
  const mr = bootstrapMean(maxRounds);
  let r1 = telem.filter((t) => t.round1_cleared).length;
  let r1Rate = telem.length ? r1 / telem.length : "";
  if (telem.length && r1 === 0) {
    const fromCsv = natural.filter((r) => Number(r.max_round) >= 2).length;
    if (fromCsv > 0) {
      r1 = fromCsv;
      r1Rate = fromCsv / natural.length;
    }
  }
  const ubRounds = telem.map((t) => t.upper_bonus_activation?.round).filter(Number.isFinite);
  const capShares = telem.map((t) => t.upper_at_cap_share).filter((x) => x != null);
  const capMean = capShares.length
    ? capShares.reduce((a, b) => a + b, 0) / capShares.length
    : "";
  const bossClears = {};
  for (const t of telem) {
    for (const [k, v] of Object.entries(t.boss_clears || {})) {
      bossClears[k] = (bossClears[k] || 0) + Number(v);
    }
  }
  return {
    label,
    batchId,
    n: rows.length,
    naturalDenominator: natural.length,
    wins,
    winRate: w,
    meanMaxRound: mr,
    round1ClearRate: r1Rate,
    upperBonusActivationMedianRound: ubRounds.length ? median(ubRounds) : "",
    upperAtCapShareMean: capMean,
    bossClears,
    incompleteBudget: rows.filter((r) => r.outcome === "INCOMPLETE:BUDGET").length,
  };
}

function main() {
  const arms = [
    { batchId: "F1F2-PILOT-c36f3b4-pre", label: "A c36f3b4-pre" },
    { batchId: "F1F2-PILOT-6f4dc92-main", label: "B 6f4dc92-main" },
    { batchId: "F1F2-PILOT-6f4dc92-Bp", label: "B′ 6f4dc92-Bp" },
  ];
  const summaries = arms.map((a) => summarizeArm(a.batchId, a.label));
  const outPath = path.join(ROOT, "diagnostics/tracking/experiments/EXP-F1F2-20261125-pilot.md");
  const lines = [
    "# EXP-F1F2 pilot (100 runs × 3 arms)",
    "",
    "Date: 2026-11-25. Rids `0-49,60-109` (holdouts 55–59 excluded). `max_steps=6000`, Street Rat builder, policy `2026-11-11-phase-b-v1`.",
    "",
    "**Caveats:** DEF-M-005 reproducibility **parked** (tentative cross-run parity). Arm A `c36f3b4-pre` has weaker cross-arm RNG parity (tentative). Pilot CSV outcomes **verified**. Telem sidecars from the first pilot pass were empty (**DEF-M-009**); aggregate upper/boss columns below are **tentative** (proxy R1 clear = share with `max_round`≥2 when jsonl `round_cleared` missing).",
    "",
    "| Arm | n | Wins | Win rate Wilson 95% | Mean max_round (bootstrap 95% CI) | R1 clear rate | Upper bonus on (median round) | Upper-at-cap share (mean) | Boss clears (sum) | INCOMPLETE:BUDGET |",
    "|-----|---|------|-------------------|----------------------------------|---------------|--------------------------------|---------------------------|-------------------|-------------------|",
  ];
  for (const s of summaries) {
    const wr = s.winRate.p === "" ? "" : `${(s.winRate.p * 100).toFixed(1)}% [${(s.winRate.low * 100).toFixed(1)}–${(s.winRate.high * 100).toFixed(1)}]`;
    const mr = s.meanMaxRound.mean === "" ? "" : `${s.meanMaxRound.mean.toFixed(2)} [${s.meanMaxRound.low.toFixed(2)}–${s.meanMaxRound.high.toFixed(2)}]`;
    const bc = Object.keys(s.bossClears).length ? JSON.stringify(s.bossClears) : "";
    lines.push(
      `| ${s.label} | ${s.naturalDenominator} | ${s.wins} | ${wr} | ${mr} | ${s.round1ClearRate === "" ? "" : (s.round1ClearRate * 100).toFixed(1) + "%"} | ${s.upperBonusActivationMedianRound} | ${s.upperAtCapShareMean === "" ? "" : (s.upperAtCapShareMean * 100).toFixed(1) + "%"} | ${bc} | ${s.incompleteBudget} |`,
    );
  }
  lines.push("", "## Sanity (F2 revert)", "");
  lines.push("- **Verified:** unit fixture — SIXES `[6,6,6,1,2]` with `runUpperHeat=70`: main total **54** (mult 3) vs Bp **45** (mult 2.5); see `tests/diagnostics/f2-scoring-variant.test.cjs`.");
  lines.push("- **Verified (DEF-M-008):** Bp arm uses harness root + `SIM_SCORING_VARIANT=F2_REVERT` (not split worktree telemetry).");
  lines.push("- **Verified (DEF-M-009):** first pilot telem.jsonl sidecars were empty; rebuilt via `scripts/rebuild-telem-jsonl.cjs` without re-appending CSV.");
  lines.push("- **Tentative:** Playwright paired rids 0–9 rarely activate upper bonus on short busts; aggregate max_round parity before fix was a measurement artifact.");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outPath, summaries }, null, 2));
}

if (require.main === module) main();