#!/usr/bin/env node
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fixtures = require('../tests/fixtures/runs.cjs');
const { createGame, plain } = require('../tests/helpers/game.cjs');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = '/opt/cursor/artifacts/pr113-followup';
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8810 + Math.floor(Math.random() * 40);
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, rel.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((resolve, reject) => {
  server.listen(PORT, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
});
const base = `http://127.0.0.1:${PORT}`;

const SETTINGS = {
  pacing: 'fast',
  reducedMotion: true,
  tutorialCompleted: true,
  skippedAlleyIntro: true,
};

async function seedPlay(page, vp, { score = 45, target = 110, round = 3, bossId = 'BOUNCER' } = {}) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(
      fixtures.run({
        phase: 'PLAY',
        round,
        score,
        target,
        hands: 4,
        discards: 3,
        stash: 55,
        hasRolled: false,
        dice: fixtures.dice([3, 4, 5, 2, 6]),
        activeBossId: bossId,
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
  await page.waitForSelector('[data-phase="PLAY"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
}

async function seedShop(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
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
  await page.waitForTimeout(800);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 1 });

for (const [vp, name] of [
  [{ width: 1920, height: 1080 }, 'play-1920x1080'],
  [{ width: 390, height: 844 }, 'play-390x844'],
]) {
  const page = await context.newPage();
  await seedPlay(page, vp, { score: 45, target: 110 });
  await page.screenshot({ path: path.join(OUT, `${name}-fullscreen.png`), fullPage: false });
  await page.close();
}

for (const [vp, name] of [
  [{ width: 768, height: 1024 }, 'stash-768x1024'],
  [{ width: 1920, height: 1080 }, 'stash-1920x1080'],
]) {
  const page = await context.newPage();
  await seedShop(page, vp);
  const footer = page.locator('[data-layout-key="shop-stash-panel"]');
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}-routes-column.png`), fullPage: false });
  await footer.screenshot({ path: path.join(OUT, `${name}-stash-footer.png`) });
  await page.close();
}

{
  const page = await context.newPage();
  await seedPlay(page, { width: 1920, height: 1080 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openHelp());
  await page.waitForSelector('[data-layout-key="help-dossier"]', { timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'help-dossier-1920x1080.png'), fullPage: false });
  await page.close();
}

{
  const page = await context.newPage();
  await seedPlay(page, { width: 1920, height: 1080 }, { bossId: 'BOUNCER' });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.toggleBossWarrant());
  await page.waitForSelector('[data-layout-key="boss-warrant-stamp"]', { timeout: 10_000 });
  const stamp = page.locator('[data-layout-key="boss-warrant-stamp"]');
  await stamp.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await stamp.screenshot({ path: path.join(OUT, 'boss-warrant-badge-1920.png') });
  await page.screenshot({ path: path.join(OUT, 'boss-warrant-context-1920x1080.png'), fullPage: false });
  await page.close();
}

await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('captures written to', OUT);