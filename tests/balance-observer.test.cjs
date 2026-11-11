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
  assertCapFieldsPresent,
  GutterbonesBalanceObserver,
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
  assertCapFieldsPresent(debt);
  assert.equal(debt.debtCollectorCapped, true);

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
  assertCapFieldsPresent(chain);
  assert.ok(chain.chainMultBonusUsed <= 6);
  if (chain.chainMultBonusUsed === 6) assert.equal(chain.chainMultCapHit, true);
});

test("wrapped observer does not change scoring digest", () => {
  const g = createGame(snapshot());
  const calc = g.api.GutterbonesRules.calculateScore;
  const resolveDice = g.api.GutterbonesRules.resolveDice;
  const fx = {
    cat: "C",
    lane: dice([2, 3, 4, 5, 6]),
    ctx: scoreContext(g, { debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] }),
  };
  const plain = calc(fx.cat, fx.lane, fx.ctx);
  const obs = createBalanceObserver({ enabled: true, repoRoot: ROOT });
  const wrapped = observeCalculateScore(calc, obs, resolveDice);
  const withObserver = wrapped(fx.cat, fx.lane, { ...fx.ctx, legalCategories: ["C", "Y"] });
  assert.deepEqual(scoringParityDigest([plain]), scoringParityDigest([withObserver]));
  const scoreEv = obs.ledger.events.find((e) => e.type === "score");
  assert.ok(scoreEv.score.rawDice.status === "ok");
  assert.ok(scoreEv.score.resolvedDice.status === "ok");
  assert.notDeepEqual(scoreEv.score.rawDice.value, scoreEv.score.resolvedDice.value);
});

test("observer disabled records zero events and does not call calculateScore wrapper side effects", () => {
  let rngCalls = 0;
  const g = createGame(snapshot(), { random: () => { rngCalls += 1; return 0.42; } });
  const obs = createBalanceObserver({ enabled: false, repoRoot: ROOT });
  const wrapped = observeCalculateScore(
    g.api.GutterbonesRules.calculateScore,
    obs,
    g.api.GutterbonesRules.resolveDice,
  );
  const before = rngCalls;
  wrapped("C", dice([2, 3, 4, 5, 6]), scoreContext(g));
  assert.equal(obs.ledger.events.length, 0);
  assert.equal(rngCalls, before, "observer must not add RNG draws");
});

test("ruleSha is content digest of rules block not revision string", () => {
  const sha = ruleShaFromRepo(ROOT);
  assert.match(sha, /^[a-f0-9]{64}$/);
  assert.notEqual(sha, GutterbonesBalanceObserver.semanticFingerprint({
    schemaVersion: "balance-observer-v1",
    ruleSha: "2026-11-11-wp1b",
    events: [],
    terminal: null,
  }));
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
