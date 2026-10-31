"use strict";
/**
 * Playtest 14: Triad/echo display, route quota mods, early curve, shop skew, refresh costs.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const vm = require("node:vm");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

let server;
let baseUrl;
let chromium;

function loadRoutes() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf('<script id="gutterbones-routes">') + 33;
  const end = html.indexOf("</script>", start);
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(`${html.slice(start, end)}\nglobalThis.R = GutterbonesRoutes;`).runInContext(sandbox);
  return sandbox.R;
}

function loadRefreshCost() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(
    /const SHOP_AGENCY_TUNING = \{[\s\S]*?\};\s*const getShopRefreshCost = \(roundNum, refreshCount\) => Math\.max\([\s\S]*?\);/,
  );
  assert.ok(m, "getShopRefreshCost in index.html");
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(`${m[0]}\nglobalThis.getShopRefreshCost = getShopRefreshCost;`).runInContext(sandbox);
  return sandbox.getShopRefreshCost;
}

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

test("rules — plain 4,5,6,5,4 is not a valid Triad", () => {
  const g = createGame(fixtures.snapshot());
  const r = g.api.calculateScore("TOK", fixtures.dice([4, 5, 6, 5, 4]));
  assert.equal(r.valid, false);
  assert.equal(r.total, 0);
});

test("rules — echo/magnet resolved pips can valid Triad; display uses resolved values", () => {
  const g = createGame(fixtures.snapshot());
  const d = fixtures.dice([4, 5, 6, 5, 4]);
  d[2] = fixtures.bone(6, 2, { faceId: "MAGNET_FACE", type: "modifier" });
  const resolved = g.api.GutterbonesRules.resolveDice(d).resolved;
  assert.deepEqual(
    resolved.map((die) => die.value),
    [4, 5, 5, 5, 4],
  );
  const r = g.api.calculateScore("TOK", d);
  assert.ok(r.valid);
  assert.equal(r.total, 40);
});

test("routes — PAWN and VIP quotas differ from LOCAL after mod apply", () => {
  const R = loadRoutes();
  const base = {
    round: 2,
    target: 130,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  };
  const local = R.projectNextRound({ path: { id: "LOCAL", mod: 1 }, ...base });
  const pawn = R.projectNextRound({ path: { id: "PAWN", mod: 1.2 }, ...base });
  const vip = R.projectNextRound({ path: { id: "VIP", mod: 1.4 }, ...base });
  assert.ok(pawn.nextTarget > local.nextTarget);
  assert.ok(vip.nextTarget > pawn.nextTarget);
});

test("routes — round 2 to 3 growth stays gradual on LOCAL", () => {
  const R = loadRoutes();
  const r2 = R.projectNextRound({
    path: { id: "LOCAL", mod: 1 },
    round: 2,
    target: 97,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  const growth = (r2.nextTarget - 97) / 97;
  assert.ok(growth <= 0.28, `R2→R3 growth ${(growth * 100).toFixed(1)}% expected ≤28%`);
  assert.ok(growth >= 0.12);
});

test("shop — refresh cost curve is softer early", () => {
  const getShopRefreshCost = loadRefreshCost();
  assert.equal(getShopRefreshCost(2, 0), 9);
  assert.equal(getShopRefreshCost(2, 1), 12);
  assert.equal(getShopRefreshCost(2, 2), 15);
  assert.equal(getShopRefreshCost(2, 3), 18);
});

test("shop — stock skew guarantee hook present for tagged offers", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /tagMatchesOffer\(offerTag, item\)/);
  assert.match(html, /!picks\.some\(\(item\) => tagMatchesOffer\(offerTag, item\)\)/);
  assert.match(html, /guaranteePool\[0\]/);
});

function panelNoScrollMetrics(page) {
  return page.evaluate(() => {
    const selectors = [".shop-routes-scroll", ".run-intel-panel"];
    const bad = [];
    for (const sel of selectors) {
      const shell = document.querySelector(sel);
      if (!shell) continue;
      const style = getComputedStyle(shell);
      const overflowScroll = style.overflowY === "auto" || style.overflowY === "scroll";
      const body = shell.querySelector(".shop-routes-body, .run-intel-body") || shell;
      const scaled = body.scrollHeight * (body.getBoundingClientRect().height / Math.max(1, body.offsetHeight));
      const clipped = scaled > shell.clientHeight + 2;
      if (overflowScroll || clipped) {
        bad.push({
          sel,
          overflowY: style.overflowY,
          shellClientHeight: shell.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          clipped,
        });
      }
    }
    return { ok: bad.length === 0, bad };
  });
}

const VIEWPORTS = [
  { name: "1280x690", width: 1280, height: 690 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

for (const vp of VIEWPORTS) {
  test(`e2e — shop routes / run intel panels have no scrollbars @ ${vp.name}`, async () => {
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
      await page.waitForSelector('[data-layout-key="shop-routes-panel"]', { timeout: 12_000 });
      const metrics = await panelNoScrollMetrics(page);
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });

  test(`e2e — rap sheet shows 3 history rows without clipping @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
      const history = fixtures.rapSheetHistory3().history;
      await page.evaluate((rows) => window.__GB_LAYOUT_AUDIT__.openRapSheetDemo(rows), history);
      await page.waitForTimeout(400);
      await page.waitForSelector('[data-layout-key="rap-sheet-history-row"]', { timeout: 12_000 });
      const metrics = await page.evaluate(() => {
        const box = document.querySelector('[data-layout-key="rap-sheet-history"]');
        const rows = Array.from(document.querySelectorAll('[data-layout-key="rap-sheet-history-row"]'));
        if (!box || rows.length < 3) return { ok: false, reason: "missing box/rows", rowCount: rows.length };
        const br = box.getBoundingClientRect();
        const bad = rows.map((row, idx) => {
          const r = row.getBoundingClientRect();
          const clipped = r.bottom > br.bottom + 1 || r.top < br.top - 1;
          const scrollable = row.scrollHeight > row.clientHeight + 1;
          return { idx, clipped, scrollable, bottom: r.bottom, boxBottom: br.bottom };
        }).filter((x) => x.clipped || x.scrollable);
        const boxStyle = getComputedStyle(box);
        return {
          ok: bad.length === 0 && boxStyle.overflowY !== "auto" && boxStyle.overflowY !== "scroll",
          bad,
          rowCount: rows.length,
          overflowY: boxStyle.overflowY,
        };
      });
      assert.ok(metrics.ok, JSON.stringify(metrics));
    } finally {
      await browser.close();
    }
  });
}
