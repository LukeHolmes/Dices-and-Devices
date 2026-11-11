"use strict";
/**
 * Lightweight shop-offer probe for organic chain stock (production RNG, no skew injection).
 * Logs BLOOD_6 / FUSE_FACE / FUSE_BOX visibility by round for builder seeds.
 * Usage: node scripts/probe-chain-stock.cjs [maxRid=24]
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const maxRid = Number(process.argv[2] || 24);
const BOT = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");
const META = {
  totalRuns: 12,
  victories: 2,
  unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
  unlockedFaceIds: [
    "MULT_FACE",
    "GOLD_FACE",
    "BLOOD_6",
    "FUSE_FACE",
    "ECHO_FACE",
    "GHOST_FACE",
    "SHIV_FACE",
    "WIREBAG_FACE",
  ],
  unlockedHardwareIds: ["ENGINE", "FUSE_BOX", "CROWBAR", "BOOKENDS"],
  purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
};

async function probeRid(rid) {
  const seed = rid * 7919;
  const { chromium } = require("playwright");
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  const visits = [];
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.evaluate((meta) => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({ pacing: "fast", reducedMotionPref: true, tutorialCompleted: true, skippedAlleyIntro: true }),
    );
    localStorage.setItem("gutterbones1977:meta:v1", JSON.stringify(meta));
    localStorage.removeItem("gutterbones1977:run:v1");
  }, META);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);

  const poll = setInterval(async () => {
    try {
      const row = await page.evaluate(() => {
        const st = window.__GB_E2E__.getState();
        if (st.phase !== "SHOP") return null;
        const snap = window.__GB_E2E__.getOrganicChainSnapshot();
        return {
          round: snap.round,
          gold: snap.gold,
          offers: (snap.shopOffers || []).map((o) => o.id),
          danger: (snap.shopOffers || []).filter((o) => o.rarity === "danger").map((o) => o.id),
        };
      });
      if (row) {
        const key = `${row.round}:${row.offers.join(",")}`;
        const last = visits[visits.length - 1];
        if (!last || last.key !== key) visits.push({ ...row, key });
      }
    } catch (_) {
      /* closing */
    }
  }, 150);

  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return runBotSession(opts);
    },
    { botSource: BOT, opts: { maxSteps: 5500, seed, strategy: "builder" } },
  );

  clearInterval(poll);
  const events = await page.evaluate(() => window.__GB_SIM_ORGANIC_TRACE__?.events || []);
  await browser.close();
  server.close();
  const bloodBuy = events.filter((e) => e.kind === "purchase" && e.id === "BLOOD_6");
  const carves = events.filter((e) => e.kind === "carve");
  return { rid, seed, visits, bloodBuy: bloodBuy.length, carves: carves.length, maxRound: result.maxRound, outcome: result.outcome };
}

async function main() {
  const rows = [];
  for (let rid = 1; rid <= maxRid; rid++) {
    rows.push(await probeRid(rid));
  }
  const outPath = process.env.PROBE_OUT || "/opt/cursor/artifacts/chain-stock-probe.json";
  fs.writeFileSync(outPath, JSON.stringify({ rules: {
    dangerCapRound: 6,
    maxEarlyDangerOffers: 1,
    earlyDangerWeightGate: 5,
    rareFacesRuns: 3,
    tier2FuseRuns: 5,
  }, rows }, null, 2) + "\n");
  const summary = rows.map((r) => ({
    rid: r.rid,
    maxRound: r.maxRound,
    bloodBuy: r.bloodBuy,
    carves: r.carves,
    shopVisits: r.visits.length,
    bloodOfferRounds: [...new Set(r.visits.filter((v) => v.offers.includes("BLOOD_6")).map((v) => v.round))],
  }));
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
