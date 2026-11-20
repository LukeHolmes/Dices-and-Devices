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
const OUT = process.env.GB_ARTIFACT_DIR ? path.resolve(process.env.GB_ARTIFACT_DIR) : path.join(ROOT, 'artifacts', 'laf-captures');
fs.mkdirSync(OUT, { recursive: true });

const CAPTURE_UNSCROLL_CSS = `
  html, body { height: auto !important; max-height: none !important; overflow: visible !important; }
  #root-gutterbones[data-phase="SHOP"] .gb-screen {
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  #root-gutterbones[data-phase="SHOP"] [data-layout-key="shop-stash-panel"] {
    position: relative !important;
    bottom: auto !important;
  }
  #root-gutterbones[data-phase="SHOP"] [data-layout-key="shop-stash-panel"] > :not(button) {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
`;

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
const context = await browser.newContext({ deviceScaleFactor: 1 });
const defaultTimeoutMs = 180_000;
async function openPage() {
  const page = await context.newPage();
  page.setDefaultTimeout(defaultTimeoutMs);
  page.setDefaultNavigationTimeout(defaultTimeoutMs);
  return page;
}

async function measureShopLayoutMetrics(page) {
  return page.evaluate(() => {
    const layout = document.querySelector('[data-layout-key="shop-layout"]');
    const routes = document.querySelector('[data-layout-key="shop-routes-panel"]');
    const stock = document.querySelector('[data-tutorial="shop-panel"]');
    const layoutCs = layout ? getComputedStyle(layout) : null;
    const routesCs = routes ? getComputedStyle(routes) : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      layout: layout
        ? {
            height: layout.getBoundingClientRect().height,
            computedHeight: layoutCs?.height,
            computedMaxHeight: layoutCs?.maxHeight,
          }
        : null,
      routesPanel: routes
        ? {
            height: routes.getBoundingClientRect().height,
            computedHeight: routesCs?.height,
            computedMaxHeight: routesCs?.maxHeight,
          }
        : null,
      stockPanel: stock ? { height: stock.getBoundingClientRect().height } : null,
    };
  });
}

async function assertBossIntroCard(page, name) {
  const card = await page.evaluate(() => {
    const el = document.querySelector('.boss-intro-card');
    if (!(el instanceof HTMLElement)) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      width: r.width,
      height: r.height,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
    };
  });
  if (!card || card.width < 200 || card.height < 120) {
    throw new Error(`${name}: boss-intro-card missing or too small: ${JSON.stringify(card)}`);
  }
  if (card.visibility === 'hidden' || Number(card.opacity) < 0.05) {
    throw new Error(`${name}: boss-intro-card not visible: ${JSON.stringify(card)}`);
  }
  return card;
}

async function injectShopUnscroll(page) {
  await page.evaluate((css) => {
    document.getElementById('__gb_capture_unscroll')?.remove();
    const tag = document.createElement('style');
    tag.id = '__gb_capture_unscroll';
    tag.textContent = css;
    document.head.appendChild(tag);
    window.scrollTo(0, 0);
    const screen = document.querySelector('#root-gutterbones[data-phase="SHOP"] .gb-screen');
    if (screen instanceof HTMLElement) screen.scrollTop = 0;
  }, CAPTURE_UNSCROLL_CSS);
}

async function measureShopTallHeight(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('#root-gutterbones[data-phase="SHOP"] .gb-screen');
    const layout = document.querySelector('[data-layout-key="shop-layout"]');
    const footer = document.querySelector('[data-layout-key="shop-stash-panel"]');
    const hit = document.querySelector('[data-layout-key="shop-hit-streets"]');
    const pad = 36;
    const tops = [];
    if (screen instanceof HTMLElement) tops.push(screen.getBoundingClientRect().top);
    if (layout instanceof HTMLElement) tops.push(layout.getBoundingClientRect().top);
    const anchorTop = tops.length ? Math.min(...tops) : 0;
  const bottoms = [];
    if (footer instanceof HTMLElement) bottoms.push(footer.getBoundingClientRect().bottom);
    if (hit instanceof HTMLElement) bottoms.push(hit.getBoundingClientRect().bottom);
    if (layout instanceof HTMLElement) bottoms.push(layout.getBoundingClientRect().bottom);
    const docBottom = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      screen instanceof HTMLElement ? screen.scrollHeight + anchorTop : 0,
    );
    bottoms.push(docBottom);
    const anchorBottom = Math.max(...bottoms, anchorTop + 400);
    const height = Math.min(16000, Math.ceil(anchorBottom - anchorTop + pad));
    const footerBottom = footer instanceof HTMLElement ? footer.getBoundingClientRect().bottom : anchorBottom;
    return { height, anchorTop, footerBottom, hitVisible: hit instanceof HTMLElement };
  });
}

async function assertFooterInViewport(page, name, viewportHeight) {
  const check = await page.evaluate(() => {
    const footer = document.querySelector('[data-layout-key="shop-stash-panel"]');
    const hit = document.querySelector('[data-layout-key="shop-hit-streets"]');
    const bar = footer?.querySelector('.h-4.bg-black');
    const filled = footer ? [...footer.querySelectorAll('.h-4.bg-black .rounded-sm')].filter((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      return bg && bg !== 'rgb(31, 41, 55)' && bg !== 'rgb(55, 65, 81)' && !bg.includes('128, 128, 128');
    }).length : 0;
    const fr = footer?.getBoundingClientRect();
    const hr = hit?.getBoundingClientRect();
    return {
      vh: window.innerHeight,
      footerBottom: fr?.bottom ?? null,
      hitBottom: hr?.bottom ?? null,
      stashFilledSegs: filled,
    };
  });
  const limit = viewportHeight;
  if (check.footerBottom == null || check.footerBottom > limit + 1.5) {
    throw new Error(
      `${name}: footer bottom ${check.footerBottom} exceeds capture height ${limit} (vh=${check.vh})`,
    );
  }
  if (check.hitBottom != null && check.hitBottom > limit + 1.5) {
    throw new Error(`${name}: HIT THE STREETS bottom ${check.hitBottom} exceeds capture height ${limit}`);
  }
  return check;
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
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.shopBusy()));
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
  const metrics = await measureShopLayoutMetrics(page);
  if (process.env.CAPTURE_FINAL_ART === '1' && (name === '1920x1080' || name === '1366x768' || name === '390x844')) {
    console.log(`shop-metrics ${name}`, JSON.stringify(metrics));
    if (vp.width >= 1024) {
      const minFill = vp.height * 0.62;
      if (!metrics.layout?.height || metrics.layout.height < minFill) {
        throw new Error(`${name}: shop-layout height ${metrics.layout?.height} < ${minFill} (vh=${metrics.innerHeight})`);
      }
      if (!metrics.routesPanel?.height || metrics.routesPanel.height < minFill) {
        throw new Error(`${name}: shop-routes-panel height ${metrics.routesPanel?.height} < ${minFill}`);
      }
    }
  }
  const outPath = path.join(OUT, `${label}_${name}_shop.png`);
  await page.screenshot({ path: outPath });
  await page.close();
  return { outPath, metrics };
}

async function captureShopTall(vp, name) {
  const page = await openPage();
  await bootShop(page, vp);
  await injectShopUnscroll(page);
  await page.waitForTimeout(150);
  let metrics = await measureShopTallHeight(page);
  let shotHeight = Math.max(metrics.height, vp.height);
  for (let i = 0; i < 3; i++) {
    await page.setViewportSize({ width: vp.width, height: shotHeight });
    await page.waitForTimeout(200);
    await injectShopUnscroll(page);
    metrics = await measureShopTallHeight(page);
    const next = Math.max(metrics.height, vp.height);
    if (next <= shotHeight + 2) break;
    shotHeight = next;
  }
  const footerMetrics = await assertFooterInViewport(page, name, shotHeight);
  const outPath = path.join(OUT, `${label}_${name}_shop.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const finalCheck = await page.evaluate(() => document.querySelector('[data-layout-key="shop-stash-panel"]')?.getBoundingClientRect().bottom);
  if (finalCheck != null && finalCheck > shotHeight + 1.5) {
    throw new Error(`${name}: post-shot footer bottom ${finalCheck} > ${shotHeight}`);
  }
  await page.evaluate(() => document.getElementById('__gb_capture_unscroll')?.remove());
  await page.close();
  return { outPath, shotHeight, footerBottom: finalCheck, stashSegs: footerMetrics.stashFilledSegs, footerMetrics, metrics };
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

const shopCaptureAll =
  process.env.CAPTURE_ROUND9 === '1' || process.env.CAPTURE_ROUND10 === '1' || process.env.CAPTURE_SHOP_ONLY === '1';

async function bootPlayMinimal(page, vp) {
  await page.setViewportSize(vp);
  await page.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.run()));
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        'gutterbones1977:settings:v1',
        JSON.stringify({ pacing: 'fast', reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: 'gutterbones1977:run:v1', data: payload },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForTimeout(400);
}

async function captureFinalArtScreens() {
  for (const [vp, name] of [
    [{ width: 1920, height: 1080 }, '1920x1080'],
    [{ width: 1366, height: 768 }, '1366x768'],
    [{ width: 390, height: 844 }, '390x844'],
  ]) {
    const page = await openPage();
    await bootPlayMinimal(page, vp);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.openBossIntroFor('BOUNCER'));
    await page.waitForSelector('[data-layout-key="boss-intro-overlay"]', { timeout: 10_000 });
    await page.waitForSelector('.boss-intro-card', { timeout: 10_000 });
    await page.waitForTimeout(300);
    await assertBossIntroCard(page, name);
    await page.screenshot({ path: path.join(OUT, `${label}_${name}_boss-intro.png`) });
    await page.close();
  }
  for (const [safeVp, safeName] of [
    [{ width: 1920, height: 1080 }, '1920x1080'],
    [{ width: 1366, height: 768 }, '1366x768'],
    [{ width: 390, height: 844 }, '390x844'],
  ]) {
    const safePage = await openPage();
    await safePage.setViewportSize(safeVp);
    await bootPlayMinimal(safePage, safeVp);
    await safePage.evaluate(() => window.__GB_LAYOUT_AUDIT__.openSafehouseDemo());
    await safePage.waitForSelector('[data-layout-key="safehouse-card"]', { timeout: 10_000 });
    await safePage.waitForTimeout(400);
    await safePage.screenshot({ path: path.join(OUT, `${label}_${safeName}_safehouse-nightclub.png`) });
    await safePage.close();
  }
  for (const [gVp, gName] of [
    [{ width: 1920, height: 1080 }, '1920x1080'],
    [{ width: 1366, height: 768 }, '1366x768'],
    [{ width: 390, height: 844 }, '390x844'],
  ]) {
    const gPage = await openPage();
    const gamblePayload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(fixtures.gamble()));
    await gPage.setViewportSize(gVp);
    await gPage.goto(`${base}/index.html?layoutAudit=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await gPage.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 180_000 });
    await gPage.evaluate(
      ({ key, data }) => {
        localStorage.setItem(
          'gutterbones1977:settings:v1',
          JSON.stringify({ pacing: 'fast', reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: 'gutterbones1977:run:v1', data: gamblePayload },
    );
    await gPage.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    await gPage.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 120_000 });
    await gPage.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await gPage.waitForSelector('[data-layout-key="gamble-card"]', { timeout: 10_000 });
    await gPage.waitForTimeout(300);
    await gPage.screenshot({ path: path.join(OUT, `${label}_${gName}_gamble-modal.png`) });
    await gPage.close();
  }
}

if (shopCaptureAll) {
  const tall390 = await captureShopTall({ width: 390, height: 844 }, '390x844');
  const tall768 = await captureShopTall({ width: 768, height: 1024 }, '768x1024');
  await captureShop({ width: 320, height: 568 }, '320x568');
  await captureShop({ width: 412, height: 915 }, '412x915');
  await captureShop({ width: 844, height: 390 }, '844x390');
  await captureShop({ width: 1024, height: 768 }, '1024x768');
  await captureShop({ width: 1366, height: 768 }, '1366x768');
  await captureShop({ width: 1920, height: 1080 }, '1920x1080');
  console.log('tall', JSON.stringify({ tall390, tall768 }));
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
if (process.env.CAPTURE_FINAL_ART === '1') {
  await captureFinalArtScreens();
}
await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('done', label, ROOT);