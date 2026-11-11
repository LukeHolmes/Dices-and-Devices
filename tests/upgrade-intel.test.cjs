"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function block(open) {
  const start = html.indexOf(open);
  assert.ok(start >= 0, `Missing ${open}`);
  const from = start + open.length;
  const end = html.indexOf("</script>", from);
  return html.slice(from, end);
}

const intelSource = block('<script id="gutterbones-intel">');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${intelSource}; this.GI = GutterbonesIntel;`, ctx);
const GI = ctx.GI;

test("GutterbonesIntel — Blood 6 copy matches scoring rule text", () => {
  const intel = GI.getUpgradeIntel("BLOOD_6");
  assert.ok(intel);
  assert.equal(intel.title, "Blood 6");
  assert.match(intel.benefits, /\+20 chips/i);
  assert.match(intel.costs, /-\$1/i);
  assert.match(intel.position, /blood ripple/i);
  assert.match(intel.position, /Shiv/i);
});

test("GutterbonesIntel — ambiguous upgrades have trigger and payoff sections", () => {
  for (const id of ["SHIV_FACE", "BLOOD_PACT", "WIREBAG_FACE", "DEBT_COLLECTOR"]) {
    const intel = GI.getUpgradeIntel(id);
    assert.ok(intel, id);
    assert.ok(intel.trigger && intel.trigger.length > 12, id);
    assert.ok((intel.benefits || intel.summary).length > 8, id);
  }
});

test("GutterbonesIntel — every carved face type in FACE_DATABASE has intel", () => {
  const missing = GI.missingFaceIntelIds();
  assert.equal(missing.length, 0, `missing face intel: ${missing.join(", ")}`);
  for (const id of GI.FACE_INTEL_IDS) {
    const intel = GI.getUpgradeIntel(id);
    assert.ok(intel?.trigger && intel?.benefits, id);
  }
});

test("GutterbonesIntel — every hardware devise has intel", () => {
  const missing = GI.missingHardwareIntelIds();
  assert.equal(missing.length, 0, `missing hardware intel: ${missing.join(", ")}`);
});

test("GutterbonesIntel — every shop face, hardware, and consumable has detailed intel", () => {
  const catalog = GI.SHOP_INTEL_IDS;
  assert.ok(Array.isArray(catalog) && catalog.length === 29, `catalog size ${catalog?.length}`);
  const missing = GI.missingShopIntelIds();
  assert.equal(missing.length, 0, `missing intel for: ${missing.join(", ")}`);
  for (const id of catalog) {
    const intel = GI.getUpgradeIntel(id);
    assert.ok(intel, `no intel row for ${id}`);
    assert.ok(intel.summary && intel.summary.length >= 16, `${id} summary`);
    assert.ok(intel.trigger && intel.trigger.length >= 12, `${id} trigger`);
    assert.ok(intel.benefits || intel.costs, `${id} payoff`);
  }
});
