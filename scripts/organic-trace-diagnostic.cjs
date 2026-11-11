"use strict";
/**
 * Diagnostic-only organic traces (retries excluded from regression gates).
 * Usage: node scripts/organic-trace-diagnostic.cjs [rid] [maxAttempts]
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const rid = Number(process.argv[2] || 16);
const maxAttempts = Number(process.argv[3] || 3);
const trace = path.join(__dirname, "organic-milestone-trace.cjs");
const steps = process.env.MILESTONE_STEPS || "40000";
const rows = [];

for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
  const outPath = `/opt/cursor/artifacts/organic-diag-rid${rid}-a${attempt}.json`;
  const r = spawnSync(process.execPath, [trace, String(rid)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MILESTONE_STEPS: steps,
      MILESTONE_OUT: outPath,
      ORGANIC_TRACE_ATTEMPT: String(attempt),
    },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const payload = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : null;
  rows.push({
    attempt,
    diagnostic: true,
    exit: r.status,
    pairwiseLinks: payload?.pairwiseLinks?.length || 0,
    organicReady: !!payload?.organicReady,
    handsRecorded: payload?.handsRecorded || 0,
    outcome: payload?.result?.outcome,
    steps: payload?.result?.steps,
  });
}
const report = { rid, steps, rows, excludedFromFrequencyGates: true };
const out = "/opt/cursor/artifacts/organic-trace-diagnostic.json";
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exit(0);
