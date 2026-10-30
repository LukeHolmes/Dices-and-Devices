"use strict";
/**
 * Playwright viewport audit: no document scroll; layout keys in bounds.
 * Requires: npx playwright install chromium (once per environment).
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = path.join("/opt/cursor/artifacts", "no-scroll-layout");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1280x690", width: 1280, height: 690 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1024x640", width: 1024, height: 640 },
  { name: "844x390", width: 844, height: 390 },
  { name: "390x844", width: 390, height: 844 },
];

const SCENARIOS = [
  { id: "title_screen", label: "Title screen", resume: null, action: null },
  { id: "lineup", label: "Operator lineup", resume: null, action: "lineup" },
  { id: "settings", label: "Settings panel", resume: null, action: "settings" },
  { id: "play", label: "Alley / PLAY", resume: "normal", action: null },
  { id: "shop", label: "Back Alley shop", resume: "shop", action: null },
  { id: "carving", label: "The Mod", resume: "carving", action: null },
  { id: "gamble", label: "Double or Nothing", resume: "gamble", action: null },
  { id: "rap_sheet", label: "Rap sheet / bust", resume: "rapSheet", action: null },
  { id: "safehouse", label: "Safehouse", resume: null, action: "safehouse" },
  { id: "help", label: "Help dossier", resume: "normal", action: "help" },
  { id: "system_menu", label: "System menu", resume: "normal", action: "system" },
  { id: "case_files", label: "Case files", resume: null, action: "lore" },
  { id: "first_run", label: "First-run overlay", resume: "normal", action: "firstRun" },
  { id: "tutorial_choice", label: "Tutorial choice", resume: null, action: "tutorialChoice" },
  { id: "tutorial_coach", label: "Tutorial coach", resume: "normal", action: "tutorialCoach" },
  { id: "records_unlocks", label: "Records / Unlocks", resume: null, action: "records" },
  { id: "mechanic_toast", label: "Mechanic toast", resume: "normal", action: "toast" },
];

function normalizeFixture(name) {
  const builders = {
    normal: () => fixtures.run(),
    shop: fixtures.shop,
    carving: fixtures.carving,
    gamble: fixtures.gamble,
    rapSheet: fixtures.rapSheet,
  };
  const builder = builders[name];
  if (!builder) return null;
  const g = createGame(fixtures.snapshot());
  return plain(g.api.normalizeSavedRun(builder()));
}

let server;
let baseUrl;
let chromium;

before(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  try {
    chromium = require("playwright").chromium;
  } catch (err) {
    throw new Error(
      "playwright is required for layout tests. Run: npm install && npx playwright install chromium",
      { cause: err },
    );
  }
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
      ".ico": "image/x-icon",
      ".jpg": "image/jpeg",
    };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
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
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 45_000 }).catch(() => {});
}

async function runScenarioAction(page, action) {
  if (!action) return;
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 20_000 });
  if (action === "help") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openHelp());
  if (action === "system") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openSystemMenu());
  if (action === "lore") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLore());
  }
  if (action === "firstRun") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openFirstRun());
  if (action === "tutorialChoice") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialChoice());
  }
  if (action === "tutorialCoach") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialCoach());
  if (action === "records") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRecords());
  if (action === "lineup") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
  if (action === "settings") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openSettings());
  if (action === "toast") await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openMechanicToast());
  if (action === "safehouse") {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openLineup());
    await page.getByRole("button", { name: "SAFEHOUSE", exact: true }).click();
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__?.getPhase?.() === "SAFEHOUSE");
  }
}

async function auditViewport(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root-gutterbones");
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const docW = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const scrollOk = docH <= vh + 1 && docW <= vw + 1;
    const bad = [];
    if (root) {
      const rr = root.getBoundingClientRect();
      if (rr.bottom > vh + 2 || rr.right > vw + 2) {
        bad.push({ key: "root-gutterbones", reason: "root outside viewport", rect: rr });
      }
    }
    root?.querySelectorAll("[data-layout-key]").forEach((el) => {
      const key = el.getAttribute("data-layout-key");
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.bottom > vh + 2 || r.right > vw + 2 || r.top < -4 || r.left < -4) {
        bad.push({
          key,
          reason: "clipped/outside viewport",
          top: r.top,
          left: r.left,
          bottom: r.bottom,
          right: r.right,
          vh,
          vw,
        });
      }
    });
    return { scrollOk, docH, docW, vh, vw, bad };
  });
}

for (const scenario of SCENARIOS) {
  for (const vp of VIEWPORTS) {
    test(`no scroll — ${scenario.id} @ ${vp.name}`, async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await waitForGameReady(page);
        if (scenario.resume) {
          const payload = normalizeFixture(scenario.resume);
          await page.evaluate(
            ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
            { key: RUN_KEY, data: payload },
          );
          await page.reload({ waitUntil: "domcontentloaded" });
          await waitForGameReady(page);
          await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
          await page.waitForTimeout(600);
        }
        await runScenarioAction(page, scenario.action);
        await page.waitForTimeout(400);
        const audit = await auditViewport(page);
        const shotPath = path.join(ARTIFACT_DIR, `${scenario.id}-${vp.name}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        assert.ok(
          audit.scrollOk,
          `${scenario.id} @ ${vp.name}: document scroll ${audit.docW}x${audit.docH} > viewport ${audit.vw}x${audit.vh}`,
        );
        assert.equal(
          audit.bad.length,
          0,
          `${scenario.id} @ ${vp.name}: layout keys out of bounds: ${JSON.stringify(audit.bad.slice(0, 3))}`,
        );
      } finally {
        await browser.close();
      }
    });
  }
}

test("rap sheet — label and value share row baseline", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 690 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForGameReady(page);
    const payload = normalizeFixture("rapSheet");
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForGameReady(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      if (window.__GB_LAYOUT_AUDIT__?.finishRapReveal) window.__GB_LAYOUT_AUDIT__.finishRapReveal();
    });
    await page.waitForTimeout(200);
    const misaligned = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-layout-key="rap-sheet-stat-row"]'));
      return rows.filter((row) => {
        const kids = row.children;
        if (kids.length < 2) return true;
        const a = kids[0].getBoundingClientRect();
        const b = kids[1].getBoundingClientRect();
        return Math.abs(a.top - b.top) > 6 || Math.abs(a.bottom - b.bottom) > 8;
      }).length;
    });
    assert.equal(misaligned, 0, `rap sheet stat rows misaligned: ${misaligned}`);
  } finally {
    await browser.close();
  }
});
