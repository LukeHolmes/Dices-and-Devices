"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = process.argv[2] || path.join(__dirname, "..");
const seed = Number(process.argv[3]) || 205894;
const vp = { width: Number(process.argv[4]) || 768, height: Number(process.argv[5]) || 1024 };
const BOT_FN = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");

function startServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(ROOT, rel.replace(/^\//, ""));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
      res.setHeader("Content-Type", types[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function measureStash(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const keys = ["stash-program-SNIFF", "stash-program-BRIBE", "stash-program-FIX", "stash-program-LAUNDER"];
    const bad = [];
    keys.forEach((key) => {
      const el = document.querySelector(`[data-layout-key="${key}"]`);
      if (!el) {
        bad.push({ key, reason: "missing" });
        return;
      }
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") {
        bad.push({ key, reason: "hidden" });
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.bottom > vh + 2 || r.top < -2) bad.push({ key, top: r.top, bottom: r.bottom, vh });
    });
    const badge = document.querySelector('[data-layout-key="next-threat-badge"]');
    const hud = document.querySelector('[data-layout-key="play-hud"]');
    return {
      phase: window.__GB_E2E__?.getState?.()?.phase,
      round: window.__GB_E2E__?.getState?.()?.round,
      bad,
      ok: bad.length === 0,
      hudBottom: hud?.getBoundingClientRect().bottom,
      badgeTop: badge?.getBoundingClientRect().top,
      vh,
    };
  });
}

(async () => {
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return await runBotSession(opts);
    },
    { botSource: BOT_FN, opts: { maxSteps: 12000, seed, strategy: "edge", stuckThreshold: 50, maxFallbacks: 24 } },
  );
  const stash = await measureStash(page);
  const st = await page.evaluate(() => window.__GB_E2E__.getState());
  console.log(JSON.stringify({ root: ROOT, seed, vp, outcome: result, state: st, stash }, null, 2));
  await browser.close();
  await new Promise((r) => server.close(r));
})();
