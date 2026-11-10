#!/usr/bin/env node
/** Release-apex frames with production hand sprites at blocking viewports (animation paused via layoutAudit only). */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const VPs = [
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "1366x768", width: 1366, height: 768 },
  { tag: "1920x1080", width: 1920, height: 1080 },
];

const PORT = 8816;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));
const base = `http://127.0.0.1:${PORT}`;

async function bootPlay(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: "gutterbones1977:run:v1", data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 20_000 });
}

async function captureHandFrame(page, vp, phaseMs, suffix) {
  await bootPlay(page, { width: vp.width, height: vp.height });
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', {
    timeout: 5000,
  });
  const frozen = await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), phaseMs);
  if (!frozen?.ok) throw new Error(`freeze failed @${phaseMs}: ${frozen?.reason || "unknown"}`);
  const vis = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandVisibility());
  if (!vis?.ok) throw new Error(`hand not visible @${phaseMs} ${vp.tag}: ${JSON.stringify(vis)}`);
  const out = `/opt/cursor/artifacts/ui-redesign-hand-${suffix}-${vp.tag}.png`;
  await page.screenshot({ path: out, fullPage: false });
  console.log("saved", out, `area=${Math.round(vis.area)}`);
  return out;
}

const browser = await chromium.launch({ headless: true });
const contactClosed = [];
const contactOpen = [];
for (const vp of VPs) {
  const page = await browser.newPage();
  try {
    contactClosed.push(await captureHandFrame(page, vp, 100, "closed"));
  } finally {
    await page.close();
  }
  const page2 = await browser.newPage();
  try {
    contactOpen.push(await captureHandFrame(page2, vp, 210, "open"));
  } finally {
    await page2.close();
  }
  const page3 = await browser.newPage();
  await bootPlay(page3, { width: vp.width, height: vp.height });
  await page3.click('[data-tutorial="roll-btn"]');
  await page3.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 5000 });
  await page3.evaluate(() => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(210));
  const apex = `/opt/cursor/artifacts/ui-redesign-hand-roll-apex-${vp.tag}.png`;
  await page3.screenshot({ path: apex, fullPage: false });
  console.log("saved", apex);
  await page3.close();
}

// Realtime motion demo (no freeze) — tablet portrait
const ctx = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: "/opt/cursor/artifacts", size: { width: 768, height: 1024 } },
});
const vpage = await ctx.newPage();
await bootPlay(vpage, { width: 768, height: 1024 });
await vpage.waitForTimeout(200);
await vpage.click('[data-tutorial="roll-btn"]');
let sawHand = false;
for (let t = 0; t < 520; t += 40) {
  await vpage.waitForTimeout(40);
  const vis = await vpage.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandVisibility());
  if (vis?.ok) {
    sawHand = true;
  }
}
if (!sawHand) {
  throw new Error("realtime tablet roll never produced visible hand (sampleRollHandVisibility)");
}
await vpage.waitForTimeout(350);
await vpage.click('[data-tutorial="roll-btn"]').catch(() => {});
await vpage.waitForTimeout(750);
const vid = vpage.video();
await vpage.close();
const demoOut = "/opt/cursor/artifacts/ui-redesign-hand-roll-production-demo.webm";
if (vid) await vid.saveAs(demoOut);
await ctx.close();
await browser.close();
server.kill();

const sheetOut = "/opt/cursor/artifacts/ui-redesign-hand-vp-contactsheet.png";
const sheetPage = await chromium.launch({ headless: true }).then((b) => b.newPage());
await sheetPage.setViewportSize({ width: 1920, height: 1080 });
await sheetPage.setContent(`<!doctype html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:8px;padding:8px;">
${[...contactClosed, ...contactOpen].map((p) => `<img src="file://${p}" style="width:100%;height:100%;object-fit:contain;background:#000"/>`).join("")}
</body>`);
await sheetPage.screenshot({ path: sheetOut, fullPage: false });
await sheetPage.context().browser()?.close();

console.log("demo", demoOut);
console.log("contactsheet", sheetOut);
