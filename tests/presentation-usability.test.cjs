"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
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

test("hand presentation duration is readable at normal pacing", () => {
  const ms = GP.rollHandFxMs("normal", false);
  assert.ok(ms >= 1000, `roll hand ms too low: ${ms}`);
  assert.ok(ms <= 2000, `roll hand ms too high: ${ms}`);
});

test("score overlay minimum hold increased for reading", () => {
  assert.ok(GP.gateMinMs("scoreOverlay", "normal", false) >= 2200);
});

let server;
let baseUrl;
let chromium;

before(async () => {
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
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function waitAudit(page) {
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 60_000 });
}

test("upgrade intel panel opens, focuses, and dismisses with Escape", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitAudit(page);
    const opened = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openUpgradeIntel("BLOOD_6"));
    assert.equal(opened, true);
    await page.waitForSelector('[data-layout-key="upgrade-intel-panel"]', { timeout: 5000 });
    const bodyText = await page.locator('[data-layout-key="upgrade-intel-panel"]').innerText();
    assert.match(bodyText, /Blood 6/i);
    assert.match(bodyText, /\+20 chips/i);
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector('[data-layout-key="upgrade-intel-panel"]'),
      { timeout: 3000 },
    );
  } finally {
    await browser.close();
  }
});

test("mechanic toast exposes dismiss control", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitAudit(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openMechanicToast());
    await page.waitForSelector('[data-layout-key="toast-dismiss"]', { timeout: 5000 });
    const box = await page.locator('[data-layout-key="toast-dismiss"]').boundingBox();
    assert.ok(box && box.width >= 28 && box.height >= 28);
  } finally {
    await browser.close();
  }
});
