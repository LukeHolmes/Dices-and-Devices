"use strict";
/** Sim must reach WIN/BUST; incomplete and softlocks fail when step cap is generous. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const { runOneGame, VIEWPORTS_BLOCKING, startServer } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");
const OLD_COMMIT = "821f6cf";

let server;
let baseUrl;
let chromium;

before(async () => {
  chromium = require("playwright").chromium;
  server = await startServer(0, ROOT);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("sim — blocking viewports reach WIN or BUST within generous cap", { timeout: 360_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.__baseUrl = baseUrl;
  const booted = { value: false };
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  try {
    for (let rid = 0; rid < 2; rid += 1) {
      const result = await runOneGame(page, {
        rid,
        seed: rid * 7919,
        strategy: ["random", "greedy", "edge", "rapid"][rid % 4],
        viewport: vp,
        maxSteps: 5000,
        booted,
      });
      assert.equal(result.stuck, false, JSON.stringify(result));
      assert.ok(result.outcome === "WIN" || result.outcome === "BUST", JSON.stringify(result));
      assert.ok(result.steps > 0 && result.steps <= 8000);
    }
  } finally {
    await browser.close();
  }
});

test("sim — seed 118785 rapid @1920x1080 reaches terminal (R2 boss intro regression)", { timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.__baseUrl = baseUrl;
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  const result = await runOneGame(page, {
    rid: 15,
    seed: 118785,
    strategy: "rapid",
    viewport: vp,
    maxSteps: 8000,
    stuckThreshold: 28,
    maxFallbacks: 14,
    booted: { value: false },
  });
  await browser.close();
  assert.notEqual(result.outcome, "INCOMPLETE:PLAY", JSON.stringify(result));
  assert.equal(result.reason, undefined, JSON.stringify(result));
  assert.ok(result.outcome === "WIN" || result.outcome === "BUST", JSON.stringify(result));
  assert.equal(result.stuck, false, JSON.stringify(result));
});

test("sim — seed 364274 edge @1920x1080 reaches terminal (score overlay regression)", { timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.__baseUrl = baseUrl;
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  const result = await runOneGame(page, {
    rid: 46,
    seed: 364274,
    strategy: "edge",
    viewport: vp,
    maxSteps: 8000,
    stuckThreshold: 28,
    maxFallbacks: 14,
    booted: { value: false },
  });
  await browser.close();
  assert.notEqual(result.outcome, "INCOMPLETE:PLAY", JSON.stringify(result));
  assert.ok(result.outcome === "WIN" || result.outcome === "BUST", JSON.stringify(result));
});

test("sim — low max-steps surfaces incomplete failures", { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.__baseUrl = baseUrl;
  const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1920x1080");
  const result = await runOneGame(page, {
    rid: 99,
    seed: 99 * 7919,
    strategy: "greedy",
    viewport: vp,
    maxSteps: 25,
    booted: { value: false },
  });
  await browser.close();
  assert.equal(result.reason, "incomplete");
  assert.equal(result.stuck, true);
});

test("sim — detects stuck runs on pre-fix commit when worktree present", { timeout: 900_000 }, async () => {
  const worktree = path.join("/tmp", `gb-sim-${OLD_COMMIT}`);
  if (!fs.existsSync(path.join(worktree, "index.html"))) {
    execSync(`git worktree add ${worktree} ${OLD_COMMIT}`, { cwd: ROOT, stdio: "pipe" });
  }
  let out;
  try {
    out = execSync(
      `node tests/sim/run.cjs --root=${worktree} --games=8 --max-steps=3500 --parallel=2 --viewports=blocking`,
      { cwd: ROOT, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    );
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    assert.ok(e.status === 1, "expected non-zero exit when old tree has failures");
  }
  const summary = JSON.parse(out.trim().split("\n").find((line) => line.startsWith("{")) || "{}");
  assert.ok(summary.failureCount >= 1, `expected at least one failure on ${OLD_COMMIT}: ${out.slice(0, 500)}`);
});
