#!/usr/bin/env node
"use strict";
/**
 * Summarize pilot CSV rows for EXP-F1F2 experiment note.
 * Usage: node scripts/diagnostics-pilot-report.cjs path/to.csv [path2 ...]
 */
const fs = require("node:fs");
const path = require("node:path");

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

function wilsonCi(wins, n, z = 1.96) {
  if (!n) return { low: "", high: "", p: "" };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return { p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function bootstrapMeanCi(values, samples = 2000, alpha = 0.05) {
  if (!values.length) return { mean: "", low: "", high: "" };
  const n = values.length;
  const means = [];
  for (let s = 0; s < samples; s += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      sum += values[Math.floor(Math.random() * n)];
    }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const low = means[Math.floor((alpha / 2) * samples)];
  const high = means[Math.floor((1 - alpha / 2) * samples)];
  return { mean, low, high };
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[s.length / 2] : (s[m - 1] + s[m]) / 2;
}

function analyzeRows(rows, label) {
  const natural = rows.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
  const wins = natural.filter((r) => r.outcome === "WIN").length;
  const wil = wilsonCi(wins, natural.length);
  const maxRounds = natural.map((r) => Number(r.max_round)).filter((n) => Number.isFinite(n));
  const mr = bootstrapMeanCi(maxRounds);
  const r1Clear = rows.filter((r) => Number(r.max_round) >= 1); // placeholder — needs telem digest
  return {
    label,
    n: rows.length,
    naturalN: natural.length,
    wins,
    winRateWilson: wil,
    meanMaxRound: mr,
    incompleteBudget: rows.filter((r) => r.outcome === "INCOMPLETE:BUDGET").length,
    r1ClearRate: "",
    upperBonusMedianRound: "",
    upperCapShare: "",
    bossClears: "",
    note: "Aggregate metrics from CSV; telem-derived fields require replay JSON (not in CSV).",
  };
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: node scripts/diagnostics-pilot-report.cjs file.csv ...");
    process.exit(1);
  }
  const out = files.map((f) => analyzeRows(parseCsv(fs.readFileSync(f, "utf8")), path.basename(f)));
  console.log(JSON.stringify(out, null, 2));
}

if (require.main === module) main();