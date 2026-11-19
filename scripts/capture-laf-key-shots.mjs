#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
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
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 400));
const base = `http://127.0.0.1:${PORT}`;

async function bootPlay(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
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

async function capture1920() {
  const page = await browser.newPage();
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
  const page = await browser.newPage();
  await bootPlay(page, vp);
  await page.screenshot({ path: path.join(OUT, `${label}_${name}_ready.png`) });
  await page.close();
}

await capture1920();
if (label === 'after') {
  await captureViewport({ width: 768, height: 1024 }, '768x1024');
  await captureViewport({ width: 390, height: 844 }, '390x844');
}
await browser.close();
server.kill();
console.log('done', label, ROOT);