"use strict";
/**
 * Playtest 18: rap sheet fit, run intel chip summary, shop routes, round-clear keyboard, score-before-clear race.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

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
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

const VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

test("source — playtest 18 hooks present", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /RunIntelSummary/);
  assert.match(html, /run-intel-summary/);
  assert.match(html, /scoreOverlayActiveRef/);
  assert.match(html, /pendingRoundFinalizeRef/);
  assert.match(html, /attemptRoundFinalizeAfterScore/);
  assert.match(html, /seedPlayIntelState/);
  assert.match(html, /data-layout-key="shop-route-card"/);
  assert.match(html, /RunBuildFootprint compact/);
});

test("source — round finalize waits on score overlay ref", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /scoreOverlayActiveRef\.current \|\| !!\(scoreBreakdown \|\| scoreResolution\)/);
  assert.match(html, /overlayLiveAfterDismiss/);
  assert.match(html, /lastHandRunOut/);
  assert.match(html, /pending\.awaitScoreOverlay/);
});

function intelMetrics(page) {
  return page.evaluate(() => {
    const mobileOverlay = document.querySelector('[data-layout-key="play-stash"].fixed');
    const panel = document.querySelector('[data-layout-key="run-intel-summary"]');
    const chips = panel?.querySelector('[data-layout-key="run-intel-chip-row"]');
    if (!panel || !chips) return { ok: false, reason: "missing inline intel" };
    const pr = panel.getBoundingClientRect();
    const cr = chips.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const flow = panel.querySelector('[data-intel-chip="flow"]');
    const fontPx = flow ? parseFloat(getComputedStyle(flow).fontSize) : 0;
    const style = getComputedStyle(panel);
    const overflowHidden = style.overflowY === "hidden" || style.overflowY === "clip";
    const verticalOk = mobileOverlay
      ? pr.top >= 0 && pr.width > 40
      : pr.top >= -2 && pr.bottom <= vh + 2;
    return {
      ok:
        verticalOk &&
        cr.right <= vw + 2 &&
        (overflowHidden || panel.scrollHeight <= panel.clientHeight + 3) &&
        style.overflowY !== "auto" &&
        style.overflowY !== "scroll" &&
        fontPx >= 8,
      fontPx,
      panelH: pr.height,
      scrollH: panel.scrollHeight,
      clientH: panel.clientHeight,
    };
  });
}

async function resumePlayHeavy(page) {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playHeavyHardware()),
  );
  payload.currentRouteEffect = {
    name: "TEST ROUTE",
    effects: ["Quota x1.40 (scaled by round curve)", "Stash to 100% on pick"],
  };
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
}

for (const vp of VIEWPORTS) {
  test(`e2e — rap sheet header and archetype fit @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const historyRows = fixtures.rapSheetHistory3().history;
      const history =
        vp.height < 420 && vp.width > vp.height
          ? historyRows.slice(0, 1)
          : historyRows;
      await page.evaluate((rows) => window.__GB_LAYOUT_AUDIT__.openRapSheetDemo(rows), history);
      await page.waitForSelector('[data-layout-key="rap-sheet-header"]', { timeout: 12_000 });
      await page.waitForSelector('[data-layout-key="rap-play-again"]', { timeout: 12_000 });
      await page.waitForSelector('[data-layout-key="rap-sheet-history-row"]', { timeout: 12_000 });
      await page.waitForTimeout(vp.height < 420 ? 1600 : 900);
      const metrics = await page.evaluate(() => {
        const header = document.querySelector('[data-layout-key="rap-sheet-header"]');
        const archetype = document.querySelector('[data-layout-key="rap-sheet-archetype"]');
        const body = document.querySelector('[data-layout-key="rap-sheet"] .gb-modal-body');
        const wrap = document.querySelector('[data-layout-key="rap-sheet-wrap"]');
        const vh = window.innerHeight;
        const hr = header?.getBoundingClientRect();
        const ar = archetype?.getBoundingClientRect();
        const bodyStyle = body ? getComputedStyle(body) : null;
        const archetypeScroll =
          archetype && archetype.scrollHeight > archetype.clientHeight + 2;
        const bodyScroll =
          bodyStyle?.overflowY !== "hidden"
          && body
          && body.scrollHeight > body.clientHeight + 4;
        const scaled = !!wrap?.dataset?.rapScale;
        const playBtn = document.querySelector('[data-layout-key="rap-play-again"]');
        const btnRect = playBtn?.getBoundingClientRect();
        const headerOk = hr && hr.top >= (scaled ? -36 : 0) && hr.bottom <= vh + 8;
        const btnOk = !!btnRect && btnRect.top >= 0 && btnRect.bottom <= vh + 4;
        return {
          ok:
            headerOk &&
            btnOk &&
            archetype &&
            ar &&
            ar.height >= 12 &&
            !archetypeScroll &&
            bodyStyle?.overflowY !== "auto" &&
            !bodyScroll,
          headerTop: hr?.top,
          btnOk,
          scaled: wrap?.dataset?.rapScale,
          archetypeH: ar?.height,
          archetypeScroll,
          bodyOverflow: bodyStyle?.overflowY,
          scale: wrap?.dataset?.rapScale,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });

  test(`e2e — shop route cards fully visible @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const payload = plain(
        createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
      );
      await page.evaluate(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: RUN_KEY, data: payload },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
      await page.locator('[data-layout-key="shop-routes-panel"]').scrollIntoViewIfNeeded();
      await page.waitForSelector('[data-layout-key="shop-route-card"]', { timeout: 12_000 });
      await page.waitForFunction(
        () => {
          const body = document.querySelector(".shop-routes-body");
          if (!body) return false;
          if (body.scrollHeight <= (body.parentElement?.clientHeight || 0) + 4) return true;
          const tr = getComputedStyle(body).transform;
          return tr && tr !== "none" && tr !== "matrix(1, 0, 0, 1, 0, 0)";
        },
        { timeout: 15_000 },
      );
      if (vp.width < 900 || vp.height < 450) await page.waitForTimeout(600);
      let metrics = { ok: false };
      for (let attempt = 0; attempt < 3 && !metrics.ok; attempt += 1) {
        if (attempt > 0) await page.waitForTimeout(700);
        metrics = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-layout-key="shop-route-card"]'));
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const body = document.querySelector(".shop-routes-body");
        const scaled =
          body
          && getComputedStyle(body).transform !== "none"
          && getComputedStyle(body).transform !== "matrix(1, 0, 0, 1, 0, 0)";
        const minCardH = scaled ? 10 : 24;
        const bad = cards.map((card, idx) => {
          const r = card.getBoundingClientRect();
          if (r.height < minCardH) return { idx, reason: "too short", h: r.height, scaled };
          if (r.bottom > vh + 2) return { idx, reason: "below viewport", bottom: r.bottom, vh };
          if (r.right > vw + 2) return { idx, reason: "clipped right", right: r.right, vw };
          if (r.top < -4) return { idx, reason: "above viewport", top: r.top };
          return null;
        }).filter(Boolean);
        return { ok: cards.length >= 3 && bad.length === 0, cardCount: cards.length, bad };
      });
      }
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });
}

const INTEL_STATES = [
  { id: "idle", seed: {} },
  {
    id: "stash-full",
    seed: { stash: 100, hasRolled: true, hands: 2, round: 3 },
  },
  {
    id: "route-mod",
    seed: {
      routeEffect: {
        name: "PAWN SHOP RUN",
        effects: ["Quota x1.40 (scaled by round curve)", "Stash to 100% on pick", "+$15 cash on pick"],
      },
      round: 4,
    },
  },
  { id: "boss-round", seed: { bossId: "LOAN_SHARK", round: 5, hands: 3 } },
];

for (const vp of VIEWPORTS) {
  for (const state of INTEL_STATES) {
    test(`e2e — run intel summary ${state.id} @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumePlayHeavy(page);
        if (vp.width < 768 || vp.height < 450) {
          await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openPlayStashPanel());
          await page.waitForSelector('[data-layout-key="play-stash"].flex', { timeout: 8000 });
        }
        await page.evaluate((seed) => window.__GB_LAYOUT_AUDIT__.seedPlayIntelState(seed), state.seed);
        await page.waitForSelector('[data-layout-key="run-intel-summary"]', { timeout: 12_000 });
        if (state.id === "stash-full") {
          await page.waitForSelector('[data-layout-key="stash-full-banner"]', { timeout: 8000 });
        }
        await page.waitForTimeout(350);
        const metrics = await intelMetrics(page);
        assert.ok(metrics.ok, JSON.stringify({ state: state.id, ...metrics }));
      } finally {
        await browser.close();
      }
    });
  }
}

test("e2e — round clear Enter and Space advance", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1&pacing=fast`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClear());
    await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 8000 });
    await page.waitForFunction(
      () => window.__GB_LAYOUT_AUDIT__.getState().roundClearCanContinue,
      { timeout: 12_000 },
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !window.__GB_LAYOUT_AUDIT__.isRoundClearVisible(), { timeout: 8000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClear());
    await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 8000 });
    await page.waitForFunction(
      () => window.__GB_LAYOUT_AUDIT__.getState().roundClearCanContinue,
      { timeout: 12_000 },
    );
    await page.keyboard.press("Space");
    await page.waitForFunction(() => !window.__GB_LAYOUT_AUDIT__.isRoundClearVisible(), { timeout: 8000 });
  } finally {
    await browser.close();
  }
});

test("source — queueFinalizeRound defers until score overlays clear", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /queueFinalizeRound/);
  assert.match(html, /pending\.ready = true/);
  assert.match(html, /scoreOverlayActiveRef\.current/);
  assert.match(html, /if \(pendingFinalize\?\.ready\)/);
});
