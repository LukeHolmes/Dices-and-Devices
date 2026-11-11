"use strict";
/**
 * Representative fixed-seed loss diagnosis (production bot, no grants).
 * Rids: 0 early, 7 mid, 16 kit, 42 late-Cop-adjacent, 53 win control.
 */
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { runOneGame, VIEWPORTS_BLOCKING } = require("../tests/sim/run.cjs");

const ROOT = path.join(__dirname, "..");
const BOT = fs.readFileSync(path.join(__dirname, "../tests/sim/in-page-bot.js"), "utf8");
const SAMPLES = (process.env.QUOTA_DIAG_RIDS || "0,7,16,42,53").split(",").map((s) => Number(s.trim()));
const vp = VIEWPORTS_BLOCKING.find((v) => v.name === "1024x768") || VIEWPORTS_BLOCKING[0];

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const server = await new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent((req.url || "/").split("?")[0]);
      const f = path.join(ROOT, u === "/" ? "index.html" : u.slice(1));
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader("Content-Type", path.extname(f) === ".html" ? "text/html" : "application/octet-stream");
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const rows = [];

  for (const rid of SAMPLES) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      page.__baseUrl = baseUrl;
      const r = await runOneGame(page, {
        rid,
        seed: rid * 7919,
        strategy: "builder",
        viewport: vp,
        maxSteps: 8000,
        booted: { value: false },
        stuckThreshold: 48,
        maxFallbacks: 36,
      });
      const hands = r.telem?.hands || [];
      const missedClears = hands.filter(
        (h) => h.total > 0 && typeof h.scoreBefore === "number" && typeof h.targetBefore === "number"
          && h.scoreBefore + h.total >= h.targetBefore,
      ).length;
      const totals = hands.map((h) => h.total || 0).filter((t) => t > 0);
      const scored = totals.reduce((a, b) => a + b, 0);
      const roundEvents = r.telem?.roundEvents || [];
      const copStarts = roundEvents.filter((e) => e.kind === "round_play_start" && e.bossId === "CROOKED_COP").length;
      const copClears = roundEvents.filter((e) => e.kind === "round_cleared" && e.bossId === "CROOKED_COP").length;
      const pairwise = hands.filter((h) =>
        (h.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger"),
      ).length;
      rows.push({
        rid,
        seed: rid * 7919,
        outcome: r.outcome,
        maxRound: r.maxRound,
        buildTag: r.telem?.build?.primaryBuild,
        terminalScore: r.telem?.score,
        terminalTarget: r.telem?.target,
        shortage: Math.max(0, (r.telem?.target || 0) - (r.telem?.score || 0)),
        inventoryCount: r.telem?.inventoryCount,
        handsPlayed: hands.length,
        scoredSum: scored,
        medianHand: median(totals),
        maxHand: totals.length ? Math.max(...totals) : 0,
        zeroHands: hands.length - totals.length,
        pairwiseLinkHands: pairwise,
        missedQuotaClearHands: missedClears,
        cop: { starts: copStarts, clears: copClears },
        causal_hint:
          (r.telem?.target || 0) > (r.telem?.score || 0)
            ? "quota_shortfall"
            : r.outcome === "WIN"
              ? "cleared"
              : "unknown",
      });
    } finally {
      await browser.close();
    }
  }
  server.close();
  const out = {
    label: "quota_loss_diagnosis_fixed_seeds",
    at: new Date().toISOString(),
    rows,
    note: "SET_CONSISTENCY is post-run tag; shortage compares terminal score vs target at bust",
  };
  const outPath = "/opt/cursor/artifacts/quota-loss-diagnosis.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
