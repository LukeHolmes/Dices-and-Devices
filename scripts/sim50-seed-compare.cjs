"use strict";
/** Compare two sim JSON summaries (fixed rid 0–49, same harness). */
const fs = require("node:fs");
const path = require("node:path");

const beforePath = process.argv[2] || "/opt/cursor/artifacts/sim50-a511a52-summary.log";
const afterPath = process.argv[3] || "/opt/cursor/artifacts/sim50-post-consistency.log";

function extractJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`no JSON in ${filePath}`);
  return JSON.parse(raw.slice(start, end + 1));
}

const before = extractJson(beforePath);
const after = extractJson(afterPath);
const out = {
  label: "fixed_rid_0_49_builder_harness",
  before: {
    wins: before.wins,
    winRate: before.winRate,
    stepsMax: before.stepsMax,
    stepsMedian: before.stepsMedian,
    buildBusts: before.buildOutcomes?.busts,
    ghostBookendsLinks: before.synergy?.linkCounts?.["ghost_echo→bookends_retrigger"],
  },
  after: {
    wins: after.wins,
    winRate: after.winRate,
    stepsMax: after.stepsMax,
    stepsMedian: after.stepsMedian,
    buildBusts: after.buildOutcomes?.busts,
    ghostBookendsLinks: after.synergy?.linkCounts?.["ghost_echo→bookends_retrigger"],
  },
};
const outFile = "/opt/cursor/artifacts/sim50-before-after.json";
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
