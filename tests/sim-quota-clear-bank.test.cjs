"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("simBuilder banks payout when hand would clear quota", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /simBuilderClearQuotaBank:\s*true/);
  assert.match(html, /clearsQuotaThisHand/);
  assert.match(
    html,
    /clearsQuotaThisHand[\s\S]*mustScore = simBuilder/s,
    "clear-quota guard applies to simBuilder mustScore",
  );
});
