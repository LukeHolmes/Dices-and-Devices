"use strict";
/**
 * Presentation pacing: module floors + Playwright minimum visible durations.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = path.join("/opt/cursor/artifacts", "presentation-timing");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function block(open) {
  const start = html.indexOf(open);
  assert.ok(start >= 0, `Missing ${open}`);
  const from = start + open.length;
  const end = html.indexOf("</script>", from);
  return html.slice(from, end);
}

const presentationSource = block('<script id="gutterbones-presentation">');
const presentation = {};
vm.createContext(presentation);
vm.runInContext(`${presentationSource}; this.GP = GutterbonesPresentation;`, presentation);
const GP = presentation.GP;

test("GutterbonesPresentation gate mins meet readable floors", () => {
  assert.ok(GP.gateMinMs("roundClear", "normal", false) >= 2500);
  assert.ok(GP.gateMinMs("bossIntro", "normal", false) >= 3000);
  assert.ok(GP.toastDurationMs("normal", false) >= 3000);
  assert.ok(GP.gateMinMs("scoreOverlay", "relaxed", false) >= GP.gateMinMs("scoreOverlay", "fast", false));
});

test("score overlay lifetime scales with synergy events", () => {
  const plain = { synergyEvents: [], explanationSteps: [], chainDepth: 0 };
  const chainy = {
    synergyEvents: [{ id: "a" }, { id: "b" }],
    explanationSteps: [{ label: "CHAIN: x" }, { label: "CHAIN: y" }],
    chainDepth: 2,
  };
  const base = GP.scoreOverlayLifetimeMs({
    result: plain,
    reducedMotion: false,
    pacing: "normal",
    synergyTuning: { overlayBaseMs: 2600 },
  });
  const deep = GP.scoreOverlayLifetimeMs({
    result: chainy,
    reducedMotion: false,
    pacing: "normal",
    synergyTuning: { overlayBaseMs: 2600, juiceStepMs: 150 },
  });
  assert.ok(deep > base);
  assert.ok(deep >= 2600);
});

let server;
let baseUrl;
let chromium;

before(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  chromium = require("playwright").chromium;
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".png": "image/png",
    };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function waitForGameReady(page) {
  await page.waitForSelector("#root-gutterbones", { timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.innerText && !root.innerText.includes("LOADING");
    },
    { timeout: 45_000 },
  );
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 20_000 });
}

test("round clear card stays visible at least gate minimum before continue", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForGameReady(page);
    const minMs = await page.evaluate(() =>
      window.GutterbonesPresentation.gateMinMs("roundClear", "normal", false),
    );
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClear());
    const t0 = Date.now();
    await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 5000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-layout-key="round-clear-card"]');
        return el && el.innerText.includes("TAP TO CONTINUE");
      },
      { timeout: minMs + 4000 },
    );
    const elapsed = Date.now() - t0;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "round-clear-ready.png") });
    assert.ok(
      elapsed >= minMs - 120,
      `round clear continue too early: ${elapsed}ms < ${minMs}ms`,
    );
  } finally {
    await browser.close();
  }
});

test("mechanic toasts stack and remain through minimum duration", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForGameReady(page);
    const minMs = await page.evaluate(() =>
      window.GutterbonesPresentation.toastDurationMs("normal", false),
    );
    await page.evaluate(() => {
      const audit = window.__GB_LAYOUT_AUDIT__;
      audit.openMechanicToast();
      audit.pushToast({
        kind: "unlock",
        message: "Second toast stacks",
        layoutKey: "unlock-toast",
      });
    });
    await page.waitForSelector('[data-layout-key="mechanic-toast"]', { timeout: 5000 });
    await page.waitForSelector('[data-layout-key="unlock-toast"]', { timeout: 5000 });
    const count = await page.locator('[data-layout-key="toast-stack-item"], [data-layout-key="mechanic-toast"], [data-layout-key="unlock-toast"]').count();
    assert.ok(count >= 2, "expected stacked toasts");
    await page.waitForTimeout(Math.min(minMs * 0.55, 2200));
    const midCount = await page.locator('[data-layout-key="mechanic-toast"]').count();
    assert.equal(midCount, 1, "first toast should still be visible mid-duration");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "toast-stack-mid.png") });
  } finally {
    await browser.close();
  }
});
