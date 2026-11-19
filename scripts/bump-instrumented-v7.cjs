#!/usr/bin/env node
"use strict";
/**
 * Tagging-only sync for instrumented baseline branches (v7).
 * Run from diagnostics repo root; pushes to origin.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const WT = path.join(ROOT, ".worktrees", "instrumented-v7");

function git(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function patchIndex(html) {
  let out = html;
  if (!out.includes("window.__GB_SIM_PHASE__ = phase")) {
    out = out.replace(
      /window\.__GB_SIM_ROUND__ = round;\n(\s+)\}, \[round\]\);/,
      "window.__GB_SIM_ROUND__ = round;\n$1}, [round]);\n\n$1useEffect(() => {\n$1    if (typeof window === 'undefined') return;\n$1    if (typeof window.__GB_SIM_DRAW_GAME__ !== 'function') return;\n$1    window.__GB_SIM_PHASE__ = phase;\n$1}, [phase]);",
    );
  }
  if (!out.includes("getSimCanonicalState:")) {
    out = out.replace(
      /getState: \(\) => \(\{(\n\s+phase,)/,
      `getSimCanonicalState: () => {
                        const snapDice = window.GutterbonesBalanceObserver?.snapshotRawLane
                            ? window.GutterbonesBalanceObserver.snapshotRawLane(dice)
                            : (dice || []).map((d) => ({
                                id: d.id,
                                value: d.value,
                                faces: (d.faces || []).map((f) => f.faceId || f.id).sort(),
                            }));
                        const shopIds = (shopItems || [])
                            .filter((item) => !soldItems.includes(item.id))
                            .map((item) => item.id)
                            .sort();
                        const inventoryIds = (inventory || []).map((item) => item.id).sort();
                        return {
                            phase,
                            round,
                            target,
                            score,
                            gold,
                            debt,
                            hands,
                            discards,
                            hasRolled: !!hasRolled,
                            kept: [...(kept || [])].sort((a, b) => a - b),
                            selectedShopPathId,
                            roundClearVisible: !!roundClearCardActive,
                            activeBossId: activeBoss?.id || null,
                            inventoryIds,
                            shopIds,
                            dice: snapDice,
                            flowStreak,
                        };
                    },
                    getState: () => ({`,
    );
  }
  out = out.replace(
    /const runRandomFn = \(\) => gameplayRandom\(\);/g,
    "const runRandomFn = () => gameplayRandom('rollLane');",
  );
  out = out.replace(
    /const pillRng = \(\) => gameplayRandom\(\);/g,
    "const pillRng = () => gameplayRandom('pillRng');",
  );
  out = out.replace(
    /Math\.floor\(gameplayRandom\(\) \* die\.faces\.length\)/g,
    "Math.floor(gameplayRandom('rollBoneFace') * die.faces.length)",
  );
  out = out.replace(
    /id: gameplayRandom\(\)/g,
    "id: gameplayRandom('rollBoneId')",
  );
  out = out.replace(
    /gameplayRandom\(\) \* free\.length\)/g,
    "gameplayRandom('rerollBonePick') * free.length)",
  );
  return out;
}

function bumpBranch(branch) {
  const dir = path.join(WT, branch.replace(/\//g, "_"));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const fetch = git(ROOT, ["fetch", "origin", branch]);
    if (fetch.status !== 0) throw new Error(fetch.stderr);
    const add = git(ROOT, ["worktree", "add", "-B", branch, dir, `origin/${branch}`]);
    if (add.status !== 0) throw new Error(add.stderr);
  }
  const indexPath = path.join(dir, "index.html");
  const before = fs.readFileSync(indexPath, "utf8");
  const after = patchIndex(before);
  if (before === after) {
    console.error(`${branch}: no changes (already patched?)`);
    return null;
  }
  fs.writeFileSync(indexPath, after);
  git(dir, ["add", "index.html"]);
  const commit = git(dir, [
    "commit",
    "-m",
    "chore(sim): v7 phase sync, canonical state export, roll caller tags (hook only)",
  ]);
  if (commit.status !== 0) throw new Error(commit.stderr);
  const rev = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
  const push = git(dir, ["push", "-u", "origin", branch]);
  if (push.status !== 0) throw new Error(push.stderr);
  return rev;
}

function main() {
  const branches = ["baseline/r78-instrumented", "baseline/r-main-instrumented"];
  const commits = {};
  for (const b of branches) {
    commits[b] = bumpBranch(b);
    console.log(`${b} -> ${commits[b]}`);
  }
  console.log(JSON.stringify(commits, null, 2));
}

module.exports = { patchIndex };

if (require.main === module) main();