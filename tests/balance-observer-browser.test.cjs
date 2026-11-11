"use strict";

/**
 * Bounded browser smoke: opt-in balance observer ledger + observer-off control.
 * Requires: npx playwright install chromium
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");

let server;
let baseUrl;
let chromium;

before(async () => {
  chromium = require("playwright").chromium;
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function waitForGame(page) {
  await page.goto(`${baseUrl}/index.html?balanceObserver=1&e2e=1&tutorial=0`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#root-gutterbones", { timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () => window.__GB_BALANCE_OBSERVER__?.enabled && window.__GB_E2E__,
    { timeout: 30_000 },
  );
}

test("browser smoke — balanceObserver ledger records roll and snapshot", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await waitForGame(page);
    await page.evaluate(() => {
      window.__GB_E2E__.skipIntroOverlays?.();
      window.__GB_E2E__.startNewRun?.();
    });
    await page.waitForFunction(
      () => window.__GB_E2E__?.getState?.()?.phase === "PLAY",
      { timeout: 45_000 },
    );
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      for (let i = 0; i < 12; i += 1) {
        window.__GB_E2E__.dismissOverlays?.();
        const dbg = window.__GB_E2E__.debugStuck?.();
        if (!dbg?.storyBeat && !dbg?.overlayActive) break;
      }
    });

    const before = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.exportLedger());
    const beforeKinds = new Set(
      before.events.filter((e) => e.type === "action").map((e) => e.action.kind),
    );

    await page.evaluate(() => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (typeof window.__GB_E2E__.rollOnce === "function") window.__GB_E2E__.rollOnce();
        else document.querySelector('[data-tutorial="roll-btn"]')?.click();
      }
    });
    await page.waitForTimeout(2000);

    const after = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.exportLedger());
    const newActions = after.events.filter((e) => e.type === "action").slice(before.events.length);
    const kinds = new Set(newActions.map((e) => e.action.kind));
    assert.ok(
      kinds.has("roll") || kinds.has("roll_slot") || kinds.has("reroll"),
      `expected roll/reroll ledger actions, saw: ${[...kinds].join(",") || "none"}`,
    );
    const commits = after.events.filter(
      (e) => e.type === "state_commit" && (e.commit?.kind === "roll" || e.commit?.kind === "reroll"),
    );
    assert.ok(commits.length >= 1, "expected react state_commit for dice mutation");
    assert.equal(commits.at(-1).commit.match.value, true, "dice lane commit matches React state");
    const snap = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.getReadOnlySnapshot?.());
    assert.ok(snap?.diceLane?.length === 5, "read-only snapshot exposes dice lane");
  } finally {
    await browser.close();
  }
});

test("browser control — observer off produces zero ledger events", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/index.html?e2e=1&tutorial=0`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#root-gutterbones", { timeout: 60_000 });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 30_000 });
    await page.evaluate(() => window.__GB_E2E__.skipIntroOverlays?.());
    await page.waitForTimeout(400);
    const obs = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__ || null);
    assert.equal(obs, null);
    await page.evaluate(() => {
      const rollBtn = document.querySelector('[data-tutorial="roll-btn"]')
        || document.querySelector('[data-layout-key="roll-btn"]');
      rollBtn?.click();
    });
    await page.waitForTimeout(800);
    const obs2 = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__ || null);
    assert.equal(obs2, null);
  } finally {
    await browser.close();
  }
});
