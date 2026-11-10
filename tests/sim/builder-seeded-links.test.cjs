"use strict";
/**
 * Regression: matched-seed builder sim must produce pairwise links via production executePayout (not test quotas).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("builder sim — 30 matched seeds emit pairwise chainLinks", () => {
  const runCjs = path.join(__dirname, "run.cjs");
  const r = spawnSync(process.execPath, [runCjs, "--games=30", "--max-steps=12000", "--parallel=1", "--viewports=blocking"], {
    cwd: path.join(__dirname, "../.."),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const text = (r.stderr || "") + (r.stdout || "");
  const marker = '\n{\n  "games"';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, `sim produced no JSON summary: ${text.slice(0, 400)}`);
  const summary = JSON.parse(text.slice(start + 1));
  assert.equal(summary.failureCount, 0, "sim must finish without stuck games");
  const linkTotal = Object.values(summary.synergy?.linkCounts || {}).reduce((s, n) => s + n, 0);
  assert.ok(linkTotal >= 1, `expected pairwise links in 30 builder games, got ${linkTotal} ${JSON.stringify(summary.synergy?.linkCounts)}`);
});
