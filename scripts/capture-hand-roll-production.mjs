#!/usr/bin/env node
/** Hand-roll review artifacts — full viewport PNGs, pixel checks, valid contact sheet, slow-mo copy. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixtures = require("../tests/fixtures/runs.cjs");
const { createGame, plain } = require("../tests/helpers/game.cjs");

const ROOT = path.resolve(import.meta.dirname, "..");
const ART = "/opt/cursor/artifacts";
const VPs = [
  { tag: "768x1024", width: 768, height: 1024 },
  { tag: "1024x768", width: 1024, height: 768 },
  { tag: "1366x768", width: 1366, height: 768 },
  { tag: "1920x1080", width: 1920, height: 1080 },
];
function phaseMs(vp, phase) {
  const wide = vp.width >= 1280;
  if (phase === "closed") return wide ? 125 : 95;
  return wide ? 255 : 220;
}

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

async function assertHandFrame(page, vp, phaseMs, frameKind = "auto") {
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', {
    timeout: 8000,
  });
  let frozen = await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), phaseMs);
  if (!frozen?.ok) throw new Error(`${vp.tag} freeze@${phaseMs}: ${frozen?.reason}`);
  await page.waitForTimeout(40);
  let px = await page.evaluate(
    (kind) => window.__GB_LAYOUT_AUDIT__.sampleRollHandOpaquePixels(kind),
    frameKind,
  );
  if (!px?.ok && frameKind === "open") {
    for (const retryMs of [phaseMs - 25, phaseMs + 30, phaseMs + 55]) {
      if (retryMs <= 0) continue;
      await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), retryMs);
      await page.waitForTimeout(30);
      px = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandOpaquePixels("open"));
      if (px?.ok) break;
    }
  }
  const vis = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandVisibility());
  const overlap = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.measureHandShuffleOverlap());
  if (!vis?.ok) throw new Error(`${vp.tag} vis@${phaseMs}: ${JSON.stringify(vis)}`);
  if (!px?.ok) throw new Error(`${vp.tag} pixels@${phaseMs}: ${JSON.stringify(px)}`);
  if (!overlap?.ok) throw new Error(`${vp.tag} shuffle overlap@${phaseMs}: ${JSON.stringify(overlap)}`);
  return { vis, px, overlap };
}

async function captureHandFrame(browser, vp, phaseMs, suffix) {
  const page = await browser.newPage();
  try {
    await bootPlay(page, { width: vp.width, height: vp.height });
    const meta = await assertHandFrame(page, vp, phaseMs, suffix);
    const out = `${ART}/ui-redesign-hand-${suffix}-${vp.tag}.png`;
    await page.screenshot({ path: out, fullPage: false });
    console.log("saved", out, meta.px.frame, `opaque=${meta.px.opaque}`);
    return out;
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
const paths = [];
for (const vp of VPs) {
  paths.push(await captureHandFrame(browser, vp, phaseMs(vp, "closed"), "closed"));
  paths.push(await captureHandFrame(browser, vp, phaseMs(vp, "open"), "open"));
  const apexPage = await browser.newPage();
  try {
    await bootPlay(apexPage, { width: vp.width, height: vp.height });
    await assertHandFrame(apexPage, vp, phaseMs(vp, "open"), "open");
    const apex = `${ART}/ui-redesign-hand-roll-apex-${vp.tag}.png`;
    await apexPage.screenshot({ path: apex, fullPage: false });
    console.log("saved", apex);
    if (vp.tag === "768x1024") {
      fs.copyFileSync(apex, `${ART}/ui-redesign-hand-roll-apex-production.png`);
    }
  } finally {
    await apexPage.close();
  }
}

// Contact sheet — embed PNGs as data URLs (file:// breaks in Chromium)
const labels = [];
for (const vp of VPs) {
  labels.push(`${vp.tag} closed`);
  labels.push(`${vp.tag} open`);
}
const imgs = paths.map((p, idx) => {
  const b64 = fs.readFileSync(p).toString("base64");
  return `<figure style="margin:0;display:flex;flex-direction:column;background:#0a0a0a;border:1px solid #333;padding:4px;min-height:0;">
<label style="font:11px monospace;color:#0df;padding:4px">${labels[idx]}</label>
<img alt="${labels[idx]}" src="data:image/png;base64,${b64}" style="width:100%;height:100%;object-fit:contain;flex:1;min-height:200px;background:#000"/>
</figure>`;
});
const sheetHtml = `<!doctype html><html><body style="margin:0;background:#111;color:#eee;font-family:monospace;">
<div style="padding:8px;font-size:12px;letter-spacing:.2em">HAND ROLL CONTACT SHEET — production sprites</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:8px;padding:8px;height:calc(100vh - 32px);box-sizing:border-box">${imgs.join("")}</div>
</body></html>`;
const sheetPage = await browser.newPage();
await sheetPage.setViewportSize({ width: 1920, height: 1080 });
await sheetPage.setContent(sheetHtml, { waitUntil: "load" });
const sheetOut = `${ART}/ui-redesign-hand-vp-contactsheet.png`;
await sheetPage.screenshot({ path: sheetOut, fullPage: false });
await sheetPage.close();

// Realtime 1× tablet demo
const ctx1 = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: ART, size: { width: 768, height: 1024 } },
});
const v1 = await ctx1.newPage();
await bootPlay(v1, { width: 768, height: 1024 });
await v1.evaluate(() => window.__GB_LAYOUT_AUDIT__.setHandReviewSlowMo(false));
await v1.waitForTimeout(200);
await v1.click('[data-tutorial="roll-btn"]');
let sawHand = false;
for (let t = 0; t < 520; t += 40) {
  await v1.waitForTimeout(40);
  const px = await v1.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandOpaquePixels());
  if (px?.ok) sawHand = true;
}
if (!sawHand) throw new Error("realtime 1x demo: no opaque hand pixels");
await v1.waitForTimeout(400);
await v1.click('[data-tutorial="roll-btn"]').catch(() => {});
await v1.waitForTimeout(600);
const vid1 = v1.video();
await v1.close();
const demoOut = `${ART}/ui-redesign-hand-roll-production-demo.webm`;
if (vid1) await vid1.saveAs(demoOut);

// Review-only 4× slow-mo copy (runtime unchanged in app)
const ctx2 = await browser.newContext({
  viewport: { width: 768, height: 1024 },
  recordVideo: { dir: ART, size: { width: 768, height: 1024 } },
});
const v2 = await ctx2.newPage();
await bootPlay(v2, { width: 768, height: 1024 });
await v2.evaluate(() => {
  window.__GB_LAYOUT_AUDIT__.setHandReviewSlowMo(true);
  const banner = document.createElement("div");
  banner.id = "gb-hand-review-banner";
  banner.textContent = "REVIEW 4× SLOW-MO — runtime roll timing unchanged";
  banner.setAttribute(
    "style",
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#ff007f;color:#fff;font:11px monospace;text-align:center;padding:6px;pointer-events:none",
  );
  document.body.appendChild(banner);
});
await v2.waitForTimeout(300);
await v2.click('[data-tutorial="roll-btn"]');
await v2.waitForTimeout(2200);
await v2.click('[data-tutorial="roll-btn"]').catch(() => {});
await v2.waitForTimeout(2400);
const vid2 = v2.video();
await v2.close();
const slowOut = `${ART}/ui-redesign-hand-roll-review-slowmo-4x.webm`;
if (vid2) await vid2.saveAs(slowOut);
await ctx1.close();
await ctx2.close();
await browser.close();
server.kill();

console.log("demo", demoOut);
console.log("slowmo", slowOut);
console.log("contactsheet", sheetOut);
