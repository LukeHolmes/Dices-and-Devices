#!/usr/bin/env node
/**
 * Hand-roll polish review artifacts — alley crops, full timeline, computed pose labels.
 * Uses freeze at 50ms steps; gameplay video at 1× with timer-throttling disabled.
 */
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

const LAUNCH = {
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
};

const PORT = 8824;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));
const base = `http://127.0.0.1:${PORT}`;

async function bootPlay(page, vp) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
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

async function alleyClip(page) {
  return page.evaluate(() => {
    const alley = document.querySelector('[data-layout-key="play-alley"]');
    if (!alley) return null;
    const r = alley.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
  });
}

async function shotAlley(page, outPath) {
  const clip = await alleyClip(page);
  if (!clip) throw new Error("no play-alley clip");
  await page.screenshot({ path: outPath, clip });
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const browser = await chromium.launch(LAUNCH);

// --- Full timeline strip (1920×1080) ---
const stripPage = await browser.newPage();
await bootPlay(stripPage, { width: 1920, height: 1080 });
const handMs = await stripPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.getRollHandFxMs());
await stripPage.click('[data-tutorial="roll-btn"]');
await stripPage.waitForSelector(".animate-gutter-hand", { timeout: 8000 });
const step = 50;
const tailEnd = handMs + 80;
const frames = [];
for (let t = 0; t <= tailEnd; t += step) {
  const frozen = await stripPage.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), t);
  if (!frozen?.ok && t > 0) break;
  const pose = await stripPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.readRollHandPose());
  const fp = `${ART}/hand-roll-polish-strip-${String(t).padStart(4, "0")}ms.png`;
  await shotAlley(stripPage, fp);
  const px = await stripPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandOpaquePixels());
  frames.push({ t, fp, pose, px });
  console.log("strip", t, pose?.dominant, pose?.animProgress?.toFixed?.(2), px?.ok);
}

const cols = 7;
const cells = frames
  .map(({ t, fp, pose, px }) => {
    const b64 = fs.readFileSync(fp).toString("base64");
    const tr = pose?.transform ? pose.transform.replace(/matrix\(([^)]+)\)/, "m($1)") : "—";
    const label = `${t}ms · ${pose?.dominant || "?"} · c${pose?.closedOp?.toFixed?.(2)} o${pose?.openOp?.toFixed?.(2)} · px${px?.ok ? "✓" : "×"}`;
    const sub = tr.length > 56 ? `${tr.slice(0, 53)}…` : tr;
    return `<figure style="margin:0;display:flex;flex-direction:column;gap:2px;background:#111;border:1px solid #333;padding:3px;">
<div style="font:9px/1.2 monospace;color:#6ee7b7">${esc(label)}</div>
<div style="font:8px/1.1 monospace;color:#888;max-height:2.2em;overflow:hidden">${esc(sub)}</div>
<img alt="${t}ms" src="data:image/png;base64,${b64}" style="width:100%;aspect-ratio:4/3;object-fit:cover;background:#000"/>
</figure>`;
  })
  .join("");
const rows = Math.ceil(frames.length / cols);
const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#0a0a0a;color:#eee;">
<div style="font:12px monospace;padding:8px;color:#0df">HAND ROLL · 50ms alley crops · ${handMs}ms sweep · ${frames.length} frames (0–${frames[frames.length - 1]?.t}ms)</div>
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:8px;width:${cols * 268}px">${cells}</div>
</body></html>`;
const sheetPage = await browser.newPage();
await sheetPage.setViewportSize({ width: cols * 268 + 24, height: rows * 220 + 48 });
await sheetPage.setContent(sheetHtml, { waitUntil: "load" });
const sheetMain = `${ART}/hand-roll-polish-contactsheet-0-${tailEnd}ms.png`;
await sheetPage.screenshot({ path: sheetMain, fullPage: true });
await sheetPage.close();
await stripPage.close();

// --- 4× VP framing stills (release @ 54%) ---
for (const vp of VPs) {
  const page = await browser.newPage();
  try {
    await bootPlay(page, { width: vp.width, height: vp.height });
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForSelector(".animate-gutter-hand", { timeout: 8000 });
    for (const [key, ratio] of [
      ["anticipation", 0.1],
      ["throw", 0.4],
      ["release", 0.56],
      ["withdraw", 0.88],
    ]) {
      await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), Math.round(handMs * ratio));
      const pose = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.readRollHandPose());
      const out = `${ART}/hand-roll-polish-${key}-${vp.tag}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log("vp", vp.tag, key, pose?.wristInsideAlley, out);
    }
  } finally {
    await page.close();
  }
}

// --- Reduced motion off/on sanity ---
const rmPage = await browser.newPage();
await bootPlay(rmPage, { width: 768, height: 1024 });
await rmPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.triggerRollHandOverlayFx());
await rmPage.waitForSelector(".animate-gutter-hand", { timeout: 5000 });
await shotAlley(rmPage, `${ART}/hand-roll-polish-rm-off-proof.png`);
await rmPage.emulateMedia({ reducedMotion: "reduce" });
await rmPage.reload({ waitUntil: "domcontentloaded" });
await rmPage.waitForFunction(() => window.__GB_LAYOUT_AUDIT__);
const rmPayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.playStashOpen844()));
await rmPage.evaluate(
  ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
  { key: "gutterbones1977:run:v1", data: rmPayload },
);
await rmPage.reload({ waitUntil: "domcontentloaded" });
await rmPage.waitForFunction(() => window.__GB_LAYOUT_AUDIT__);
await rmPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
await rmPage.click('[data-tutorial="roll-btn"]');
await rmPage.waitForTimeout(400);
const rmCount = await rmPage.locator(".animate-gutter-hand").count();
await shotAlley(rmPage, `${ART}/hand-roll-polish-rm-on-proof.png`);
fs.writeFileSync(
  `${ART}/hand-roll-polish-rm-check.json`,
  JSON.stringify({ reducedMotionHandCount: rmCount, expectZero: true }, null, 2),
);
await rmPage.close();

// --- Normal-speed gameplay video (minimal prelude) ---
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  recordVideo: { dir: ART, size: { width: 1366, height: 768 } },
});
const vPage = await ctx.newPage();
await bootPlay(vPage, { width: 1366, height: 768 });
await vPage.evaluate(() => {
  const hint = document.querySelector('[data-layout-key="play-alley"] .absolute.inset-x-4');
  if (hint) hint.style.display = "none";
});
await vPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.setHandReviewSlowMo(false));
const rollGap = handMs + 200;
const clickRoll = async () => {
  await vPage.waitForFunction(
    () => {
      const b = document.querySelector('[data-tutorial="roll-btn"]');
      return b && !b.disabled;
    },
    { timeout: 15_000 },
  );
  await vPage.click('[data-tutorial="roll-btn"]');
};
for (let i = 0; i < 2; i += 1) {
  await clickRoll();
  await vPage.waitForTimeout(rollGap);
}
await clickRoll();
await vPage.waitForTimeout(160);
const rapidOk = await vPage.evaluate(() => {
  const b = document.querySelector('[data-tutorial="roll-btn"]');
  return !!(b && !b.disabled);
});
if (rapidOk) {
  await vPage.click('[data-tutorial="roll-btn"]');
  await vPage.waitForTimeout(110);
}
await vPage.waitForTimeout(handMs + 160);
const vid = vPage.video();
await vPage.close();
const demoOut = `${ART}/hand-roll-polish-gameplay-normal.webm`;
if (vid) await vid.saveAs(demoOut);

await ctx.close();
await browser.close();
server.kill();

fs.writeFileSync(
  `${ART}/hand-roll-polish-timeline-meta.json`,
  JSON.stringify({ handMs, step, frameCount: frames.length, lastMs: frames[frames.length - 1]?.t, frames: frames.map((f) => ({ t: f.t, pose: f.pose, pxOk: f.px?.ok })) }, null, 2),
);

console.log("handMs", handMs);
console.log("contactsheet", sheetMain);
console.log("demo", demoOut);
console.log("meta", `${ART}/hand-roll-polish-timeline-meta.json`);
