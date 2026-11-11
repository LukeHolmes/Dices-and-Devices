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
    const beforeEventSeq = before.events.length;

    await page.evaluate(() => window.__GB_E2E__.rollOnce?.());
    await page.waitForTimeout(2000);

    const after = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.exportLedger());
    const newEvents = after.events.slice(beforeEventSeq);
    assert.ok(newEvents.length > 0, "expected new ledger events after roll");
    const newActions = newEvents.filter((e) => e.type === "action");
    const kinds = new Set(newActions.map((e) => e.action.kind));
    assert.ok(
      kinds.has("roll") || kinds.has("roll_slot") || kinds.has("reroll"),
      `expected roll/reroll ledger actions, saw: ${[...kinds].join(",") || "none"}`,
    );
    const newCommits = newEvents.filter(
      (e) => e.type === "state_commit" && (e.commit?.kind === "roll" || e.commit?.kind === "reroll"),
    );
    assert.ok(newCommits.length >= 1, "expected react state_commit for dice mutation");
    assert.equal(newCommits.at(-1).commit.match.value, true, "dice lane commit matches React state");
    const snap = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.getReadOnlySnapshot?.());
    assert.ok(snap?.diceLane?.length === 5, "read-only snapshot exposes dice lane");
  } finally {
    await browser.close();
  }
});

async function reachPlayWithoutE2eFastDice(page) {
  await page.goto(`${baseUrl}/index.html?balanceObserver=1&tutorial=0`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#root-gutterbones", { timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 60_000 },
  );
  await page.waitForFunction(() => window.__GB_BALANCE_OBSERVER__?.enabled, { timeout: 45_000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    try {
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({
          totalRuns: 3,
          unlockedPersonaIds: ["STREET_RAT", "HUSTLER"],
          launderedCash: 0,
          recordsViews: 0,
        }),
      );
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ tutorialCompleted: true, skippedAlleyIntro: true, reducedMotionPref: false }),
      );
    } catch (_) { /* ignore */ }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 60_000 },
  );
  await page.waitForFunction(() => window.__GB_BALANCE_OBSERVER__?.enabled, { timeout: 45_000 });
  await page.evaluate(() => {
    const play = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "PLAY");
    play?.click();
  });
  await page.waitForSelector('[data-layout-key="lineup-title"]', { timeout: 30_000 });
  await page.evaluate(() => {
    const run = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "NEW RUN");
    run?.click();
  });
  await page.waitForFunction(
    () => document.querySelector('[data-tutorial="roll-btn"]:not([disabled])'),
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () => !document.body.innerText.includes("FREE OPENING SNIFF"),
    { timeout: 12_000 },
  );
  await page.waitForFunction(
    () => !document.body.innerText.includes("FREE OPENING SNIFF"),
    { timeout: 12_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-tutorial="roll-btn"]:not([disabled])'),
    { timeout: 20_000 },
  );
  const e2eFast = await page.evaluate(
    () => typeof window.__GB_E2E_QUERY__ === "function" && window.__GB_E2E_QUERY__(),
  );
  assert.equal(e2eFast, false, "staggered path requires e2e=0 (no sync dice fast path)");
}

test("browser staggered roll (no e2e fast path) records dice commits", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await reachPlayWithoutE2eFastDice(page);
    await page.waitForFunction(
      () => {
        const events = window.__GB_BALANCE_OBSERVER__?.exportLedger()?.events || [];
        return events.some((e) => e.type === "state_commit" && e.commit?.kind === "reroll");
      },
      { timeout: 20_000 },
    );
    const beforeSeq = await page.evaluate(() => window.__GB_BALANCE_OBSERVER__.exportLedger().events.length);
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForFunction(
      (seq) => {
        const events = window.__GB_BALANCE_OBSERVER__.exportLedger().events.slice(seq);
        const kinds = events.filter((e) => e.type === "action").map((e) => e.action.kind);
        const commits = events.filter((e) => e.type === "state_commit").length;
        return kinds.includes("roll") && commits >= 1;
      },
      beforeSeq,
      { timeout: 45_000 },
    );
    const delta = await page.evaluate((seq) => {
      const events = window.__GB_BALANCE_OBSERVER__.exportLedger().events.slice(seq);
      const actions = events.filter((e) => e.type === "action").map((e) => e.action.kind);
      return { actions, commits: events.filter((e) => e.type === "state_commit").length };
    }, beforeSeq);
    assert.ok(
      delta.actions.includes("roll") || delta.actions.includes("roll_slot"),
      `staggered roll expected roll/roll_slot actions, got ${delta.actions.join(",")}`,
    );
    assert.ok(delta.commits >= 1, "expected post-commit state_commit on staggered roll");
    const rollSlots = delta.actions.filter((k) => k === "roll_slot").length;
    if (rollSlots > 0) {
      assert.ok(rollSlots >= 2, `expected staggered multi-step roll_slot events, saw ${rollSlots}`);
    }
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
