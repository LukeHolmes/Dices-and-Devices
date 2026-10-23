"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { html, sharedSource, actionSource } = require("./helpers/game.cjs");
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
