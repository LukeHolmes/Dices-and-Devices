"use strict";
/** Monte Carlo: how often BLOOD_6 appears in a generated shop at round 7 (production RNG in browser). */
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");

async function main() {
  const trials = Number(process.argv[2] || 200);
  const round = Number(process.argv[3] || 7);
  const { chromium } = require("playwright");
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  const stats = await page.evaluate(
    async ({ trials, round }) => {
      let blood = 0;
      let dangerAny = 0;
      let fuse = 0;
      const ids = {};
      for (let t = 0; t < trials; t++) {
        localStorage.setItem(
          "gutterbones1977:meta:v1",
          JSON.stringify({
            totalRuns: 12,
            unlockedFaceIds: ["MULT_FACE", "GOLD_FACE", "BLOOD_6", "FUSE_FACE", "GHOST_FACE", "SHIV_FACE", "WIREBAG_FACE"],
            unlockedHardwareIds: ["ENGINE", "FUSE_BOX", "CROWBAR", "BOOKENDS"],
            purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
            unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
          }),
        );
        window.__GB_E2E__.startNewRun?.();
        window.__GB_E2E__.setRound?.(round);
        window.__GB_E2E__.setGold?.(80);
        window.__GB_E2E__.goShop?.();
        const offers = window.__GB_E2E__.getShopOffers?.() || [];
        for (const o of offers) ids[o.id] = (ids[o.id] || 0) + 1;
        if (offers.some((o) => o.id === "BLOOD_6")) blood++;
        if (offers.some((o) => o.rarity === "danger")) dangerAny++;
        if (offers.some((o) => o.id === "FUSE_FACE")) fuse++;
      }
      return { trials, blood, dangerAny, fuse, ids };
    },
    { trials, round },
  );
  const out = { round, ...stats, bloodRate: stats.blood / trials, dangerRate: stats.dangerAny / trials };
  const outPath = "/opt/cursor/artifacts/shop-blood-montecarlo.json";
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ outPath, ...out }, null, 2));
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
