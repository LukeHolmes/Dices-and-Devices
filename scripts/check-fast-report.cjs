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

console.log("=== check:fast (blocking) — npm test + test:layout ===\n");
let code = run("npm", ["test"]);
if (code !== 0) process.exit(code);
code = run("npm", ["run", "test:layout"]);
if (code !== 0) process.exit(code);

console.log("\n=== check:fast — smoke (all viewports; phone failures are warnings) ===\n");
const smokeCode = run(
  "node",
  ["--test", "--test-timeout=720000", "tests/check-fast-smoke.test.cjs"],
  { CHECK_FAST_PRINT_PHONE_REPORT: "1" },
);
if (smokeCode !== 0) process.exit(smokeCode);

const phoneReport = printPhonePortraitReport();

console.log("\n=== check:fast (blocking viewports) ===");
console.log("Smoke seeds 13 & 61 must pass at: 844x390, 768x1024, 1024x768, 1366x768, 1920x1080");
console.log("(Phone portrait smoke runs are non-blocking unless PHONE_PORTRAIT_BLOCKING=1)");

module.exports = { phoneReport };
