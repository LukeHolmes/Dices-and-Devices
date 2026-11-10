"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { clearPhoneWarnings, printPhonePortraitReport } = require("../tests/helpers/phone-portrait.cjs");

const ROOT = path.join(__dirname, "..");
const env = {
  ...process.env,
  PHONE_PORTRAIT_BLOCKING: process.env.PHONE_PORTRAIT_BLOCKING ?? "0",
};

function run(cmd, args, envExtra = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: { ...env, ...envExtra },
    stdio: "inherit",
    shell: false,
  });
  return r.status ?? 1;
}

clearPhoneWarnings();

console.log("=== check:fast — test:fast (Node rules/unit, no Playwright playtest suite) ===\n");
let code = run("npm", ["run", "test:fast"]);
if (code !== 0) process.exit(code);

console.log("\n=== check:fast — repro-r13 softlocks ===\n");
code = run("node", ["--test", "--test-timeout=420000", "tests/repro-r13-softlocks.test.cjs"]);
if (code !== 0) process.exit(code);

console.log("\n=== check:fast — hand-roll overlay (production sprites) ===\n");
code = run("node", ["--test", "--test-timeout=180000", "tests/hand-roll-overlay.test.cjs"]);
if (code !== 0) process.exit(code);

const fullLayout = process.env.FULL_LAYOUT_REPLAY === "1";
if (fullLayout) {
  console.log("\n=== check:fast (blocking) — test:layout (FULL_LAYOUT_REPLAY=1) ===\n");
  code = run("npm", ["run", "test:layout"]);
  if (code !== 0) process.exit(code);
} else {
  console.log("\n=== check:fast — skipping browser layout replay (use FULL_LAYOUT_REPLAY=1 or CI full-replay job) ===\n");
}

console.log("\n=== check:fast — polish step5 layout (blocking + phone warnings) ===\n");
code = run("node", ["--test", "--test-timeout=900000", "tests/polish-step5-layout.test.cjs"], {
  CHECK_FAST_PRINT_PHONE_REPORT: "1",
});
if (code !== 0) process.exit(code);

console.log("\n=== check:fast — stuck-game smoke (blocking viewports) ===\n");
const smokeCode = run(
  "node",
  ["--test", "--test-timeout=720000", "tests/polish-step5-stuck-smoke.test.cjs"],
  { CHECK_FAST_PRINT_PHONE_REPORT: "1" },
);
if (smokeCode !== 0) process.exit(smokeCode);

const phoneReport = printPhonePortraitReport();

console.log("\n=== check:fast (blocking viewports) ===");
console.log("Smoke seeds 13 & 61 must pass at blocking: 768x1024, 1024x768, 1366x768, 1920x1080");
console.log("(Phone portrait + 844x390 smoke runs are warnings unless PHONE_PORTRAIT_BLOCKING=1)");

module.exports = { phoneReport };
