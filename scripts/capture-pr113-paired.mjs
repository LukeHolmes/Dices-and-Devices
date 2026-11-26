#!/usr/bin/env node
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fixtures = require('../tests/fixtures/runs.cjs');
const { createGame, plain } = require('../tests/helpers/game.cjs');

const BRANCH_ROOT = path.resolve(process.env.BRANCH_ROOT || path.join(import.meta.dirname, '..'));
const MAIN_ROOT = path.resolve(process.env.MAIN_ROOT || path.join(BRANCH_ROOT, '..', 'Dices-and-Devices-main'));
const OUT = '/opt/cursor/artifacts/pr113-paired';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1920, height: 1080, name: '1920x1080' },
];

async function withServer(root, fn) {
  const PORT = 8800 + Math.floor(Math.random() * 80);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(root, rel.replace(/^\//, ''));
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const base = `http://127.0.0.1:${PORT}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const SETTINGS = {
  pacing: 'fast',
  reducedMotion: true,
  tutorialCompleted: true,
  skippedAlleyIntro: true,
};

async function seedPlay(page, base) {
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(
      fixtures.run({
        phase: 'PLAY',
        round: 3,
        score: 45,
        target: 110,
        hands: 4,
        discards: 3,
        stash: 40,
        hasRolled: false,
        dice: fixtures.dice([3, 4, 5, 2, 6]),
        activeBossId: 'BOUNCER',
      }),
    ),
  );
  await page.evaluate(
    ({ key, data, settings }) => {
      localStorage.setItem('gutterbones1977:settings:v1', JSON.stringify(settings));
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'gutterbones1977:run:v1', data: payload, settings: SETTINGS },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-tutorial="roll-btn"]:not([disabled])', { timeout: 60_000 });
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForFunction(
    () => {
      const lane = document.querySelector('[data-layout-key="play-dice-lane"]');
      return lane && lane.querySelectorAll('button').length >= 5;
    },
    { timeout: 60_000 },
  );
  await page.waitForTimeout(350);
}

async function seedShop(page, base) {
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));
  await page.evaluate(
    ({ key, data, settings }) => {
      localStorage.setItem('gutterbones1977:settings:v1', JSON.stringify(settings));
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'gutterbones1977:run:v1', data: payload, settings: SETTINGS },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 60_000 });
  await page.waitForTimeout(500);
}

async function captureSet({ label, root }) {
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error(`missing index.html in ${root}`);
  }
  await withServer(root, async (base) => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedPlay(page, base);
      await page.screenshot({ path: path.join(OUT, `${label}_${vp.name}_play-after-roll.png`), fullPage: false });
      await page.close();

      const shopPage = await context.newPage();
      await shopPage.setViewportSize({ width: vp.width, height: vp.height });
      await seedShop(shopPage, base);
      await shopPage.screenshot({ path: path.join(OUT, `${label}_${vp.name}_shop.png`), fullPage: false });
      await shopPage.close();
    }
    await context.close();
    await browser.close();
  });
}

await captureSet({ label: 'main', root: MAIN_ROOT });
await captureSet({ label: 'branch', root: BRANCH_ROOT });
console.log('paired captures ->', OUT);