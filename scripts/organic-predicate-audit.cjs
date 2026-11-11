"use strict";
/**
 * Bounded diagnostic: one organic-ready seed (default rid 7 / seed 55433).
 * Records unfulfilled predicates at each eligible payout; compare snapshot C-preview vs executePayout.
 * Usage: node scripts/organic-predicate-audit.cjs [rid]
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const rid = Number(process.argv[2] || 7);
const seed = rid * 7919;
const BOT = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");
const OUT = process.env.PREDICATE_AUDIT_OUT || `/opt/cursor/artifacts/organic-predicate-audit-rid${rid}.json`;

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
  await page.goto(`${baseUrl}/index.html?e2e=1&organicDiag=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);
  await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("organicDiag") === "1") {
      window.__GB_ORGANIC_PREDICATE_DIAG__ = [];
    }
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
        unlockedFaceIds: ["MULT_FACE", "GOLD_FACE", "BLOOD_6", "FUSE_FACE", "ECHO_FACE", "GHOST_FACE"],
        unlockedHardwareIds: ["ENGINE", "FUSE_BOX", "CROWBAR", "BOOKENDS"],
        purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
      }),
    );
    localStorage.removeItem("gutterbones1977:run:v1");
    window.__GB_SIM_TELEM__ = { hands: [], record(h) { this.hands.push(h); } };
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_E2E__);

  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return runBotSession(opts);
    },
    { botSource: BOT, opts: { maxSteps: 14000, seed, strategy: "builder" } },
  );

  const summary = await page.evaluate(() => {
    const diag = window.__GB_ORGANIC_PREDICATE_DIAG__ || [];
    const hands = window.__GB_SIM_TELEM__?.hands || [];
    const links = hands.flatMap((h) => h.chainLinks || []);
    const snap = window.__GB_E2E__?.getOrganicChainSnapshot?.() || {};
    const laneSim = window.__GB_E2E__?.isOrganicChainReady?.()
      ? window.__GB_E2E__.organicChainLaneSim?.(1200)
      : null;
    const fulfilled = diag.filter((d) => d.kind === "executePayout" && d.parity?.evalPred_has_target_pair);
    const predicateHistogram = {};
    for (const row of diag) {
      for (const u of row.unfulfilled || []) {
        predicateHistogram[u] = (predicateHistogram[u] || 0) + 1;
      }
    }
    return {
      organicReady: snap.organicReady,
      diagCount: diag.length,
      executePayoutRows: diag.filter((d) => d.kind === "executePayout").length,
      prePayoutRows: diag.filter((d) => d.kind === "pre_payout_bot").length,
      predicateHistogram,
      fulfilledLinkPayouts: fulfilled.length,
      telemLinks: links,
      laneSim,
      diag,
    };
  });

  const savedMilestone = fs.existsSync(`/opt/cursor/artifacts/organic-milestone-rid${rid}.json`)
    ? JSON.parse(fs.readFileSync(`/opt/cursor/artifacts/organic-milestone-rid${rid}.json`, "utf8"))
    : null;

  const report = {
    rid,
    seed,
    organicLinkTarget: "ghost_echo→bookends_retrigger",
    run: result,
    savedMilestone: savedMilestone
      ? {
          organicReady: savedMilestone.organicReady,
          purchases: savedMilestone.purchaseEvents?.map((p) => p.id),
          carves: savedMilestone.carveEvents?.map((c) => `${c.faceId}@die${c.dieIdx}`),
          laneSim: savedMilestone.laneSim,
        }
      : null,
    ...summary,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

  const mdPath = OUT.replace(/\.json$/, ".md");
  const hist = summary.predicateHistogram;
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]);
  const sim = summary.laneSim || savedMilestone?.laneSim;
  let md = `# Organic predicate audit (rid ${rid}, seed ${seed})\n\n`;
  md += `Kit ready at end: **${summary.organicReady}** | Diag rows: ${summary.diagCount} | executePayout: ${summary.executePayoutRows}\n\n`;
  md += `## Unfulfilled predicate frequency (during post-kit payouts)\n\n`;
  for (const [k, v] of top) md += `- \`${k}\`: ${v}\n`;
  if (!top.length) md += `- (no post-kit payout rows recorded)\n`;
  md += `\n## Lane layout simulation (carved dice, production resolveDieAfterRoll)\n\n`;
  if (sim) {
    md += `- trials: ${sim.trials}\n`;
    md += `- ghost+echo adjacent: ${sim.ghostEchoHits} (${((100 * sim.ghostEchoHits) / sim.trials).toFixed(2)}%)\n`;
    md += `- ends value match: ${sim.endMatchHits} (${((100 * sim.endMatchHits) / sim.trials).toFixed(2)}%)\n`;
    md += `- combined (independent estimate): ~${(((sim.ghostEchoHits / sim.trials) * (sim.endMatchHits / sim.trials)) * 100).toFixed(3)}%\n`;
    md += `- joint hits in sample: ${sim.linkLayoutHits}\n`;
  } else md += `- Kit not ready — no lane sim\n`;
  md += `\n## Preview vs executePayout\n\n`;
  md += `- \`getOrganicChainSnapshot().linkPreview\` only evaluates category **C** on current \`dice\` (not e2ePending).\n`;
  md += `- \`executePayout(catId)\` uses \`diceForScore\` (= pending dice if set, else \`dice\`) and the same \`calculateScore\` wrapper — parity flag \`calculateScore_C_matches_execute_when_cat_C\` on each row.\n`;
  md += `\n## Telem pairwise links\n\n\`${JSON.stringify(summary.telemLinks)}\`\n`;
  fs.writeFileSync(mdPath, md);

  console.log(JSON.stringify({ outJson: OUT, outMd: mdPath, fulfilled: summary.fulfilledLinkPayouts, hist: top.slice(0, 6) }, null, 2));
  await browser.close();
  server.close();
  process.exit(summary.telemLinks.length >= 1 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
