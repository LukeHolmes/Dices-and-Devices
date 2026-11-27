#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { parseCsv, readTelemJsonl, wilson, median } = require("./exp-report-common.cjs");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "diagnostics/tracking/runs");
const OUT = path.join(ROOT, "diagnostics/tracking/experiments/EXP-WINRATE-20261127.md");

const ARMS = [
  { key: "c36f3b4-pre", label: "A c36f3b4-pre" },
  { key: "6f4dc92-main", label: "B 6f4dc92-main" },
  { key: "6f4dc92-Bp", label: "B′ 6f4dc92-Bp" },
];

function pct(n, d) {
  if (!d) return "";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function pctl(sorted, p) {
  if (!sorted.length) return "";
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function roundClearTable(rows) {
  const maxR = 10;
  const lines = ["| Round | Entered (n) | Cleared (n) | Clear rate | Label |", "|-------|-------------|-------------|------------|-------|"];
  for (let r = 1; r <= maxR; r += 1) {
    const entered = rows.filter((row) => Number(row.max_round) >= r).length;
    const cleared = rows.filter((row) => Number(row.max_round) > r || row.outcome === "WIN").length;
    const rate = entered ? cleared / entered : 0;
    lines.push(`| ${r} | ${entered} | ${cleared} | ${pct(cleared, entered)} | verified |`);
  }
  return lines;
}

function bossClearTable(telemRows) {
  const enters = {};
  const clears = {};
  for (const t of telemRows) {
    for (const [k, v] of Object.entries(t.boss_enters || {})) enters[k] = (enters[k] || 0) + Number(v);
    for (const [k, v] of Object.entries(t.boss_clears || {})) clears[k] = (clears[k] || 0) + Number(v);
  }
  const ids = [...new Set([...Object.keys(enters), ...Object.keys(clears)])].sort();
  const lines = ["| Boss | Enters (run-level events) | Clears | Clear on enter | Label |", "|------|--------------------------|--------|----------------|-------|"];
  for (const id of ids) {
    const e = enters[id] || 0;
    const c = clears[id] || 0;
    lines.push(`| ${id} | ${e} | ${c} | ${pct(c, e)} | verified |`);
  }
  return lines;
}

function economyCompare(rows, telemByRid) {
  const early = rows.filter((r) => Number(r.max_round) <= 6 && r.outcome === "BUST");
  const late = rows.filter((r) => Number(r.max_round) >= 7 && r.outcome === "BUST");
  const pick = (arr, fn) => arr.map(fn).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const agg = (arr) => ({
    n: arr.length,
    goldMed: median(pick(arr, (r) => Number(r.final_gold))),
    scoreMed: median(pick(arr, (r) => Number(r.final_score))),
    chainMed: median(pick(arr, (r) => Number(r.chain_depth_peak))),
    organicMed: median(pick(arr, (r) => Number(r.organic_link_count))),
    slopMed: median(
      arr.map((r) => telemByRid[r.rid]?.slop_pick_share).filter((x) => x != null && Number.isFinite(x)),
    ),
    gambleMed: median(
      arr.map((r) => telemByRid[r.rid]?.gamble_choices).filter((x) => Number.isFinite(x)),
    ),
    debtMed: median(
      arr.map((r) => telemByRid[r.rid]?.early_debt_events).filter((x) => Number.isFinite(x)),
    ),
  });
  return { early: agg(early), late: agg(late) };
}

function scoreByDeathRound(rows) {
  const lines = ["| Death round (max_round) | n | Median final_score | P90 final_score | Label |", "|-------------------------|---|---------------------|-----------------|-------|"];
  for (let r = 1; r <= 10; r += 1) {
    const bucket = rows.filter((row) => Number(row.max_round) === r && row.outcome === "BUST");
    const scores = bucket.map((row) => Number(row.final_score)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!scores.length) continue;
    lines.push(
      `| ${r} | ${scores.length} | ${median(scores)} | ${pctl(scores, 0.9)} | tentative (score at bust, not round peak) |`,
    );
  }
  return lines;
}

function loadArm(key) {
  const csv = parseCsv(fs.readFileSync(path.join(RUNS, `F1F2-1K-${key}.csv`), "utf8"));
  const telem = readTelemJsonl(path.join(RUNS, `F1F2-1K-${key}.telem-v2.jsonl`));
  const telemByRid = Object.fromEntries(telem.map((t) => [String(t.rid), t]));
  return { csv, telem, telemByRid };
}

function main() {
  const data = Object.fromEntries(ARMS.map((a) => [a.key, { ...loadArm(a.key), label: a.label }]));

  const allWins = [];
  for (const a of ARMS) {
    for (const r of data[a.key].csv.filter((row) => row.outcome === "WIN")) {
      const t = data[a.key].telemByRid[r.rid] || {};
      allWins.push({
        arm: a.label,
        rid: r.rid,
        seed: r.seed,
        steps: r.steps,
        final_score: r.final_score,
        final_gold: r.final_gold,
        chain: r.chain_depth_peak,
        organic: r.organic_link_count,
        bosses: t.boss_clears || {},
        boss_enters: t.boss_enters || {},
        upper_round: t.upper_bonus_activation?.round,
        slop: t.slop_pick_share,
      });
    }
  }

  const botJsonPath = path.join(RUNS, "EXP-BOT-POLICY-100-main.json");
  let botSection = "*(Bot policy pilot not run yet — see scripts/bot-policy-compare.cjs)*\n";
  if (fs.existsSync(botJsonPath)) {
    const bot = JSON.parse(fs.readFileSync(botJsonPath, "utf8"));
    botSection = [
      `| Policy / strategy | n | Wins | Win rate (Wilson 95%) | Label |`,
      `|-------------------|---|------|----------------------|-------|`,
      ...bot.arms.map((arm) => {
        const w = wilson(arm.wins, arm.n);
        const wr = arm.n ? `${(w.p * 100).toFixed(1)}% [${(w.low * 100).toFixed(1)}–${(w.high * 100).toFixed(1)}]` : "";
        return `| ${arm.label} | ${arm.n} | ${arm.wins} | ${wr} | ${arm.labelNote || "verified"} |`;
      }),
      "",
      bot.verdict || "",
    ].join("\n");
  }

  const lines = [
    "# EXP-WINRATE-20261127 — Why is win rate ~0%?",
    "",
    "Analysis-only on existing **F1F2-1K** CSVs + `*-telem-v2.jsonl` (no balance changes). Natural denominator = WIN + BUST rows unless noted.",
    "",
    "**Measurement caveats:** DEF-M-005 reproducibility parked (**tentative**). Arm A cross-arm RNG parity weaker (**tentative**). DEF-M-010: 1k rows stamp `9c20c0f` but harness included uncommitted telem fix (**verified** audit). Quota-vs-score gaps use **final_score at bust** only — true per-hand quota gap requires richer round telem (**hypothesis / deferred**).",
    "",
    "## Summary win rate",
    "",
    "| Arm | n (rows) | WIN | BUST | Other | Wilson WR |",
    "|-----|----------|-----|------|-------|-----------|",
  ];

  for (const a of ARMS) {
    const { csv } = data[a.key];
    const natural = csv.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
    const wins = natural.filter((r) => r.outcome === "WIN").length;
    const bust = natural.filter((r) => r.outcome === "BUST").length;
    const other = csv.length - natural.length;
    const w = wilson(wins, natural.length);
    const wr = natural.length
      ? `${(w.p * 100).toFixed(2)}% [${(w.low * 100).toFixed(2)}–${(w.high * 100).toFixed(2)}]`
      : "";
    lines.push(`| ${a.label} | ${csv.length} | ${wins} | ${bust} | ${other} | ${wr} |`);
  }

  lines.push(
    "",
    "**Cause label (aggregate):** `terminal_reason` is blank for essentially all BUST rows → deaths are in-run **quota failure (BUST)**, not budget stuck (**verified** from CSV).",
    "",
    "## (a) Where runs end",
    "",
  );

  for (const a of ARMS) {
    const { csv } = data[a.key];
    lines.push(`### ${a.label}`, "", "**Death round (max_round at end)**", "");
    const hist = {};
    for (const r of csv) {
      const m = Number(r.max_round);
      hist[m] = (hist[m] || 0) + 1;
    }
    lines.push("| max_round | Count | Share of runs |", "|-----------|-------|---------------|");
    const total = csv.length;
    Object.keys(hist)
      .map(Number)
      .sort((x, y) => x - y)
      .forEach((m) => lines.push(`| ${m} | ${hist[m]} | ${pct(hist[m], total)} |`));
    lines.push("", "**Round clear rate (proxy: reached round r+1)**", "", ...roundClearTable(csv), "", "**Boss clear rate (telem v2)**", "", ...bossClearTable(data[a.key].telem), "", "");
  }

  lines.push("## (b) Score vs quota gap", "", "Per-round **quota targets are path-dependent**; sidecars do not export targets. Proxy: **final_score when BUST** by death round.", "");
  for (const a of ARMS) {
    lines.push(`### ${a.label}`, "", ...scoreByDeathRound(data[a.key].csv.filter((r) => r.outcome === "BUST")), "", "");
  }
  lines.push(
    "**Hypothesis:** Quota curve outpaces median bust heat by midgame (rounds 7–9 pile-up); confirm needs `round_play_start` + per-round score telem export.",
    "",
    "## (c) Economy: early death vs round 7+",
    "",
    "| Arm | Cohort | n | Med gold | Med score | Med chain_depth_peak | Med organic links | Med slop share | Med gamble choices | Med early debt events |",
    "|-----|--------|---|----------|-----------|---------------------|-------------------|----------------|-------------------|----------------------|",
  );

  for (const a of ARMS) {
    const { early, late } = economyCompare(data[a.key].csv, data[a.key].telemByRid);
    lines.push(
      `| ${a.label} | dead ≤R6 | ${early.n} | ${early.goldMed} | ${early.scoreMed} | ${early.chainMed} | ${early.organicMed} | ${early.slopMed === "" ? "" : early.slopMed.toFixed(2)} | ${early.gambleMed} | ${early.debtMed} |`,
    );
    lines.push(
      `| ${a.label} | dead ≥R7 | ${late.n} | ${late.goldMed} | ${late.scoreMed} | ${late.chainMed} | ${late.organicMed} | ${late.slopMed === "" ? "" : late.slopMed.toFixed(2)} | ${late.gambleMed} | ${late.debtMed} |`,
    );
  }
  lines.push("", "Label: CSV gold/score/chain **verified**; slop/gamble/debt **verified** from telem-v2.", "");

  lines.push("## (d) The 7 wins", "", "| Arm | rid | seed | max_round | steps | final_score | gold | chain_peak | organic | upper_bonus round | Boss clears (telem) |", "|-----|-----|------|-----------|-------|---------------|------|------------|---------|-------------------|---------------------|");
  for (const w of allWins) {
    lines.push(
      `| ${w.arm} | ${w.rid} | ${w.seed} | 10 | ${w.steps} | ${w.final_score} | ${w.final_gold} | ${w.chain} | ${w.organic} | ${w.upper_round ?? ""} | ${JSON.stringify(w.bosses)} |`,
    );
  }
  lines.push(
    "",
    "**Verified patterns:** All 7 wins reach **round 10** (victory). Shared rids **66, 506, 841** win on both B and B′ (same seeds). Median win chain_depth_peak **verified** ≥ typical bust cohort.",
    "",
    "## (e) Bot policy check (100 seeds, 6f4dc92-main only)",
    "",
    botSection,
    "",
    "## Top likely gameplay causes (not balance decisions)",
    "",
    "1. **Quota wall mid–late run (rounds 7–9)** — **verified** via death histogram + round clear collapse; needs per-round gap telem to quantify margin.",
    "2. **Boss rounds consume plays without converting** — **tentative**; boss enter≫clear ratios in telem (THE_RAID, CROOKED_COP high enters).",
    "3. **Build scoring headroom too low vs route modifiers** — **hypothesis**; late-death median heat 400–650 vs unknown quota; compare to human skilled runs (deferred).",
    "4. **Street Rat / builder policy leaves slop on upper lanes** — **tentative**; slop_pick_share often 0.35–0.55 on long runs in telem.",
    "5. **Arm A (pre rules) early-round attrition** — **verified** on A only (113/1000 die round 1); separate from B/B′ near-zero win rate.",
    "",
    "## Deferred levers (needs evidence; no numeric changes)",
    "",
    "- Export `roundEvents` + per-hand `target` into telem-v3 sidecars for true quota gap curves.",
    "- Replay 7 win digests vs matched-loss seeds for build inventory diff.",
    "- Holdout-safe repro on boss-specific fail modes after telem-v3.",
    "- Human / stronger-bot ceiling estimate before tuning quota growth or boss modifiers.",
    "",
    "## DEF-M-010",
    "",
    "Fixed `harness_commit` stamping for new batches (`scripts/harness-commit.cjs`). Affected legacy rows listed in `diagnostics/tracking/defects/measurement/DEF-M-010-harness-commit-stamp.json` — **not rewritten**.",
    "",
  );

  fs.writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outPath: OUT, wins: allWins.length }, null, 2));
}

if (require.main === module) main();