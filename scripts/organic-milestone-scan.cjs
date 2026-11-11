"use strict";
/**
 * Scan seeded builder milestones until one records a production pairwise link.
 * Usage: node scripts/organic-milestone-scan.cjs [startRid] [count]
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const start = Number(process.argv[2] || 0);
const count = Number(process.argv[3] || 32);
const script = path.join(__dirname, "organic-milestone-trace.cjs");
const steps = process.env.MILESTONE_STEPS || "40000";
const parallel = Math.max(1, Math.min(6, Number(process.env.MILESTONE_PARALLEL || 4)));

function traceOne(rid) {
  return new Promise((resolve) => {
    const outPath = `/opt/cursor/artifacts/organic-milestone-rid${rid}.json`;
    const child = spawn(process.execPath, [script, String(rid)], {
      env: {
        ...process.env,
        MILESTONE_STEPS: steps,
        MILESTONE_OUT: outPath,
      },
      stdio: "ignore",
    });
    child.on("close", (status) => {
      if (!fs.existsSync(outPath)) {
        resolve(null);
        return;
      }
      const report = JSON.parse(fs.readFileSync(outPath, "utf8"));
      const pairs = (report.pairwiseLinks || []).length;
      if (status === 0 && pairs >= 1) {
        resolve({ rid, report, exit: status });
        return;
      }
      resolve(null);
    });
  });
}

async function main() {
  let winner = null;
  let scanned = 0;
  for (let base = start; base < start + count && !winner; base += parallel) {
    const batch = [];
    for (let i = 0; i < parallel && base + i < start + count; i++) {
      batch.push(base + i);
    }
    const results = await Promise.all(batch.map((rid) => traceOne(rid)));
    scanned += batch.length;
    winner = results.find(Boolean) || null;
  }
  const summary = {
    start,
    count,
    steps,
    parallel,
    winner,
    scanned: winner ? winner.rid - start + 1 : scanned,
  };
  fs.writeFileSync("/opt/cursor/artifacts/organic-milestone-scan.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(winner ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
