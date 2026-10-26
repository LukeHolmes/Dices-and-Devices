"use strict";
// Print normalized run JSON for manual browser injection (Phase B checklist).
// Usage: node scripts/dump-fixture-save.cjs [normal|wager|gamble|carving]
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const name = (process.argv[2] || "normal").toLowerCase();
const builders = {
  normal: () => fixtures.run(),
  wager: fixtures.wager,
  gamble: fixtures.gamble,
  carving: fixtures.carving,
};
const builder = builders[name];
if (!builder) {
  console.error(`Unknown fixture "${name}". Use: ${Object.keys(builders).join(", ")}`);
  process.exit(1);
}

const g = createGame(fixtures.snapshot());
const normalized = g.api.normalizeSavedRun(builder());
console.log(JSON.stringify(plain(normalized)));
