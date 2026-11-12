"use strict";
/**
 * Headless seeded bot sim (Playwright + in-page bot loop).
 * Usage: node tests/sim/run.cjs [--games=150] [--max-steps=12000] [--parallel=6] [--viewports=blocking|all]
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../..");
const BOT_FN = fs.readFileSync(path.join(__dirname, "in-page-bot.js"), "utf8");
const VIEWPORTS_ALL = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];
const VIEWPORTS_BLOCKING = VIEWPORTS_ALL.filter((v) =>
  ["768x1024", "1024x768", "1366x768", "1920x1080"].includes(v.name),
);
const STRATEGIES = ["builder", "builder", "builder", "builder"];

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function parseArgs(argv) {
  const out = {
    games: 150,
    maxSteps: 12_000,
    port: 0,
    parallel: 8,
    viewports: "blocking",
    root: ROOT,
  };
  for (const arg of argv) {
    if (arg.startsWith("--games=")) out.games = Number(arg.slice(8)) || out.games;
    else if (arg.startsWith("--max-steps=")) out.maxSteps = Number(arg.slice(12)) || out.maxSteps;
    else if (arg.startsWith("--port=")) out.port = Number(arg.slice(7)) || 0;
    else if (arg.startsWith("--parallel=")) out.parallel = Math.max(1, Number(arg.slice(11)) || 1);
    else if (arg.startsWith("--base-url=")) out.baseUrl = arg.slice(11);
    else if (arg.startsWith("--viewports=")) out.viewports = arg.slice(12) || out.viewports;
    else if (arg.startsWith("--root=")) out.root = path.resolve(arg.slice(7));
  }
  return out;
}

function pickViewports(mode) {
  if (mode === "all") return VIEWPORTS_ALL;
  return VIEWPORTS_BLOCKING;
}

function startServer(port, root) {
  const absRoot = path.resolve(root);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.resolve(absRoot, rel.replace(/^\//, ""));
      if (!filePath.startsWith(absRoot + path.sep) && filePath !== absRoot) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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
  page.setDefaultTimeout(120_000);
  const mobile = viewport.width < 700 || viewport.height < 500;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const simPolicy = process.env.SIM_POLICY_REVISION || "2026-11-11-phase-b-v1";
  const observerQ = process.env.SIM_POLICY_OBSERVER === "1" ? "&balanceObserver=1" : "";
  await page.goto(
    `${baseUrl}/index.html?e2e=1&simPolicy=${encodeURIComponent(simPolicy)}${observerQ}`,
    { waitUntil: "networkidle", timeout: 120_000 },
  );
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 120_000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "gutterbones1977:settings:v1",
      JSON.stringify({
        pacing: "fast",
        reducedMotionPref: true,
        tutorialCompleted: true,
        skippedAlleyIntro: true,
      }),
    );
    try {
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
    } catch (_) {
      /* ignore */
    }
    localStorage.removeItem("gutterbones1977:run:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
  if (mobile) {
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 1 });
    });
  }
}

async function runOneGame(
  page,
  { rid, seed, strategy, viewport, maxSteps, booted: bootedRef, stuckThreshold = 48, maxFallbacks = 36 },
) {
  page.setDefaultTimeout(120_000);
  const booted = bootedRef || { value: false };
  if (!booted.value) {
    await bootPage(page, page.__baseUrl, viewport);
    booted.value = true;
  } else {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const simPolicy = process.env.SIM_POLICY_REVISION || "2026-11-11-phase-b-v1";
    await page.goto(
      `${page.__baseUrl}/index.html?e2e=1&simPolicy=${encodeURIComponent(simPolicy)}`,
      { waitUntil: "domcontentloaded", timeout: 90_000 },
    );
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotionPref: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
      try {
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
      } catch (_) {
        /* ignore */
      }
      localStorage.removeItem("gutterbones1977:run:v1");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => window.__GB_E2E__, { timeout: 60_000 });
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
        stuckThreshold,
        maxFallbacks,
      },
    },
  );
  const telem = await page.evaluate(() => {
    const st = window.__GB_E2E__?.getState?.() || {};
    const hands = (window.__GB_SIM_TELEM__ && window.__GB_SIM_TELEM__.hands) || [];
    const roundEvents = (window.__GB_SIM_TELEM__ && window.__GB_SIM_TELEM__.roundEvents) || [];
    const build = window.__GB_E2E__?.getBuildProfile?.() || null;
    return { hands, gold: st.gold, score: st.score, build, roundEvents };
  });
  return { rid, viewport: viewport.name, ...result, telem };
}

function classifyFailures(results, maxSteps) {
  const terminal = results.filter((r) => r.outcome === "WIN" || r.outcome === "BUST");
  const stepCounts = terminal.map((r) => r.steps || 0);
  const medSteps = median(stepCounts);
  const generousCap = Math.max(maxSteps, Math.ceil(medSteps * 10));
  const failures = [];
  for (const r of results) {
    if (r.outcome === "WIN" || r.outcome === "BUST") continue;
    const exhausted = (r.steps || 0) >= maxSteps;
    const capGenerous = maxSteps >= Math.max(1000, medSteps * 10);
    if (r.stuck || r.reason === "incomplete") {
      if (capGenerous || exhausted) failures.push(r);
      else failures.push({ ...r, reason: r.reason || "incomplete", detail: (r.detail || "") + ";cap_not_generous" });
    } else if (String(r.outcome || "").startsWith("INCOMPLETE")) {
      failures.push({ ...r, stuck: true, reason: "incomplete" });
    }
  }
  return { medSteps, generousCap, failures, terminal };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const viewports = pickViewports(args.viewports);
  const t0 = Date.now();
  let server;
  let baseUrl = args.baseUrl;
  if (!baseUrl) {
    server = await startServer(args.port || 0, args.root);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const results = [];

  const jobs = [];
  for (let rid = 0; rid < args.games; rid++) {
    jobs.push({
      rid,
      seed: rid * 7919,
      strategy: STRATEGIES[rid % 4],
      viewport: viewports[(rid >> 2) % viewports.length],
    });
  }

  const parallel = Math.min(args.parallel, jobs.length);
  let cursor = 0;

  async function worker() {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    page.__baseUrl = baseUrl;
    const booted = { value: false };
    while (true) {
      const job = jobs[cursor++];
      if (!job) break;
      try {
        const r = await runOneGame(page, { ...job, maxSteps: args.maxSteps, booted });
        results.push(r);
        process.stderr.write(
          `sim ${results.length}/${args.games} rid=${r.rid} outcome=${r.outcome || r.reason} steps=${r.steps} maxRound=${r.maxRound}\n`,
        );
      } catch (e) {
        results.push({
          rid: job.rid,
          seed: job.seed,
          strategy: job.strategy,
          viewport: job.viewport.name,
          stuck: true,
          reason: "exception",
          detail: String(e).slice(0, 240),
          steps: 0,
          maxRound: 0,
        });
      }
    }
    await context.close();
  }

  await Promise.all(Array.from({ length: parallel }, () => worker()));
  await browser.close();
  if (server) await new Promise((r) => server.close(r));

  const { medSteps, generousCap, failures, terminal } = classifyFailures(results, args.maxSteps);
  const allSteps = results.map((r) => r.steps || 0);
  const maxStepsUsed = allSteps.length ? Math.max(...allSteps) : 0;
  const maxRoundReached = results.length ? Math.max(...results.map((r) => r.maxRound || 0)) : 0;
  const rounds = results.map((r) => r.maxRound || 0);
  const medMaxRound = median(rounds);

  const LINK_KEYS = [
    "blood_ripple→fuse_spark",
    "blood_ripple→ghost_echo",
    "fuse_spark→engine_link",
    "ghost_echo→bookends_retrigger",
    "ghost_echo→engine_link",
    "wire_feed→crowbar_cascade",
  ];
  const linkCounts = Object.fromEntries(LINK_KEYS.map((k) => [k, 0]));
  let chainMultCapHits = 0;
  let debtCapHits = 0;
  const depthHist = {};
  let handsWithChain = 0;
  const buildWins = {};
  const buildBusts = {};
  let crookedCopStarts = 0;
  let crookedCopClears = 0;
  const sinkGoldBefore = [];
  const sinkAmounts = [];
  for (const r of results) {
    for (const ev of r.telem?.roundEvents || []) {
      if (ev.kind === "round_play_start" && ev.bossId === "CROOKED_COP") crookedCopStarts += 1;
      if (ev.kind === "round_cleared" && ev.bossId === "CROOKED_COP") crookedCopClears += 1;
      if (ev.kind === "shop_advance_sink" && ev.sink > 0) {
        sinkGoldBefore.push(ev.goldBefore);
        sinkAmounts.push(ev.sink);
      }
    }
    const hands = r.telem?.hands || [];
    for (const h of hands) {
      if ((h.chainDepth || 0) > 0 || (h.synergyChainIds || []).length) handsWithChain += 1;
      const d = h.chainDepth || 0;
      depthHist[d] = (depthHist[d] || 0) + 1;
      if (h.chainMultCapHit) chainMultCapHits += 1;
      if (h.debtCollectorCapped) debtCapHits += 1;
      for (const l of h.chainLinks || []) {
        const key = `${l.from}→${l.to}`;
        if (key in linkCounts) linkCounts[key] += 1;
      }
    }
    const arch = r.telem?.build?.primaryBuild || r.telem?.build?.archetype || "unknown";
    const bucket = r.outcome === "WIN" ? buildWins : buildBusts;
    bucket[arch] = (bucket[arch] || 0) + 1;
  }
  const winRate = results.length ? results.filter((r) => r.outcome === "WIN").length / results.length : 0;

  const summary = {
    games: args.games,
    maxSteps: args.maxSteps,
    viewports: args.viewports,
    parallel,
    durationMs: Date.now() - t0,
    completed: results.length,
    wins: results.filter((r) => r.outcome === "WIN").length,
    busts: results.filter((r) => r.outcome === "BUST").length,
    winRate,
    terminal: terminal.length,
    failureCount: failures.length,
    stepsMedian: medSteps,
    stepsMax: maxStepsUsed,
    maxRoundMedian: medMaxRound,
    maxRoundReached,
    avgMaxRound:
      results.length ? results.reduce((s, r) => s + (r.maxRound || 0), 0) / results.length : 0,
    generousStepCap: generousCap,
    synergy: { linkCounts, depthHist, handsWithChain, chainMultCapHits, debtCapHits },
    buildOutcomes: { wins: buildWins, busts: buildBusts },
    telemetry: {
      crookedCop: {
        roundStarts: crookedCopStarts,
        roundsCleared: crookedCopClears,
        survivalRate: crookedCopStarts ? crookedCopClears / crookedCopStarts : 0,
      },
      shopAdvanceSink: {
        events: sinkAmounts.length,
        medianGoldBefore: median(sinkGoldBefore),
        medianSink: median(sinkAmounts),
      },
    },
    failures: failures.map((g) => ({
      rid: g.rid,
      seed: g.seed,
      strategy: g.strategy,
      viewport: g.viewport,
      reason: g.reason,
      detail: g.detail,
      maxRound: g.maxRound,
      phase: g.phase,
      steps: g.steps,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    for (const f of failures.slice(0, 20)) {
      console.error(`SIM FAILURE seed=${f.seed} rid=${f.rid} viewport=${f.viewport} reason=${f.reason} steps=${f.steps} maxRound=${f.maxRound} phase=${f.phase}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  runOneGame,
  VIEWPORTS: VIEWPORTS_ALL,
  VIEWPORTS_BLOCKING,
  bootPage,
  BOT_FN,
  classifyFailures,
  startServer,
  parseArgs,
  pickViewports,
};
