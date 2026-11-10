"use strict";
/**
 * Polish step 5: per-screen interactive layout audit (scroll, typography, tap targets, in-viewport).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");
const {
  isNonBlockingViewport,
  phonePortraitBlockingEnabled,
  printPhonePortraitReport,
} = require("./helpers/phone-portrait.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const FIXTURES = {
  normal: () => fixtures.run(),
  shopBusy: fixtures.shopBusy,
  carving: fixtures.carving,
  rapSheet: fixtures.rapSheet,
};

const SCREENS = [
  { id: "play", fixture: "normal", action: null },
  { id: "score_overlay", fixture: "normal", action: "scoreBreakdown" },
  { id: "shop", fixture: "shopBusy", action: null },
  { id: "carving", fixture: "carving", action: null },
  { id: "boss_intro", fixture: "normal", action: "bossIntro" },
  { id: "round_clear", fixture: "normal", action: "roundClear" },
  { id: "rap_sheet", fixture: "normal", action: "rapSheet" },
  { id: "help", fixture: "normal", action: "help" },
  { id: "system_menu", fixture: "normal", action: "system" },
  { id: "first_run", fixture: "normal", action: "firstRun" },
  { id: "toast", fixture: "normal", action: "toast" },
  { id: "popover", fixture: "normal", action: "runIntelPopover" },
];

let server;
let baseUrl;
let chromium;
let sharedBrowser;

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
  sharedBrowser = await chromium.launch({ headless: true });
});

after(async () => {
  if (sharedBrowser) await sharedBrowser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (process.env.CHECK_FAST_PRINT_PHONE_REPORT === "1") {
    printPhonePortraitReport();
  }
});

async function resumeFixture(page, fixtureName) {
  const builder = FIXTURES[fixtureName];
  const g = createGame(fixtures.snapshot());
  const payload = plain(g.api.normalizeSavedRun(builder()));
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(500);
}

async function runScreenAction(page, action) {
  if (!action) return;
  if (action === "scoreBreakdown") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openScoreBreakdownDemo());
    await page.waitForSelector('[data-layout-key="score-breakdown-overlay"]', { timeout: 10_000 }).catch(() => {});
  } else if (action === "bossIntro") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor("LOAN_SHARK"));
    await page.waitForSelector('[data-layout-key="boss-intro-overlay"]', { timeout: 8000 });
  } else if (action === "roundClear") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClearDemo());
    await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 8000 });
  } else if (action === "rapSheet") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forfeitRunDemo(280));
    await page.waitForSelector('[data-layout-key="rap-sheet"]', { timeout: 12_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal?.());
    await page.waitForTimeout(350);
  } else if (action === "help") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openHelp());
  } else if (action === "system") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openSystemMenu());
  } else if (action === "firstRun") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openFirstRun());
  } else if (action === "toast") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openMechanicToast());
    await page.waitForTimeout(250);
  } else if (action === "runIntelPopover") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.toggleRunIntelDetails());
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

for (const screen of SCREENS) {
  for (const vp of VIEWPORTS) {
    if (screen.id === "score_overlay" && vp.height < 500) continue;
    test(`polish step5 layout — ${screen.id} @ ${vp.name}`, async () => {
      const context = await sharedBrowser.newContext();
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 });
        await resumeFixture(page, screen.fixture);
        if (screen.id === "shop") {
          await page.waitForTimeout(350);
        }
        await runScreenAction(page, screen.action);
        const audit = await page.evaluate(() =>
          window.__GB_LAYOUT_AUDIT__.auditScreenLayout({
            minBodyPx: 11,
            minTapFontPx: 12,
            minTapPx: 32,
            fullTapAudit: true,
          }),
        );
        const msg = `${screen.id} @ ${vp.name}: ${JSON.stringify(audit)}`;
        if (isNonBlockingViewport(vp.name) && !phonePortraitBlockingEnabled()) {
          if (!audit.ok) {
            const { recordPhoneWarning } = require("./helpers/phone-portrait.cjs");
            recordPhoneWarning({
              suite: "polish-step5-layout",
              viewport: vp.name,
              label: screen.id,
              message: msg,
            });
          }
          return;
        }
        assert.ok(audit.ok, msg);
      } finally {
        await page.close();
        await context.close();
      }
    });
  }
}
