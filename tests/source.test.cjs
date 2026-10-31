"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  html,
  sharedSource,
  storySource,
  actionSource,
  appSource,
} = require("./helpers/game.cjs");
test("Audio module exposes gameplay API", () => {
  const audioPath = path.join(__dirname, "../assets/audio/gutterbones-audio.js");
  assert.ok(fs.existsSync(audioPath), "gutterbones-audio.js");
  assert.match(html, /assets\/audio\/gutterbones-audio\.js/);
  const audioSource = fs.readFileSync(audioPath, "utf8");
  for (const fn of [
    "init",
    "clatter",
    "stinger",
    "chainStep",
    "categoryStinger",
    "retrigger",
    "payout",
    "bossSting",
    "bust",
    "paper",
    "playTone",
    "setMuted",
    "setVolume",
  ]) {
    assert.match(audioSource, new RegExp(`${fn}\\(`));
  }
  assert.match(appSource, /window\.GutterbonesAudio/);
  assert.match(appSource, /gutterbones1977:settings:v1/);
});

test("Bootstrap selects production React and gates dev tools on public hosts", () => {
  assert.match(html, /window\.__GUTTERBONES_DEV__/);
  assert.match(html, /react\.production\.min\.js/);
  assert.match(html, /react-dom\.production\.min\.js/);
  assert.match(html, /react\.development\.js/);
  assert.match(appSource, /IS_DEV_BUILD/);
  assert.match(appSource, /__GUTTERBONES_DEV__/);
  assert.match(html, /__GUTTERBONES_BRANDING__/);
});

test("Shared inline rules and onboarding precede the app without extra requests", () => {
  const rulesIdx = html.indexOf('<script id="gutterbones-rules">');
  const onboardingIdx = html.indexOf('<script id="gutterbones-onboarding">');
  const tutorialIdx = html.indexOf('<script id="gutterbones-tutorial">');
  const replayIdx = html.indexOf('<script id="gutterbones-replay">');
  const storyIdx = html.indexOf('<script id="gutterbones-story">');
  const routesIdx = html.indexOf('<script id="gutterbones-routes">');
  const gambleIdx = html.indexOf('<script id="gutterbones-gamble">');
  const appIdx = html.indexOf('<script type="text/babel">');
  assert.ok(
    rulesIdx >= 0 &&
      onboardingIdx > rulesIdx &&
      tutorialIdx > onboardingIdx &&
      replayIdx > tutorialIdx &&
      storyIdx > replayIdx &&
      routesIdx > storyIdx &&
      gambleIdx > routesIdx &&
      appIdx > gambleIdx,
  );
  assert.match(appSource, /GutterbonesRoutes\.projectNextRound/);
  assert.match(appSource, /GutterbonesGamble\.resolveFlip/);
  assert.match(appSource, /RouteChoiceCard/);
  assert.match(appSource, /StoryPanelOverlay/);
  assert.match(appSource, /playStoryBeat/);
  for (const panel of [
    "assets/panels/witness/prologue.png",
    "assets/panels/witness/r2.png",
    "assets/panels/witness/bust.png",
    "assets/panels/witness/victory.png",
  ]) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", panel)), panel);
  }
  assert.match(appSource, /GutterbonesOnboarding/);
  assert.match(appSource, /CategoryUnlockFooter/);
  const stepMatches = appSource.match(/ONBOARDING_STEPS\s*=\s*\[/);
  assert.ok(stepMatches);
  const stepsBlock = appSource.slice(appSource.indexOf("ONBOARDING_STEPS"));
  const stepCount = (stepsBlock.match(/title:\s*'/g) || []).length;
  assert.ok(stepCount >= 7, `expected >= 7 onboarding steps, got ${stepCount}`);
  assert.match(appSource, /LockedPayoutRow/);
  assert.match(
    actionSource("calculateScore"),
    /GutterbonesRules.calculateScore/,
  );
  assert.doesNotMatch(sharedSource, /localStorage|setTimeout|document\./);
});
test("Phase 5 roster portraits wired and on disk", () => {
  for (const asset of [
    "assets/personas/card-counter.png",
    "assets/bosses/bouncer.png",
    "assets/bosses/crooked-cop.png",
  ]) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset);
  }
  assert.match(appSource, /card-counter\.png/);
  assert.match(appSource, /bosses\/bouncer\.png/);
  assert.match(appSource, /crooked-cop\.png/);
});

test("Dice face PNG art wired", () => {
  assert.match(appSource, /DICE_ART/);
  assert.match(appSource, /assets\/dice\/die-1\.png/);
  for (const face of ["die-1", "die-2", "die-3", "die-4", "die-5", "die-6", "die-blank", "die-held"]) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets/dice", `${face}.png`)), face);
  }
});

test("Phase 6d input UX hooks present", () => {
  assert.match(appSource, /rollLockRef/);
  assert.match(appSource, /pendingPayoutRef/);
  assert.match(appSource, /seenHelpDossier/);
  assert.match(appSource, /CATEGORY_RULE_TOOLTIPS/);
  assert.match(sharedSource, /reason: invalidReason/);
});

test("Live playtest polish hooks (Oct 2026)", () => {
  assert.match(appSource, /openingStashGrant:\s*25/);
  assert.match(appSource, /SCORE_OVERLAY_LIFETIME_MS\s*=\s*2600/);
  assert.match(html, /id="gutterbones-presentation"/);
  assert.match(appSource, /GutterbonesPresentation/);
  assert.match(appSource, /ToastStack/);
  assert.match(appSource, /pacing:\s*'normal'/);
  assert.match(appSource, /getScoreOverlayLifetimeMs/);
  assert.match(appSource, /overlayTailMs/);
  assert.match(appSource, /applyDevSynergyDemoDice/);
  assert.match(appSource, /applyDevMultiChainDemoDice/);
  assert.match(appSource, /overlayPerChainStepMs/);
  assert.match(appSource, /categoryPreviewSlotActive/);
  assert.match(appSource, /pathPickEffects/);
  assert.match(appSource, /SYNERGY_HINTS/);
  assert.match(appSource, /carveAdjacencyProfile/);
  assert.match(appSource, /SIDE BET \$|best \$\{bestPreviewHeat\}/);
  assert.match(appSource, /pendingUnlockMessageRef/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "favicon.ico")), "favicon.ico");
});

test("No-scroll layout shell (Oct 2026)", () => {
  assert.match(html, /html,\s*body[\s\S]*overflow:\s*hidden/);
  assert.match(appSource, /gb-app-shell/);
  assert.match(appSource, /gb-screen/);
  assert.match(appSource, /gb-panel-scroll/);
  assert.match(appSource, /layoutAudit/);
  assert.match(appSource, /gb-play-dock/);
});

test("Release prep — title, settings, analytics, manifest (Oct 2026)", () => {
  assert.match(html, /coldforge\.goatcounter\.com\/count/);
  assert.match(html, /gutterbonesTrack/);
  assert.match(html, /rel="manifest" href="manifest\.json"/);
  assert.match(html, /property="og:title"/);
  assert.match(appSource, /TitleScreen/);
  assert.match(appSource, /GameSettingsPanel/);
  assert.match(appSource, /data-layout-key="title-screen"/);
  assert.match(appSource, /data-layout-key="settings-panel"/);
  assert.match(appSource, /gutterbonesTrack\(daily \? 'daily_start' : 'run_start'\)/);
  assert.match(appSource, /gutterbonesTrack\('run_end', \{ round \}\)/);
  assert.match(appSource, /gutterbonesTrack\('tutorial_complete'\)/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "manifest.json")), "manifest.json");
});

test("Playtest 4 fixes (Oct 2026)", () => {
  assert.match(html, /rel="icon"[^>]+favicon\.ico/);
  assert.match(appSource, /CarvingDieTile/);
  assert.match(appSource, /rerollBoneSlot/);
  assert.match(appSource, /consumePill:\s*false/);
  assert.match(appSource, /FREE OPENING SNIFF/);
  assert.match(appSource, /!hasRolled \?[\s\S]*SIDE BET \(pre-roll\)/);
  assert.match(appSource, /lossExplanation && phase === 'PLAY'/);
  assert.match(appSource, /stashFillRate/);
  assert.match(appSource, /pillCurrencyHint/);
});

test("Phase 6f shop loan and audio settings present", () => {
  assert.match(appSource, /LOAN when cash is short/);
  assert.match(appSource, /SOUND \{audioMuted \? 'MUTED' : 'ON'\}/);
  assert.match(appSource, /Round \$\{round\} quota cleared/);
});

test("Phase 6c safehouse and favicon polish", () => {
  assert.match(html, /rel="icon"[^>]+favicon\.ico/);
  assert.match(html, /\/Dices-and-Devices\//);
  assert.match(html, /withAssetBase/);
  assert.match(html, /apple-touch-icon[^>]+gutterbones-card\.png/);
  assert.doesNotMatch(appSource, /UNLOCKS: \{upgrade\.unlocks\.join\(', '\)\}/);
  assert.match(appSource, /displayNameForUnlockId/);
  assert.match(storySource, /PANEL_ART_AVAILABLE/);
  assert.match(appSource, /TODO\(art\): card-counter\.png/);
});

test("Pro polish roll and transition hooks", () => {
  assert.match(appSource, /transitionToPhase/);
  assert.match(appSource, /DICE_LAND_STAGGER_MS/);
  assert.match(appSource, /AudioSystem\.dieThud/);
  assert.match(appSource, /score-row-fixed/);
  assert.match(appSource, /tutorial-coach-mask/);
  assert.match(appSource, /roll-ready-pulse-inner/);
  assert.match(html, /@keyframes rollReadyPulse[\s\S]*?box-shadow: 0 6px 0 #7a003d/);
  assert.doesNotMatch(html, /@keyframes rollReadyPulse[\s\S]*?translateY\(-1px\)/);
  const audioSource = fs.readFileSync(
    path.join(__dirname, "../assets/audio/gutterbones-audio.js"),
    "utf8",
  );
  assert.match(audioSource, /dieThud\(/);
});

test("Referenced local artwork exists", () => {
  const refs = [
    ...html.matchAll(/['"`](assets\/[\w/.-]+\.(?:png|jpg|webp|svg))['"`]/g),
  ];
  assert.ok(refs.length > 10);
  for (const [, asset] of refs)
    assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset);
});
