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
  const storyIdx = html.indexOf('<script id="gutterbones-story">');
  const routesIdx = html.indexOf('<script id="gutterbones-routes">');
  const gambleIdx = html.indexOf('<script id="gutterbones-gamble">');
  const appIdx = html.indexOf('<script type="text/babel">');
  assert.ok(
    rulesIdx >= 0 &&
      onboardingIdx > rulesIdx &&
      storyIdx > onboardingIdx &&
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
  assert.match(appSource, /SCORE_OVERLAY_LIFETIME_MS\s*=\s*1200/);
  assert.match(appSource, /Side bet: this roll/);
  assert.match(appSource, /pendingUnlockMessageRef/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "favicon.ico")), "favicon.ico");
});

test("Phase 6f shop loan and audio settings present", () => {
  assert.match(appSource, /LOAN appears when cash is short/);
  assert.match(appSource, /SOUND \{audioMuted \? 'MUTED' : 'ON'\}/);
  assert.match(appSource, /Round \$\{round\} quota cleared/);
});

test("Phase 6c safehouse and favicon polish", () => {
  assert.match(html, /rel="icon"[^>]+gutterbones-card\.png/);
  assert.doesNotMatch(appSource, /UNLOCKS: \{upgrade\.unlocks\.join\(', '\)\}/);
  assert.match(appSource, /displayNameForUnlockId/);
  assert.match(storySource, /PANEL_ART_AVAILABLE/);
  assert.match(appSource, /TODO\(art\): card-counter\.png/);
});

test("Referenced local artwork exists", () => {
  const refs = [
    ...html.matchAll(/['"`](assets\/[\w/.-]+\.(?:png|jpg|webp|svg))['"`]/g),
  ];
  assert.ok(refs.length > 10);
  for (const [, asset] of refs)
    assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset);
});
