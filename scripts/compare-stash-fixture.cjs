"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

async function probe(root, label) {
  const fixtures = require(path.join(root, "tests/fixtures/runs.cjs"));
  const { createGame, plain } = require(path.join(root, "tests/helpers/game.cjs"));
  const RUN_KEY = "gutterbones1977:run:v1";
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(root, rel.replace(/^\//, ""));
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.setHeader("Content-Type", "text/html");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  const builder = () => {
    const heavy = fixtures.playHeavyHardware();
    const base =
      typeof fixtures.playNonBossNextThreat === "function"
        ? fixtures.playNonBossNextThreat()
        : fixtures.run({
            phase: "PLAY",
            round: 4,
            paths: [{ id: "SHARK_TURF", name: "SHARK TURF", bossId: "LOAN_SHARK", mod: 1.2, color: "border-red-600 text-red-600" }],
            committedPathId: "SHARK_TURF",
          });
    return {
      ...base,
      round: heavy.round,
      inventory: heavy.inventory,
      stash: 55,
      score: heavy.score,
      target: heavy.target,
      hands: heavy.hands,
      hasRolled: true,
      activeBossId: null,
      activeBoss: null,
    };
  };
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: RUN_KEY, data: payload });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const vh = window.innerHeight;
    const keys = ["stash-program-SNIFF", "stash-program-BRIBE", "stash-program-FIX", "stash-program-LAUNDER"];
    const bad = [];
    keys.forEach((key) => {
      const el = document.querySelector(`[data-layout-key="${key}"]`);
      const r = el?.getBoundingClientRect();
      if (!el || !r || r.width < 2) bad.push({ key, reason: "missing" });
      else if (r.bottom > vh + 2) bad.push({ key, top: r.top, bottom: r.bottom, vh });
    });
    const hud = document.querySelector('[data-layout-key="play-hud"]');
    const threat = document.querySelector('[data-layout-key="play-next-threat-slot"]');
    const badge = document.querySelector('[data-layout-key="next-threat-badge"]');
    return {
      ok: bad.length === 0,
      bad,
      hudHeight: hud?.getBoundingClientRect().height,
      threatSlotHeight: threat?.getBoundingClientRect().height,
      badgeVisible: !!badge,
      vh,
    };
  });
  await browser.close();
  await new Promise((r) => server.close(r));
  return { label, ...m };
}

(async () => {
  const main = await probe("/tmp/gb-main-d640497", "main");
  const pr = await probe("/workspace", "pr");
  console.log(JSON.stringify({ main, pr }, null, 2));
})();
