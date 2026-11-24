"use strict";
/**
 * Gutterbones 1977 — balance analysis (EV + opening-clear).
 * Loads PRODUCTION rules once (tests/helpers/game.cjs + vm), then:
 *  1. Exhaustively evaluates all 6^5 = 7776 single-roll hands per category.
 *  2. Runs a compact opening-round sim at target 75 per persona pill count.
 * Run: node scripts/balance-ev.cjs   (from repo root)
 */
const vm = require("node:vm");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const { createGame, sharedSource } = require(path.join(REPO, "tests/helpers/game.cjs"));
const { dice } = require(path.join(REPO, "tests/fixtures/runs.cjs"));

// ---- load rules once ----
const g = createGame({ flowStreak: 0, handLevels: {}, inventory: [], hardwareDisabled: false, activeBoss: null });
const HAND_MASTERY_TUNING = { baseLevel: 1, chipPerLevel: 5, maxLevel: 8 };
const CATEGORIES = g.api.CATEGORIES;

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(sharedSource + "\nglobalThis.GutterbonesRules = GutterbonesRules;").runInContext(sandbox);

let flow = 0;
function scoreCtx() {
  return {
    handLevels: {},
    flowStreak: flow,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES,
    HAND_MASTERY_TUNING,
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
  };
}
const calculateScore = (catId, currentDice) =>
  sandbox.GutterbonesRules.calculateScore(catId, currentDice, scoreCtx());

// ---- exhaustive single-roll EV ----
const CAT_IDS = Object.keys(CATEGORIES);
const evs = {};
for (const c of CAT_IDS) evs[c] = { valid: 0, sum: 0, validSum: 0, max: 0 };
for (let n = 0; n < 7776; n++) {
  let x = n;
  const vals = [];
  for (let i = 0; i < 5; i++) { vals.push((x % 6) + 1); x = Math.floor(x / 6); }
  const d = dice(vals);
  for (const c of CAT_IDS) {
    const r = calculateScore(c, d);
    if (r.valid) {
      evs[c].valid++;
      evs[c].sum += r.total;
      evs[c].validSum += r.total;
      if (r.total > evs[c].max) evs[c].max = r.total;
    }
  }
}

console.log("=== Single-roll category EV (5 fresh standard dice, no faces/flow/mastery) ===");
console.log("category | P(valid) | E[heat] (incl misses) | E[heat|valid] | max");
console.log("--- | --- | --- | --- | ---");
const sorted = CAT_IDS.slice().sort((a, b) => evs[b].sum / 7776 - evs[a].sum / 7776);
for (const c of sorted) {
  const e = evs[c];
  const pv = (e.valid / 7776).toFixed(3);
  const evMean = (e.sum / 7776).toFixed(1);
  const evV = (e.validSum / e.valid).toFixed(1);
  console.log(`${c} | ${pv} | ${evMean} | ${evV} | ${e.max}`);
}

// ---- opening sim (rules loaded once) ----
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// limited onboarding sheet for totalRuns=0: upper + TOK + FH + C
const LIMITED = ['ONES','TWOS','THREES','FOURS','FIVES','SIXES','TOK','FH','C'];

function bestPlay(d, usedCats) {
  let best = { cat: null, total: 0, valid: false };
  for (const c of LIMITED) {
    if (usedCats.has(c)) continue;
    const r = calculateScore(c, d);
    if (r.valid && r.total > best.total) best = { cat: c, total: r.total, valid: true };
  }
  return best;
}
function keepMask(catId, vals) {
  const m = [false,false,false,false,false];
  if (!catId) return m;
  const face = { ONES:1,TWOS:2,THREES:3,FOURS:4,FIVES:5,SIXES:6 }[catId];
  if (face != null) { vals.forEach((v,i)=>{ if(v===face) m[i]=true; }); return m; }
  if (catId === 'C') return vals.map(v => v >= 4);
  const counts = {}; vals.forEach(v => counts[v]=(counts[v]||0)+1);
  let mode = vals[0], mc = 0;
  for (const [v,c] of Object.entries(counts)) if (c>mc) { mc=c; mode=Number(v); }
  if (catId === 'TOK') { vals.forEach((v,i)=>{ if(v===mode) m[i]=true; }); return m; }
  if (catId === 'FH') {
    const ent = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const keep = new Set(ent.slice(0,2).map(([v])=>Number(v)));
    vals.forEach((v,i)=>{ if(keep.has(v)) m[i]=true; });
    return m;
  }
  return m;
}
function simulateRound(pills, plays, rng) {
  const used = new Set(); let heat = 0; let streak = 0;
  for (let play = 0; play < plays; play++) {
    let vals = Array.from({length:5}, () => 1 + Math.floor(rng()*6));
    let d = dice(vals);
    let left = pills;
    while (left > 0) {
      flow = streak;
      const p = bestPlay(d, used);
      if (!p.valid || p.total < 12) break;
      const m = keepMask(p.cat, vals);
      if (!m.some(Boolean)) break;
      vals = vals.map((v,i)=> m[i] ? v : 1 + Math.floor(rng()*6));
      d = dice(vals); left--;
    }
    flow = streak;
    const scored = bestPlay(d, used);
    if (!scored.valid) { streak = 0; continue; }
    used.add(scored.cat); heat += scored.total; streak++;
  }
  return heat;
}
function probClear(target, pills, plays, seed, iters) {
  const rng = mulberry32(seed); let clears = 0;
  for (let i=0;i<iters;i++) if (simulateRound(pills, plays, rng) >= target) clears++;
  return clears/iters;
}

console.log("\n=== Opening clear rate @75 (limited sheet, greedy hold, 8000 iters) ===");
console.log("pills | plays | P(clear>=75)");
for (const [pills, plays] of [[0,4],[1,4],[2,4],[3,4],[2,5]]) {
  const p = probClear(75, pills, plays, 0x6e202610, 8000);
  console.log(`${pills} | ${plays} | ${p.toFixed(3)}`);
}
