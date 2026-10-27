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
test("Bootstrap selects production React and gates dev tools on public hosts", () => {
  assert.match(html, /window\.__GUTTERBONES_DEV__/);
  assert.match(html, /react\.production\.min\.js/);
  assert.match(html, /react-dom\.production\.min\.js/);
  assert.match(html, /react\.development\.js/);
  assert.match(appSource, /IS_DEV_BUILD/);
  assert.match(appSource, /__GUTTERBONES_DEV__/);
  assert.match(html, /__GUTTERBONES_BRANDING__/);
});

test("Shared inline rules precede the app without adding a runtime request", () => {
  assert.ok(
    html.indexOf('<script id="gutterbones-rules">') <
      html.indexOf('<script type="text/babel">'),
  );
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
