#!/usr/bin/env node
/**
 * Look-and-feel pass QA: 8 viewports, play states, fps, bundle delta (Playwright).
 * Usage: node scripts/capture-laf-qa.mjs [--label before|after] [root] [outDir]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGame, plain } from '../tests/helpers/game.cjs';
import fixtures from '../tests/fixtures/runs.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const labelIdx = argv.indexOf('--label');
const label = labelIdx >= 0 ? argv[labelIdx + 1] : 'after';
const positional = argv.filter((a, i) => !a.startsWith('-') && (labelIdx < 0 || (i !== labelIdx + 1 && i !== labelIdx)));
const root = positional[0] ? path.resolve(positional[0]) : path.join(__dirname, '..');
const outDir = positional[1]
  ? path.resolve(positional[1])
  : path.join(root, 'artifacts', `laf-qa-${label}`);
fs.mkdirSync(outDir, { recursive: true });

const SIZES = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 568],
];
const RUN_KEY = 'gutterbones1977:run:v1';

const fixture = fixtures.run({
  phase: 'PLAY',
  round: 3,
  score: 12,
  target: 110,
  hands: 4,
  discards: 3,
  stash: 55,
  hasRolled: false,
  dice: fixtures.dice([3, 4, 5, 2, 6]),
});

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

const qa = {
  label,
  indexBytes: fs.statSync(path.join(root, 'index.html')).size,
  sizes: {},
  fps: {},
  decorativeBbox: {},
};

async function seedPlay(page, { reducedMotion = false } = {}) {
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixture));
  await page.evaluate(
    ({ key, data, reducedMotion: rm }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({ pacing: 'fast', reducedMotion: rm, tutorialCompleted: true, skippedAlleyIntro: true })
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload, reducedMotion }
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
  for (let i = 0; i < 120; i += 1) {
    if (await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__)) break;
    await page.waitForTimeout(1000);
  }
  if (!(await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__))) throw new Error('layoutAudit missing');
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="play-alley"]', { timeout: 120_000 });
  await page.waitForSelector('[data-tutorial="roll-btn"]:not([disabled])', { timeout: 120_000 }).catch(() => {});
  await page.waitForFunction(() => window.__GB_ROLL_HAND_SPRITES_READY === true, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function measureDecorBbox(page) {
  return page.evaluate(() => {
    const keys = [
      '.look-and-feel-ambient .laf-ambient-bulb',
      '.laf-ashtray-ember',
      '.laf-ashtray-smoke',
      '.batch52-ashtray-prop',
    ];
    const roll = document.querySelector('[data-tutorial="roll-btn"]');
    const lane = document.querySelector('[data-layout-key="play-dice-lane"]');
    const alley = document.querySelector('[data-layout-key="play-alley"]');
    const out = {};
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    for (const sel of keys) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = { ok: true, skipped: true };
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2) {
        out[sel] = { ok: true, hidden: true };
        continue;
      }
      const badRoll = roll && hit(r, roll.getBoundingClientRect());
      const badLane = lane && hit(r, lane.getBoundingClientRect());
      let insideAlley = true;
      if (alley) {
        const ar = alley.getBoundingClientRect();
        insideAlley = r.left >= ar.left - 2 && r.right <= ar.right + 2 && r.top >= ar.top - 2 && r.bottom <= ar.bottom + 2;
      }
      out[sel] = { ok: !badRoll && !badLane && insideAlley, badRoll: !!badRoll, badLane: !!badLane, insideAlley };
    }
    return out;
  });
}

async function captureHandMid(page) {
  const hasRoll = await page.locator('[data-tutorial="roll-btn"]:not([disabled])').count();
  if (!hasRoll) {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.triggerRollHandOverlayFx?.());
  } else {
    await page.click('[data-tutorial="roll-btn"]');
  }
  await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', { timeout: 8000 });
  const handMs = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.getRollHandFxMs());
  const midMs = Math.round(handMs * 0.54);
  await page.waitForTimeout(midMs);
  await page.evaluate((ms) => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(ms), midMs);
  await page.waitForTimeout(80);
}

for (const [w, h] of SIZES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: w, height: h });
  await seedPlay(page);
  const key = `${w}x${h}`;
  await page.screenshot({ path: path.join(outDir, `${label}_${key}_ready.png`), fullPage: false });
  const decor = await measureDecorBbox(page);
  qa.decorativeBbox[key] = decor;
  const decorOk = Object.values(decor).every((d) => d.ok !== false);
  qa.sizes[key] = { decorOk, lookAndFeel: await page.evaluate(() => document.getElementById('root-gutterbones')?.dataset?.lookAndFeel === '1') };
  if (w === 1920 && h === 1080) {
    try {
      await captureHandMid(page);
      await page.screenshot({ path: path.join(outDir, `${label}_${key}_midroll.png`), fullPage: false });
    } catch (e) {
      qa.sizes[key].midRollError = String(e.message || e);
    }
  }
  await page.close();
}

const scorePage = await browser.newPage();
await scorePage.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(scorePage);
await scorePage.evaluate(() => {
  const row = document.querySelector('button[data-payout-row]:not([disabled])');
  if (row) row.click();
});
await scorePage.waitForSelector('[data-layout-key="score-breakdown-overlay"], [data-layout-key="score-resolution-overlay"]', {
  timeout: 15_000,
}).catch(() => {});
await scorePage.waitForTimeout(400);
await scorePage.screenshot({ path: path.join(outDir, `${label}_1920x1080_scored.png`), fullPage: false });
await scorePage.close();

const shopPage = await browser.newPage();
await shopPage.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(shopPage);
await shopPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.openTutorialCoachShop());
await shopPage.waitForSelector('[data-layout-key="shop-layout"]', { timeout: 30_000 }).catch(() => {});
await shopPage.waitForTimeout(600);
await shopPage.screenshot({ path: path.join(outDir, `${label}_1920x1080_shop.png`), fullPage: false });
await shopPage.close();

const modalPage = await browser.newPage();
await modalPage.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(modalPage);
await modalPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.showCarvingHelpToast());
await modalPage.waitForTimeout(500);
await modalPage.screenshot({ path: path.join(outDir, `${label}_1920x1080_modal.png`), fullPage: false });
await modalPage.close();

const rmPage = await browser.newPage();
await rmPage.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(rmPage, { reducedMotion: true });
await rmPage.screenshot({ path: path.join(outDir, `${label}_1920x1080_reduced.png`), fullPage: false });
await rmPage.close();

async function measureFps(page, duringRoll) {
  if (duringRoll) {
    await page.click('[data-tutorial="roll-btn"]');
    await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"] .animate-gutter-hand', { timeout: 5000 }).catch(() => {});
  }
  return page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    await new Promise((resolve) => {
      let n = 0;
      const tick = (t) => {
        samples.push(1000 / Math.max(1, t - last));
        last = t;
        if (++n >= 50) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.sort((a, b) => a - b);
    return { median: samples[Math.floor(samples.length / 2)], p10: samples[4], p90: samples[samples.length - 5] };
  });
}

const fpsIdle = await browser.newPage();
await fpsIdle.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(fpsIdle);
qa.fps.idle = await measureFps(fpsIdle, false);
await fpsIdle.close();

const fpsRoll = await browser.newPage();
await fpsRoll.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(fpsRoll);
qa.fps.roll = await measureFps(fpsRoll, true);
await fpsRoll.close();

qa.bboxAllOk = Object.values(qa.decorativeBbox).every((row) => Object.values(row).every((d) => d.ok !== false));
fs.writeFileSync(path.join(outDir, 'laf-qa-report.json'), `${JSON.stringify(qa, null, 2)}\n`);
console.log(JSON.stringify(qa, null, 2));

await browser.close();
server.close();