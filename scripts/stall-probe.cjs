#!/usr/bin/env node
"use strict";
/** Capture last steps + UI for budget-stall diagnosis (measurement only). */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = process.env.STALL_PROBE_OUT || "/opt/cursor/artifacts/stall-probe.json";

async function main() {
  const baseline = process.argv[2] || "R78-i";
  const rid = Number(process.argv[3] || 0);
  const maxSteps = Number(process.argv[4] || 12000);
  const seed = rid * 7919;

  const batch = require(path.join(ROOT, "scripts/diagnostics-batch.cjs"));
  process.env.SIM_SEED_GAME = "1";
  process.env.SIM_NODE_PACED = "1";
  process.env.SIM_BOOT_SETTLE_MS = process.env.SIM_BOOT_SETTLE_MS || "0";
  process.env.SIM_STREET_RAT_PROFILE = "1";
  process.env.SIM_POLICY_REVISION = batch.FIXED_POLICY_REVISION;
  process.env.SIM_LINK_OBSERVER = "1";

  const rulesRoot = batch.ensureRulesRoot(baseline, "", true);
  const { runOneGame, pickViewports, startServer } = require(path.join(ROOT, "tests/sim/run.cjs"));
  const { ensurePlaywrightClock, installDeterministicNetwork } = require(path.join(
    ROOT,
    "tests/sim/run-paced-bot.cjs",
  ));
  const viewportsList = pickViewports("blocking");
  const server = await startServer(0, rulesRoot);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await ensurePlaywrightClock(context);
  await installDeterministicNetwork(context);
  const page = await context.newPage();
  page.__baseUrl = baseUrl;
  const booted = { value: false };
  const viewport = viewportsList[0];
  const result = await runOneGame(page, {
    rid,
    seed,
    strategy: "builder",
    viewport,
    maxSteps,
    booted,
  });
  const ui = await page.evaluate(() => {
    const st = window.__GB_E2E__?.getState?.() || {};
    const locks = window.__GB_E2E__?.getPlayLocks?.() || {};
    const debug = window.__GB_E2E__?.debugStuck?.() || null;
    const buttons = [...document.querySelectorAll("button,[role=button]")]
      .filter((b) => !b.disabled)
      .slice(0, 24)
      .map((b) => ({
        text: (b.innerText || b.getAttribute("aria-label") || "").trim().slice(0, 60),
        lk: b.getAttribute("data-layout-key") || "",
      }));
    const overlays = [...document.querySelectorAll("[data-layout-key]")]
      .map((el) => el.getAttribute("data-layout-key"))
      .filter((k) => /overlay|modal|intro|boss|breakdown|resolution|round-clear/i.test(k || ""));
    return { st, locks, debug, buttons, overlays };
  });
  const stepTrace = result.stepTrace || [];
  const last30 = stepTrace.slice(-30);
  const payload = {
    baseline,
    rulesRoot,
    rid,
    seed,
    maxSteps,
    result: {
      outcome: result.outcome,
      reason: result.reason,
      detail: result.detail,
      stuck: result.stuck,
      steps: result.steps,
      maxRound: result.maxRound,
      phase: result.phase,
    },
    telem: {
      roundEvents: (result.telem?.roundEvents || []).slice(-20),
      shopPolicySteps: (result.telem?.shopPolicySteps || []).slice(-10),
      hands: (result.telem?.hands || []).length,
      gold: result.telem?.gold,
      score: result.telem?.score,
    },
    last30Steps: last30,
    ui,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ out: OUT, outcome: result.outcome, steps: result.steps, maxRound: result.maxRound }, null, 2));
  await browser.close();
  await new Promise((r) => server.close(r));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});