"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  html,
  sharedSource,
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
  const appIdx = html.indexOf('<script type="text/babel">');
  assert.ok(
    rulesIdx >= 0 &&
      onboardingIdx > rulesIdx &&
      storyIdx > onboardingIdx &&
      routesIdx > storyIdx &&
      appIdx > routesIdx,
  );
  assert.match(appSource, /GutterbonesRoutes\.projectNextRound/);
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

test("Referenced local artwork exists", () => {
  const refs = [
    ...html.matchAll(/['"`](assets\/[\w/.-]+\.(?:png|jpg|webp|svg))['"`]/g),
  ];
  assert.ok(refs.length > 10);
  for (const [, asset] of refs)
    assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset);
});
