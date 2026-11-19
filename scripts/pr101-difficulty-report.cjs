#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");
const OUT = path.join(ROOT, "diagnostics/tracking/experiments/EXP-PR101-difficulty-20261119.md");

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") {
        cols.push(cur);
        cur = "";
      } else cur += c;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function wilson(successes, n, z = 1.96) {
  if (!n) return { lo: null, hi: null, p: null };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: center - margin, hi: center + margin };
}

function bootstrapMean(samples, iters = 2000) {
  if (!samples.length) return { mean: null, lo: null, hi: null };
  const means = [];
  const n = samples.length;
  for (let i = 0; i < iters; i += 1) {
    let s = 0;
    for (let j = 0; j < n; j += 1) s += samples[Math.floor(Math.random() * n)];
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  return {
    mean,
    lo: means[Math.floor(0.025 * iters)],
    hi: means[Math.floor(0.975 * iters)],
  };
}

function twoProportionZ(winsA, nA, winsB, nB) {
  if (!nA || !nB) return { z: null, p: null };
  const p1 = winsA / nA;
  const p2 = winsB / nB;
  const p = (winsA + winsB) / (nA + nB);
  const se = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
  if (!se) return { z: null, p: null };
  const z = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p: pValue, delta: p1 - p2 };
}

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d
    * t
    * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

function analyzeRows(rows) {
  const budgetExcluded = rows.filter((r) => r.outcome === "INCOMPLETE:BUDGET");
  const scored = rows.filter((r) => r.outcome !== "INCOMPLETE:BUDGET");
  const wins = scored.filter((r) => r.outcome === "WIN").length;
  const maxRounds = scored.map((r) => Number(r.max_round)).filter(Number.isFinite);
  const winCi = wilson(wins, scored.length);
  const roundCi = bootstrapMean(maxRounds);

  const bossAgg = {};
  for (const r of scored) {
    let boss = {};
    try {
      boss = JSON.parse(r.boss_stats_json || "{}");
    } catch {
      boss = {};
    }
    for (const [id, st] of Object.entries(boss)) {
      bossAgg[id] = bossAgg[id] || { entered: 0, cleared: 0 };
      bossAgg[id].entered += st.entered || 0;
      bossAgg[id].cleared += st.cleared || 0;
    }
  }
  const bossClearRates = {};
  for (const [id, st] of Object.entries(bossAgg)) {
    bossClearRates[id] = st.entered ? { rate: st.cleared / st.entered, ...wilson(st.cleared, st.entered) } : { rate: null };
  }

  const bustRounds = scored.filter((r) => r.outcome === "BUST").map((r) => Number(r.bust_round || r.max_round)).filter(Number.isFinite);
  const bustHist = {};
  for (const b of bustRounds) bustHist[b] = (bustHist[b] || 0) + 1;

  const shopsR14 = scored.filter((r) => Number(r.shop_visits_r1_4) > 0);
  const saltsHits = scored.filter((r) => r.salts_offered_r1_4 !== "" && Number(r.salts_offered_r1_4) > 0).length;
  const saltsShare = shopsR14.length ? saltsHits / shopsR14.length : null;
  const saltsCi = shopsR14.length ? wilson(saltsHits, shopsR14.length) : { lo: null, hi: null, p: null };

  return {
    totalRuns: rows.length,
    budgetExcluded: budgetExcluded.length,
    denominator: scored.length,
    wins,
    winRate: winCi,
    meanRounds: roundCi,
    bossClearRates,
    bustHist,
    saltsShare: { p: saltsShare, ...saltsCi },
    shopsR14Denominator: shopsR14.length,
  };
}

function loadArm(arm) {
  const p = path.join(RUNS, `DIFF-PR101-20261119-${arm}.csv`);
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
  return parseCsv(fs.readFileSync(p, "utf8"));
}

function main() {
  const oldA = analyzeRows(loadArm("old"));
  const newA = analyzeRows(loadArm("new"));
  const ztest = twoProportionZ(oldA.wins, oldA.denominator, newA.wins, newA.denominator);

  const md = `# EXP-PR101-difficulty-20261119

Rules: **OLD** \`7d649ef\` (pre-PR #101) vs **NEW** \`df7b4e2\` (post-PR #101 merge). Harness: seeded Street Rat + safe-cut gambit, policy \`2026-11-11-phase-b-v1\`, 12 000 steps, rids 0–49 & 60–109 (holdouts 55–59 excluded). No LLM.

## Verified

- Batch CSVs: \`diagnostics/tracking/runs/DIFF-PR101-20261119-old.csv\`, \`...-new.csv\`
- Budget exhaustions excluded from denominators (counted separately below)

## Tentative (DEF-M-005 non-repro adds noise)

Small win-rate deltas are **not conclusive** without 20/20 repro on harness timing.

### Win rate (95% Wilson on scored runs)

| Arm | Wins | Denominator (excl. budget) | Rate | 95% CI |
|-----|------|------------------------------|------|--------|
| OLD | ${oldA.wins} | ${oldA.denominator} | ${((oldA.winRate.p ?? 0) * 100).toFixed(1)}% | ${oldA.winRate.lo != null ? `[${(oldA.winRate.lo * 100).toFixed(1)}%, ${(oldA.winRate.hi * 100).toFixed(1)}%]` : "n/a"} |
| NEW | ${newA.wins} | ${newA.denominator} | ${((newA.winRate.p ?? 0) * 100).toFixed(1)}% | ${newA.winRate.lo != null ? `[${(newA.winRate.lo * 100).toFixed(1)}%, ${(newA.winRate.hi * 100).toFixed(1)}%]` : "n/a"} |

Two-proportion test (win rate OLD vs NEW): Δ=${ztest.delta != null ? `${(ztest.delta * 100).toFixed(2)} pp` : "n/a"}, z=${ztest.z?.toFixed(3) ?? "n/a"}, two-sided p=${ztest.p?.toFixed(4) ?? "n/a"}.

### Mean max round (bootstrap 95% CI, scored runs)

| Arm | Mean | 95% CI |
|-----|------|--------|
| OLD | ${oldA.meanRounds.mean?.toFixed(2) ?? "n/a"} | ${oldA.meanRounds.lo != null ? `[${oldA.meanRounds.lo.toFixed(2)}, ${oldA.meanRounds.hi.toFixed(2)}]` : "n/a"} |
| NEW | ${newA.meanRounds.mean?.toFixed(2) ?? "n/a"} | ${newA.meanRounds.lo != null ? `[${newA.meanRounds.lo.toFixed(2)}, ${newA.meanRounds.hi.toFixed(2)}]` : "n/a"} |

### Boss clear rate (cleared / entered, Wilson per boss id)

OLD: \`${JSON.stringify(oldA.bossClearRates)}\`

NEW: \`${JSON.stringify(newA.bossClearRates)}\`

### Bust round distribution (scored busts)

OLD: \`${JSON.stringify(oldA.bustHist)}\`

NEW: \`${JSON.stringify(newA.bustHist)}\`

### Salts offer share (runs with R1–4 shop visit where kit stock listed SMELLING_SALTS; may under-count full shop)

| Arm | Offer share | Denominator (shop visits r1–4) | 95% CI |
|-----|-------------|-----------------------------------|--------|
| OLD | ${oldA.saltsShare.p != null ? `${(oldA.saltsShare.p * 100).toFixed(1)}%` : "blank/n/a"} | ${oldA.shopsR14Denominator} | ${oldA.saltsShare.lo != null ? `[${(oldA.saltsShare.lo * 100).toFixed(1)}%, ${(oldA.saltsShare.hi * 100).toFixed(1)}%]` : "n/a"} |
| NEW | ${newA.saltsShare.p != null ? `${(newA.saltsShare.p * 100).toFixed(1)}%` : "blank/n/a"} | ${newA.shopsR14Denominator} | ${newA.saltsShare.lo != null ? `[${(newA.saltsShare.lo * 100).toFixed(1)}%, ${(newA.saltsShare.hi * 100).toFixed(1)}%]` : "n/a"} |

### Budget exclusions

| Arm | Excluded INCOMPLETE:BUDGET | Total runs |
|-----|---------------------------|------------|
| OLD | ${oldA.budgetExcluded} | ${oldA.totalRuns} |
| NEW | ${newA.budgetExcluded} | ${newA.totalRuns} |

## Decision summary

${ztest.delta != null && Math.abs(ztest.delta) >= 0.03 ? "Observed win-rate shift exceeds ~3pp; treat as directional pending harness repro." : "No strong win-rate separation at this sample size; difficulty change inconclusive."} Instrumented hook-off parity remains unresolved (DEF-M-005 parked).

`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(JSON.stringify({ out: OUT, old: oldA, new: newA, ztest }, null, 2));
}

if (require.main === module) main();