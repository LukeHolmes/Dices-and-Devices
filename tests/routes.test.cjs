"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function block(open) {
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}
const routesSource = block('<script id="gutterbones-routes">');

function loadRoutes() {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(routesSource + "\nglobalThis.routes = GutterbonesRoutes;").runInContext(sandbox);
  return sandbox.routes;
}

const BACK_ALLEY = { id: "LOCAL", name: "BACK ALLEY", mod: 1 };
const PAWN = { id: "PAWN", name: "PAWN SHOP", mod: 1.2, reward: 15 };
const SAFEHOUSE = { id: "HIDEOUT", name: "SAFEHOUSE CUT", mod: 1.09, handDelta: 1, discardDelta: -1 };
const BOUNCER = {
  id: "BOUNCER",
  name: "THE BOUNCER",
  applyTarget: (t) => Math.floor(t * 1.5),
};
const THE_RAID = {
  id: "THE_RAID",
  name: "THE RAID",
  applyTarget: (t) => Math.floor(t * 3),
};

test("projectNextRound — early BACK ALLEY from round 1 target 85", () => {
  const routes = loadRoutes();
  const out = routes.projectNextRound({
    path: BACK_ALLEY,
    round: 1,
    target: 85,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.equal(out.nextRound, 2);
  assert.equal(out.nextTarget, 113);
  assert.equal(out.nextTargetDisplay, 113);
  assert.equal(out.nextHands, 4);
  assert.equal(out.nextDiscards, 3);
});

test("projectNextRound — PAWN scales quota higher than alley", () => {
  const routes = loadRoutes();
  const base = { round: 2, target: 113, debt: 0, insaneContract: false, hasLedger: false, personaPlays: 4, personaPills: 3 };
  const alley = routes.projectNextRound({ path: BACK_ALLEY, ...base });
  const pawn = routes.projectNextRound({ path: PAWN, ...base });
  assert.ok(pawn.nextTarget > alley.nextTarget);
  assert.ok(pawn.effectLines.some((l) => l.includes("+$15")));
});

test("projectNextRound — SAFEHOUSE adjusts plays and pills", () => {
  const routes = loadRoutes();
  const out = routes.projectNextRound({
    path: SAFEHOUSE,
    round: 3,
    target: 200,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.equal(out.nextHands, 5);
  assert.equal(out.nextDiscards, 2);
});

test("projectNextRound — debt penalty from round 4 without ledger", () => {
  const routes = loadRoutes();
  const out = routes.projectNextRound({
    path: BACK_ALLEY,
    round: 3,
    target: 200,
    debt: 20,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.ok(out.effectLines.some((l) => l.includes("Debt pressure")));
  const noDebt = routes.projectNextRound({
    path: BACK_ALLEY,
    round: 3,
    target: 200,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.ok(out.nextTarget > noDebt.nextTarget);
});

test("projectNextRound — boss path display quota (Bouncer round 5)", () => {
  const routes = loadRoutes();
  const turf = { id: "BOSS", name: "TURF WAR", mod: 1.4, boss: BOUNCER };
  const out = routes.projectNextRound({
    path: turf,
    round: 4,
    target: 220,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.ok(out.nextTargetDisplay > out.nextTarget);
  assert.ok(out.effectLines.some((l) => l.includes("BOUNCER")));
});

test("projectNextRound — THE RAID path round 9 scale", () => {
  const routes = loadRoutes();
  const raidPath = { id: "RAID", name: "THE RAID", mod: 1, boss: THE_RAID };
  const out = routes.projectNextRound({
    path: raidPath,
    round: 8,
    target: 400,
    debt: 0,
    insaneContract: false,
    hasLedger: false,
    personaPlays: 4,
    personaPills: 3,
  });
  assert.ok(out.nextTargetDisplay >= out.nextTarget * 2);
});

test("sideBetPayout mirrors production formula", () => {
  const routes = loadRoutes();
  assert.equal(routes.sideBetPayout(10, 1.75), 18);
  assert.equal(routes.sideBetPayout(5, 1.75), 9);
  assert.equal(routes.sideBetPayout(1, 1.75), 2);
});

test("wagerThresholdForRound steps by round", () => {
  const routes = loadRoutes();
  assert.equal(routes.wagerThresholdForRound(1), 110);
  assert.equal(routes.wagerThresholdForRound(3), 126);
});

test("pathPickEffects — route shop tags and modifiers", () => {
  const routes = loadRoutes();
  assert.equal(routes.pathPickEffects(BACK_ALLEY).nextShopTag, "balanced");
  assert.equal(Object.keys(routes.pathPickEffects(BACK_ALLEY).routeModifiers).length, 0);
  assert.equal(routes.pathPickEffects(PAWN).nextShopTag, "hardware");
  assert.equal(routes.pathPickEffects(PAWN).routeModifiers.shopDiscount, 0.15);
  assert.equal(routes.pathPickEffects(SAFEHOUSE).routeModifiers.flowCapDelta, -1);
  assert.equal(routes.pathPickEffects({ id: "SMUGGLE" }).nextShopTag, "chaos");
  assert.equal(routes.pathPickEffects({ id: "VIP" }).nextShopTag, "rare");
  assert.equal(routes.pathPickEffects({ id: "VIP" }).routeModifiers.informantWeight, 1);
});

test("effectiveFlowCap applies route flowCapDelta", () => {
  const routes = loadRoutes();
  assert.equal(routes.effectiveFlowCap(6, {}), 6);
  assert.equal(routes.effectiveFlowCap(6, { flowCapDelta: -1 }), 5);
  assert.equal(routes.effectiveFlowCap(6, { flowCapDelta: -8 }), 0);
});

test("describePathModifiers includes shop skew lines", () => {
  const routes = loadRoutes();
  const lines = routes.describePathModifiers(PAWN);
  assert.ok(lines.some((l) => l.includes("HARDWARE")));
  assert.ok(lines.some((l) => l.includes("15%")));
});
