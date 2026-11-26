'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/art/batch-5-2/RUNTIME-MANIFEST.json'), 'utf8'));

function positionsFor(name) {
  const start = html.indexOf('@keyframes ' + name + ' {');
  assert.ok(start >= 0, 'missing keyframes: ' + name);
  const block = html.slice(start).split('\n    }', 1)[0];
  return [...block.matchAll(/background-position:\s*([\d.]+)%\s+([\d.]+)%/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
}

test('ambient 4x2 sheets visit all eight whole cells', () => {
  assert.deepEqual(positionsFor('lafSpriteGrid8'), [
    [0, 0], [33.333333, 0], [66.666667, 0], [100, 0],
    [0, 100], [33.333333, 100], [66.666667, 100], [100, 100],
  ]);
  assert.doesNotMatch(html, /animation:\s*lafAmbient8\b/);
  assert.match(html, /animation: lafSpriteGrid8 1\.15s steps\(1, end\) infinite/);
  assert.match(html, /lafAshtraySmokeLoop 16s ease-in-out infinite/);
});

test('rat 8x1 sheet reaches the eighth cell without half-cell slices', () => {
  const p = positionsFor('lafRatSprite8');
  assert.equal(p.length, 8);
  for (let i = 0; i < 8; i += 1) {
    assert.ok(Math.abs(p[i][0] - i * 100 / 7) < 0.00001);
    assert.equal(p[i][1], 0);
  }
  assert.match(html, /lafRatSprite8 calc\(var\(--critter-ms, 2200ms\) \/ 2\) steps\(1, end\)/);
});

test('roll hand validates both PNG fallback images before readiness', () => {
  assert.match(html, /loadImage\(ROLL_HAND_SPRITE_SHEET\)/);
  assert.match(html, /loadImage\(ROLL_HAND_PNG_CLOSED\),\s*loadImage\(ROLL_HAND_PNG_OPEN\)/);
  assert.match(html, /closedOk && openOk \? 'png' : 'none'/);
  assert.match(html, /probeRollHandSprites\(\)\.then\(\(mode\)/);
  assert.doesNotMatch(html, /const mode = ok \? 'sheet' : 'png'/);
});

test('Rap Sheet and boss labels have separate high-contrast styling', () => {
  assert.match(html, /\[data-layout-key="rap-sheet"\] \.rap-sheet-stat-label\s*{\s*color: #e8dfd0 !important/);
  assert.match(html, /\[data-layout-key="rap-sheet"\] \.text-green-800/);
  assert.match(html, /boss-intro-name-plate \.shop-section-header__label\s*{[\s\S]*?font-size: clamp\(1\.15rem, 3\.2vw, 1\.9rem\) !important/);
});

test('runtime size total includes look-and-feel asset bytes', () => {
  const expected = [...manifest.assets, ...(manifest.lookAndFeelAssets || [])]
    .reduce((sum, item) => sum + Number(item.bytes || 0), 0);
  assert.equal(manifest.totalBytes, expected);
});

test('edge-cleaned atlas asset hashes are not misrepresented as original master hashes', () => {
  const cleaned = manifest.assets.filter((a) => a.edgeCleaned);
  assert.equal(cleaned.length, 5);
  for (const asset of cleaned) {
    assert.equal(asset.masterSha256, null);
    assert.equal(asset.masterSha256Verified, false);
    assert.match(asset.intermediateSha256, /^[a-f0-9]{64}$/);
  }
});
