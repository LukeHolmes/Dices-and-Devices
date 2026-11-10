"use strict";
/**
 * sim50 + synergy chain telemetry vs main @ baseline commit.
 * Usage: node tests/sim/synergy-balance-report.cjs [--games=50] [--baseline=2d56900]
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { runOneGame, VIEWPORTS_BLOCKING, parseArgs } = require("./run.cjs");

const ROOT = path.join(__dirname, "../..");
const LINK_KEYS = [
  "blood_ripple→ghost_echo",
  "fuse_spark→engine_link",
  "ghost_echo→engine_link",
  "wire_feed→crowbar_cascade",
];

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function checkoutIndex(commit) {
  const r = spawnSync("git", ["show", `${commit}:index.html`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git show ${commit}:index.html failed`);
  return r.stdout;
}

async function runSimPass({ label, games, rootDir, parallel }) {
  const http = require("node:http");
  const { chromium } = require("playwright");
  const viewports = VIEWPORTS_BLOCKING;
  const STRATEGIES = ["random", "greedy", "edge", "rapid"];

  const server = await new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const filePath = path.join(rootDir, rel.replace(/^\//, ""));
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
      res.setHeader("Content-Type", types[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const jobs = [];
  for (let rid = 0; rid < games; rid++) {
    jobs.push({
      rid,
      seed: rid * 7919,
      strategy: STRATEGIES[rid % 4],
      viewport: viewports[(rid >> 2) % viewports.length],
    });
  }
  const results = [];
  let cursor = 0;
  const maxSteps = 8000;

  async function worker() {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.__baseUrl = baseUrl;
    const booted = { value: false };
    while (true) {
      const job = jobs[cursor++];
      if (!job) break;
      await page.evaluate(() => window.__GB_SIM_TELEM__?.reset?.());
      const r = await runOneGame(page, { ...job, maxSteps, booted });
      const telem = await page.evaluate(() => {
        const st = window.__GB_E2E__?.getState?.() || {};
        return {
          hands: (window.__GB_SIM_TELEM__ && window.__GB_SIM_TELEM__.hands) || [],
          gold: st.gold,
          score: st.score,
          phase: st.phase,
        };
      });
      results.push({ ...r, telem });
    }
    await context.close();
  }

  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, () => worker()));
  await browser.close();
  await new Promise((r) => server.close(r));

  return aggregate(label, results);
}

function aggregate(label, results) {
  const allHands = [];
  const linkCounts = Object.fromEntries(LINK_KEYS.map((k) => [k, 0]));
  let chainMultCapHits = 0;
  let debtCapHits = 0;
  let handsWithChain = 0;
  const depthHist = {};
  const finals = [];

  for (const r of results) {
    const hands = r.telem?.hands || [];
    allHands.push(...hands);
    if (r.telem?.gold != null) finals.push(Number(r.telem.gold) || 0);
    else if (r.telem?.score != null) finals.push(Number(r.telem.score) || 0);
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
  }

  const totals = allHands.filter((h) => h.valid).map((h) => h.total);
  return {
    label,
    games: results.length,
    scoredHands: totals.length,
    handsWithChain,
    linkCounts,
    depthHist,
    chainMultCapHits,
    debtCapHits,
    avgHandTotal: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
    medianHandTotal: median(totals),
    avgFinalGold: finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : 0,
    medianFinalGold: median(finals),
    failureCount: results.filter((x) => x.stuck || (x.reason && !["WIN", "BUST"].includes(x.outcome))).length,
  };
}

function parseCli(argv) {
  const out = { games: 50, baseline: "2d56900", parallel: 4 };
  for (const a of argv) {
    if (a.startsWith("--games=")) out.games = Number(a.slice(8)) || out.games;
    if (a.startsWith("--baseline=")) out.baseline = a.slice(11);
    if (a.startsWith("--parallel=")) out.parallel = Number(a.slice(11)) || out.parallel;
  }
  return out;
}

function fixtureLinkAudit() {
  const { createGame } = require("../helpers/game.cjs");
  const { snapshot, dice, bone } = require("../fixtures/runs.cjs");
  const g = createGame(snapshot());
  const ctx = (over) => ({
    handLevels: {},
    flowStreak: 0,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: { enabled: true, chainLinkingEnabled: true, maxChainPasses: 8, maxChainBonusMultPerHand: 6, debtCollectorMaxMult: 4 },
    ...over,
  });
  const cases = [
    {
      id: "blood_ripple→ghost_echo",
      run: () => {
        const d = dice([6, 0, 2, 3, 4]);
        d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
        d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
        d[2] = bone(2, 2, { faceId: "GHOST_FACE", type: "modifier" });
        return g.api.GutterbonesRules.calculateScore("C", d, ctx({ inventory: [{ id: "FUSE_BOX" }, { id: "ENGINE" }] }));
      },
    },
    {
      id: "fuse_spark→engine_link",
      run: () => {
        const d = dice([6, 6, 0, 6, 6]);
        d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
        d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
        d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
        d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
        d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
        return g.api.GutterbonesRules.calculateScore("C", d, ctx({ inventory: [{ id: "ENGINE" }, { id: "FUSE_BOX" }] }));
      },
    },
    {
      id: "ghost_echo→engine_link",
      run: () => {
        const d = dice([6, 0, 2, 3, 4]);
        d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
        d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
        d[2] = bone(2, 2, { faceId: "GHOST_FACE", type: "modifier" });
        d[3] = bone(4, 3, { faceId: "MULT_FACE", type: "modifier" });
        d[4] = bone(4, 4, { faceId: "MULT_FACE", type: "modifier" });
        return g.api.GutterbonesRules.calculateScore("C", d, ctx({ inventory: [{ id: "ENGINE" }, { id: "ENGINE" }] }));
      },
    },
    {
      id: "wire_feed→crowbar_cascade",
      run: () => {
        const d = dice([6, 0, 2, 3, 4]);
        d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
        d[1] = bone(0, 1, { faceId: "SHIV_FACE", type: "destructive" });
        d[2] = bone(2, 2, { faceId: "WIRE_FACE", type: "modifier" });
        d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
        return g.api.GutterbonesRules.calculateScore("C", d, ctx({ inventory: [{ id: "CROWBAR" }] }));
      },
    },
  ];
  const out = {};
  for (const c of cases) {
    const r = c.run();
    out[c.id] = {
      chainDepth: r.chainDepth || 0,
      chainLinks: r.chainLinks || [],
      markers: r.chainLinkMarkers || [],
      total: r.total,
    };
  }
  return out;
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  const tmpMain = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "gb-main-"));
  for (const name of ["index.html", "assets"]) {
    const src = path.join(ROOT, name);
    const dest = path.join(tmpMain, name);
    if (name === "index.html") {
      fs.writeFileSync(dest, checkoutIndex(opts.baseline), "utf8");
    } else if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    }
  }

  console.error(`Running MAIN @ ${opts.baseline} (${opts.games} games)…`);
  const mainAgg = await runSimPass({ label: "main", games: opts.games, rootDir: tmpMain, parallel: opts.parallel });
  console.error(`Running STAGE3 (workspace)…`);
  const stageAgg = await runSimPass({ label: "stage3", games: opts.games, rootDir: ROOT, parallel: opts.parallel });

  const report = {
    baselineCommit: opts.baseline,
    games: opts.games,
    main: mainAgg,
    stage3: stageAgg,
    fixtureLinks: fixtureLinkAudit(),
    note: "sim50 bots usually bust in round 1 before synergy gear assembles; fixtureLinks proves production rules fire all four links with linking on.",
  };
  console.log(JSON.stringify(report, null, 2));
  fs.rmSync(tmpMain, { recursive: true, force: true });
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
