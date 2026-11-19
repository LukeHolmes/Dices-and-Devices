#!/usr/bin/env node
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fixtures = require('../tests/fixtures/runs.cjs');
const { createGame, plain } = require('../tests/helpers/game.cjs');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, '..');
const label = process.argv[3] || 'after';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8824 + Math.floor(Math.random() * 50);
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

async function bootPlay(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(
      fixtures.run({
        phase: 'PLAY',
        round: 3,
        score: 12,
        target: 110,
        hands: 4,
        discards: 3,
        stash: 55,
        hasRolled: false,
        dice: fixtures.dice([3, 4, 5, 2, 6]),
      }),
    ),
  );
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({ pacing: 'fast', reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'gutterbones1977:run:v1', data: payload },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 20_000 });
  await page.waitForSelector('[data-tutorial="roll-btn"]:not([disabled])', { timeout: 60_000 });
}

const browser = await chromium.launch({ headless: true });
const defaultTimeoutMs = 180_000;
async function openPage() {
  const page = await browser.newPage();
  page.setDefaultTimeout(defaultTimeoutMs);
  page.setDefaultNavigationTimeout(defaultTimeoutMs);
  return page;
}

async function capture1920() {
  const page = await openPage();
  await bootPlay(page, { width: 1920, height: 1080 });
  await page.screenshot({ path: path.join(OUT, `${label}_1920x1080_ready.png`) });
  await page.click('[data-tutorial="roll-btn"]');
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', { timeout: 8000 });
  const handMs = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getRollHandFxMs());
  const midMs = Math.round(handMs * 0.54);
  await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), midMs);
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT, `${label}_1920x1080_midroll.png`) });
  await page.close();
}

async function captureViewport(vp, name) {
  const page = await openPage();
  await bootPlay(page, vp);
  await page.screenshot({ path: path.join(OUT, `${label}_${name}_ready.png`) });
  await page.close();
}

async function bootShop(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()),
  );
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({ pacing: 'fast', reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'gutterbones1977:run:v1', data: payload },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-phase="SHOP"], [data-layout-key="shop-layout"]', { timeout: 60_000 });
  await page.waitForTimeout(800);
}

async function captureShop(vp, name) {
  const page = await openPage();
  await bootShop(page, vp);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const screen = document.querySelector('#root-gutterbones[data-phase="SHOP"] .gb-screen');
    if (screen instanceof HTMLElement) screen.scrollTop = 0;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, `${label}_${name}_shop.png`) });
  await page.close();
}

async function captureShopTall(vp, name) {
  const page = await openPage();
  await bootShop(page, vp);
  const shotHeight = await page.evaluate(() => {
    document.getElementById('__gb_capture_unscroll')?.remove();
    const tag = document.createElement('style');
    tag.id = '__gb_capture_unscroll';
    tag.textContent = `
      html, body { height: auto !important; max-height: none !important; overflow: visible !important; }
      #root-gutterbones[data-phase="SHOP"] .gb-screen {
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
    `;
    document.head.appendChild(tag);
    window.scrollTo(0, 0);
    const screen = document.querySelector('#root-gutterbones[data-phase="SHOP"] .gb-screen');
    if (screen instanceof HTMLElement) screen.scrollTop = 0;
    const hit = document.querySelector('[data-layout-key="shop-hit-streets"]');
    const layout = document.querySelector('[data-layout-key="shop-layout"]');
    const anchorTop = screen instanceof HTMLElement ? screen.getBoundingClientRect().top : 0;
    const anchorBottom = hit
      ? hit.getBoundingClientRect().bottom
      : (layout?.getBoundingClientRect().bottom ?? anchorTop + 2400);
    const pad = 28;
    return Math.min(16000, Math.max(window.innerHeight, Math.ceil(anchorBottom - anchorTop + pad)));
  });
  await page.setViewportSize({ width: vp.width, height: shotHeight });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT, `${label}_${name}_shop.png`),
    fullPage: false,
  });
  await page.evaluate(() => document.getElementById('__gb_capture_unscroll')?.remove());
  await page.close();
}

async function capture390Drawer() {
  const page = await openPage();
  await bootPlay(page, { width: 390, height: 844 });
  const openBtn = page.locator('[data-layout-key="mobile-score-sheet-open"]');
  if (await openBtn.count()) {
    await openBtn.click();
    await page.waitForSelector('.mobile-score-sheet--expanded', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(OUT, `${label}_390x844_drawer.png`) });
  await page.close();
}

if (process.env.CAPTURE_SHOP_ONLY === '1') {
  await captureShopTall({ width: 390, height: 844 }, '390x844');
  await captureShopTall({ width: 768, height: 1024 }, '768x1024');
  await captureShop({ width: 1024, height: 768 }, '1024x768');
} else {
  await capture1920();
  await captureShop({ width: 1920, height: 1080 }, '1920x1080');
  await captureViewport({ width: 1366, height: 768 }, '1366x768');
  if (label === 'after') {
    await captureShopTall({ width: 390, height: 844 }, '390x844');
    await captureShopTall({ width: 768, height: 1024 }, '768x1024');
    await captureShop({ width: 1024, height: 768 }, '1024x768');
    await capture390Drawer();
  }
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('done', label, ROOT);