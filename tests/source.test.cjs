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
  const appIdx = html.indexOf('<script type="text/babel">');
  assert.ok(rulesIdx >= 0 && onboardingIdx > rulesIdx && appIdx > onboardingIdx);
  assert.match(appSource, /GutterbonesOnboarding/);
  assert.match(appSource, /CategoryUnlockFooter/);
  const stepMatches = appSource.match(/ONBOARDING_STEPS\s*=\s*\[/);
  assert.ok(stepMatches);
  const stepsBlock = appSource.slice(appSource.indexOf("ONBOARDING_STEPS"));
  const stepCount = (stepsBlock.match(/title:\s*'/g) || []).length;
  assert.ok(stepCount >= 6, `expected >= 6 onboarding steps, got ${stepCount}`);
  assert.match(
    actionSource("calculateScore"),
    /GutterbonesRules.calculateScore/,
  );
  assert.doesNotMatch(sharedSource, /localStorage|setTimeout|document\./);
});
test("Referenced local artwork exists", () => {
  const refs = [
    ...html.matchAll(/['"`](assets\/[\w/.-]+\.(?:png|jpg|webp|svg))['"`]/g),
  ];
  assert.ok(refs.length > 10);
  for (const [, asset] of refs)
    assert.ok(fs.existsSync(path.join(__dirname, "..", asset)), asset);
});
