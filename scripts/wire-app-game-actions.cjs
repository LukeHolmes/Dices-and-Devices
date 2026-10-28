"use strict";
/** Remove inlined run actions from App.jsx and wire createGameActions. */
const fs = require("node:fs");
const path = require("node:path");
const { actionSource } = require("../tests/helpers/game.cjs");

const root = path.join(__dirname, "..");
let app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");

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

for (const name of actionNames) {
  const block = actionSource(name);
  if (!app.includes(block)) {
    console.warn(`Block not found for ${name}, skipping`);
    continue;
  }
  app = app.replace(block + "\n\n", "");
  app = app.replace(block + "\n", "");
  app = app.replace(block, "");
}

if (!app.includes('from "./app/gameActions.js"')) {
  app = app.replace(
    'import GutterbonesGamble from "./systems/gamble.js";\n',
    'import GutterbonesGamble from "./systems/gamble.js";\nimport { createGameActions } from "./app/gameActions.js";\n',
  );
}

const hookMarker = "    const toggleMechanicPopup = (popupId) => setActiveMechanicPopup(current => (current === popupId ? null : popupId));";
const insertAfter = `    const scopeRef = useRef({});
    const actionsRef = useRef(null);
    if (!actionsRef.current) {
        actionsRef.current = createGameActions(() => scopeRef.current);
    }
    const {
        getBossAdjustedTarget,
        calculateScore,
        rollBones,
        popPill,
        handleProgram,
        resumeRun,
        serializeRun,
        persistRun,
        updateMeta,
        awardLaunderedCash,
        executePayout,
        payDebtFromCash,
        registerDebtSpike,
    } = actionsRef.current;

`;

if (!app.includes("scopeRef = useRef")) {
  if (!app.includes(hookMarker)) throw new Error("toggleMechanicPopup marker missing");
  app = app.replace(hookMarker, hookMarker + "\n\n" + insertAfter);
}

const scopeAssignMarker = "    return (\n        <div className={`w-full h-[100dvh]";
const scopeAssign = `    scopeRef.current = {
        phase, round, score, target, hands, discards, gold, debt, stash, persona, personaIdx,
        dice, kept, rolling, hasRolled, inventory, consumables, activeBoss, insaneContract,
        hardwareDisabled, flowStreak, handLevels, activeWager, history, usedCats, runStats,
        arcId, runClosed, reducedMotion, meta, paths, shopRefreshes, shopItems, gambleStake,
        currentRouteEffect, selectedItem, carvingDie, swapMode, swapIdx, currentTarget,
        canPlaceWager, wagerThreshold,
        analyzeRunFailure, generateShop, playStoryBeat,
        showMechanicPopup, spawnHitCallout, spawnPaperStamp, spawnFlying, cascadeTriggers,
        triggerCameraKick, patchSettings, scheduleTimeout, scheduleInterval, clearScheduledInterval,
        AudioSystem,
        setPhase, setPersona, setPersonaIdx, setRound, setScore, setTarget, setHands, setDiscards,
        setGold, setDebt, setStash, setInsaneContract, setInventory, setConsumables, setDice,
        setKept, setHasRolled, setUsedCats, setHandLevels, setFlowStreak, setShopItems,
        setShopRefreshes, setGambleStake, setActiveWager, setCurrentRouteEffect, setPaths,
        setActiveBoss, setBossIntro, setSelectedItem, setCarvingDie, setSwapMode, setSwapIdx,
        setHistory, setRunStats, setBustActive, setPayoutActive, setFlyingScores, setCinematic,
        setScoreResolution, setScoreBreakdown, setLossExplanation, setSoldItems, setCarveSparks,
        setPillBursts, setStoryBeat, setRunClosed, setFixerLine, setLastLaundered, setHasSavedRun,
        setMeta, setRolling, setFeltPulse, setActiveMechanicPopup, setShowMobileStash,
        setHitFlashActive, setScorePulse, setPowBurst, setTriggerCascade,
    };
`;

if (!app.includes("scopeRef.current =")) {
  if (!app.includes(scopeAssignMarker)) throw new Error("scope assign marker missing");
  app = app.replace(scopeAssignMarker, scopeAssign + "\n\n    " + scopeAssignMarker.trimStart());
}

fs.writeFileSync(path.join(root, "src/App.jsx"), app);
console.log("Updated App.jsx");
