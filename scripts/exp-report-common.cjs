#!/usr/bin/env node
"use strict";
const fs = require("node:fs");

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
  if (!nums.length) return "";
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function readTelemJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").trim().split(/\n/).filter(Boolean).map((l) => JSON.parse(l));
}

function summarizeArmFromCsvAndTelem({ csvPath, telemPath, label, capDefault = 3, telemVerified = true }) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const telem = readTelemJsonl(telemPath);
  const telemByRid = Object.fromEntries(telem.map((t) => [t.rid, t]));
  const natural = rows.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
  const wins = natural.filter((r) => r.outcome === "WIN").length;
  const w = wilson(wins, natural.length);
  const maxRounds = natural.map((r) => Number(r.max_round)).filter(Number.isFinite);
  const mr = bootstrapMean(maxRounds);
  let r1 = telem.filter((t) => t.round1_cleared).length;
  let r1Rate = telem.length ? r1 / telem.length : "";
  const ubRounds = telem.map((t) => t.upper_bonus_activation?.round).filter(Number.isFinite);
  const capShares = telem
    .map((t) => t.upper_at_cap_share)
    .filter((x) => x != null && Number.isFinite(x));
  const capMean = capShares.length ? capShares.reduce((a, b) => a + b, 0) / capShares.length : "";
  const bossClears = {};
  const bossEnters = {};
  for (const t of telem) {
    for (const [k, v] of Object.entries(t.boss_clears || {})) {
      bossClears[k] = (bossClears[k] || 0) + Number(v);
    }
    for (const [k, v] of Object.entries(t.boss_enters || {})) {
      bossEnters[k] = (bossEnters[k] || 0) + Number(v);
    }
  }
  const handsWithTelem = telem.filter((t) => (t.upper_after_bonus_hands || 0) > 0 || t.round1_cleared).length;
  const telemQuality = telemVerified && telem.length && handsWithTelem > natural.length * 0.1 ? "verified" : "tentative";
  return {
    label,
    n: rows.length,
    naturalDenominator: natural.length,
    wins,
    winRate: w,
    meanMaxRound: mr,
    round1ClearRate: r1Rate,
    round1ClearLabel: telemQuality,
    upperBonusActivationMedianRound: ubRounds.length ? median(ubRounds) : "",
    upperBonusLabel: ubRounds.length ? telemQuality : "tentative",
    upperAtCapShareMean: capMean,
    upperCapLabel: capShares.length ? telemQuality : "tentative",
    bossClears,
    bossEnters,
    bossLabel: Object.keys(bossClears).length ? telemQuality : "tentative",
    incompleteBudget: rows.filter((r) => r.outcome === "INCOMPLETE:BUDGET").length,
    harnessCommits: [...new Set(telem.map((t) => t.harness_commit).filter(Boolean))],
    telemPath,
  };
}

function pairedDiffBootstrap(maps, keyFn, reps = 2500) {
  const rids = Object.keys(maps.a).filter((rid) => maps.b[rid] != null);
  const diffs = rids
    .map((rid) => keyFn(maps.a[rid]) - keyFn(maps.b[rid]))
    .filter((d) => Number.isFinite(d));
  if (!diffs.length) return { mean: "", low: "", high: "", n: 0 };
  const n = diffs.length;
  const samples = [];
  for (let r = 0; r < reps; r += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += diffs[Math.floor(Math.random() * n)];
    samples.push(s / n);
  }
  samples.sort((a, b) => a - b);
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  return { mean, low: samples[Math.floor(0.025 * reps)], high: samples[Math.floor(0.975 * reps)], n };
}

function csvMapsByRid(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const m = {};
  for (const r of rows) {
    if (r.outcome !== "WIN" && r.outcome !== "BUST") continue;
    m[Number(r.rid)] = r;
  }
  return m;
}

module.exports = {
  parseCsv,
  wilson,
  bootstrapMean,
  median,
  readTelemJsonl,
  summarizeArmFromCsvAndTelem,
  pairedDiffBootstrap,
  csvMapsByRid,
};