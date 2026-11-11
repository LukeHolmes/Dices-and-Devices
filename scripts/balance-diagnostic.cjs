#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = process.env.BALANCE_DIAG_ARTIFACT_DIR
  || "/opt/cursor/artifacts";

const HOLDOUT_RIDS = new Set([55, 56, 57, 58, 59]);
const LOCK_PATH = path.join(ROOT, "tests/fixtures/holdout-seeds-lock.json");

function writeFailureArtifact(payload) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, "balance-diagnostic-failure.json");
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

function parseArgs(argv) {
  const out = { rid: null, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg.startsWith("--rid=")) out.rid = Number(arg.split("=")[1]);
    else if (arg === "--caps-only") out.capsOnly = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node scripts/balance-diagnostic.cjs [--rid=N] [--caps-only]");
    process.exit(0);
  }

  if (args.rid != null && HOLDOUT_RIDS.has(args.rid)) {
    const artifact = writeFailureArtifact({
      ok: false,
      reason: "holdout_rid_rejected",
      rid: args.rid,
      lockedRids: [...HOLDOUT_RIDS],
      lockFile: fs.existsSync(LOCK_PATH) ? LOCK_PATH : null,
    });
    console.error(`Rejected holdout rid ${args.rid}. Artifact: ${artifact}`);
    process.exit(1);
  }

  const { createGame } = require(path.join(ROOT, "tests/helpers/game.cjs"));
  const { snapshot, dice, bone } = require(path.join(ROOT, "tests/fixtures/runs.cjs"));
  const failures = [];

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

  const g = createGame(snapshot());
  const calc = g.api.GutterbonesRules.calculateScore;

  const debtCase = calc(
    "C",
    dice([2, 3, 4, 5, 6]),
    scoreContext(g, { debt: 20, inventory: [{ id: "DEBT_COLLECTOR" }] }),
  );
  if (!debtCase.debtCollectorCapped) {
    failures.push({ check: "debt_collector_cap_flag", debt: 20, got: debtCase.debtCollectorCapped });
  }
  const debtStep = (debtCase.explanationSteps || []).find((s) =>
    String(s.label).includes("DEBT COLLECTOR"),
  );
  if (!debtStep || !String(debtStep.impact).includes("+4")) {
    failures.push({ check: "debt_collector_contribution", impact: debtStep?.impact });
  }

  const chainLane = dice([6, 6, 0, 6, 6]);
  chainLane[0] = bone(6, 0, { faceId: "BLOOD_6", type: "blood" });
  chainLane[1] = bone(6, 1, { faceId: "BLOOD_6", type: "blood" });
  chainLane[2] = bone(0, 2, { faceId: "FUSE_FACE", type: "modifier" });
  chainLane[3] = bone(6, 3, { faceId: "BLOOD_6", type: "blood" });
  chainLane[4] = bone(6, 4, { faceId: "BLOOD_6", type: "blood" });

  const chainCase = calc(
    "C",
    chainLane,
    scoreContext(g, { inventory: [{ id: "ENGINE" }, { id: "FUSE_BOX" }] }),
  );
  const chainUsed = Number(chainCase.chainMultBonusUsed) || 0;
  if (chainUsed > 6) {
    failures.push({ check: "chain_mult_cap_binding", chainMultBonusUsed: chainUsed });
  }

  if (failures.length) {
    const artifact = writeFailureArtifact({ ok: false, failures, head: "balance-diagnostic" });
    console.error(JSON.stringify({ ok: false, failures, artifact }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checks: ["debt_collector_cap_flag", "chain_mult_cap_binding"] }, null, 2));
}

main().catch((err) => {
  const artifact = writeFailureArtifact({ ok: false, reason: "exception", message: String(err) });
  console.error(err);
  console.error(`Artifact: ${artifact}`);
  process.exit(1);
});
