"use strict";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

async function main() {
  const outDir = process.argv[2] || "/opt/cursor/artifacts";
  const label = process.argv[3] || "after";
  fs.mkdirSync(outDir, { recursive: true });

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

  const fixturePayload = () => fixtures.run({
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
      { id: "ENGINE", name: "The Engine", instanceId: "snap-1" },
      { id: "FUSE_BOX", name: "Fuse Box", instanceId: "snap-2" },
    ],
    currentRouteEffect: { name: "BACK ALLEY", effects: ["Standard hustle"] },
  });

  for (const { id, w, h } of [
    { id: "390x844", w: 390, h: 844 },
    { id: "1366x768", w: 1366, h: 768 },
  ]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "networkidle", timeout: 120_000 });
    const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixturePayload()));
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({
            pacing: "fast",
            reducedMotion: false,
            tutorialCompleted: true,
            skippedAlleyIntro: true,
          }),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });
    await page.evaluate(() => {
      window.__GB_LAYOUT_AUDIT__?.triggerRollHandOverlayFx?.();
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.freezeRollHandThrowAt?.(500));
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(outDir, `option-c-${label}_${id}.png`),
      scale: "css",
    });
    await page.close();
  }

  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(`Wrote snapshots to ${outDir} (${label})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
