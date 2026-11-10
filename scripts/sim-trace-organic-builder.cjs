"use strict";
/**
 * Traced seeded builder run (rid → seed rid*7919): intended vs actual organic chain kit per phase.
 * Usage: node scripts/sim-trace-organic-builder.cjs [rid]
 */
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

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
  const trace = [];
  const intended = {
    acquisition: "ENGINE + FUSE_BOX hardware, 2× BLOOD_6 + FUSE_FACE carved on dice 0,1,2",
    carve: "blood die0, blood die1, fuse die2 (lane-adjacent chain)",
    adjacency: "rolled lane shows BLOOD at i,i+1 and FUSE at neighbor with blood_ripple charge",
    reroll: "keepDiceForReroll retains blood/fuse neighborhood until layout valid",
    payout: "score category C → noteChainLink blood_ripple→fuse_spark",
  };
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
    window.__GB_SIM_ORGANIC_TRACE__ = { steps: [], events: [] };
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.evaluate(() => {
    window.__GB_SIM_ORGANIC_TRACE__ = { steps: [], events: [] };
  });

  const poll = setInterval(async () => {
    try {
      const snap = await page.evaluate(() => {
        if (!window.__GB_E2E__?.getOrganicChainSnapshot) return null;
        const s = window.__GB_E2E__.getOrganicChainSnapshot();
        const st = window.__GB_E2E__.getState();
        return { ...s, score: st.score, target: st.target, hands: st.hands, hasRolled: window.__GB_E2E__.getHasRolled?.() };
      });
      if (snap) {
        const last = trace[trace.length - 1];
        const sig = JSON.stringify([snap.phase, snap.round, snap.organicReady, snap.lane, snap.bloodOnBoard]);
        if (!last || last.sig !== sig) {
          trace.push({ t: Date.now(), sig, snap, intendedNote: null });
        }
      }
    } catch (_) {
      /* page may be closing */
    }
  }, 120);

  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return runBotSession(opts);
    },
    { botSource: BOT, opts: { maxSteps: 12000, seed, strategy: "builder" } },
  );

  clearInterval(poll);
  const hands = await page.evaluate(() => {
    const h = window.__GB_SIM_TELEM__?.hands || [];
    const links = h.flatMap((x) => x.chainLinks || []);
    const organicEvents = window.__GB_SIM_ORGANIC_TRACE__?.events || [];
    return {
      handCount: h.length,
      linkCount: links.length,
      links: links.slice(0, 8),
      organicEvents,
    };
  });

  const report = {
    rid,
    seed,
    intended,
    result,
    hands,
    organicEvents: hands.organicEvents,
    trace: trace.slice(-80),
    diagnosis: [],
  };
  if (!trace.some((t) => t.snap?.organicReady)) {
    report.diagnosis.push("BLOCKER: isOrganicChainReady never true — shop left before ENGINE+FUSE_BOX+2 blood carve + fuse carve.");
  }
  const maxBlood = Math.max(0, ...trace.map((t) => t.snap?.bloodOnBoard || 0));
  if (maxBlood < 2) {
    report.diagnosis.push("BLOCKER: acquisition/carve — fewer than 2 BLOOD_6 faces on dice (max " + maxBlood + ").");
  }
  if (hands.linkCount === 0) {
    report.diagnosis.push(
      trace.some((t) => t.snap?.linkPreview?.chainLinks?.length)
        ? "payout saw linkPreview but telem empty — investigate executePayout path"
        : "adjacency/reroll/payout — rolled lane never produced pairwise link on category C",
    );
  }

  const outPath = process.env.TRACE_OUT || "/opt/cursor/artifacts/organic-trace-rid" + rid + ".json";
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outPath, diagnosis: report.diagnosis, organicReadyEver: trace.some((t) => t.snap?.organicReady), ...hands, outcome: result.outcome }, null, 2));
  await browser.close();
  server.close();
  process.exit(hands.linkCount >= 1 || result.outcome === "WIN" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
