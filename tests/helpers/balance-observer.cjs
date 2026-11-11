"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "balance-observer-v1";
const OBSERVER_REVISION = "2026-11-11-wp1";

/** Explicit missing field — never coerce to 0/false in ledgers. */
const UNAVAILABLE = Object.freeze({ status: "unavailable" });

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function ruleShaFromRepo(repoRoot) {
  const rulesPath = path.join(repoRoot, "index.html");
  const html = fs.readFileSync(rulesPath, "utf8");
  const open = '<script id="gutterbones-rules">';
  const start = html.indexOf(open);
  const end = html.indexOf("</script>", start + open.length);
  if (start < 0 || end < 0) return null;
  return sha256(html.slice(start + open.length, end));
}

function optionalField(value, available, reason) {
  if (!available) {
    return { ...UNAVAILABLE, reason: reason || "not instrumented on this baseline" };
  }
  return { status: "ok", value };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function fingerprintLedger(ledger) {
  return sha256(stableStringify(ledger));
}

/**
 * Read-only balance observer. Does not seed RNG, alter decisions, or enable organic trace.
 */
function createBalanceObserver(options = {}) {
  const repoRoot = options.repoRoot || path.join(__dirname, "../..");
  const enabled = !!options.enabled;
  const ledger = {
    schemaVersion: SCHEMA_VERSION,
    observerRevision: OBSERVER_REVISION,
    enabled,
    ruleSha: ruleShaFromRepo(repoRoot),
    policySha: options.policySha || null,
    diagnosticSha: sha256(`${SCHEMA_VERSION}:${OBSERVER_REVISION}`),
    nodeVersion: process.version,
    rng: optionalField(null, false, "main has no per-call RNG ledger; runRandomRef exists without seedRunRng counters"),
    events: [],
    terminal: null,
  };

  const push = (type, payload) => {
    if (!enabled) return;
    ledger.events.push({
      seq: ledger.events.length,
      type,
      atMs: Date.now(),
      ...payload,
    });
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    enabled,
    unavailable: UNAVAILABLE,
    ledger,
    recordMeta(meta = {}) {
      Object.assign(ledger, meta);
    },
    recordOffer(offer) {
      push("offer", {
        offer: {
          itemId: offer.itemId ?? UNAVAILABLE,
          baseCost: offer.baseCost ?? UNAVAILABLE,
          finalPrice: offer.finalPrice ?? UNAVAILABLE,
          cashAffordable: offer.cashAffordable ?? UNAVAILABLE,
          borrowable: offer.borrowable ?? UNAVAILABLE,
          debtAfterPurchase: offer.debtAfterPurchase ?? UNAVAILABLE,
          available: offer.available ?? UNAVAILABLE,
        },
      });
    },
    recordAction(action) {
      push("action", {
        action: {
          kind: action.kind,
          reason: action.reason ?? UNAVAILABLE,
          before: action.before ?? UNAVAILABLE,
          after: action.after ?? UNAVAILABLE,
          unavailableReason: action.unavailableReason ?? null,
        },
      });
    },
    recordScore(scoreRecord) {
      push("score", { score: scoreRecord });
    },
    recordChainStage(stage) {
      push("chain_stage", { stage });
    },
    setTerminal(terminal) {
      ledger.terminal = terminal;
      push("terminal", { terminal });
    },
    fingerprint() {
      return fingerprintLedger({
        ruleSha: ledger.ruleSha,
        events: ledger.events.map(({ type, ...rest }) => ({ type, ...rest })),
        terminal: ledger.terminal,
      });
    },
    toJSON() {
      return JSON.parse(JSON.stringify(ledger));
    },
  };
}

/**
 * Wrap calculateScore so observer records real production outcomes without changing them.
 */
function observeCalculateScore(calculateScore, observer) {
  if (!observer?.enabled) return calculateScore;
  return function observedCalculateScore(catId, dice, context) {
    const before = {
      debt: context?.debt ?? UNAVAILABLE,
      flowStreak: context?.flowStreak ?? UNAVAILABLE,
      inventoryIds: (context?.inventory || []).map((i) => i.id),
    };
    const result = calculateScore(catId, dice, context);
    const resolved = context?.resolvedDicePreview;
    observer.recordScore({
      categoryId: catId,
      valid: result.valid,
      chips: result.chips,
      mult: result.mult,
      total: result.total,
      flowMult: result.flowMult,
      chainDepth: result.chainDepth ?? 0,
      chainLinks: result.chainLinks || [],
      synergyEvents: (result.synergyEvents || []).map((e) => ({
        chainId: e.chainId || e.id || null,
        label: e.label || null,
      })),
      chainMultBonusUsed: optionalField(
        result.chainMultBonusUsed,
        result.chainMultBonusUsed != null,
        "missing from calculateScore return",
      ),
      chainMultCapHit: optionalField(
        result.chainMultCapHit,
        result.chainMultCapHit != null,
        "missing from calculateScore return",
      ),
      debtCollectorCapped: optionalField(
        result.debtCollectorCapped,
        result.debtCollectorCapped != null,
        "missing from calculateScore return",
      ),
      rawDice: resolved ?? UNAVAILABLE,
      resolvedDice: UNAVAILABLE,
      legalCategories: UNAVAILABLE,
      before,
      after: UNAVAILABLE,
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
    chainDepth: r.chainDepth,
    chainMultBonusUsed: r.chainMultBonusUsed,
    chainMultCapHit: r.chainMultCapHit,
    debtCollectorCapped: r.debtCollectorCapped,
  }));
}

module.exports = {
  SCHEMA_VERSION,
  OBSERVER_REVISION,
  UNAVAILABLE,
  createBalanceObserver,
  observeCalculateScore,
  ruleShaFromRepo,
  fingerprintLedger,
  scoringParityDigest,
  optionalField,
  sha256,
};
