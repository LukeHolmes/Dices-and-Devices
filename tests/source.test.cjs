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
  onboardingSource,
  storySource,
  routesSource,
  gambleSource,
} = require("./helpers/game.cjs");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mainJsx = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
const bootstrapJs = fs.readFileSync(path.join(root, "src/bootstrap.js"), "utf8");
const catalogJs = fs.readFileSync(path.join(root, "src/data/catalog.js"), "utf8");

test("Audio module exposes gameplay API", () => {
  const audioPath = path.join(root, "assets/audio/gutterbones-audio.js");
  assert.ok(fs.existsSync(audioPath), "gutterbones-audio.js");
  assert.match(indexHtml, /assets\/audio\/gutterbones-audio\.js/);
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
  assert.match(catalogJs + appSource, /gutterbones1977:settings:v1/);
});

test("Bootstrap gates dev tools and branding", () => {
  assert.match(bootstrapJs, /window\.__GUTTERBONES_DEV__/);
  assert.match(bootstrapJs, /window\.__GUTTERBONES_BRANDING__/);
  assert.match(appSource, /IS_DEV_BUILD/);
  assert.match(appSource, /__GUTTERBONES_DEV__/);
  assert.match(mainJsx, /bootstrap\.js/);
  assert.match(indexHtml, /type="module"/);
  assert.doesNotMatch(indexHtml, /text\/babel/);
});

test("Systems load as src modules before App", () => {
  assert.match(mainJsx, /App\.jsx/);
  assert.match(appSource, /from "\.\/systems\/rules\.js"/);
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
    assert.ok(fs.existsSync(path.join(root, panel)), panel);
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
  assert.match(onboardingSource, /GutterbonesOnboarding/);
  assert.match(storySource, /GutterbonesStory/);
  assert.match(routesSource, /GutterbonesRoutes/);
  assert.match(gambleSource, /GutterbonesGamble/);
  assert.match(catalogJs, /export const PERSONAS/);
});

test("Phase 5 roster portraits wired and on disk", () => {
  for (const asset of [
    "assets/personas/card-counter.png",
    "assets/bosses/bouncer.png",
    "assets/bosses/crooked-cop.png",
  ]) {
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
  }
  const portraitCorpus = appSource + catalogJs;
  assert.match(portraitCorpus, /card-counter\.png/);
  assert.match(portraitCorpus, /bosses\/bouncer\.png/);
  assert.match(portraitCorpus, /crooked-cop\.png/);
});

test("Referenced local artwork exists", () => {
  const corpus = indexHtml + appSource + catalogJs + html;
  const refs = [
    ...corpus.matchAll(/['"`](assets\/[\w/.-]+\.(?:png|jpg|webp|svg))['"`]/g),
  ];
  assert.ok(refs.length > 10);
  for (const [, asset] of refs)
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
});
