"use strict";
/**
 * Headless seeded bot sim (Playwright + in-page bot loop).
 * Usage: node tests/sim/run.cjs [--games=2000] [--max-steps=220] [--parallel=6]
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../..");
const BOT_FN = fs.readFileSync(path.join(__dirname, "in-page-bot.js"), "utf8");
const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];
const STRATEGIES = ["random", "greedy", "edge", "rapid"];

function parseArgs(argv) {
  const out = { games: 2000, maxSteps: 60, port: 0, parallel: 16 };
  for (const arg of argv) {
    if (arg.startsWith("--games=")) out.games = Number(arg.slice(8)) || out.games;
    else if (arg.startsWith("--max-steps=")) out.maxSteps = Number(arg.slice(12)) || out.maxSteps;
    else if (arg.startsWith("--port=")) out.port = Number(arg.slice(7)) || 0;
    else if (arg.startsWith("--parallel=")) out.parallel = Math.max(1, Number(arg.slice(11)) || 1);
    else if (arg.startsWith("--base-url=")) out.baseUrl = arg.slice(11);
  }
  return out;
}

function startServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(ROOT, rel.replace(/^\//, ""));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
      res.setHeader("Content-Type", types[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function bootPage(page, baseUrl, viewport) {
  const mobile = viewport.width < 700 || viewport.height < 500;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/index.html?e2e=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({
        pacing: "fast",
        reducedMotion: true,
        tutorialCompleted: true,
        skippedAlleyIntro: true,
      }),
    );
  });
  if (mobile) {
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 1 });
    });
  }
}

async function runOneGame(page, { rid, seed, strategy, viewport, maxSteps, booted: bootedRef }) {
  const booted = bootedRef || { value: false };
  if (!booted.value) {
    await bootPage(page, page.__baseUrl, viewport);
    booted.value = true;
  } else {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
  }
  const result = await page.evaluate(
    async ({ botSource, opts }) => {
      // eslint-disable-next-line no-eval
      eval(botSource);
      return await runBotSession(opts);
    },
    {
      botSource: BOT_FN,
      opts: {
        maxSteps,
        seed,
        strategy,
        stuckThreshold: 20,
        maxFallbacks: 6,
      },
    },
  );
  return { rid, viewport: viewport.name, ...result };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  let server;
  let baseUrl = args.baseUrl;
  if (!baseUrl) {
    server = await startServer(args.port || 0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const stuckGames = [];

  const jobs = [];
  for (let rid = 0; rid < args.games; rid++) {
    jobs.push({
      rid,
      seed: rid * 7919,
      strategy: STRATEGIES[rid % 4],
      viewport: VIEWPORTS[(rid >> 2) % VIEWPORTS.length],
    });
  }

  const parallel = Math.min(args.parallel, jobs.length);
  let cursor = 0;

  async function worker() {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.__baseUrl = baseUrl;
    const booted = { value: false };
    while (true) {
      const job = jobs[cursor++];
      if (!job) break;
      try {
        const r = await runOneGame(page, { ...job, maxSteps: args.maxSteps, booted });
        results.push(r);
        if (r.stuck) stuckGames.push(r);
      } catch (e) {
        stuckGames.push({
          rid: job.rid,
          seed: job.seed,
          strategy: job.strategy,
          viewport: job.viewport.name,
          stuck: true,
          reason: "exception",
          detail: String(e).slice(0, 240),
        });
      }
    }
    await context.close();
  }

  await Promise.all(Array.from({ length: parallel }, () => worker()));
  await browser.close();
  if (server) await new Promise((r) => server.close(r));

  const summary = {
    games: args.games,
    maxSteps: args.maxSteps,
    parallel,
    durationMs: Date.now() - t0,
    completed: results.length,
    stuckCount: stuckGames.length,
    wins: results.filter((r) => r.outcome === "WIN").length,
    busts: results.filter((r) => r.outcome === "BUST").length,
    incomplete: results.filter((r) => String(r.outcome || "").startsWith("INCOMPLETE")).length,
    stuckGames: stuckGames.map((g) => ({
      rid: g.rid,
      seed: g.seed,
      strategy: g.strategy,
      viewport: g.viewport,
      reason: g.reason,
      detail: g.detail,
      maxRound: g.maxRound,
      phase: g.phase,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (stuckGames.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runOneGame, VIEWPORTS, bootPage, BOT_FN };
