"use strict";
// Legacy entry point: all GB001–GB011 fixes live in tests/regression-defects.test.cjs
const { execFileSync } = require("node:child_process");
execFileSync(process.execPath, ["--test", "tests/regression-defects.test.cjs"], {
  stdio: "inherit",
});
