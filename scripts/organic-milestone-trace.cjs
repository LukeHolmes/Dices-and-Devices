"use strict";
/**
 * Milestone trace: prove purchase→carve→payout link on one seed (short budget).
 * Usage: node scripts/organic-milestone-trace.cjs [rid]
 * Exit 0 when __GB_SIM_TELEM__ records any production noteChainLink pair.
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
          "WILD_FACE",
          "ECHO_FACE",
          "GHOST_FACE",
          "SHIV_FACE",
          "WIREBAG_FACE",
          "MAGNET_FACE",
          "MARK_FACE",
          "FUSE_FACE",
          "DOUBLE_DOWN_FACE",
        ],
        unlockedHardwareIds: [
          "BOOKENDS",
          "LOADED_DIE",
          "BRASS_KNUCKLES",
          "BLACK_BOOK",
          "BURNER_PHONE",
          "CROWBAR",
          "ENGINE",
          "FUSE_BOX",
          "MIRROR_RIG",
          "DEBT_COLLECTOR",
          "HOT_STREAK_COIL",
          "CENTERPIECE",
        ],
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
    {
      botSource: BOT,
      opts: {
        maxSteps: Number(process.env.MILESTONE_STEPS || 36000),
        seed,
        strategy: "builder",
        stuckThreshold: 48,
        maxFallbacks: 36,
      },
    },
  );

  const telem = await page.evaluate(() => {
    const events = window.__GB_SIM_ORGANIC_TRACE__?.events || [];
    const hands = window.__GB_SIM_TELEM__?.hands || [];
    const links = hands.flatMap((h) => h.chainLinks || []);
    const snap = window.__GB_E2E__?.getOrganicChainSnapshot?.() || {};
    const handsWithLinks = hands
      .filter((h) => (h.chainLinks || []).length > 0)
      .map((h) => ({
        chainLinks: h.chainLinks,
        synergyChainIds: h.synergyChainIds,
        total: h.total,
        chainDepth: h.chainDepth,
      }));
    const synergyHist = {};
    let handsWithGhostEcho = 0;
    let pairwiseLinkHands = 0;
    hands.forEach((h) => {
      (h.synergyChainIds || []).forEach((id) => {
        synergyHist[id] = (synergyHist[id] || 0) + 1;
      });
      if ((h.synergyChainIds || []).includes("ghost_echo")) handsWithGhostEcho += 1;
      if (
        (h.chainLinks || []).some(
          (l) => l.from === "ghost_echo" && l.to === "bookends_retrigger",
        )
      ) {
        pairwiseLinkHands += 1;
      }
    });
    return {
      events,
      links,
      organicReady: snap.organicReady,
      bloodOnBoard: snap.bloodOnBoard,
      fuseOnBoard: snap.fuseOnBoard,
      handsRecorded: hands.length,
      handsWithGhostEcho,
      pairwiseLinkHands,
      handsWithLinks,
      synergyHist,
      laneSim: window.__GB_SIM_LANE_SIM__ || null,
    };
  });

  const ORGANIC_PAIRS = [
    "blood_ripple→fuse_spark",
    "fuse_spark→engine_link",
    "ghost_echo→bookends_retrigger",
    "wire_feed→crowbar_cascade",
  ];
  const pairLinks = telem.links.filter((l) => {
    const key = typeof l === "string" ? l : `${l.from}→${l.to}`;
    return ORGANIC_PAIRS.includes(key);
  });
  const report = {
    rid,
    seed,
    result,
    organicReady: telem.organicReady,
    handsRecorded: telem.handsRecorded || 0,
    handsWithGhostEcho: telem.handsWithGhostEcho || 0,
    pairwiseLinkHands: telem.pairwiseLinkHands || 0,
    handsWithLinks: telem.handsWithLinks || [],
    synergyHist: telem.synergyHist || {},
    organicLinkTarget: "ghost_echo→bookends_retrigger",
    bloodOnBoard: telem.bloodOnBoard,
    fuseOnBoard: telem.fuseOnBoard,
    purchaseEvents: telem.events.filter((e) => e.kind === "purchase"),
  carveEvents: telem.events.filter((e) => e.kind === "carve"),
    refreshEvents: telem.events.filter((e) => e.kind === "refresh"),
    pairwiseLinks: telem.links.slice(0, 12),
    bloodFusePairCount: pairLinks.length,
    laneSim: telem.laneSim,
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
