"use strict";
/** Regenerate src/app/gameActions.js from action bodies in App.jsx */
const fs = require("node:fs");
const path = require("node:path");
const { actionSource } = require("../tests/helpers/game.cjs");

const actionNames = [
  "getBossAdjustedTarget",
  "calculateScore",
  "rollBones",
  "popPill",
  "handleProgram",
  "resumeRun",
  "serializeRun",
  "persistRun",
  "updateMeta",
  "awardLaunderedCash",
  "executePayout",
  "payDebtFromCash",
  "registerDebtSpike",
];

const scopeKeys = [
  "phase",
  "round",
  "score",
  "target",
  "hands",
  "discards",
  "gold",
  "debt",
  "stash",
  "persona",
  "personaIdx",
  "dice",
  "kept",
  "rolling",
  "hasRolled",
  "inventory",
  "consumables",
  "activeBoss",
  "insaneContract",
  "hardwareDisabled",
  "flowStreak",
  "handLevels",
  "activeWager",
  "history",
  "usedCats",
  "runStats",
  "arcId",
  "runClosed",
  "reducedMotion",
  "meta",
  "paths",
  "shopRefreshes",
  "shopItems",
  "gambleStake",
  "currentRouteEffect",
  "selectedItem",
  "carvingDie",
  "swapMode",
  "swapIdx",
  "currentTarget",
  "canPlaceWager",
  "wagerThreshold",
  "analyzeRunFailure",
  "generateShop",
  "playStoryBeat",
  "showMechanicPopup",
  "spawnHitCallout",
  "spawnPaperStamp",
  "spawnFlying",
  "cascadeTriggers",
  "triggerCameraKick",
  "patchSettings",
  "scheduleTimeout",
  "scheduleInterval",
  "clearScheduledInterval",
  "AudioSystem",
  "setPhase",
  "setPersona",
  "setPersonaIdx",
  "setRound",
  "setScore",
  "setTarget",
  "setHands",
  "setDiscards",
  "setGold",
  "setDebt",
  "setStash",
  "setInsaneContract",
  "setInventory",
  "setConsumables",
  "setDice",
  "setKept",
  "setHasRolled",
  "setUsedCats",
  "setHandLevels",
  "setFlowStreak",
  "setShopItems",
  "setShopRefreshes",
  "setGambleStake",
  "setActiveWager",
  "setCurrentRouteEffect",
  "setPaths",
  "setActiveBoss",
  "setBossIntro",
  "setSelectedItem",
  "setCarvingDie",
  "setSwapMode",
  "setSwapIdx",
  "setHistory",
  "setRunStats",
  "setBustActive",
  "setPayoutActive",
  "setFlyingScores",
  "setCinematic",
  "setScoreResolution",
  "setScoreBreakdown",
  "setLossExplanation",
  "setSoldItems",
  "setCarveSparks",
  "setPillBursts",
  "setStoryBeat",
  "setRunClosed",
  "setFixerLine",
  "setLastLaundered",
  "setHasSavedRun",
  "setMeta",
  "setRolling",
  "setFeltPulse",
  "setActiveMechanicPopup",
  "setShowMobileStash",
  "setHitFlashActive",
  "setScorePulse",
  "setPowBurst",
  "setTriggerCascade",
];

const uniqueScopeKeys = [...new Set(scopeKeys)];

const root = path.join(__dirname, "..");

const bodies = actionNames.map((name) => {
  const raw = actionSource(name);
  const body = raw.replace(new RegExp(`^    const ${name} = `), "");
  return `  const ${name} = ${body.trim()};`;
});

const header = `/**
 * Run action implementations (generated — run \`node scripts/generate-game-actions.cjs\` after edits).
 */
import GutterbonesRules from "../systems/rules.js";
import GutterbonesStory from "../systems/story.js";
import GutterbonesRoutes from "../systems/routes.js";
import GutterbonesGamble from "../systems/gamble.js";
import * as catalog from "../data/catalog.js";

const {
  PERSONAS,
  RUN_SAVE_VERSION,
  RUN_PHASES,
  CATEGORIES,
  HAND_MASTERY_TUNING,
  ECONOMY_TUNING,
  BOSS_TUNING,
  FLOW_TUNING,
  WAGER_TUNING,
  GAMBLE_TUNING,
  EARLY_GAME_TUNING,
  INSANE_CONTRACT_MODIFIERS,
  DEBT_PAYDOWN_TUNING,
  FIXER_LINES,
  pickLine,
  DEFAULT_RUN_BUILD,
  mergeMetaState,
  saveMetaState,
  clearSavedRun,
  loadSavedRun,
  saveSavedRun,
  hydrateItem,
  hydratePath,
  bossById,
  PROGRAMS,
  getFlowMultiplier,
  getHandMasteryBonus,
} = catalog;

export function createGameActions(getScope) {
  const scope = getScope();
  const {
    ${uniqueScopeKeys.join(",\n    ")},
  } = scope;

`;

const footer = `
  return {
    ${actionNames.join(",\n    ")},
  };
}
`;

fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
fs.writeFileSync(
  path.join(root, "src/app/gameActions.js"),
  header + bodies.join("\n\n") + footer,
);
console.log("Wrote src/app/gameActions.js");
