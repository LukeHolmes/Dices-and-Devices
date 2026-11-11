"use strict";
/**
 * Fixed 0–49 builder summary for policy revision tagging (no holdout).
 * Output: /opt/cursor/artifacts/sim-policy-compare.json
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const policyRevision = process.env.SIM_POLICY_REVISION || "2026-11-11-phase-b-v1";
const logPath = `/opt/cursor/artifacts/sim-policy-${policyRevision}.log`;
const r = spawnSync("npm", ["run", "sim:50", "--", "--games=50", "--max-steps=12000", "--parallel=4"], {
  cwd: ROOT,
  env: { ...process.env, SIM_POLICY_REVISION: policyRevision },
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
fs.writeFileSync(logPath, r.stdout + "\n" + r.stderr);
const jsonStart = (r.stdout || "").lastIndexOf("{");
let summary = null;
if (jsonStart >= 0) {
  try {
    summary = JSON.parse(r.stdout.slice(jsonStart));
  } catch (_) {
    summary = null;
  }
}
const out = {
  policyRevision,
  at: new Date().toISOString(),
  exit: r.status,
  summary,
  logPath,
  holdoutLocked: "tests/fixtures/holdout-seeds-lock.json",
};
fs.writeFileSync("/opt/cursor/artifacts/sim-policy-compare.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
process.exit(r.status ?? 0);
