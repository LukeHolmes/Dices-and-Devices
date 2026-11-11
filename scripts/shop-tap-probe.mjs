import { chromium } from "playwright";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createGame, plain } = require("../tests/helpers/game.cjs");
const fixtures = require("../tests/fixtures/runs.cjs");

const g = createGame(fixtures.snapshot());
const payload = plain(g.api.normalizeSavedRun(fixtures.shop()));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 768 });
await page.goto("http://127.0.0.1:8763/index.html?e2e=1");
await page.waitForFunction(() => window.__GB_E2E__);
await page.evaluate(
  ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
  { key: "gutterbones1977:run:v1", data: payload },
);
await page.reload();
await page.waitForFunction(() => window.__GB_E2E__?.getState?.()?.phase === "SHOP", { timeout: 30000 });
const scan = await page.evaluate(`(${require("fs").readFileSync("/workspace/scripts/harness_r2_6113.py").toString().match(/SCAN=r"""([\s\S]*?)"""/)?.[1] || "(()=>({btn:[]}))"})()`);
console.log("buttons", scan.btn?.length, scan.btn?.slice(0, 8));
await browser.close();
