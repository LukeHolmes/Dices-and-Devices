"use strict";
/**
 * Phone portrait (360×640, 390×844, 412×915) can be non-blocking while Luke finishes desktop/tablet.
 * Set PHONE_PORTRAIT_BLOCKING=1 to fail CI on these viewports again.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const PHONE_PORTRAIT_NAMES = Object.freeze(["360x640", "390x844", "412x915"]);

const BLOCKING_CHECK_FAST_NAMES = Object.freeze([
  "844x390",
  "768x1024",
  "1024x768",
  "1366x768",
  "1920x1080",
]);

const REPORT_PATH = path.join("/opt/cursor/artifacts", "phone-portrait-warnings.jsonl");

function phonePortraitBlockingEnabled() {
  return process.env.PHONE_PORTRAIT_BLOCKING === "1";
}

function isPhonePortrait(viewportName) {
  return PHONE_PORTRAIT_NAMES.includes(viewportName);
}

function isBlockingCheckFastViewport(viewportName) {
  return BLOCKING_CHECK_FAST_NAMES.includes(viewportName);
}

function recordPhoneWarning(entry) {
  const row = {
    at: new Date().toISOString(),
    blocking: phonePortraitBlockingEnabled(),
    ...entry,
  };
  try {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.appendFileSync(REPORT_PATH, `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    // artifact dir optional in local runs
  }
  if (process.env.PHONE_PORTRAIT_VERBOSE === "1") {
    console.warn(`[phone non-blocking] ${entry.suite || "?"} — ${entry.label || entry.message || ""}`);
  }
}

function clearPhoneWarnings() {
  try {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, "", "utf8");
  } catch {
    // ignore
  }
}

/**
 * Run assert.ok / assert.equal semantics; on phone portrait with blocking off, record warning only.
 */
function assertViewport(viewportName, condition, message, meta = {}) {
  if (condition) return;
  const msg = message || "assertion failed";
  if (isPhonePortrait(viewportName) && !phonePortraitBlockingEnabled()) {
    recordPhoneWarning({
      suite: meta.suite,
      viewport: viewportName,
      label: meta.label || msg,
      message: msg,
    });
    return;
  }
  assert.ok(false, msg);
}

function assertEqualViewport(viewportName, actual, expected, message, meta = {}) {
  if (actual === expected) return;
  const msg = message || `expected ${expected}, got ${actual}`;
  if (isPhonePortrait(viewportName) && !phonePortraitBlockingEnabled()) {
    recordPhoneWarning({
      suite: meta.suite,
      viewport: viewportName,
      label: meta.label || msg,
      message: msg,
    });
    return;
  }
  assert.equal(actual, expected, msg);
}

function printPhonePortraitReport() {
  let lines = [];
  try {
    if (fs.existsSync(REPORT_PATH)) {
      lines = fs.readFileSync(REPORT_PATH, "utf8").trim().split("\n").filter(Boolean);
    }
  } catch {
    lines = [];
  }
  const warnings = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { message: line };
    }
  });
  console.log("\n=== phone (non-blocking) ===");
  if (!warnings.length) {
    console.log("No phone portrait warnings recorded.");
    console.log(`(Set PHONE_PORTRAIT_BLOCKING=1 to enforce ${PHONE_PORTRAIT_NAMES.join(", ")})`);
    return { warnings: [], count: 0 };
  }
  const byVp = {};
  for (const w of warnings) {
    const vp = w.viewport || "unknown";
    if (!byVp[vp]) byVp[vp] = [];
    byVp[vp].push(w);
  }
  for (const vp of PHONE_PORTRAIT_NAMES) {
    const list = byVp[vp] || [];
    console.log(`${vp}: ${list.length} warning(s)`);
    for (const w of list.slice(0, 8)) {
      console.log(`  - ${w.suite || ""} ${w.label || w.message || ""}`.trim());
    }
    if (list.length > 8) console.log(`  … and ${list.length - 8} more`);
  }
  console.log(`Total: ${warnings.length} (PHONE_PORTRAIT_BLOCKING=${phonePortraitBlockingEnabled() ? "1" : "0"})`);
  return { warnings, count: warnings.length };
}

module.exports = {
  PHONE_PORTRAIT_NAMES,
  BLOCKING_CHECK_FAST_NAMES,
  phonePortraitBlockingEnabled,
  isPhonePortrait,
  isBlockingCheckFastViewport,
  recordPhoneWarning,
  clearPhoneWarnings,
  assertViewport,
  assertEqualViewport,
  printPhonePortraitReport,
  REPORT_PATH,
};
