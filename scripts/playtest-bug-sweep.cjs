"use strict";
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = [
  { name: "phone", w: 390, h: 844 },
  { name: "laptop", w: 1366, h: 768 },
  { name: "desktop", w: 1920, h: 1080 },
];

async function main() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  const payload = () =>
  fixtures.run({
    phase: "PLAY",
    round: 4,
    score: 62,
    target: 161,
    hands: 2,
    discards: 2,
    gold: 28,
    hasRolled: true,
    dice: fixtures.dice([2, 2, 2, 3, 4]),
    activeBossId: "LOAN_SHARK",
    inventory: [
      { id: "ENGINE", name: "The Engine", instanceId: "s1" },
      { id: "FUSE_BOX", name: "Fuse Box", instanceId: "s2" },
    ],
    usedCats: [],
  });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error" && !/\[BABEL\]|deoptimised the styling/i.test(text)) {
        consoleErrors.push(text);
      }
    });
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1&critters=force`, { waitUntil: "domcontentloaded" });
    const data = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(payload()));
    await page.evaluate(
      ({ key, run }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
        );
        localStorage.setItem(key, JSON.stringify(run));
      },
      { key: RUN_KEY, run: data },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });

    const layout = await page.evaluate((vw) => {
      const clip = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { missing: true };
        const r = el.getBoundingClientRect();
        return { missing: false, right: r.right, left: r.left, clipped: r.right > vw + 1 || r.left < -1 };
      };
      return {
        warrant: clip('[data-layout-key="boss-warrant-stamp"]'),
        roll: clip('[data-layout-key="play-roll-btn"]'),
        diceClipped: [...document.querySelectorAll(".bone-die-btn")].some((d) => {
          const r = d.getBoundingClientRect();
          return r.right > vw + 1 || r.left < -1;
        }),
      };
    }, vp.w);
    if (layout.warrant.missing) issues.push(`${vp.name}: boss warrant missing`);
    if (layout.warrant.clipped) issues.push(`${vp.name}: boss warrant clipped`);
    if (layout.diceClipped) issues.push(`${vp.name}: dice clipped`);

    if (vp.name === "phone") {
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setMobileScoreSheetOpen(true));
      await page.waitForSelector(".mobile-score-sheet--expanded", { timeout: 8000 }).catch(() => {
        issues.push("phone: score sheet failed to expand");
      });
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setMobileScoreSheetOpen(false));
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
      await page.waitForSelector(".pill-attach-tray--armed", { timeout: 5000 }).catch(() => {
        issues.push("phone: pill tray arm failed");
      });
      const clipArmed = await page.evaluate(() => {
        const vw = window.innerWidth;
        return [...document.querySelectorAll(".bone-die-btn")].some((d) => d.getBoundingClientRect().right > vw + 1);
      });
      if (clipArmed) issues.push("phone: dice clipped while pill armed");
    }

    if (vp.name !== "phone") {
      const thinUsed = await page.evaluate(() => {
        const row = document.querySelector(".payout-tier-done, .payout-tier-bust");
        return row ? row.getBoundingClientRect().height : -1;
      });
      if (thinUsed > 24) issues.push(`${vp.name}: used/bust row not thin (${thinUsed}px)`);
    }

    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("rat"));
    await page.waitForSelector('[data-layout-key="alley-critter-crawl"]', { timeout: 6000 }).catch(() => {
      issues.push(`${vp.name}: critter did not spawn`);
    });

    const noise = consoleErrors.filter(
      (e) => !/favicon|Failed to load resource.*favicon|\[BABEL\]|deoptimised the styling/i.test(e),
    );
    if (noise.length) issues.push(`${vp.name}: console errors: ${noise.slice(0, 3).join(" | ")}`);
    await page.close();
  }

  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(JSON.stringify({ issues, ok: issues.length === 0 }, null, 2));
  if (issues.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
