#!/usr/bin/env node
"use strict";
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_ROOT = path.join(__dirname, "..");

function git(cmd, cwd) {
  return spawnSync("git", cmd, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** Git HEAD, or HEAD+w{16} when the working tree differs from HEAD (measurement harness stamp). */
function harnessCommit(root = DEFAULT_ROOT) {
  const head = (git(["rev-parse", "HEAD"], root).stdout || "").trim();
  if (!head) return "";
  const porcelain = (git(["status", "--porcelain"], root).stdout || "").trim();
  if (!porcelain) return head;
  const diff = git(["diff", "HEAD"], root).stdout || "";
  const hash = crypto.createHash("sha256").update(`${diff}\n---\n${porcelain}`).digest("hex").slice(0, 16);
  return `${head}+w${hash}`;
}

module.exports = { harnessCommit, git };