#!/usr/bin/env node
"use strict";
/**
 * R78 diagnostic branch — bounded balance observer traces (no regression gate).
 * Usage: node scripts/r78-bounded-balance-trace.cjs
 * Env: MAX_STEPS (default 1000), PARALLEL (default 2), DEADLINE_MS (default 900000)
 */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = process.env.R78_TRACE_ARTIFACT_DIR || "/opt/cursor/artifacts";
const MAX_STEPS = Number(process.env.MAX_STEPS || 1000);
const PARALLEL = Math.min(2, Math.max(1, Number(process.env.PARALLEL || 2)));
const DEADLINE_MS = Number(process.env.DEADLINE_MS || 15 * 60 * 1000);
const BOT = fs.readFileSync(path.join(ROOT, "tests/sim/in-page-bot.js"), "utf8");

const JOBS = [
  { rid: 16, attempt: 0, label: "rid16-a0-run1" },
  { rid: 16, attempt: 0, label: "rid16-a0-run2" },
  { rid: 0, attempt: 0, label: "rid0-a0" },
  { rid: 7, attempt: 0, label: "rid7-a0" },
  { rid: 23, attempt: 0, label: "rid23-a0" },
];

const ORGANIC_PAIRS = [
  "blood_ripple→fuse_spark",
  "fuse_spark→engine_link",
  "ghost_echo→bookends_retrigger",
  "wire_feed→crowbar_cascade",
];

function stableStringify(obj) {
  return JSON.stringify(obj, (_, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {})
    : v));
}

function ledgerFingerprint(ledger) {
  if (!ledger) return null;
  const obs = ledger;
  const scores = (obs.events || []).filter((e) => e.type === "score");
  const linkKeys = scores.flatMap((e) => (e.score?.chainLinks || []).map((l) => `${l.from}→${l.to}`)).sort();
  return {
    eventCount: obs.events?.length || 0,
    scoreCount: scores.length,
    terminal: obs.terminal || null,
    semanticFp: typeof window !== "undefined" ? null : linkKeys.join("|"),
    linkKeys,
  };
}

function analyzeRun(payload) {
  const hands = payload.telem?.hands || [];
  const scores = (payload.ledger?.events || []).filter((e) => e.type === "score");
  const preds = payload.organicPredicateDiag || [];
  const chainAnalysis = hands.map((h, idx) => {
    const links = (h.chainLinks || []).map((l) => `${l.from}→${l.to}`);
    const organicPairs = links.filter((k) => ORGANIC_PAIRS.includes(k));
    const predAtScore = preds.filter((p) => p.kind === "executePayout");
    return {
      handIndex: idx,
      total: h.total,
      round: h.round,
      valid: h.valid,
      chainDepth: h.chainDepth,
      synergyChainIds: h.synergyChainIds || [],
      chainLinks: links,
      organicPairs,
      caps: {
        chainMultBonusUsed: h.chainMultBonusUsed,
        chainMultCapHit: h.chainMultCapHit,
        debtCollectorCapped: h.debtCollectorCapped,
      },
    };
  });

  const eligibleMoments = preds.filter((p) => {
    const uf = p.unfulfilled || [];
    return (p.preds?.ghost_echo?.eligible || p.preds?.bookends_retrigger?.eligible)
      || uf.length > 0
      || p.evalPred_has_target_pair;
  });

  const firstEligibleNoLink = (() => {
    for (const h of chainAnalysis) {
      if (h.organicPairs.length) return null;
      if ((h.synergyChainIds || []).includes("ghost_echo") && !h.chainLinks.length) {
        return { handIndex: h.handIndex, reason: "ghost_echo_synergy_without_pairwise_link", detail: h };
      }
    }
    const lastPred = preds.find((p) => (p.unfulfilled || []).length > 0);
    if (lastPred) {
      return {
        kind: "predicate_unfulfilled",
        catId: lastPred.catId,
        unfulfilled: lastPred.unfulfilled,
        parity: lastPred.parity,
      };
    }
    return { kind: "no_scored_hand_with_eligible_ghost_bookends", handsScored: hands.length };
  })();

  return {
    handsScored: hands.length,
    chainAnalysis,
    eligibleMoments: eligibleMoments.slice(0, 40),
    firstMiss: firstEligibleNoLink,
    pairwiseLinkHands: hands.filter((h) =>
      (h.chainLinks || []).some((l) => l.from === "ghost_echo" && l.to === "bookends_retrigger"),
    ).length,
    synergyHist: hands.reduce((acc, h) => {
      (h.synergyChainIds || []).forEach((id) => { acc[id] = (acc[id] || 0) + 1; });
      return acc;
    }, {}),
    scoreEvents: scores.length,
  };
}

async function runOneJob({ serverPort, job, deadlineAt }) {
  if (Date.now() > deadlineAt) {
    return {
      ...job,
      infrastructureFailure: true,
      reason: "deadline_exceeded_before_start",
    };
  }
  const seed = job.rid * 7919;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await context.addInitScript(() => {
    const orig = Math.random;
    const IGNORE_STACK_RE = /gutterbones-audio|react-dom|scheduler|chrome-extension/i;
    const GAME_STACK_RE = /index\.html|rollBones|reroll|gamble|blueprint|sniff|Smuggle|generateShop|carve|resolveFlip|beginContract|GutterbonesRoutes/i;
    window.__GB_UNSEEDED_RNG__ = { count: 0, sites: [], note: "decision-path Math.random only (audio/react excluded)" };
    Math.random = function unseededAudit() {
      const stack = new Error().stack || "";
      if (IGNORE_STACK_RE.test(stack) || !GAME_STACK_RE.test(stack)) return orig.call(Math);
      window.__GB_UNSEEDED_RNG__.count += 1;
      const line = stack.split("\n")[2] || "unknown";
      if (window.__GB_UNSEEDED_RNG__.sites.length < 32) {
        window.__GB_UNSEEDED_RNG__.sites.push(line.trim());
      }
      return orig.call(Math);
    };
  });
  const page = await context.newPage();
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  try {
    await page.goto(
      `${baseUrl}/index.html?e2e=1&balanceObserver=1&organicDiag=1`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    await page.waitForFunction(() => window.__GB_E2E__ && window.__GB_BALANCE_OBSERVER__?.enabled, {
      timeout: 120_000,
    });
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
      localStorage.setItem(
        "gutterbones1977:meta:v1",
        JSON.stringify({
          totalRuns: 12,
          victories: 2,
          unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
          unlockedFaceIds: [
            "MULT_FACE", "GOLD_FACE", "BLOOD_6", "WILD_FACE", "ECHO_FACE", "GHOST_FACE",
            "SHIV_FACE", "WIREBAG_FACE", "MAGNET_FACE", "MARK_FACE", "FUSE_FACE", "DOUBLE_DOWN_FACE",
          ],
          unlockedHardwareIds: [
            "BOOKENDS", "LOADED_DIE", "BRASS_KNUCKLES", "BLACK_BOOK", "BURNER_PHONE", "CROWBAR",
            "ENGINE", "FUSE_BOX", "MIRROR_RIG", "DEBT_COLLECTOR", "HOT_STREAK_COIL", "CENTERPIECE",
          ],
          purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
        }),
      );
      localStorage.removeItem("gutterbones1977:run:v1");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_E2E__ && window.__GB_BALANCE_OBSERVER__?.enabled, {
      timeout: 60_000,
    });

    const botResult = await page.evaluate(
      async ({ botSource, opts }) => {
        // eslint-disable-next-line no-eval
        eval(botSource);
        return runBotSession(opts);
      },
      {
        botSource: BOT,
        opts: {
          maxSteps: MAX_STEPS,
          seed,
          strategy: "builder",
          stuckThreshold: 48,
          maxFallbacks: 36,
        },
      },
    );

    const harvested = await page.evaluate(() => {
      const hands = window.__GB_SIM_TELEM__?.hands || [];
      const bootstrap = window.__GB_E2E__?.getBootstrapFingerprint?.() || null;
      const organicReady = window.__GB_E2E__?.getOrganicChainSnapshot?.() || null;
      const ledger = window.__GB_BALANCE_OBSERVER__?.exportLedger?.()
        || window.__GB_BALANCE_OBSERVER__?.toJSON?.()
        || null;
      return {
        hands,
        bootstrap,
        organicReady,
        ledger,
        organicPredicateDiag: window.__GB_ORGANIC_PREDICATE_DIAG__ || [],
        unseededRng: window.__GB_UNSEEDED_RNG__ || { count: 0, sites: [] },
        state: window.__GB_E2E__?.getState?.() || null,
      };
    });

    const out = {
      ...job,
      seed,
      maxSteps: MAX_STEPS,
      bot: botResult,
      infrastructureFailure: false,
      ...harvested,
      analysis: null,
    };
    out.analysis = analyzeRun({
      telem: { hands: harvested.hands },
      ledger: harvested.ledger,
      organicPredicateDiag: harvested.organicPredicateDiag,
    });
    const seeded = !!harvested.bootstrap?.rngSeeded;
    const gameUnseeded = (harvested.unseededRng?.count || 0) > 0;
    out.outsideDeterministicCoverage = seeded && gameUnseeded;
    out.seededRngCalls = harvested.bootstrap?.rngCalls ?? null;
    return out;
  } catch (e) {
    return {
      ...job,
      seed,
      infrastructureFailure: true,
      reason: "playwright_or_harness_error",
      detail: String(e && e.message ? e.message : e),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const t0 = Date.now();
  const deadlineAt = t0 + DEADLINE_MS;

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
  const serverPort = server.address().port;

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < JOBS.length) {
      const i = cursor++;
      const job = JOBS[i];
      process.stderr.write(`[r78-trace] start ${job.label}\n`);
      const row = await runOneJob({ serverPort, job, deadlineAt });
      results.push(row);
      const ledgerPath = path.join(ARTIFACT_DIR, `r78-ledger-${job.label}.json`);
      if (row.ledger) {
        fs.writeFileSync(ledgerPath, `${JSON.stringify(row.ledger, null, 2)}\n`);
      }
      const runPath = path.join(ARTIFACT_DIR, `r78-trace-${job.label}.json`);
      const { ledger, ...sansLedger } = row;
      fs.writeFileSync(runPath, `${JSON.stringify({ ...sansLedger, ledgerPath: row.ledger ? ledgerPath : null }, null, 2)}\n`);
      process.stderr.write(
        `[r78-trace] done ${job.label} steps=${row.bot?.steps} hands=${row.analysis?.handsScored} unseeded=${row.unseededRng?.count}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, () => worker()));
  server.close();

  const r16 = results.filter((r) => r.rid === 16);
  let rid16Identical = null;
  if (r16.length === 2 && !r16[0].infrastructureFailure && !r16[1].infrastructureFailure) {
    const handFp = (row) => stableStringify((row.hands || []).map((h) => ({
      total: h.total,
      round: h.round,
      chainDepth: h.chainDepth,
      chainLinks: (h.chainLinks || []).map((l) => `${l.from}→${l.to}`).sort(),
      synergyChainIds: [...(h.synergyChainIds || [])].sort(),
    })));
    rid16Identical = handFp(r16[0]) === handFp(r16[1]);
  }

  const summary = {
    branch: "cursor/r78-diagnostic-traces",
    headNote: "R78 @ 59e11dc + observer port (89210e3 cherry-pick)",
    maxSteps: MAX_STEPS,
    parallel: PARALLEL,
    durationMs: Date.now() - t0,
    rid16Attempt0Identical: rid16Identical,
    runs: results.map((r) => ({
      label: r.label,
      rid: r.rid,
      seed: r.seed,
      infrastructureFailure: r.infrastructureFailure,
      outsideDeterministicCoverage: r.outsideDeterministicCoverage,
      unseededRngCount: r.unseededRng?.count ?? null,
      unseededSites: r.unseededRng?.sites ?? [],
      bot: r.bot,
      handsScored: r.analysis?.handsScored,
      pairwiseLinkHands: r.analysis?.pairwiseLinkHands,
      synergyHist: r.analysis?.synergyHist,
      firstMiss: r.analysis?.firstMiss,
      organicReady: r.organicReady,
      ledgerArtifact: r.ledger ? path.join(ARTIFACT_DIR, `r78-ledger-${r.label}.json`) : null,
      traceArtifact: path.join(ARTIFACT_DIR, `r78-trace-${r.label}.json`),
    })),
    wp2Recommendations: [
      "Bank legal clears that meet quota (builder probes already show immediate-score defect on R78).",
      "Score category C when organic predicates show ghost_echo+bookends eligible but bot picks another row.",
      "Defer reroll until after assessing best legal payout vs quota gap; preserve lone Ghost/Echo on board.",
    ],
  };

  const summaryPath = path.join(ARTIFACT_DIR, "r78-bounded-trace-summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ summaryPath, rid16Identical: rid16Identical, durationMs: summary.durationMs }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
