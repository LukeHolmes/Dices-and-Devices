#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { harnessCommit } = require("../../scripts/harness-commit.cjs");

const sha = harnessCommit();
assert.match(sha, /^[0-9a-f]{40}(?:\+w[0-9a-f]{16})?$/);
console.log("harnessCommit", sha);