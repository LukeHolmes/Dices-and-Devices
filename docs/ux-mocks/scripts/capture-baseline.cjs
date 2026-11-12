"use strict";
/**
 * UX dice-space audit: baseline screenshots + layout measurements (main build, no gameplay changes).
 * Usage: node docs/ux-mocks/scripts/capture-baseline.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");
const { createGame, plain } = require("../../../tests/helpers/game.cjs");
const fixtures = require("../../../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "../../..");
const OUT = path.join(ROOT, "docs/ux-mocks/baseline");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "1366x768", width: 1366, height: 768 },
  { id: "1920x1080", width: 1920, height: 1080 },
];

const MOMENTS = [
  {
    id: "01-run-start",
    label: "Run start (round 1, before first roll)",
    builder: () =>
      fixtures.run({
        round: 1,
        score: 0,
        target: 85,
        hands: 4,
        discards: 3,
        hasRolled: false,
        dice: fixtures.dice([1, 1, 1, 1, 1]),
      }),
    afterLoad: async (page) => {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.stabilizePlayChromeForCapture?.());
    },
  },
  {
    id: "02-before-roll",
    label: "Before roll (same hand, dice idle)",
    builder: () =>
      fixtures.run({
        round: 2,
        score: 22,
        target: 110,
        hands: 3,
        hasRolled: false,
        dice: fixtures.dice([4, 5, 6, 2, 3]),
      }),
    afterLoad: async (page) => {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.stabilizePlayChromeForCapture?.());
    },
  },
  {
    id: "03-after-roll-rows-lit",
    label: "After roll — payout rows highlighted",
    builder: () =>
      fixtures.run({
        round: 3,
        score: 48,
        target: 135,
        hands: 2,
        hasRolled: true,
        dice: fixtures.dice([2, 2, 2, 3, 4]),
        inventory: [
          { id: "ENGINE", name: "The Engine", instanceId: "ux-1" },
          { id: "FUSE_BOX", name: "Fuse Box", instanceId: "ux-2" },
        ],
        flowStreak: 2,
      }),
    afterLoad: async (page) => {
      await page.evaluate(() => {
        window.__GB_LAYOUT_AUDIT__?.stabilizePlayChromeForCapture?.();
        document.querySelectorAll(".score-row-valid-accent, .payout-tier-live").forEach((row) => {
          row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        });
        const best = document.querySelector(".payout-tier-best, .score-row-valid-accent");
        if (best) best.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });
      await page.waitForTimeout(200);
    },
  },
  {
    id: "04-shop",
    label: "Shop",
    builder: () => fixtures.shopBusy(),
    afterLoad: async (page) => {
      await page.waitForTimeout(350);
    },
  },
  {
    id: "05-control-panel-revealed",
    label: "Control panel — drawers / intel open",
    builder: () => fixtures.playHeavyHardware(),
    afterLoad: async (page) => {
      await page.evaluate(() => {
        window.__GB_LAYOUT_AUDIT__?.stabilizePlayChromeForCapture?.();
        const mods = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("MODS"));
        if (mods) mods.click();
        window.__GB_LAYOUT_AUDIT__?.toggleRunIntelDetails?.();
        const logBtn = document.querySelector('[data-layout-key="play-history-log"]');
        if (logBtn) logBtn.click();
      });
      await page.waitForTimeout(400);
    },
  },
];

function measureDiceSpace() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vpArea = vw * vh;
  const measureEl = (sel, name) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return { name, hidden: true, display: style.display };
    }
    const r = el.getBoundingClientRect();
    const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const visibleArea = visW * visH;
    return {
      name,
      widthPx: Math.round(r.width),
      heightPx: Math.round(r.height),
      topPx: Math.round(r.top),
      bottomPx: Math.round(r.bottom),
      areaPx: Math.round(r.width * r.height),
      visibleAreaPx: Math.round(visibleArea),
      pctOfViewport: +(100 * (visibleArea / vpArea)).toFixed(2),
      pctOfViewportHeight: +(100 * (r.height / vh)).toFixed(2),
      pctOfViewportWidth: +(100 * (r.width / vw)).toFixed(2),
    };
  };
  const hud = measureEl('[data-layout-key="play-hud"]', "control-strip (play-hud)");
  const alley = measureEl('[data-layout-key="play-alley"]', "dice tray (play-alley)");
  const lane = measureEl('[data-layout-key="play-dice-lane"]', "dice lane row");
  const grid = measureEl('[data-layout-key="play-phase-grid"]', "hand grid (dice + ledger)");
  const ledger = measureEl('[data-layout-key="play-ledger-column"]', "payout ledger column");
  const stashCol = measureEl('[data-layout-key="play-stash-column"]', "stash column");
  const dock = document.querySelector(".gb-play-dock");
  const dockRect = dock ? dock.getBoundingClientRect() : null;
  const chromeAboveAlley = alley && !alley.missing ? alley.topPx : null;
  return {
    viewport: { width: vw, height: vh },
    playPhase: document.getElementById("root-gutterbones")?.getAttribute("data-phase"),
    measures: [hud, alley, lane, grid, ledger, stashCol].filter(Boolean),
    mobileDockHeightPx: dockRect ? Math.round(dockRect.height) : 0,
    spaceAboveDiceTrayPx: chromeAboveAlley,
    alleyToViewportHeightRatio: alley && !alley.missing ? alley.pctOfViewportHeight : null,
  };
}

async function resumeFixture(page, builder) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem("gutterbones1977:settings:v1", JSON.stringify({
        pacing: "fast",
        reducedMotion: true,
        tutorialCompleted: true,
        skippedAlleyIntro: true,
      }));
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 60_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root-gutterbones");
      return root && root.getAttribute("data-phase");
    },
    { timeout: 20_000 },
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), viewports: VIEWPORTS, moments: [] };

  try {
    for (const vp of VIEWPORTS) {
      for (const moment of MOMENTS) {
        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
            waitUntil: "networkidle",
            timeout: 90_000,
          });
          await resumeFixture(page, moment.builder);
          if (moment.afterLoad) await moment.afterLoad(page);
          await page.waitForTimeout(moment.id === "04-shop" ? 600 : 300);

          const metrics =
            moment.id.startsWith("04")
              ? await page.evaluate(() => ({
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                  shop: true,
                }))
              : await page.evaluate(measureDiceSpace);

          const file = `${moment.id}_${vp.id}.png`;
          const filePath = path.join(OUT, file);
          await page.screenshot({ path: filePath, fullPage: false, scale: "css" });

          report.moments.push({
            id: moment.id,
            label: moment.label,
            viewport: vp.id,
            screenshot: `baseline/${file}`,
            metrics,
          });
          console.log(`OK ${moment.id} @ ${vp.id} alley%=${metrics.measures?.find((m) => m.name?.includes("alley"))?.pctOfViewport ?? "shop"}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  fs.writeFileSync(path.join(OUT, "measurements.json"), JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.join(OUT, "measurements.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
