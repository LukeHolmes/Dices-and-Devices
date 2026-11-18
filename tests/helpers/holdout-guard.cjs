"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../..");
const LOCK_PATH = path.join(ROOT, "tests/fixtures/holdout-seeds-lock.json");
const HOLDOUT_RIDS = new Set([55, 56, 57, 58, 59]);

function loadHoldoutLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return null;
  }
}

function parseRidSpec(spec) {
  if (spec == null || spec === "") return [];
  if (Array.isArray(spec)) return spec.map((n) => Number(n)).filter(Number.isFinite);
  const s = String(spec).trim();
  if (!s) return [];
  const out = new Set();
  for (const part of s.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    if (piece.includes("-")) {
      const [a, b] = piece.split("-").map((x) => Number(x.trim()));
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let rid = lo; rid <= hi; rid += 1) out.add(rid);
    } else {
      const n = Number(piece);
      if (Number.isFinite(n)) out.add(n);
    }
  }
  return [...out].sort((x, y) => x - y);
}

function assertRidsAllowed(rids, { approvalId = null, approvalFlag = false } = {}) {
  const holdouts = rids.filter((rid) => HOLDOUT_RIDS.has(rid));
  if (!holdouts.length) {
    return { ok: true, holdouts: [], approved: false };
  }
  const envApproval = process.env.HOLDOUT_APPROVAL_ID || "";
  const explicit =
    approvalFlag === true
    || (approvalId && envApproval && approvalId === envApproval)
    || (holdouts.length && envApproval && !approvalId);
  if (explicit) {
    return { ok: true, holdouts, approved: true, approvalId: approvalId || envApproval || null };
  }
  return {
    ok: false,
    holdouts,
    approved: false,
    reason: "holdout_rid_rejected",
    lockFile: fs.existsSync(LOCK_PATH) ? LOCK_PATH : null,
    lockedRids: [...HOLDOUT_RIDS],
  };
}

function appendHoldoutConsumptionLog(csvPath, row) {
  const header =
    "ts,rid,seed,context,commit,workflow_run_url,approved,approval_id,outcome_visible,notes\n";
  const exists = fs.existsSync(csvPath);
  const line = [
    row.ts || new Date().toISOString(),
    row.rid ?? "",
    row.seed ?? "",
    row.context ?? "",
    row.commit ?? "",
    row.workflow_run_url ?? "",
    row.approved ?? "",
    row.approval_id ?? "",
    row.outcome_visible ?? "",
    (row.notes ?? "").replace(/,/g, ";"),
  ].join(",");
  if (!exists) fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  fs.appendFileSync(csvPath, (exists ? "" : header) + `${line}\n`, "utf8");
}

module.exports = {
  HOLDOUT_RIDS,
  LOCK_PATH,
  loadHoldoutLock,
  parseRidSpec,
  assertRidsAllowed,
  appendHoldoutConsumptionLog,
};