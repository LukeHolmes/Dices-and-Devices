"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");

function block(open) {
  assert.equal(html.split(open).length, 2, `Expected exactly one ${open}`);
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf("</script>", start);
  assert.ok(end > start, `Missing closing script for ${open}`);
  return html.slice(start, end);
}

const observerSource = block('<script id="gutterbones-balance-observer">');

function loadGutterbonesBalanceObserver() {
  const ctx = { window: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(observerSource, ctx);
  return ctx.GutterbonesBalanceObserver;
}

const GBO = loadGutterbonesBalanceObserver();

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function ruleShaFromRepo(repoRoot) {
  const rulesPath = path.join(repoRoot, "index.html");
  const blob = fs.readFileSync(rulesPath, "utf8");
  const open = '<script id="gutterbones-rules">';
  const start = blob.indexOf(open);
  const end = blob.indexOf("</script>", start + open.length);
  if (start < 0 || end < 0) return null;
  return sha256(blob.slice(start + open.length, end));
}

function createBalanceObserver(options = {}) {
  const repoRoot = options.repoRoot || path.join(__dirname, "../..");
  return GBO.create({
    enabled: !!options.enabled,
    ruleSha: options.ruleSha ?? ruleShaFromRepo(repoRoot),
    policySha: options.policySha || null,
    observerRevision: options.observerRevision || "2026-11-11-wp1b",
    rngReason:
      options.rngReason
      || "main has no per-call RNG ledger; runRandomRef exists without seedRunRng counters",
  });
}

function installBrowserObserverShim(sandbox, observer) {
  sandbox.window = sandbox.window || {};
  sandbox.window.__GB_BALANCE_OBSERVER__ = observer;
  sandbox.GutterbonesBalanceObserver = GBO;
}

function observeCalculateScore(calculateScore, observer, resolveDice) {
  if (!observer?.enabled) return calculateScore;
  return function observedCalculateScore(catId, dice, context) {
    const before = {
      debt: context?.debt ?? GBO.missingField("debt"),
      flowStreak: context?.flowStreak ?? GBO.missingField("flowStreak"),
      inventoryIds: (context?.inventory || []).map((i) => i.id),
    };
    const result = calculateScore(catId, dice, context);
    let resolvedSnapshot = GBO.missingField("resolveDice unavailable");
    if (typeof resolveDice === "function") {
      const { resolved, destroyed } = resolveDice(dice);
      resolvedSnapshot = {
        status: "ok",
        value: GBO.snapshotResolvedLane(resolved, destroyed),
      };
    }
    observer.recordScore({
      categoryId: catId,
      valid: result.valid,
      chips: result.chips,
      mult: result.mult,
      total: result.total,
      flowMult: result.flowMult,
      chainDepth: result.chainDepth,
      chainLinks: result.chainLinks || [],
      chainMultBonusUsed: GBO.capFieldFromResult(result, "chainMultBonusUsed"),
      chainMultCapHit: GBO.capFieldFromResult(result, "chainMultCapHit"),
      debtCollectorCapped: GBO.capFieldFromResult(result, "debtCollectorCapped"),
      rawDice: { status: "ok", value: GBO.snapshotRawLane(dice) },
      resolvedDice: resolvedSnapshot,
      legalCategories: context?.legalCategories
        ? { status: "ok", value: context.legalCategories }
        : GBO.missingField("legalCategories not supplied to observer context"),
      before,
      after: GBO.missingField("post-score banked heat not available in rules-only observer wrap"),
    });
    return result;
  };
}

function scoringParityDigest(results) {
  return results.map((r) => ({
    valid: r.valid,
    chips: r.chips,
    mult: r.mult,
    total: r.total,
    chainDepth: r.chainDepth ?? 0,
  }));
}

function assertCapFieldsPresent(result, assertImpl = assert) {
  for (const key of ["chainMultBonusUsed", "chainMultCapHit", "debtCollectorCapped"]) {
    assertImpl.ok(
      Object.prototype.hasOwnProperty.call(result, key) && result[key] != null,
      `missing ${key} on calculateScore return`,
    );
  }
}

function assertCapFieldsAbsent(result, assertImpl = assert) {
  for (const key of ["chainMultBonusUsed", "chainMultCapHit", "debtCollectorCapped"]) {
    assertImpl.equal(
      result[key],
      undefined,
      `unexpected ${key} on legacy calculateScore return`,
    );
  }
}

module.exports = {
  SCHEMA_VERSION: GBO.SCHEMA_VERSION,
  UNAVAILABLE: GBO.UNAVAILABLE,
  GutterbonesBalanceObserver: GBO,
  createBalanceObserver,
  installBrowserObserverShim,
  observeCalculateScore,
  ruleShaFromRepo,
  scoringParityDigest,
  assertCapFieldsPresent,
  assertCapFieldsAbsent,
  loadGutterbonesBalanceObserver,
  observerSource,
  sha256,
};
