"use strict";
/**
 * Milestone trace: prove purchase→carve→payout link on one seed (short budget).
 * Usage: node scripts/organic-milestone-trace.cjs [rid]
 * Exit 0 when __GB_SIM_TELEM__ records blood_ripple→fuse_spark.
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const rid = Number(process.argv[2] || 1);
const seed = rid * 7919;
const BOT = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");

async function main() {
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
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({ pacing: "fast", reducedMotionPref: true, tutorialCompleted: true, skippedAlleyIntro: true }),
    );
    localStorage.setItem(
      "gutterbones1977:meta:v1",
      JSON.stringify({
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
      }),
    );
    localStorage.removeItem("gutterbones1977:run:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.evaluate(() => {
    window.__GB_SIM_ORGANIC_TRACE__ = { events: [] };
  });

  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return runBotSession(opts);
    },
    { botSource: BOT, opts: { maxSteps: 14000, seed, strategy: "builder" } },
  );

  const telem = await page.evaluate(() => {
    const events = window.__GB_SIM_ORGANIC_TRACE__?.events || [];
    const hands = window.__GB_SIM_TELEM__?.hands || [];
    const links = hands.flatMap((h) => h.chainLinks || []);
    const snap = window.__GB_E2E__?.getOrganicChainSnapshot?.() || {};
    return { events, links, organicReady: snap.organicReady, bloodOnBoard: snap.bloodOnBoard, fuseOnBoard: snap.fuseOnBoard };
  });

  const pairLinks = telem.links.filter((l) => l === "blood_ripple→fuse_spark" || String(l).includes("blood_ripple"));
  const report = {
    rid,
    seed,
    result,
    organicReady: telem.organicReady,
    bloodOnBoard: telem.bloodOnBoard,
    fuseOnBoard: telem.fuseOnBoard,
    purchaseEvents: telem.events.filter((e) => e.kind === "purchase"),
  carveEvents: telem.events.filter((e) => e.kind === "carve"),
    refreshEvents: telem.events.filter((e) => e.kind === "refresh"),
    pairwiseLinks: telem.links.slice(0, 12),
    bloodFusePairCount: pairLinks.length,
  };
  const outPath = process.env.MILESTONE_OUT || `/opt/cursor/artifacts/organic-milestone-rid${rid}.json`;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outPath, ...report, linkOk: pairLinks.length >= 1 }, null, 2));
  await browser.close();
  server.close();
  process.exit(pairLinks.length >= 1 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
