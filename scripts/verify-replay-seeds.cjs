"use strict";
/**
 * Verify replay seeds (generous step cap, low concurrency).
 * Usage: node scripts/verify-replay-seeds.cjs
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BOT_FN = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");

const JOBS = [
  { name: "1024x768 R3 round-clear", width: 1024, height: 768, seed: 768143, strategy: "greedy" },
  { name: "1024x768 SHOP R6", width: 1024, height: 768, seed: 609763, strategy: "greedy" },
  { name: "1024x768 R1", width: 1024, height: 768, seed: 807738, strategy: "edge" },
  { name: "1920x1080 R1", width: 1920, height: 1080, seed: 744386, strategy: "greedy" },
  { name: "412x915 R3", width: 412, height: 915, seed: 997794, strategy: "random" },
  { name: "844x390 R3", width: 844, height: 390, seed: 514735, strategy: "edge" },
];

function startServer() {
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
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function runJob(page, baseUrl, job) {
  await page.setViewportSize({ width: job.width, height: job.height });
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
    );
  });
  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      eval(botSource);
      return await runBotSession(opts);
    },
    {
      botSource: BOT_FN,
      opts: {
        maxSteps: 20_000,
        seed: job.seed,
        strategy: job.strategy,
        stuckThreshold: 50,
        maxFallbacks: 24,
      },
    },
  );
  const progress = {
    name: job.name,
    seed: job.seed,
    viewport: `${job.width}x${job.height}`,
    outcome: result.outcome || result.reason || "unknown",
    stuck: !!result.stuck,
    steps: result.steps,
    maxRound: result.maxRound,
    phase: result.phase,
    detail: result.detail || "",
    genuineSoftlock:
      !!result.stuck && result.reason !== "incomplete" && !String(result.outcome || "").startsWith("INCOMPLETE"),
    harnessIncomplete: result.reason === "incomplete" || String(result.outcome || "").startsWith("INCOMPLETE"),
  };
  return progress;
}

(async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(180_000);
  const results = [];
  for (const job of JOBS) {
    process.stderr.write(`verify ${job.name} seed=${job.seed}\n`);
    try {
      results.push(await runJob(page, baseUrl, job));
    } catch (e) {
      results.push({
        name: job.name,
        seed: job.seed,
        stuck: true,
        genuineSoftlock: false,
        harnessIncomplete: false,
        exception: String(e).slice(0, 300),
      });
    }
  }
  await browser.close();
  await new Promise((r) => server.close(r));
  const summary = {
    completed: results.filter((r) => r.outcome === "WIN" || r.outcome === "BUST").length,
    harnessIncomplete: results.filter((r) => r.harnessIncomplete).length,
    genuineSoftlocks: results.filter((r) => r.genuineSoftlock).length,
    exceptions: results.filter((r) => r.exception).length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync("/opt/cursor/artifacts/replay-seed-verify.json", JSON.stringify(summary, null, 2));
})();
