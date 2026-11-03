import { chromium } from "playwright";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const base = "http://127.0.0.1:8763/index.html?layoutAudit=1";
const RUN_KEY = "gutterbones1977:run:v1";
const shots = [
  { name: "shop-1366x768", w: 1366, h: 768 },
  { name: "shop-844x390", w: 844, h: 390 },
  { name: "shop-390x844", w: 390, h: 844 },
];
const outDir = "/opt/cursor/artifacts";

const g = createGame(fixtures.snapshot());
const shopPayload = plain(g.api.normalizeSavedRun(fixtures.shop()));

async function main() {
  const browser = await chromium.launch();
  for (const vp of shots) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 30000 });
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: RUN_KEY, data: shopPayload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 30000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `${vp.name}.png`) });
    await page.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
