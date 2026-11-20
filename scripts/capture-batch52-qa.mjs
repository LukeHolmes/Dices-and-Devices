#!/usr/bin/env node
/**
 * Batch 5.2 production QA captures via layoutAudit=1 (Playwright Chromium).
 * Usage: node scripts/capture-batch52-qa.mjs [--label before|after] [root] [outDir]
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
  : path.join('/opt/cursor/artifacts', `batch52-qa-${label}`);
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
const MOBILE = new Set([390 * 10000 + 844, 320 * 10000 + 568]);
const RUN_KEY = 'gutterbones1977:run:v1';

const fixture = fixtures.run({
  phase: 'PLAY',
  round: 4,
  score: 62,
  target: 161,
  hands: 4,
  discards: 2,
  gold: 28,
  hasRolled: true,
  dice: fixtures.dice([2, 2, 2, 3, 4]),
  inventory: [
    { id: 'BRASS_KNUCKLES', name: 'Brass Knuckles', instanceId: 'bk-1' },
    { id: 'ENGINE', name: 'The Engine', instanceId: 'eng-1' },
    { id: 'CENTERPIECE', name: 'Centerpiece', instanceId: 'cp-1' },
  ],
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

const qa = { label, sizes: {}, bbox: {}, consoleErrors: [], fps: null };
const errors = [];

async function seedPlay(page) {
  await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixture));
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({ pacing: 'fast', reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true })
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload }
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
  for (let i = 0; i < 120; i += 1) {
    const ready = await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__);
    if (ready) break;
    await page.waitForTimeout(1000);
  }
  if (!(await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__))) {
    throw new Error('layoutAudit hook missing after 120s');
  }
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="play-alley"]', { timeout: 120_000 });
  await page.waitForTimeout(600);
}

for (const [w, h] of SIZES) {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ size: `${w}x${h}`, text: msg.text() });
  });
  await page.setViewportSize({ width: w, height: h });
  await seedPlay(page);
  const key = `${w}x${h}`;
  await page.screenshot({ path: path.join(outDir, `${label}_${key}_play.png`), fullPage: false });
  if (w === 768 && h === 1024) {
    const ledger = page.locator('[data-layout-key="play-ledger-column"]');
    if (await ledger.count()) {
      await ledger.screenshot({ path: path.join(outDir, `${label}_${key}_ledger.png`) });
    }
  }
  if (w === 1920 && h === 1080) {
    const alley = page.locator('[data-layout-key="play-alley"]');
    if (await alley.count()) {
      await alley.screenshot({ path: path.join(outDir, `${label}_${key}_alley.png`) });
    }
  }
  if (MOBILE.has(w * 10000 + h)) {
    const openBtn = page.locator('[data-layout-key="mobile-score-sheet-open"]');
    if (await openBtn.count()) {
      await openBtn.click();
      await page.waitForSelector('.mobile-score-sheet--expanded', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outDir, `${label}_${key}_matchbook-drawer.png`), fullPage: false });
    }
  }
  const checks = await page.evaluate(() => {
    const ashtray = document.querySelector('.batch52-ashtray-prop');
    const roll = document.querySelector('[data-layout-key="play-roll-btn"]');
    const lane = document.querySelector('[data-layout-key="play-dice-lane"]');
    const alley = document.querySelector('[data-layout-key="play-alley"]');
    let overlap = { ok: true, reason: 'no-ashtray' };
    if (ashtray && ashtray.getBoundingClientRect().width >= 2) {
      const a = ashtray.getBoundingClientRect();
      const hit = (b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      const badRoll = roll && hit(roll.getBoundingClientRect());
      const badLane = lane && hit(lane.getBoundingClientRect());
      let insideAlley = true;
      if (alley) {
        const ar = alley.getBoundingClientRect();
        insideAlley =
          a.left >= ar.left + 2 &&
          a.right <= ar.right - 2 &&
          a.top >= ar.top + 2 &&
          a.bottom <= ar.bottom - 2;
      }
      overlap = { ok: !badRoll && !badLane && insideAlley, badRoll: !!badRoll, badLane: !!badLane, insideAlley };
    }
    const longNames = ['Triad', 'Full Ride', 'Short Run', 'THE JACKPOT'];
    const ledgerRows = {};
    for (const name of longNames) {
      const el = [...document.querySelectorAll('.matchbook-ledger .score-row-name, .mobile-score-sheet .score-row-name')].find(
        (node) => (node.textContent || '').trim().includes(name)
      );
      if (!el) {
        ledgerRows[name] = { found: false };
        continue;
      }
      const cs = getComputedStyle(el);
      ledgerRows[name] = {
        found: true,
        truncated: el.scrollWidth > el.clientWidth + 1,
        color: cs.color,
        fontWeight: cs.fontWeight,
      };
    }
    return { overlap, ledgerRows };
  });
  qa.sizes[key] = {
    ...checks,
    batch52: await page.evaluate(() => document.getElementById('root-gutterbones')?.dataset?.batch52Art === '1'),
  };
  await page.close();
}

const fpsPage = await browser.newPage();
await fpsPage.setViewportSize({ width: 1920, height: 1080 });
await seedPlay(fpsPage);
qa.fps = await fpsPage.evaluate(async () => {
  const samples = [];
  let last = performance.now();
  await new Promise((resolve) => {
    let n = 0;
    const tick = (t) => {
      samples.push(1000 / (t - last));
      last = t;
      if (++n >= 45) resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  samples.sort((a, b) => a - b);
  return { median: samples[Math.floor(samples.length / 2)], p10: samples[4], p90: samples[samples.length - 5] };
});
await fpsPage.close();

qa.consoleErrors = errors;
qa.bboxAllOk = Object.values(qa.sizes).every((s) => s.overlap?.ok !== false);
qa.ledger768 = qa.sizes['768x1024']?.ledgerRows || null;
fs.writeFileSync(path.join(outDir, 'qa-report.json'), `${JSON.stringify(qa, null, 2)}\n`);
console.log(JSON.stringify(qa, null, 2));

await browser.close();
server.close();