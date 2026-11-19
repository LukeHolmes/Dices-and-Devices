#!/usr/bin/env node
/**
 * Ashtray before/after crops + 8-size bbox gate (layoutAudit=1).
 * Usage: node scripts/capture-ashtray-crops.mjs --label before|after [--root dir] [--out dir]
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
  : path.join('/opt/cursor/artifacts', `ashtray-scale-${label}`);
fs.mkdirSync(outDir, { recursive: true });

const CROP_SIZES = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const BBOX_SIZES = [
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
  round: 4,
  score: 62,
  target: 161,
  hands: 4,
  discards: 2,
  gold: 28,
  hasRolled: true,
  dice: fixtures.dice([2, 2, 2, 3, 4]),
  inventory: [{ id: 'ENGINE', name: 'The Engine', instanceId: 'eng-1' }],
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
    if (await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__)) break;
    await page.waitForTimeout(1000);
  }
  if (!(await page.evaluate(() => !!window.__GB_LAYOUT_AUDIT__))) {
    throw new Error('layoutAudit hook missing');
  }
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="play-alley"]', { timeout: 120_000 });
  await page.waitForTimeout(500);
}

function overlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

const report = { label, crops: {}, bbox: {}, consoleErrors: [] };

for (const [w, h] of CROP_SIZES) {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push({ size: `${w}x${h}`, text: msg.text() });
  });
  await page.setViewportSize({ width: w, height: h });
  await seedPlay(page);
  const key = `${w}x${h}`;
  const clip = await page.evaluate(() => {
    const anchor = document.querySelector('[data-layout-key="batch52-ashtray-anchor"]');
    const img = document.querySelector('.batch52-ashtray-prop');
    const el = img || anchor;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { hidden: true };
    const pad = Math.round(Math.max(24, Math.min(64, r.width * 0.35)));
    return {
      hidden: false,
      x: Math.max(0, Math.floor(r.left - pad)),
      y: Math.max(0, Math.floor(r.top - pad)),
      width: Math.ceil(r.width + pad * 2),
      height: Math.ceil(r.height + pad * 2),
    };
  });
  if (clip && !clip.hidden) {
    await page.screenshot({
      path: path.join(outDir, `${label}_ashtray_crop_${key}.png`),
      clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
    });
    report.crops[key] = clip;
  } else {
    report.crops[key] = { hidden: true };
  }
  await page.close();
}

for (const [w, h] of BBOX_SIZES) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: w, height: h });
  await seedPlay(page);
  const key = `${w}x${h}`;
  const checks = await page.evaluate(() => {
    const anchor = document.querySelector('[data-layout-key="batch52-ashtray-anchor"]');
    const ashtray = document.querySelector('.batch52-ashtray-prop');
    const deco = [
      ...document.querySelectorAll('.laf-ashtray-ember, .laf-ashtray-smoke'),
    ];
    const alley = document.querySelector('[data-layout-key="play-alley"]');
    const lane = document.querySelector('[data-layout-key="play-dice-lane"]');
    const roll = document.querySelector('[data-layout-key="play-roll-btn"]');
    const scoreTargets = [
      ...document.querySelectorAll('.gb-payout-row-btn, [data-layout-key="play-roll-btn"]'),
    ];
    const visual = document.querySelector('.batch52-ashtray-prop');
    const pack = anchor || ashtray;
    if (!pack) return { ok: true, reason: 'no-ashtray-node' };
    const hidden = pack.getBoundingClientRect().width < 2
      || (anchor && getComputedStyle(anchor).display === 'none');
    if (hidden) return { ok: true, hidden: true };
    const rects = [
      visual ? visual.getBoundingClientRect() : pack.getBoundingClientRect(),
      ...deco.filter((n) => getComputedStyle(n).display !== 'none').map((n) => n.getBoundingClientRect()),
    ];
    const hits = (b) => rects.some((a) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom));
    const badLane = lane && hits(lane.getBoundingClientRect());
    const badRoll = roll && hits(roll.getBoundingClientRect());
    let badScore = false;
    for (const node of scoreTargets) {
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (hits(r)) {
        badScore = true;
        break;
      }
    }
    let insideAlley = true;
    if (alley) {
      const ar = alley.getBoundingClientRect();
      const a = pack.getBoundingClientRect();
      insideAlley =
        a.left >= ar.left + 1 &&
        a.right <= ar.right - 1 &&
        a.top >= ar.top + 1 &&
        a.bottom <= ar.bottom - 1;
    }
    return {
      ok: !badLane && !badRoll && !badScore && insideAlley,
      badLane,
      badRoll,
      badScore,
      insideAlley,
      hidden: false,
      ashtrayW: pack.getBoundingClientRect().width,
    };
  });
  report.bbox[key] = checks;
  await page.close();
}

report.bboxAllOk = Object.values(report.bbox).every((b) => b.ok !== false);
fs.writeFileSync(path.join(outDir, 'ashtray-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

await browser.close();
server.close();