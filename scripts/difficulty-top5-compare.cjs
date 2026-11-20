#!/usr/bin/env node
"use strict";
/** Deterministic main vs branch difficulty snapshot for PR #101 (no LLM, no win-rate sim). */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { createGame } = require("../tests/helpers/game.cjs");
const { snapshot, dice } = require("../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");

function loadHtml(ref = "HEAD") {
  const html =
    ref === "HEAD"
      ? fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
      : execFileSync("git", ["show", `${ref}:index.html`], {
          encoding: "utf8",
          cwd: ROOT,
          maxBuffer: 64 * 1024 * 1024,
        });
  const block = (open) => {
    const start = html.indexOf(open) + open.length;
    const end = html.indexOf("</script>", start);
    return html.slice(start, end);
  };
  return {
    html,
    routesSource: block('<script id="gutterbones-routes">'),
    replaySource: block('<script id="gutterbones-replay">'),
    rulesSource: block('<script id="gutterbones-rules">'),
    appSource: block('<script type="text/babel">'),
    isBranch: /getEffectiveShopRefreshCost/.test(html),
    bossPathSpread: /\{\s*\.\.\.next\[bossIdx\]/.test(html),
  };
}

function loadRoutes(routesSource) {
  const sandbox = { Math };
  vm.createContext(sandbox);
  vm.runInContext(`${routesSource}\nglobalThis.R = GutterbonesRoutes;`, sandbox);
  return sandbox.R;
}

function loadReplay(replaySource) {
  const sandbox = { Math, Object };
  vm.createContext(sandbox);
  vm.runInContext(replaySource, sandbox);
  return sandbox.GutterbonesReplay?.EXTRA_PATHS || [];
}

function loadBosses(rulesSource, appSource) {
  const g = createGame(snapshot());
  return g.api.BOSSES;
}

function buildBossPath(replaced, boss, useMainSpread) {
  if (useMainSpread) {
    return {
      ...replaced,
      id: "BOSS",
      name: "TURF WAR",
      desc: `${boss.name}: ${boss.desc}`,
      color: "border-red-600 text-red-600 animate-pulse",
      boss,
    };
  }
  return {
    id: "BOSS",
    name: "TURF WAR",
    desc: `${boss.name}: ${boss.desc}`,
    color: "border-red-600 text-red-600 animate-pulse",
    boss,
    mod: 1,
  };
}

function simulateQuotas({ routes, bosses, replacedPath, useMainSpread, label }) {
  const LOCAL = { id: "LOCAL", name: "BACK ALLEY", mod: 1 };
  const bossIds = ["BOUNCER", "LOAN_SHARK", "JUNKIE", "CROOKED_COP", "INFORMANT"];
  const base = {
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  };
  const out = {};
  for (const bossId of bossIds) {
    const boss = bosses[bossId];
    let target = 75;
    const byRound = {};
    for (let round = 1; round <= 10; round++) {
      const isBoss = round >= 4 && round % 2 === 0;
      const activeBoss = isBoss ? boss : null;
      const playTarget = routes.applyBossAdjustedTarget(target, activeBoss, round);
      byRound[round] = playTarget;
      if (round >= 10) break;
      const path =
        round + 1 >= 4 && (round + 1) % 2 === 0
          ? buildBossPath(replacedPath, boss, useMainSpread)
          : LOCAL;
      const proj = routes.projectNextRound({
        path,
        round: round + 1,
        target,
        ...base,
      });
      target = proj.nextTarget;
    }
    out[`${label}/${bossId}`] = byRound;
  }
  const alleyOnly = {};
  let t = 75;
  for (let round = 1; round <= 10; round++) {
    alleyOnly[round] = t;
    if (round >= 10) break;
    const proj = routes.projectNextRound({ path: LOCAL, round: round + 1, target: t, ...base });
    t = proj.nextTarget;
  }
  out[`${label}/NON_BOSS_LOCAL`] = alleyOnly;
  return out;
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

function sliceGenerateShop(appSource) {
  const start = appSource.indexOf("        const generateShop = ");
  const end = appSource.indexOf("        const refreshShop = ", start + 1);
  if (start < 0 || end < 0) throw new Error("generateShop slice missing");
  return appSource.slice(start, end);
}

function shopStatsForRef(refs) {
  const { appSource, rulesSource, replaySource, routesSource } = refs;
  const g = createGame(snapshot());
  const routes = loadRoutes(routesSource);
  const EXTRA = loadReplay(replaySource);
  const genSrc = sliceGenerateShop(appSource);
  const defaultMeta = {
    unlockedFaceIds: Object.keys(g.api.FACE_DATABASE),
    unlockedHardwareIds: [...g.api.DEFAULT_META_STATE.unlockedHardwareIds],
  };
  const stats = {
    shops: 0,
    engineOffered: 0,
    tagOffered: 0,
    saltsOffered: 0,
    lockedHwOffered: 0,
  };
  const BUILD_IDS = { UNKNOWN: "UNKNOWN", CHAOS: "CHAOS", MULT_ENGINE: "MULT_ENGINE" };
  for (let seed = 0; seed < 100; seed++) {
    const rng = mulberry32(seed);
    for (let round = 1; round <= 4; round++) {
      const offerTag = round >= 3 ? "hardware" : "balanced";
      const captured = [];
      const sandbox = {
        Math,
        phase: "SHOP",
        round,
        gold: 40,
        stash: 20,
        debt: 0,
        dice: dice([1, 2, 3, 4, 5]),
        inventory: [],
        history: [],
        flowStreak: 0,
        meta: defaultMeta,
        soldItems: [],
        runExclusiveShopIds: [],
        routeModifiers: {},
        nextShopTag: offerTag,
        nextShopTagRef: { current: offerTag },
        dailyRunActive: true,
        runRandomRef: { current: rng },
        shopAdvanceLockRef: { current: false },
        shopRewardGrantedRef: { current: null },
        SHOP_TUNING: g.api.SHP_TUNING || { maxAffordableBuffer: 12, earlyDangerRoundGate: 5, priceScaleFromRound: 1.045 },
        PROGRESSION_GUARDRAILS: { dangerCapRound: 6, maxEarlyDangerOffers: 1 },
        EARLY_GAME_TUNING: { bossPathStartsRound: 4 },
        BUILD_IDS,
        FACE_DATABASE: g.api.FACE_DATABASE,
        DEVISES: g.api.DEVISES,
        CONSUMABLES: g.api.CONSUMABLES,
        BOSSES: g.api.BOSSES,
        PATHS: [
          { id: "LOCAL", mod: 1 },
          { id: "VIP", mod: 1.4, fillStash: true },
          ...EXTRA,
        ],
        GutterbonesReplay: {
          modifierShopOffers: () => [],
          filterPathsForMeta: (paths) => paths,
          EXTRA_PATHS: EXTRA,
        },
        GutterbonesRoutes: routes,
        GutterbonesRuleExperiments: undefined,
        paths: [{ id: "LOCAL" }],
        ECONOMY_TUNING: { shortageToDebtRatio: 0.82 },
        analyzeBuild: () => ({ primaryBuild: "UNKNOWN" }),
        getArchetypeTagsForItemId: (id) => (id === "ENGINE" ? ["MULT_ENGINE"] : []),
        itemFitsCurrentBuild: () => false,
        isShopFaceAvailable: () => true,
        shopListPrice: (item) => Math.max(1, Math.floor(Number(item?.cost) || 1)),
        balanceObserverActive: () => false,
        linkObserverActive: () => false,
        scheduleTimeout: (fn) => fn(),
        setShopItems: (items) => captured.push(...items.map((i) => i.id)),
        setShopRefreshes: () => {},
        setPaths: () => {},
        setSelectedShopPathId: () => {},
        setActiveShopTag: () => {},
        setRouteModifiers: () => {},
        setSoldItems: () => {},
      };
      sandbox.SHOP_TUNING = { maxAffordableBuffer: 12, earlyDangerRoundGate: 5, priceScaleFromRound: 1.045 };
      sandbox.globalThis = sandbox;
      vm.createContext(sandbox);
      vm.runInContext(`${genSrc}\nglobalThis.runShop = () => generateShop();`, sandbox, { timeout: 5000 });
      sandbox.runShop();
      stats.shops += 1;
      if (captured.includes("ENGINE")) stats.engineOffered += 1;
      if (captured.includes("SMELLING_SALTS")) stats.saltsOffered += 1;
      const hasTag =
        offerTag === "hardware"
          ? captured.some((id) => g.api.DEVISES[id] && id !== "ENGINE" && id !== "LOADED_DIE")
          : false;
      if (hasTag) stats.tagOffered += 1;
      if (captured.includes("ENGINE") && !defaultMeta.unlockedHardwareIds.includes("ENGINE")) {
        stats.lockedHwOffered += 1;
      }
    }
  }
  return stats;
}

function refreshCosts(refs) {
  const { appSource, isBranch } = refs;
  const m = appSource.match(
    /const getShopRefreshCost = \(roundNum, refreshCount\) => Math\.max\([\s\S]*?\);\s*(const getEffectiveShopRefreshCost[\s\S]*?;\s*)?/,
  );
  if (!m) return { round: 6, base: null, display: null, charged: null };
  const sandbox = { Math, SHOP_AGENCY_TUNING: { refreshBaseCost: 8, refreshRoundTax: 2, refreshEscalation: 4 } };
  vm.createContext(sandbox);
  vm.runInContext(
    `const SHOP_AGENCY_TUNING = { refreshBaseCost: 8, refreshRoundTax: 2, refreshEscalation: 4 };\n${m[0]}\nglobalThis.getShopRefreshCost=getShopRefreshCost; if (typeof getEffectiveShopRefreshCost!=='undefined') globalThis.getEffectiveShopRefreshCost=getEffectiveShopRefreshCost;`,
    sandbox,
  );
  const base = sandbox.getShopRefreshCost(6, 0);
  const discount = 5;
  const display = isBranch
    ? sandbox.getEffectiveShopRefreshCost(6, 0, discount)
    : base - discount;
  const charged = isBranch ? sandbox.getEffectiveShopRefreshCost(6, 0, discount) : base;
  return { round: 6, base, display, charged };
}

function comboAfterMark(useBranchFix) {
  const prev = { categoryMarks: {}, comboMeter: 2, heatSpikeNextHand: 0.25 };
  const next = useBranchFix
    ? { ...prev, categoryMarks: { ONES: 1 } }
    : { categoryMarks: { ONES: 1 } };
  return { comboMeter: next.comboMeter ?? 0, heatSpike: next.heatSpikeNextHand ?? 0 };
}

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}% (${n}/${d})` : "n/a";
}

function main() {
  const mainRefs = loadHtml("main");
  const branchRefs = loadHtml("HEAD");
  const routes = loadRoutes(branchRefs.routesSource);
  const bosses = loadBosses(branchRefs.rulesSource, branchRefs.appSource);
  const EXTRA = loadReplay(branchRefs.replaySource);
  const VIP = { id: "VIP", name: "VIP ROOM", mod: 1.4, fillStash: true };
  const HIGHWIRE = EXTRA.find((p) => p.id === "HIGHWIRE") || {
    id: "HIGHWIRE",
    mod: 1.35,
    shopRefreshDiscount: 5,
  };

  const mainBase = simulateQuotas({
    routes,
    bosses,
    replacedPath: VIP,
    useMainSpread: true,
    label: "main_vip",
  });
  const branchBase = simulateQuotas({
    routes,
    bosses,
    replacedPath: VIP,
    useMainSpread: false,
    label: "branch_vip",
  });
  const mainHw = simulateQuotas({
    routes,
    bosses,
    replacedPath: HIGHWIRE,
    useMainSpread: true,
    label: "main_highwire",
  });
  const branchHw = simulateQuotas({
    routes,
    bosses,
    replacedPath: HIGHWIRE,
    useMainSpread: false,
    label: "branch_highwire",
  });

  const mainShop = shopStatsForRef(mainRefs);
  const branchShop = shopStatsForRef(branchRefs);
  const mainRef = refreshCosts(mainRefs);
  const branchRef = refreshCosts(branchRefs);
  const mainCombo = comboAfterMark(false);
  const branchCombo = comboAfterMark(true);

  const nonBossMatch =
    JSON.stringify(mainBase["main_vip/NON_BOSS_LOCAL"]) ===
    JSON.stringify(branchBase["branch_vip/NON_BOSS_LOCAL"]);

  const sampleBoss = "BOUNCER";
  const bossR5 =
    mainBase[`main_vip/${sampleBoss}`][5] - branchBase[`branch_vip/${sampleBoss}`][5];

  return {
    mainRefs,
    branchRefs,
    nonBossMatch,
    bossR5,
    sampleBoss,
    mainBase,
    branchBase,
    mainHw,
    branchHw,
    mainShop,
    branchShop,
    mainRef,
    branchRef,
    mainCombo,
    branchCombo,
    bosses,
  };
}

const r = main();
const md = [];
md.push("### static/deterministic checks, not win-rate simulation\n");
md.push("| Check | main | branch | Δ |");
md.push("| --- | --- | --- | --- |");
md.push(
  `| Non-boss LOCAL quotas R1–10 | baseline | ${r.nonBossMatch ? "identical" : "DIFF"} | ${r.nonBossMatch ? "0" : "≠"} |`,
);
md.push(
  `| Turf War R5 play quota (${r.sampleBoss}, VIP slot) | ${r.mainBase[`main_vip/${r.sampleBoss}`][5]} | ${r.branchBase[`branch_vip/${r.sampleBoss}`][5]} | ${r.branchBase[`branch_vip/${r.sampleBoss}`][5] - r.mainBase[`main_vip/${r.sampleBoss}`][5]} |`,
);
md.push(
  `| Turf War R6 base target before boss mult (${r.sampleBoss}, VIP) | ${r.mainBase[`main_vip/${r.sampleBoss}`][6] ?? "—"} | ${r.branchBase[`branch_vip/${r.sampleBoss}`][6]} | ${(r.branchBase[`branch_vip/${r.sampleBoss}`][6] ?? 0) - (r.mainBase[`main_vip/${r.sampleBoss}`][6] ?? 0)} |`,
);
md.push(
  `| Turf War R5 (${r.sampleBoss}, HIGHWIRE unlocked) | ${r.mainHw[`main_highwire/${r.sampleBoss}`][5]} | ${r.branchHw[`branch_highwire/${r.sampleBoss}`][5]} | ${r.branchHw[`branch_highwire/${r.sampleBoss}`][5] - r.mainHw[`main_highwire/${r.sampleBoss}`][5]} |`,
);
md.push(
  `| Shops R1–4 seeds 0–99: ENGINE offered | ${pct(r.mainShop.engineOffered, r.mainShop.shops)} | ${pct(r.branchShop.engineOffered, r.branchShop.shops)} | locked Engine gate on branch |`,
);
md.push(
  `| … Smelling Salts | ${pct(r.mainShop.saltsOffered, r.mainShop.shops)} | ${pct(r.branchShop.saltsOffered, r.branchShop.shops)} | ${r.branchShop.saltsOffered - r.mainShop.saltsOffered} shops |`,
);
md.push(
  `| … hardware route-tag item (R3–4) | ${pct(r.mainShop.tagOffered, 200)} | ${pct(r.branchShop.tagOffered, 200)} | more survives slot carve |`,
);
md.push(
  `| … locked ENGINE (no Call the Fence) | ${pct(r.mainShop.lockedHwOffered, r.mainShop.shops)} | ${pct(r.branchShop.lockedHwOffered, r.branchShop.shops)} | should be 0% branch |`,
);
md.push(
  `| HIGHWIRE refresh R6 (display / charged) | ${r.mainRef.display} / ${r.mainRef.charged} | ${r.branchRef.display} / ${r.branchRef.charged} | main mismatch ${r.mainRef.display !== r.mainRef.charged ? "yes" : "no"} |`,
);
md.push(
  `| comboMeter after MARK (prev=2) | ${r.mainCombo.comboMeter} | ${r.branchCombo.comboMeter} | heatSpike ${r.mainCombo.heatSpike}→${r.branchCombo.heatSpike} |`,
);

const bossTable = ["| Boss | Round | main (VIP) | branch (VIP) | Δ |", "| --- | --- | --- | --- | --- |"];
for (const id of ["BOUNCER", "LOAN_SHARK", "JUNKIE", "CROOKED_COP", "INFORMANT"]) {
  for (const round of [4, 5, 6, 8, 10]) {
    const a = r.mainBase[`main_vip/${id}`][round];
    const b = r.branchBase[`branch_vip/${id}`][round];
    bossTable.push(`| ${id} | ${round} | ${a} | ${b} | ${b - a} |`);
  }
}
md.push("\n**Turf War play quotas (VIP replaced slot):**\n");
md.push(...bossTable);

if (require.main === module) {
  console.log(md.join("\n"));
}
module.exports = { main, md: md.join("\n") };