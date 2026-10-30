"use strict";
/**
 * Monte Carlo opening-round simulator using production rules + onboarding categories.
 * Run: node scripts/sim-opening.cjs
 */
const vm = require("node:vm");
const path = require("node:path");
const fs = require("node:fs");
const { createGame, sharedSource } = require("../tests/helpers/game.cjs");
const { dice, bone } = require("../tests/fixtures/runs.cjs");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function block(open) {
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}
const onboardingSource = block('<script id="gutterbones-onboarding">');
const routesSource = block('<script id="gutterbones-routes">');

function loadRulesApi() {
  const g = createGame({
    flowStreak: 0,
    handLevels: {},
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
  });
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(sharedSource + "\nglobalThis.GutterbonesRules = GutterbonesRules;").runInContext(
    sandbox,
  );
  const HAND_MASTERY_TUNING = { baseLevel: 1, chipPerLevel: 5, maxLevel: 8 };
  const scoreCtx = () => ({
    handLevels: {},
    flowStreak: scoreCtx._flow,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING,
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
  });
  scoreCtx._flow = 0;
  const calculateScore = (catId, currentDice) => {
    const ctx = scoreCtx();
    return sandbox.GutterbonesRules.calculateScore(catId, currentDice, ctx);
  };
  return { calculateScore, setFlow: (n) => {
    scoreCtx._flow = n;
  } };
}

function loadOnboarding() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(onboardingSource + "\nglobalThis.ob = GutterbonesOnboarding;").runInContext(
    sandbox,
  );
  return sandbox.ob;
}

function loadRoutes() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(routesSource + "\nglobalThis.routes = GutterbonesRoutes;").runInContext(
    sandbox,
  );
  return sandbox.routes;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDice(rng) {
  return dice(
    Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6)),
  );
}

function bestPlay(api, currentDice, usedCats, categoryIds) {
  let best = { cat: null, total: 0, valid: false };
  for (const catId of categoryIds) {
    if (usedCats.has(catId)) continue;
    const r = api.calculateScore(catId, currentDice);
    if (r.valid && r.total > best.total) {
      best = { cat: catId, total: r.total, valid: true };
    }
  }
  return best;
}

function keepMaskForCategory(catId, values) {
  const mask = [false, false, false, false, false];
  if (!catId) return mask.map(() => false);
  if (["ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES"].includes(catId)) {
    const face = { ONES: 1, TWOS: 2, THREES: 3, FOURS: 4, FIVES: 5, SIXES: 6 }[catId];
    values.forEach((v, i) => {
      if (v === face) mask[i] = true;
    });
    return mask;
  }
  if (catId === "C") {
    return values.map((v) => v >= 4);
  }
  const counts = {};
  values.forEach((v) => {
    counts[v] = (counts[v] || 0) + 1;
  });
  let mode = values[0];
  let modeCount = 0;
  for (const [v, c] of Object.entries(counts)) {
    if (c > modeCount) {
      modeCount = c;
      mode = Number(v);
    }
  }
  if (catId === "TOK" || catId === "FOK" || catId === "Y") {
    values.forEach((v, i) => {
      if (v === mode) mask[i] = true;
    });
    return mask;
  }
  if (catId === "FH") {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const keepVals = new Set(entries.slice(0, 2).map(([v]) => Number(v)));
    values.forEach((v, i) => {
      if (keepVals.has(v)) mask[i] = true;
    });
    return mask;
  }
  return mask;
}

function simulateRound({ pills, plays = 4, rng, totalRuns = 0, holdStrategy = true }) {
  const onboarding = loadOnboarding();
  const categoryIds = onboarding.getAvailableCategoryIds(totalRuns);
  const api = loadRulesApi();
  const usedCats = new Set();
  let flowStreak = 0;
  let heat = 0;

  for (let play = 0; play < plays; play++) {
    let currentDice = rollDice(rng);
    let pillsLeft = pills;
    if (holdStrategy) {
      while (pillsLeft > 0) {
        api.setFlow(flowStreak);
        const prospect = bestPlay(api, currentDice, usedCats, categoryIds);
        if (!prospect.valid || prospect.total < 12) break;
        const values = currentDice.map((d) => d.value);
        const mask = keepMaskForCategory(prospect.cat, values);
        if (!mask.some(Boolean)) break;
        currentDice = currentDice.map((d, i) =>
          mask[i] ? d : bone(1 + Math.floor(rng() * 6), i),
        );
        pillsLeft -= 1;
      }
    }
    api.setFlow(flowStreak);
    const scored = bestPlay(api, currentDice, usedCats, categoryIds);
    if (!scored.valid) {
      flowStreak = 0;
      continue;
    }
    usedCats.add(scored.cat);
    heat += scored.total;
    flowStreak += 1;
  }
  return heat;
}

function probClear({ target, pills, iterations, seed, totalRuns = 0, holdStrategy = true }) {
  const rng = mulberry32(seed);
  let clears = 0;
  for (let i = 0; i < iterations; i++) {
    if (simulateRound({ pills, rng, totalRuns, holdStrategy }) >= target) clears += 1;
  }
  return clears / iterations;
}

const BACK_ALLEY = { id: "LOCAL", name: "BACK ALLEY", mod: 1 };

function projectRoundTarget(routes, startTarget, fromRound, toRound) {
  let target = startTarget;
  let round = fromRound;
  while (round < toRound) {
    const out = routes.projectNextRound({
      path: BACK_ALLEY,
      round,
      target,
      debt: 0,
      insaneContract: false,
      hasLedger: false,
      personaPlays: 4,
      personaPills: 3,
    });
    target = out.nextTarget;
    round = out.nextRound;
  }
  return target;
}

function main() {
  const iterations = 8000;
  const seed = 0x6e202610;
  const personas = [
    ["Street Rat / Counter", 3],
    ["Hustler", 2],
    ["Enforcer", 0],
  ];
  const targets = [85, 100, 130];
  console.log(`Opening sim (${iterations} rounds, seed ${seed}, first-run categories)\n`);
  console.log("| Persona (pills) | T≥85 | T≥100 | T≥130 |");
  console.log("|---|---|---|---|");
  for (const [name, pills] of personas) {
    const cols = targets.map((t) => probClear({ target: t, pills, iterations, seed }).toFixed(2));
    console.log(`| ${name} (${pills}) | ${cols.join(" | ")} |`);
  }
  const routes = loadRoutes();
  const r6 = projectRoundTarget(routes, 85, 1, 6);
  console.log(`\nBack Alley quota entering round 6 (from R1 @85): ${r6}`);
}

if (require.main === module) main();

module.exports = {
  mulberry32,
  simulateRound,
  probClear,
  projectRoundTarget,
  loadRoutes,
  loadRulesApi,
  BACK_ALLEY,
};
