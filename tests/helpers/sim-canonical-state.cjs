"use strict";

const crypto = require("node:crypto");

function stableValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableValue);
  const keys = Object.keys(value).sort();
  const out = {};
  for (const k of keys) out[k] = stableValue(value[k]);
  return out;
}

function canonicalStateHash(state) {
  const stable = stableValue(state || {});
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
}

function actionKey(action) {
  if (action == null) return "";
  if (typeof action === "string") return action;
  return JSON.stringify(action);
}

/**
 * Find first step index where pre-action state hash or chosen action differs.
 */
function firstTraceDivergence(traceA, traceB) {
  const a = traceA || [];
  const b = traceB || [];
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const sa = a[i]?.stateHash;
    const sb = b[i]?.stateHash;
    const aa = actionKey(a[i]?.action);
    const ab = actionKey(b[i]?.action);
    if (sa !== sb || aa !== ab) {
      return { index: i, a: a[i], b: b[i] };
    }
  }
  if (a.length !== b.length) {
    return {
      index: len,
      a: a[len] || null,
      b: b[len] || null,
      reason: "trace_length_mismatch",
      lengths: { a: a.length, b: b.length },
    };
  }
  return null;
}

/**
 * Classify root cause at first divergence (harness timing / RNG / other nondeterminism).
 */
function classifyTraceDivergence(diverge, { gameDrawLogA, gameDrawLogB } = {}) {
  if (!diverge || !diverge.a || !diverge.b) return "unknown";
  const hashA = diverge.a.stateHash;
  const hashB = diverge.b.stateHash;
  const actA = actionKey(diverge.a.action);
  const actB = actionKey(diverge.b.action);
  const drawsA = diverge.a.gameRngDraws ?? diverge.a.rngDraws ?? 0;
  const drawsB = diverge.b.gameRngDraws ?? diverge.b.rngDraws ?? 0;

  if (hashA === hashB && actA !== actB) {
    return "harness-timing";
  }

  if (hashA !== hashB) {
    if (drawsA !== drawsB) {
      return "rng";
    }
    const logA = gameDrawLogA || [];
    const logB = gameDrawLogB || [];
    const drawTail = Math.min(logA.length, logB.length);
    for (let i = 0; i < drawTail; i += 1) {
      const ea = logA[i];
      const eb = logB[i];
      if (ea?.v !== eb?.v || ea?.site !== eb?.site) {
        if (ea?.n === eb?.n && (ea?.phase !== eb?.phase || ea?.round !== eb?.round)) {
          return "harness-timing";
        }
        return "rng";
      }
    }
    if (actA !== actB) {
      return "harness-timing";
    }
    return "nondeterminism";
  }

  return "unknown";
}

module.exports = {
  actionKey,
  canonicalStateHash,
  classifyTraceDivergence,
  firstTraceDivergence,
  stableValue,
};