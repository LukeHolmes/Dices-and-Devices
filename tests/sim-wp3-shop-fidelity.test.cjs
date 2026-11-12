"use strict";

/**
 * WP3 shop: in-page bot must not fall through to legacy shop heuristics on SHOP.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const inPage = fs.readFileSync(path.join(__dirname, "sim/in-page-bot.js"), "utf8");

test("WP3 SHOP loop never delegates to legacy shop bot", () => {
  const block = inPage.slice(
    inPage.indexOf('simPolicyRev === "2026-11-12-wp3-shop-v1" && ph === "SHOP"'),
    inPage.indexOf('simPolicyRev === "2026-11-12-wp3-shop-v1" && ph === "CARVING"'),
  );
  assert.match(block, /autoShopPolicyStep/);
  assert.doesNotMatch(block, /if \(window\.__GB_E2E__\?\.autoShopPolicyStep\?\(\)\)/);
  assert.match(block, /continue;/);
});
