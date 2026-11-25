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
const label = process.argv[2] || 'after';
const outDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join('/opt/cursor/artifacts', `qa-high-medium-fixes-${label}`);
fs.mkdirSync(outDir, { recursive: true });

const RUN_KEY = 'gutterbones1977:run:v1';

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
  'round-clear': { phase: 'ROUND_CLEAR', keys: ['round-clear-card'] },
  bust: { phase: 'RAP_SHEET', keys: ['rap-sheet'] },
};

const SCREENS = [
  { id: 'play', build: () => fixtures.run({ phase: 'PLAY', hasRolled: true, debt: 12, gold: 44, round: 3 }) },
  { id: 'shop', build: () => shopQaFixture({ debt: 24 }) },
  { id: 'shop-debt', build: () => shopQaFixture({ debt: 28, gold: 90 }) },
  { id: 'shop-nodebt', build: () => shopQaFixture({ debt: 0, gold: 55 }) },
  {
    id: 'boss-bouncer',
    build: () => fixtures.run({ phase: 'PLAY', activeBossId: 'BOUNCER', round: 4, target: 120, score: 5, hasRolled: true }),
  },
  { id: 'safehouse', build: () => fixtures.run({ phase: 'SAFEHOUSE' }) },
  { id: 'rap-sheet', build: () => {
    const r = fixtures.rapSheet();
    return { ...r, bustActive: false };
  } },
  { id: 'lineup', build: () => fixtures.run({ phase: 'LINEUP', round: 0, gold: 0 }) },
  { id: 'carving', build: () => fixtures.carving() },
  { id: 'gamble', build: () => fixtures.gamble() },
  { id: 'victory', build: () => fixtures.run({ phase: 'VICTORY', gold: 80, round: 6 }) },
  { id: 'round-clear', build: () => fixtures.run({ phase: 'ROUND_CLEAR', round: 2, gold: 30 }) },
  { id: 'bust', build: () => fixtures.rapSheet() },
];

const VIEWPORTS = [
  [390, 844],
  [1920, 1080],
  [844, 390],
  [1366, 768],
  [360, 640],
  [768, 1024],
];

const FIX_VIEWPORTS = {
  H1: [[1920, 1080], [390, 844]],
  H2: [[390, 844], [844, 390]],
  H3: [[844, 390]],
  H4: [[1920, 1080], [360, 640]],
  H5: [[390, 844], [412, 915]],
  H6: [[390, 844], [360, 640]],
  H7: [[1366, 768], [390, 844], [768, 1024]],
  H8: [[844, 390]],
  M1: [[1920, 1080]],
  M2: [[844, 390], [360, 640]],
  M3: [[844, 390], [390, 844]],
  M4: [[1920, 1080]],
  M5: [[390, 844]],
  M6: [[844, 390]],
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
  const filePath = path.join(root, rel.replace(/^\//, ''));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function seed(page, builder, screenId) {
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const built = builder();
  if (typeof built !== 'object' || built === null) {
    throw new Error(`fixture builder for ${screenId} did not return an object`);
  }
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(built));
  await page.evaluate(
    ({ key, data }) => {
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
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__GB_LAYOUT_AUDIT__, { timeout: 60000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  if (screenId === 'boss-bouncer') {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.openBossIntroFor?.('BOUNCER'));
    await page.waitForTimeout(800);
  }
  await verifyScreen(page, screenId);
  await page.waitForTimeout(400);
}

async function verifyScreen(page, screenId) {
  const spec = SCREEN_CHECKS[screenId];
  if (!spec) return;
  await page.waitForFunction(
    (expectedPhase) => {
      const root = document.getElementById('root-gutterbones');
      return root && root.getAttribute('data-phase') === expectedPhase;
    },
    spec.phase,
    { timeout: 45000 },
  );
  for (const key of spec.keys) {
    await page.waitForSelector(`[data-layout-key="${key}"]`, { timeout: 45000, state: 'visible' });
  }
  if (spec.assert === 'debt-buttons') {
    await page.waitForFunction(() => {
      const root = document.getElementById('root-gutterbones');
      if (!root || root.getAttribute('data-phase') !== 'SHOP') return false;
      const pay = [...document.querySelectorAll('.shop-debt-control-grid button')].find((b) => /PAY \$10/.test(b.textContent || ''));
      const clear = [...document.querySelectorAll('.shop-debt-control-grid button')].find((b) => /CLEAR/.test(b.textContent || ''));
      return !!(pay && clear);
    }, { timeout: 15000 });
  }
  if (spec.assert === 'no-debt-label') {
    await page.waitForFunction(() => {
      const root = document.getElementById('root-gutterbones');
      if (!root || root.getAttribute('data-phase') !== 'SHOP') return false;
      const pay = [...document.querySelectorAll('.shop-debt-control-grid button')].find((b) => /PAY \$10/.test(b.textContent || ''));
      const label = document.querySelector('.shop-options-debt .shop-debt-empty-label');
      return !pay && label && /no debt/i.test(label.textContent || '');
    }, { timeout: 15000 });
  }
}

const manifest = { label, at: new Date().toISOString(), shots: [], errors: [] };

for (const screen of SCREENS) {
  for (const [w, h] of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    const file = `${w}x${h}_${screen.id}.png`;
    try {
      await seed(page, screen.build, screen.id);
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

for (const [fixId, pairs] of Object.entries(FIX_VIEWPORTS)) {
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
      await seed(page, screen.build, screen.id);
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