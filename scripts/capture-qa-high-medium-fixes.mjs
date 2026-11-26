#!/usr/bin/env node
/**
 * Screenshots for art/qa-high-medium-fixes: fixture-driven screens with phase verification.
 * Usage: node scripts/capture-qa-high-medium-fixes.mjs [before|after] [outDir]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGame, plain } from '../tests/helpers/game.cjs';
import fixtures from '../tests/fixtures/runs.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const indexFile = process.env.QA_INDEX_HTML
  ? path.resolve(process.env.QA_INDEX_HTML)
  : path.join(root, 'index.html');
const screenFilter = process.env.QA_CAPTURE_SCREENS
  ? new Set(process.env.QA_CAPTURE_SCREENS.split(',').map((s) => s.trim()).filter(Boolean))
  : null;
const viewportFilter = process.env.QA_CAPTURE_VIEWPORTS
  ? process.env.QA_CAPTURE_VIEWPORTS.split(';').map((pair) => {
      const [w, h] = pair.split('x').map(Number);
      return [w, h];
    })
  : null;
const label = process.argv[2] || 'after';
const outDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join('/opt/cursor/artifacts', `qa-high-medium-fixes-${label}`);
fs.mkdirSync(outDir, { recursive: true });

const RUN_KEY = 'gutterbones1977:run:v1';
const IN_RUN_PHASES = new Set(['PLAY', 'SHOP', 'CARVING', 'GAMBLE']);

/** Stable shop busy state for comparable before/after captures */
function shopQaFixture({ debt = 24, gold = 80 } = {}) {
  const base = fixtures.shopBusy();
  return {
    ...base,
    debt,
    gold,
    round: 4,
    stash: 40,
    shopItems: base.shopItems,
    paths: base.paths,
  };
}

function normalizePayload(built) {
  if (IN_RUN_PHASES.has(built.phase)) {
    return plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(built));
  }
  return plain({ version: 2, arcId: 'witness', personaId: 'STREET_RAT', dice: fixtures.run().dice, ...built });
}

const SCREEN_CHECKS = {
  play: { phase: 'PLAY', keys: ['play-alley'] },
  shop: { phase: 'SHOP', keys: ['shop-layout', 'shop-refresh-stock'] },
  'shop-debt': { phase: 'SHOP', keys: ['shop-layout'], assert: 'debt-buttons' },
  'shop-nodebt': { phase: 'SHOP', keys: ['shop-layout'], assert: 'no-debt-label' },
  'boss-bouncer': { phase: 'PLAY', keys: ['boss-intro-overlay', 'boss-intro-name'] },
  safehouse: { phase: 'SAFEHOUSE', keys: ['safehouse-card'] },
  'rap-sheet': { phase: 'RAP_SHEET', keys: ['rap-sheet', 'rap-play-again'] },
  lineup: { phase: 'LINEUP', keys: ['lineup-grid', 'lineup-title'] },
  carving: { phase: 'CARVING', keys: ['carving-layout'] },
  gamble: { phase: 'GAMBLE', keys: ['gamble-card'] },
  victory: { phase: 'VICTORY', keys: ['victory-card'] },
  'round-clear': { phase: 'PLAY', keys: ['round-clear-card'] },
  bust: { phase: 'RAP_SHEET', keys: ['rap-sheet'] },
};

const SCREENS = [
  { id: 'play', mode: 'resume', build: () => fixtures.run({ phase: 'PLAY', hasRolled: true, debt: 12, gold: 44, round: 3 }) },
  { id: 'shop', mode: 'resume', build: () => shopQaFixture({ debt: 24 }) },
  { id: 'shop-debt', mode: 'resume', build: () => shopQaFixture({ debt: 28, gold: 90 }) },
  { id: 'shop-nodebt', mode: 'resume', build: () => shopQaFixture({ debt: 0, gold: 55 }) },
  {
    id: 'boss-bouncer',
    mode: 'boss-bouncer',
    build: () => fixtures.run({ phase: 'PLAY', activeBossId: 'BOUNCER', round: 4, target: 120, score: 5, hasRolled: true }),
  },
  { id: 'safehouse', mode: 'safehouse', build: null },
  { id: 'rap-sheet', mode: 'rap-sheet', build: null },
  { id: 'lineup', mode: 'lineup', build: null },
  { id: 'carving', mode: 'resume', build: () => fixtures.carving() },
  { id: 'gamble', mode: 'resume', build: () => fixtures.gamble() },
  { id: 'victory', mode: 'victory', build: null },
  { id: 'round-clear', mode: 'round-clear', build: null },
  { id: 'bust', mode: 'rap-sheet', build: null },
];

const VIEWPORTS = [
  [390, 844],
  [1920, 1080],
  [844, 390],
  [1366, 768],
  [360, 640],
  [768, 1024],
];

const H2_H6_VIEWPORTS = [
  [390, 844],
  [844, 390],
  [1920, 1080],
];

const FIX_VIEWPORTS = {
  H1: [[1920, 1080], [390, 844]],
  H2: H2_H6_VIEWPORTS,
  H3: [[844, 390]],
  H4: [[1920, 1080], [360, 640]],
  H5: [[390, 844], [412, 915]],
  H6: H2_H6_VIEWPORTS,
  H7: [[1366, 768], [390, 844], [768, 1024]],
  H8: [[844, 390]],
  M1: [[1920, 1080]],
  M2: [[844, 390], [360, 640]],
  M3: [[844, 390], [390, 844]],
  M4: [[1920, 1080]],
  M5: [[390, 844]],
  M6: [[844, 390], [390, 844]],
  M7: [[390, 844]],
  M8: [[390, 844]],
  M9: [[844, 390]],
  M10: [[844, 390], [390, 844]],
  M11: [[1920, 1080], [844, 390]],
  B1: [[1920, 1080], [390, 844]],
  B2: [[844, 390]],
  B3: [[1366, 768]],
  B4: [[1920, 1080]],
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  let filePath = path.join(root, rel.replace(/^\//, ''));
  if (rel === '/index.html' || rel === '/') filePath = indexFile;
  if (!filePath.startsWith(root) && filePath !== indexFile) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function installSettings(page) {
  await page.evaluate(
    ({ key }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({
          pacing: 'fast',
          reducedMotion: true,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
          uiRedesign: true,
          batch52Art: true,
          lookAndFeel: true,
        }),
      );
      localStorage.removeItem(key);
    },
    { key: RUN_KEY },
  );
}

async function resumeFromFixture(page, builder) {
  const built = builder();
  const payload = normalizePayload(built);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: RUN_KEY,
    data: payload,
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(500);
}

async function navigateScreen(page, screen) {
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await installSettings(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90000 });

  switch (screen.mode) {
    case 'lineup':
      await page.waitForSelector('[data-layout-key="title-screen"]', { timeout: 30000 });
      await page.locator('[data-layout-key="title-screen"] button', { hasText: 'PLAY' }).first().click();
      await page.waitForFunction(
        () => document.getElementById('root-gutterbones')?.getAttribute('data-phase') === 'LINEUP',
        { timeout: 30000 },
      );
      break;
    case 'rap-sheet':
      await resumeFromFixture(page, () => fixtures.bustLastHand());
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forfeitRunDemo(280));
      await page.waitForFunction(
        () => document.getElementById('root-gutterbones')?.getAttribute('data-phase') === 'RAP_SHEET',
        { timeout: 45000 },
      );
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.finishRapReveal?.());
      await page.waitForTimeout(350);
      break;
    case 'boss-bouncer':
      await resumeFromFixture(page, screen.build);
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor('BOUNCER'));
      await page.waitForTimeout(800);
      break;
    case 'safehouse':
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openSafehouseDemo());
      await page.waitForFunction(
        () => document.getElementById('root-gutterbones')?.getAttribute('data-phase') === 'SAFEHOUSE',
        { timeout: 30000 },
      );
      break;
    case 'victory':
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openVictoryDemo());
      await page.waitForFunction(
        () => document.getElementById('root-gutterbones')?.getAttribute('data-phase') === 'VICTORY',
        { timeout: 30000 },
      );
      break;
    case 'round-clear':
      await resumeFromFixture(page, () => fixtures.run({ phase: 'PLAY', round: 2, score: 90, target: 85, hasRolled: true }));
      await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openRoundClearDemo());
      await page.waitForSelector('[data-layout-key="round-clear-card"]', { timeout: 30000, state: 'visible' });
      break;
    case 'resume':
    default:
      await resumeFromFixture(page, screen.build);
      break;
  }

  await verifyScreen(page, screen.id);
  await page.waitForTimeout(400);
}

async function verifyScreen(page, screenId) {
  const spec = SCREEN_CHECKS[screenId];
  if (!spec) return;
  await page.waitForFunction(
    (expectedPhase) => document.getElementById('root-gutterbones')?.getAttribute('data-phase') === expectedPhase,
    spec.phase,
    { timeout: 45000 },
  );
  const requireVisible = screenId !== 'lineup';
  for (const key of spec.keys) {
  await page.waitForSelector(`[data-layout-key="${key}"]`, {
      timeout: 45000,
      state: requireVisible ? 'visible' : 'attached',
    });
  }
  if (spec.assert === 'debt-buttons') {
    await page.waitForFunction(() => {
      const pay = document.querySelector('[data-layout-key="shop-debt-pay"], [data-layout-key="shop-debt-footer-pay"]');
      const clear = document.querySelector('[data-layout-key="shop-debt-clear"], [data-layout-key="shop-debt-footer-clear"]');
      return !!(pay && clear);
    }, { timeout: 15000 });
  }
  if (spec.assert === 'no-debt-label') {
    await page.waitForFunction(() => {
      const pay = document.querySelector('[data-layout-key="shop-debt-pay"], [data-layout-key="shop-debt-footer-pay"]');
      const label = document.querySelector('.shop-options-debt .shop-debt-empty-label');
      return !pay && label && /no debt/i.test(label.textContent || '');
    }, { timeout: 15000 });
  }
  if (screenId === 'lineup') {
    await page.waitForFunction(() => {
      const grid = document.querySelector('[data-layout-key="lineup-grid"]');
      const title = document.querySelector('[data-layout-key="lineup-title"]');
      const phase = document.getElementById('root-gutterbones')?.getAttribute('data-phase');
      const gridH = grid?.getBoundingClientRect().height || 0;
      const titleH = title?.getBoundingClientRect().height || 0;
      return phase === 'LINEUP'
        && gridH > 24
        && titleH > 8
        && title?.textContent?.includes('GUTTERBONES');
    }, { timeout: 15000 });
  }
  if (screenId === 'rap-sheet' || screenId === 'bust') {
    await page.waitForFunction(() => {
      const phase = document.getElementById('root-gutterbones')?.getAttribute('data-phase');
      const sheet = document.querySelector('[data-layout-key="rap-sheet"]');
      return phase === 'RAP_SHEET' && sheet && sheet.getBoundingClientRect().height > 40;
    }, { timeout: 15000 });
  }
}

const manifest = { label, at: new Date().toISOString(), shots: [], errors: [] };

const screensToRun = screenFilter ? SCREENS.filter((s) => screenFilter.has(s.id)) : SCREENS;
const viewportsToRun = viewportFilter || VIEWPORTS;

for (const screen of screensToRun) {
  for (const [w, h] of viewportsToRun) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const file = `${w}x${h}_${screen.id}.png`;
    try {
      await navigateScreen(page, screen);
      const phase = await page.evaluate(() => document.getElementById('root-gutterbones')?.getAttribute('data-phase'));
      await page.screenshot({ path: path.join(outDir, file), fullPage: false });
      manifest.shots.push({ file, screen: screen.id, phase, w, h, ok: true });
    } catch (err) {
      const errPath = path.join(outDir, `${w}x${h}_${screen.id}.error.txt`);
      fs.writeFileSync(errPath, String(err));
      manifest.errors.push({ file, message: String(err) });
    }
    await page.close();
  }
}

if (!screenFilter) for (const [fixId, pairs] of Object.entries(FIX_VIEWPORTS)) {
  const screenMap = {
    H1: 'safehouse',
    H2: 'rap-sheet',
    H3: 'boss-bouncer',
    H4: 'boss-bouncer',
    H5: 'play',
    H6: 'lineup',
    H7: 'shop-debt',
    H8: 'carving',
    M1: 'shop',
    M2: 'safehouse',
    M3: 'gamble',
    M4: 'victory',
    M5: 'victory',
    M6: 'rap-sheet',
    M7: 'round-clear',
    M8: 'play',
    M9: 'shop',
    M10: 'play',
    M11: 'boss-bouncer',
    B1: 'play',
    B2: 'play',
    B3: 'shop-debt',
    B4: 'shop-nodebt',
  };
  const sid = screenMap[fixId];
  const screen = SCREENS.find((s) => s.id === sid);
  if (!screen) continue;
  for (const [w, h] of pairs) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const file = `fix-${fixId}_${w}x${h}_${sid}.png`;
    try {
      await navigateScreen(page, screen);
      await page.screenshot({ path: path.join(outDir, file), fullPage: false });
      manifest.shots.push({ file, fixId, ok: true });
    } catch (err) {
      manifest.errors.push({ file, fixId, message: String(err) });
    }
    await page.close();
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
server.close();
console.log('Wrote', outDir, 'label=', label, 'errors=', manifest.errors.length);
if (manifest.errors.length) process.exitCode = 1;