"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { createGame } = require("./helpers/game.cjs");
const { snapshot, dice, bone } = require("./fixtures/runs.cjs");
const {
  createBalanceObserver,
  observeCalculateScore,
  scoringParityDigest,
  ruleShaFromRepo,
} = require("./helpers/balance-observer.cjs");

const ROOT = path.join(__dirname, "..");

function scoreContext(g, overrides = {}) {
  return {
    handLevels: {},
    flowStreak: 0,
    debt: 0,
    inventory: [],
    hardwareDisabled: false,
    activeBoss: null,
    CATEGORIES: g.api.CATEGORIES,
    HAND_MASTERY_TUNING: { baseLevel: 1, maxLevel: 8, chipPerLevel: 5 },
    getFlowMultiplier: g.api.getFlowMultiplier,
    getHandMasteryBonus: g.api.getHandMasteryBonus,
    synergyTuning: {
      enabled: true,
      chainLinkingEnabled: true,
      maxChainPasses: 8,
      maxChainBonusMultPerHand: 6,
      debtCollectorMaxMult: 4,
    },
    ...overrides,
  };
}

test("calculateScore cap instrumentation matches binding fixtures", () => {
  const g = createGame(snapshot());
  const calc = g.api.GutterbonesRules.calculateScore;

  const debt = calc(
    "C",
    dice([2, 3, 4, 5, 6]),
    scoreContext(g, { debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] }),
  );
  assert.equal(debt.debtCollectorCapped, true);
  assert.ok(debt.mult >= 4);

  const d = dice([6, 6, 0, 6, 6]);
  d[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  d[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  d[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  d[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  d[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });
  const chain = calc(
    "C",
    d,
    scoreContext(g, { inventory: [{ id: "ENGINE" }, { id: "FUSE_BOX" }] }),
  );
  assert.ok(Number(chain.chainMultBonusUsed) <= 6);
  if (Number(chain.chainMultBonusUsed) === 6) {
    assert.equal(chain.chainMultCapHit, true);
  }
});

test("observer on/off scoring parity (identical outcomes)", () => {
  const g = createGame(snapshot());
  const baseCalc = g.api.GutterbonesRules.calculateScore;
  const fixtures = [
    {
      cat: "C",
      lane: dice([2, 3, 4, 5, 6]),
      ctx: { debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] },
    },
    {
      cat: "Y",
      lane: dice([6, 6, 6, 6, 6]),
      ctx: {},
    },
  ];

  for (const fx of fixtures) {
    const plain = baseCalc(fx.cat, fx.lane, scoreContext(g, fx.ctx));
    const obsOff = createBalanceObserver({ enabled: false, repoRoot: ROOT });
    const obsOn = createBalanceObserver({ enabled: true, repoRoot: ROOT });
    const wrapped = observeCalculateScore(baseCalc, obsOn);
    const withObserver = wrapped(fx.cat, fx.lane, scoreContext(g, fx.ctx));
    assert.deepEqual(
      scoringParityDigest([plain]),
      scoringParityDigest([withObserver]),
    );
    assert.equal(obsOff.ledger.events.length, 0);
    assert.ok(obsOn.ledger.events.length >= 1);
    assert.ok(ruleShaFromRepo(ROOT));
  }
});

test("ledger marks RNG metadata unavailable on main", () => {
  const obs = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  assert.equal(obs.ledger.rng.status, "unavailable");
});

test("balance-diagnostic CLI rejects holdout rids 55–59", () => {
  const script = path.join(ROOT, "scripts/balance-diagnostic.cjs");
  const artifactDir = path.join(ROOT, ".tmp-balance-artifacts");
  let exit = 0;
  let stderr = "";
  try {
    execFileSync(process.execPath, [script, "--rid=57"], {
      env: { ...process.env, BALANCE_DIAG_ARTIFACT_DIR: artifactDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    exit = err.status;
    stderr = err.stderr?.toString() || "";
  }
  assert.equal(exit, 1);
  assert.match(stderr, /holdout/i);
  const artifactPath = path.join(artifactDir, "balance-diagnostic-failure.json");
  assert.ok(require("node:fs").existsSync(artifactPath));
});
