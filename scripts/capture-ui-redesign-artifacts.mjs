#!/usr/bin/env node
/**
 * Capture before (main worktree) and after (current tree) UI screenshots for draft PR #79.
 */
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const outRoot = process.argv[2] || "/opt/cursor/artifacts/ui-redesign";
const beforeDir = path.join(outRoot, "before-main");
const afterDir = path.join(outRoot, "after-redesign");
const RUN_KEY = "gutterbones1977:run:v1";

for (const d of [outRoot, beforeDir, afterDir]) fs.mkdirSync(d, { recursive: true });

const worktreePath = path.join("/tmp", "gb-ui-redesign-before-main");
const hasWorktree = (() => {
  try {
    const list = execSync("git worktree list", { cwd: ROOT, encoding: "utf8" });
    return list.includes(worktreePath);
  } catch {
    return false;
  }
})();

if (!hasWorktree) {
  execSync(`git fetch origin main`, { cwd: ROOT, stdio: "inherit" });
  execSync(`git worktree add "${worktreePath}" origin/main`, { cwd: ROOT, stdio: "inherit" });
}

function startServer(cwd, port) {
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd,
    stdio: "ignore",
  });
  return server;
}

async function loadPlay(page, builder, vp, base) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(700);
}

async function captureSuite(serveRoot, outDir, label) {
  const PORT = label === "before" ? 8807 : 8808;
  const server = startServer(serveRoot, PORT);
  await new Promise((r) => setTimeout(r, 650));
  const base = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch({ headless: true });
  const vpTablet = { width: 768, height: 1024 };
  const vpDesk = { width: 1920, height: 1080 };
  const page = await browser.newPage();

  await loadPlay(page, fixtures.playStashOpen844, vpTablet, base);
  await page.screenshot({
    path: path.join(outDir, `play-tablet-768x1024-${label}.png`),
    fullPage: false,
  });

  if (label === "after") {
    const hasRedesign = await page.$("#root-gutterbones[data-ui-redesign='1']");
    if (!hasRedesign) console.warn("after capture: data-ui-redesign flag missing");
    await page.click('[data-layout-key="payout-unlock-open"]').catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "play-payout-unlock-inspector.png"), fullPage: false });
    await page.click('[data-layout-key="payout-unlock-close"]').catch(() => {});
    await page.waitForTimeout(250);
  }

  await page.click('[data-tutorial="roll-btn"]').catch(() => {});
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outDir, `play-tablet-after-roll-${label}.png`), fullPage: false });

  const payoutRow = await page.$("button[data-payout-row]:not([disabled])");
  if (payoutRow) {
    await payoutRow.hover();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(outDir, `play-payout-receipt-hover-${label}.png`), fullPage: false });
  }

  await page.click('[data-layout-key="play-history-log"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `play-history-drawer-${label}.png`), fullPage: false });
  await page.click('[data-layout-key="play-history-close"]').catch(() => {});

  await loadPlay(page, fixtures.shopBusy, vpDesk, base);
  await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 12_000 });
  await page.screenshot({ path: path.join(outDir, `shop-counting-cash-1920-${label}.png`), fullPage: false });
  if (label === "after") {
    await page.setViewportSize(vpTablet);
    await loadPlay(page, fixtures.shopBusy, vpTablet, base);
    await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 12_000 });
    await page.screenshot({ path: path.join(outDir, "shop-tablet-768x1024-after.png"), fullPage: false });
  }

  if (label === "after") {
    const inspectBtn = await page.$('[data-layout-key="shop-inspect-offer"]');
    if (inspectBtn) {
      await inspectBtn.click();
      await page.waitForTimeout(300);
      const boneBtn = await page.$('[data-layout-key="shop-inspect-bone-1"]');
      if (boneBtn) await boneBtn.click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(outDir, "shop-workbench-inspect-bones.png"), fullPage: false });
    }
  }

  try {
    await page.setViewportSize(vpDesk);
    const carvePayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.carving()));
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: carvePayload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(800);
    if (await page.$('[data-layout-key="carving-layout"]')) {
      await page.screenshot({ path: path.join(outDir, `carving-mod-bench-${label}.png`), fullPage: false });
    }
  } catch (err) {
    console.warn(`${label} carving capture skipped:`, err.message);
  }

  await page.close();
  await browser.close();
  server.kill();
  console.log(`Saved ${label} shots →`, outDir);
}

await captureSuite(worktreePath, beforeDir, "before");
await captureSuite(ROOT, afterDir, "after");

const flat = [
  ["before-main/play-tablet-768x1024-before.png", "ui-redesign-before-play-tablet-768x1024.png"],
  ["after-redesign/play-tablet-768x1024-after.png", "ui-redesign-after-play-tablet-768x1024.png"],
  ["before-main/play-tablet-after-roll-before.png", "ui-redesign-before-play-tablet-after-roll.png"],
  ["after-redesign/play-tablet-after-roll-after.png", "ui-redesign-after-play-tablet-after-roll.png"],
  ["after-redesign/play-payout-unlock-inspector.png", "ui-redesign-after-payout-unlock-inspector-768x1024.png"],
  ["after-redesign/play-payout-receipt-hover-after.png", "ui-redesign-after-payout-receipt-hover-768x1024.png"],
  ["after-redesign/play-history-drawer-after.png", "ui-redesign-after-play-history-drawer-768x1024.png"],
  ["after-redesign/shop-counting-cash-1920-after.png", "ui-redesign-after-shop-1920x1080.png"],
  ["after-redesign/shop-workbench-inspect-bones.png", "ui-redesign-after-shop-inspect-bones-1920x1080.png"],
  ["after-redesign/shop-tablet-768x1024-after.png", "ui-redesign-after-shop-tablet-768x1024.png"],
  ["after-redesign/carving-mod-bench-after.png", "ui-redesign-after-carving-1920x1080.png"],
];
for (const [rel, name] of flat) {
  const src = path.join(outRoot, rel);
  const dest = path.join("/opt/cursor/artifacts", name);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

console.log("UI redesign before/after capture complete:", outRoot);
console.log("Flat artifact copies under /opt/cursor/artifacts/ui-redesign-*.png");
