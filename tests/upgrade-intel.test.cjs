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
