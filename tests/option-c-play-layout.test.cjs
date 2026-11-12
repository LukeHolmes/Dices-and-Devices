"use strict";
/**
 * Option C play layout: phone score sheet + desktop ledger panel.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const { createGame, plain } = require("./helpers/game.cjs");
const fixtures = require("./fixtures/runs.cjs");

const ROOT = path.join(__dirname, "..");
const RUN_KEY = "gutterbones1977:run:v1";

const TARGETS = [
  { name: "390x844", width: 390, height: 844, minDiceRowPct: 8.2, minAlleyWidthPct: 0, mobile: true },
  { name: "1366x768", width: 1366, height: 768, minDiceRowPct: 5.0, minAlleyWidthPct: 68, minLedgerPx: 335, maxLedgerPx: 400, mobile: false },
  { name: "1536x864", width: 1536, height: 864, minDiceRowPct: 4.6, minAlleyWidthPct: 69, minLedgerPx: 340, maxLedgerPx: 430, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, minDiceRowPct: 4.0, minAlleyWidthPct: 72, minLedgerPx: 380, maxLedgerPx: 430, mobile: false },
  { name: "2560x1440", width: 2560, height: 1440, minDiceRowPct: 3.15, minAlleyWidthPct: 78, minLedgerPx: 400, maxLedgerPx: 430, mobile: false },
];

const DESKTOP_ALLEY_BASELINE_PCT = 58;

let server;
let baseUrl;
let chromium;

before(async () => {
  chromium = require("playwright").chromium;
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function resumePostRoll(page, { withHandFx = false, usedCats = [] } = {}) {
  const payload = plain(
    createGame(fixtures.snapshot()).api.normalizeSavedRun(
      fixtures.run({
        phase: "PLAY",
        round: 4,
        score: 62,
        target: 161,
        hands: 2,
        discards: 2,
        gold: 28,
        hasRolled: true,
        dice: fixtures.dice([2, 2, 2, 3, 4]),
        activeBossId: "LOAN_SHARK",
        inventory: [
          { id: "ENGINE", name: "The Engine", instanceId: "optc-1" },
          { id: "FUSE_BOX", name: "Fuse Box", instanceId: "optc-2" },
        ],
        currentRouteEffect: { name: "BACK ALLEY", effects: ["Standard hustle"] },
        usedCats,
      }),
    ),
  );
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({
          pacing: "fast",
          reducedMotion: false,
          tutorialCompleted: true,
          skippedAlleyIntro: true,
        }),
      );
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: RUN_KEY, data: payload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
  await page.waitForSelector('[data-layout-key="play-dice-lane"]', { timeout: 45_000 });
  if (withHandFx) {
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.triggerRollHandOverlayFx?.());
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.freezeRollHandThrowAt?.(500));
    await page.waitForTimeout(400);
  }
}

const measurePlayLayout = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vpArea = vw * vh;
  const laneEls = [...document.querySelectorAll(".bone-die-btn")];
  let lanePct = 0;
  if (laneEls.length) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    laneEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      l = Math.min(l, rect.left);
      t = Math.min(t, rect.top);
      r = Math.max(r, rect.right);
      b = Math.max(b, rect.bottom);
    });
    lanePct = +(((r - l) * (b - t) * 100) / vpArea).toFixed(2);
  }
  const overlapsDieFace = (die, other) => {
    if (!die || !other) return false;
    const dr = die.getBoundingClientRect();
    const pr = other.getBoundingClientRect();
    const ix = Math.max(0, Math.min(dr.right, pr.right) - Math.max(dr.left, pr.left));
    const iy = Math.max(0, Math.min(dr.bottom, pr.bottom) - Math.max(dr.top, pr.top));
    return ix * iy > 24;
  };
  let pillOnFace = false;
  for (const slot of document.querySelectorAll(".bone-slot-wrap")) {
    const die = slot.querySelector(".bone-die-btn");
    const pill = slot.querySelector(".bone-pill-control");
    if (overlapsDieFace(die, pill)) pillOnFace = true;
  }
  const actionBar = document.querySelector('[data-layout-key="play-alley-controls"]');
  let pillOnActions = false;
  if (actionBar) {
    const ar = actionBar.getBoundingClientRect();
    for (const pill of document.querySelectorAll(".bone-pill-control")) {
      const pr = pill.getBoundingClientRect();
      const ix = Math.max(0, Math.min(pr.right, ar.right) - Math.max(pr.left, ar.left));
      const iy = Math.max(0, Math.min(pr.bottom, ar.bottom) - Math.max(pr.top, ar.top));
      if (ix * iy > 12) pillOnActions = true;
    }
  }
  const diceClipped = [...document.querySelectorAll(".bone-die-btn")].some((die) => {
    const r = die.getBoundingClientRect();
    return r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1;
  });
  const ledger = document.querySelector('[data-layout-key="play-ledger-column"]');
  const ledgerVisible = ledger && window.getComputedStyle(ledger).display !== "none";
  const scoreSheet = document.querySelector('[data-layout-key="play-mobile-score-sheet"]');
  const scoreSheetVisible = scoreSheet && window.getComputedStyle(scoreSheet).display !== "none";
  const collapsed = !!document.querySelector('[data-layout-key="mobile-score-sheet-collapsed"]');
  const expanded = !!document.querySelector(".mobile-score-sheet--expanded");
  const bestLine = document.querySelector(".mobile-score-best-line");
  const chips = [...document.querySelectorAll(".mobile-payout-chip")];
  const tapBad = chips.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 44 - 0.5 || r.height < 44 - 0.5;
  });
  const openBtn = document.querySelector('[data-layout-key="mobile-score-sheet-open"]');
  const openTapOk = !openBtn || (() => {
    const r = openBtn.getBoundingClientRect();
    return r.width >= 44 - 0.5 && r.height >= 44 - 0.5;
  })();
  const alley = document.querySelector('[data-layout-key="play-alley"]');
  const alleyWidthPct = alley
    ? +((alley.getBoundingClientRect().width * 100) / vw).toFixed(2)
    : 0;
  const ledgerWidthPx = ledger ? Math.round(ledger.getBoundingClientRect().width) : 0;
  const handSprite = document.querySelector(".gutter-roll-hand-sprite");
  let handSpritePx = 0;
  if (handSprite) {
    const hs = getComputedStyle(handSprite);
    handSpritePx = parseFloat(hs.width) || handSprite.getBoundingClientRect().width;
    handSpritePx = Math.round(handSpritePx);
  }
  const ledgerCompact = !!document.querySelector(".matchbook-ledger--compact");
  const compactRowCount = document.querySelectorAll(
    '[data-layout-key="play-ledger-column"] .score-row--compact',
  ).length;
  const moreRail = document.querySelector('[data-layout-key="payout-sheet-more"]');
  const moreRailVisible =
    moreRail &&
    window.getComputedStyle(moreRail).display !== "none" &&
    moreRail.getBoundingClientRect().height > 0;
  const pinnedBest = document.querySelector(
    '[data-layout-key="play-ledger-column"] .score-row-pinned.payout-tier-best',
  );
  const firstLedgerRow = document.querySelector(
    '[data-layout-key="play-ledger-column"] [data-payout-row].score-row--compact',
  );
  const usedThin = document.querySelector(
    '[data-layout-key="play-ledger-column"] .score-row--compact.payout-tier-done',
  );
  let usedRowHeight = 0;
  if (usedThin) usedRowHeight = usedThin.getBoundingClientRect().height;
  const pillTray = document.querySelector('[data-layout-key="play-pill-tray"]');
  let pillTrayTapOk = false;
  if (pillTray) {
    const r = pillTray.getBoundingClientRect();
    pillTrayTapOk = r.width >= 44 - 0.5 && r.height >= 44 - 0.5;
  }
  const underDiePills = [...document.querySelectorAll(".bone-pill-control")].filter((el) => {
    const st = window.getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden";
  }).length;
  const pillTrayPresent = !!document.querySelector('[data-layout-key="play-pill-tray"]');
  return {
    lanePct,
    pillOnFace,
    pillOnActions,
    underDiePills,
    pillTrayTapOk,
    pillTrayPresent,
    diceClipped,
    ledgerVisible,
    scoreSheetVisible,
    collapsed,
    expanded,
    bestLineOk: !!bestLine && (bestLine.textContent || "").includes("Best:"),
    chipCount: chips.length,
    tapBad: tapBad.length,
    openTapOk,
    alleyWidthPct,
    ledgerWidthPx,
    handSpritePx,
    ledgerCompact,
    compactRowCount,
    moreRailVisible: !!moreRailVisible,
    pinnedBest: !!pinnedBest,
    firstRowIsBest:
      !!firstLedgerRow && firstLedgerRow.getAttribute("data-payout-row") === "TOK",
    usedRowHeight,
  };
};

for (const vp of TARGETS) {
  test(`option C layout @ ${vp.name}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resumePostRoll(page);
      const m = await page.evaluate(measurePlayLayout);
      assert.ok(m.lanePct >= vp.minDiceRowPct, `dice row ${m.lanePct}% < ${vp.minDiceRowPct}%`);
      assert.equal(m.pillOnFace, false, "pill overlaps die face");
      assert.equal(m.diceClipped, false, "dice clipped");
      assert.equal(m.pillOnActions, false, "pill overlaps shuffle/roll");
      if (vp.mobile) {
        assert.equal(m.scoreSheetVisible, true, "mobile score sheet missing");
        assert.equal(m.collapsed, true, "expected collapsed sheet");
        assert.equal(m.expanded, false, "sheet should start collapsed");
        assert.equal(m.ledgerVisible, false, "desktop ledger visible on phone");
        assert.ok(m.chipCount >= 2 && m.chipCount <= 3, `chip count ${m.chipCount}`);
        assert.equal(m.tapBad, 0, "payout chips under 44px");
        assert.equal(m.openTapOk, true, "SCORE affordance under 44px");
        assert.equal(m.bestLineOk, true, "best-play line missing");
        assert.equal(m.underDiePills, 0, "legacy under-die pill buttons visible");
        assert.equal(m.pillTrayTapOk, true, "pill tray under 44px");
      } else {
        assert.equal(m.underDiePills, 0, "legacy under-die pill buttons visible");
        assert.equal(m.pillTrayPresent, true, "pill tray missing");
        assert.equal(m.ledgerVisible, true, "desktop ledger hidden");
        assert.equal(m.scoreSheetVisible, false, "mobile sheet visible on desktop");
        assert.equal(m.ledgerCompact, true, "compact matchbook class missing");
        assert.ok(m.compactRowCount >= 8, `compact rows ${m.compactRowCount}`);
        assert.equal(m.moreRailVisible, false, "collapsing +more rail visible");
        assert.equal(m.pinnedBest, true, "best row not pinned/highlighted");
        assert.equal(m.firstRowIsBest, true, "best row not first in ledger");
        assert.ok(
          m.alleyWidthPct >= vp.minAlleyWidthPct,
          `alley ${m.alleyWidthPct}% < ${vp.minAlleyWidthPct}%`,
        );
        assert.ok(
          m.alleyWidthPct > DESKTOP_ALLEY_BASELINE_PCT,
          `alley not wider than old 7/12 baseline (${m.alleyWidthPct}% vs ${DESKTOP_ALLEY_BASELINE_PCT}%)`,
        );
        if (vp.minLedgerPx) {
          assert.ok(
            m.ledgerWidthPx >= vp.minLedgerPx,
            `ledger ${m.ledgerWidthPx}px < ${vp.minLedgerPx}px`,
          );
        }
        if (vp.maxLedgerPx) {
          assert.ok(
            m.ledgerWidthPx <= vp.maxLedgerPx + 8,
            `ledger ${m.ledgerWidthPx}px > ${vp.maxLedgerPx}px cap`,
          );
        }
      }
    } finally {
      await browser.close();
    }
  });
}

test("desktop compact ledger — used row thins", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page, { usedCats: ["ONES"] });
    const m = await page.evaluate(measurePlayLayout);
    assert.ok(m.usedRowHeight >= 28 && m.usedRowHeight <= 36, `used row height ${m.usedRowHeight}px`);
    const aces = await page.$('[data-layout-key="play-ledger-column"] [data-payout-row="ONES"]');
    assert.ok(aces, "Aces row missing");
    const cls = await aces.evaluate((el) => el.className);
    assert.match(cls, /payout-tier-done/, "Aces not marked used");
    assert.match(cls, /score-row--compact/, "Aces not compact row");
  } finally {
    await browser.close();
  }
});

test("pill attach tray — select, highlight, attach, cancel, hold", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await resumePostRoll(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
    await page.waitForSelector(".pill-attach-tray--armed");
    const targets = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.countPillTargets());
    assert.equal(targets, 5, `expected 5 highlighted bones, got ${targets}`);
    await page.evaluate(() => document.querySelectorAll(".bone-die-btn")[2]?.click());
    await page.waitForTimeout(80);
    let attached = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.pillAttachedSlot());
    assert.equal(attached, 2, "attach slot 3");
    await page.waitForSelector('[data-layout-key="bone-pill-badge-3"]', { timeout: 5000 });
    await page.locator('[data-layout-key="bone-pill-badge-3"]').click();
    attached = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.pillAttachedSlot());
    assert.equal(attached, null, "badge detach failed");
    await page.evaluate(() => document.querySelectorAll(".bone-die-btn")[2]?.click());
    await page.waitForTimeout(80);
    const discardsBefore = await page.evaluate(() => {
      const t = document.querySelector('[data-layout-key="play-pill-tray"]');
      const m = (t?.textContent || "").match(/PILL · (\d+)/);
      return m ? Number(m[1]) : -1;
    });
    await page.evaluate(() => document.querySelectorAll(".bone-die-btn")[2]?.click());
    await page.waitForTimeout(400);
    const discardsAfter = await page.evaluate(() => {
      const t = document.querySelector('[data-layout-key="play-pill-tray"]');
      const m = (t?.textContent || "").match(/PILL · (\d+)/);
      return m ? Number(m[1]) : -1;
    });
    assert.equal(discardsAfter, discardsBefore - 1, "pill did not consume on second bone tap");
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
    await page.locator('[data-layout-key="play-pill-tray"]').click();
    const armed = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.pillTrayArmed());
    assert.equal(armed, false, "tray cancel failed");
    const heldBefore = await page.evaluate(() => {
      const die = document.querySelectorAll(".bone-die-btn")[0];
      return die?.classList.contains("bone-die-kept");
    });
    await page.evaluate(() => document.querySelectorAll(".bone-die-btn")[0]?.click());
    await page.waitForTimeout(80);
    const heldAfter = await page.evaluate(() => {
      const die = document.querySelectorAll(".bone-die-btn")[0];
      return die?.classList.contains("bone-die-kept");
    });
    assert.notEqual(heldBefore, heldAfter, "hold toggle did not run without armed pill");
  } finally {
    await browser.close();
  }
});

test("mobile score sheet — open, dismiss, score from sheet", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setMobileScoreSheetOpen(true));
    await page.waitForSelector(".mobile-score-sheet--expanded", { timeout: 8000 });
    let expanded = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.mobileScoreSheetExpanded());
    assert.equal(expanded, true, "open failed");
    const sheetTop = await page.evaluate(() => {
      const panel = document.querySelector(".mobile-score-sheet--expanded");
      return panel ? panel.getBoundingClientRect().top : 0;
    });
    assert.ok(sheetTop >= 844 * 0.35, `sheet too tall: top ${sheetTop}`);
    await page.locator('[data-layout-key="mobile-score-sheet-backdrop"]').click({
      position: { x: 24, y: 48 },
      timeout: 10_000,
    });
    await page.waitForTimeout(200);
    expanded = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.mobileScoreSheetExpanded());
    assert.equal(expanded, false, "backdrop dismiss failed");
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setMobileScoreSheetOpen(true));
    await page.waitForSelector(".mobile-score-sheet--expanded");
    await page.click('[data-layout-key="mobile-score-sheet-expanded"] [data-layout-key="payout-row-TOK"]');
    await page.waitForTimeout(400);
    expanded = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.mobileScoreSheetExpanded());
    assert.equal(expanded, false, "sheet should close after score");
    const used = await page.evaluate(() => !!document.querySelector('[data-layout-key="mobile-score-sheet-expanded"] [data-layout-key="payout-row-TOK"].payout-tier-done, [data-payout-row="TOK"].payout-tier-done'));
    assert.equal(used, true, "TOK not marked used after score");
  } finally {
    await browser.close();
  }
});

test("HUD polish — status bar, roll pips, warrant, contextual controls", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page);
    const bar = await page.$('[data-layout-key="play-status-bar"]');
    assert.ok(bar, "status bar missing");
    const barText = await bar.evaluate((el) => el.textContent || "");
    assert.match(barText, /\$\d+/, "cash visible on status bar");
    assert.match(barText, /\/161/, "quota target on status bar");
    assert.match(barText, /IOU \$/, "debt line visible on status bar");
    const hudClip = await page.evaluate(() => {
      const vw = window.innerWidth;
      const bad = [];
      document
        .querySelectorAll(
          '[data-layout-key="play-stash-open-mobile"], [data-layout-key="system-menu-street"], [data-layout-key="play-history-log"], [data-layout-key="boss-warrant-stamp"], [data-layout-key="play-status-bar"]',
        )
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1 || r.left < -1) bad.push(el.getAttribute("data-layout-key"));
        });
      return bad;
    });
    assert.deepEqual(hudClip, [], `HUD clipped: ${hudClip.join(", ")}`);
    const pillBadges = await page.$$eval(".bone-pill-badge", (els) =>
      els.filter((el) => {
        const st = window.getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity || 1) > 0.05;
      }).length,
    );
    assert.equal(pillBadges, 0, "pill badges visible without attachment");
    const bestLum = await page.evaluate(() => {
      const el = document.querySelector(".mobile-score-best-line");
      if (!el) return -1;
      const nums = window.getComputedStyle(el).color.match(/[\d.]+/g);
      if (!nums || nums.length < 3) return -1;
      const [r, g, b] = nums.map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    });
    assert.ok(bestLum > 0 && bestLum < 0.55, `best line contrast (lum ${bestLum})`);
    const legacyQuota = await page.$(".street-ledger-quota--legacy");
    const legacyVisible = legacyQuota
      ? await legacyQuota.evaluate((el) => window.getComputedStyle(el).display !== "none")
      : true;
    assert.equal(legacyVisible, false, "legacy quota row should be hidden");
    const pipsOn = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.rollsPipOnCount());
    assert.equal(pipsOn, 2, `roll pips on count ${pipsOn}`);
    const playsHud = await page.$(".street-ledger-icon--plays");
    assert.equal(playsHud, null, "plays counter box should be gone");
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.togglePlayStatusBreakdown());
    await page.waitForSelector('[data-layout-key="play-status-breakdown"]');
    assert.equal(await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.playStatusBreakdownOpen()), true);
    const warrantCompact = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.bossWarrantCompact());
    assert.equal(warrantCompact, true, "warrant should start compact");
    const ruleVisible = await page.evaluate(() => {
      const rule = document.querySelector(".boss-warrant-rule");
      if (!rule) return false;
      return window.getComputedStyle(rule).display !== "none";
    });
    assert.equal(ruleVisible, false, "warrant rule should be hidden when compact");
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.toggleBossWarrant());
    await page.waitForSelector('[data-layout-key="boss-warrant-detail"]');
    const scoreReady = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.playScoreReadyUi());
    assert.equal(scoreReady, true, "score-ready emphasis missing");
    const shuffle = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.shuffleControlDisplayed());
    const rollBtn = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.rollControlDisplayed());
    assert.equal(shuffle, false, "shuffle should hide when score-ready");
    assert.equal(rollBtn, false, "roll should hide when score-ready");
    const scoreLabel = await page.locator(".mobile-score-sheet-open").textContent();
    assert.match(scoreLabel || "", /SCORE NOW/i);
    const spent = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.spentProgramCount());
    assert.ok(spent >= 1, "expected at least one spent/collapsed program");
  } finally {
    await browser.close();
  }
});

test("phone pill armed — dice lane not clipped", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.setPillTrayArmed(true));
    await page.waitForSelector(".pill-attach-tray--armed");
    const clip = await page.evaluate(() => {
      const vw = window.innerWidth;
      return [...document.querySelectorAll(".bone-die-btn")].some((die) => {
        const r = die.getBoundingClientRect();
        return r.left < -1 || r.right > vw + 1;
      });
    });
    assert.equal(clip, false, "dice clipped when pill armed");
    const targets = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.countPillTargets());
    assert.equal(targets, 5, "pill targets present");
  } finally {
    await browser.close();
  }
});

test("desktop matchbook — used and bust rows collapse thin", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page, { usedCats: ["ONES"] });
    const rows = await page.evaluate(() => {
      const h = (el) => (el ? el.getBoundingClientRect().height : -1);
      const used = document.querySelector('[data-layout-key="play-ledger-column"] [data-payout-row="ONES"].payout-tier-done');
      const bust = document.querySelector('[data-layout-key="play-ledger-column"] .payout-tier-bust');
      return { used: h(used), bust: h(bust) };
    });
    assert.ok(rows.used >= 28 && rows.used <= 36, `used row height ${rows.used}px`);
    assert.ok(rows.bust >= 28 && rows.bust <= 36, `bust row height ${rows.bust}px`);
  } finally {
    await browser.close();
  }
});

test("alley critter crawl — cosmetic, non-blocking", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1&critters=force`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem(
        "gutterbones1977:settings:v1",
        JSON.stringify({ pacing: "fast", reducedMotion: false, tutorialCompleted: true, skippedAlleyIntro: true }),
      );
    });
    await resumePostRoll(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("rat"));
    await page.waitForSelector('[data-layout-key="alley-critter-crawl"]', { timeout: 8000 });
    const pe = await page.$eval('[data-layout-key="alley-critter-crawl"]', (el) => getComputedStyle(el).pointerEvents);
    assert.equal(pe, "none", "critter blocks pointer events");
    const laneBox = await page.$eval('[data-layout-key="play-dice-lane"]', (el) => {
      const r = el.getBoundingClientRect();
      return { b: r.bottom, t: r.top };
    });
    const critterBox = await page.$eval('[data-layout-key="alley-critter-crawl"]', (el) => {
      const r = el.getBoundingClientRect();
      return { b: r.bottom, t: r.top, w: r.width, h: r.height };
    });
    assert.ok(critterBox.w >= 70 && critterBox.w <= 100, `rat width ${critterBox.w}px`);
    assert.ok(critterBox.b <= laneBox.b + 2, "critter should stay in dice lane band");
    assert.ok(critterBox.t >= laneBox.t - 4, "critter should stay in dice lane band");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.forceAlleyCritter("roach"));
    await page.waitForSelector('[data-layout-key="alley-critter-crawl"]', { timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.alleyCritterActive()), true);
  } finally {
    await browser.close();
  }
});

test("phone HUD — warrant stamp and hardware tabs visible", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await resumePostRoll(page);
    const hud = await page.evaluate(() => ({
      warrant: !!document.querySelector('[data-layout-key="boss-warrant-stamp"]'),
      warrantW: document.querySelector('[data-layout-key="boss-warrant-stamp"]')?.getBoundingClientRect().width ?? 0,
      tabs: [...document.querySelectorAll(".hardware-rail-socket-label")].map((e) => (e.textContent || "").trim()),
    }));
    assert.equal(hud.warrant, true, "boss warrant missing");
    assert.ok(hud.warrantW >= 48, `warrant too narrow (${hud.warrantW}px)`);
    assert.ok(hud.tabs.some((t) => /engine/i.test(t)), "Engine tab missing");
    assert.ok(hud.tabs.some((t) => /fuse/i.test(t)), "Fuse Box tab missing");
  } finally {
    await browser.close();
  }
});

test("desktop roll hand sprite scales up on laptop", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const { width, height, minHandPx } of [
      { width: 1366, height: 768, minHandPx: 170 },
      { width: 1920, height: 1080, minHandPx: 175 },
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
      await resumePostRoll(page, { withHandFx: true });
      const handPx = await page.evaluate(() => {
        const el = document.querySelector(".gutter-roll-hand-sprite");
        return el ? Math.round(el.getBoundingClientRect().width) : 0;
      });
      assert.ok(handPx >= minHandPx, `${width}x${height} hand ${handPx}px < ${minHandPx}px`);
    }
  } finally {
    await browser.close();
  }
});

test("roll hand overlay visible during throw", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({
            pacing: "fast",
            reducedMotion: false,
            tutorialCompleted: true,
            skippedAlleyIntro: true,
          }),
        );
      },
      { key: RUN_KEY },
    );
    await resumePostRoll(page);
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.triggerRollHandOverlayFx());
    await page.waitForSelector('[data-layout-key="roll-hand-throw-overlay"]', { timeout: 8000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.freezeRollHandThrowAt(520));
    await page.waitForTimeout(60);
    const vis = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandVisibility());
    assert.equal(vis.ok, true, `hand not visible (clipArea ${vis.clipArea}, opacity ${vis.opacity})`);
    const px = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.sampleRollHandOpaquePixels());
    assert.equal(px.ok, true, px.reason || "hand pixels not sampled");
    assert.ok((px.opaque ?? 0) > 80, `hand too faint (opaque ${px.opaque})`);
  } finally {
    await browser.close();
  }
});

test("HUD polish — pre-roll shows roll only", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const payload = plain(
      createGame(fixtures.snapshot()).api.normalizeSavedRun(
        fixtures.run({
          phase: "PLAY",
          round: 4,
          score: 0,
          target: 161,
          hands: 3,
          discards: 3,
          gold: 28,
          hasRolled: false,
          dice: fixtures.dice([1, 1, 1, 1, 1]),
          activeBossId: "LOAN_SHARK",
        }),
      ),
    );
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}/index.html?layoutAudit=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, data }) => {
        localStorage.setItem(
          "gutterbones1977:settings:v1",
          JSON.stringify({ pacing: "fast", reducedMotion: true, tutorialCompleted: true, skippedAlleyIntro: true }),
        );
        localStorage.setItem(key, JSON.stringify(data));
      },
      { key: RUN_KEY, data: payload },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__GB_LAYOUT_AUDIT__, { timeout: 90_000 });
    await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.resumeSavedRun());
    await page.waitForSelector('[data-layout-key="play-roll-btn"]', { timeout: 45_000 });
    const shuffle = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.shuffleControlDisplayed());
    const rollBtn = await page.evaluate(() => window.__GB_LAYOUT_AUDIT__.rollControlDisplayed());
    assert.equal(shuffle, false, "shuffle hidden pre-roll");
    assert.equal(rollBtn, true, "roll visible pre-roll");
    const pips = await page.evaluate(() => document.querySelectorAll('[data-layout-key="play-rolls-pips"] .play-roll-pip--on').length);
    assert.equal(pips, 3, "roll pips reflect hands remaining");
  } finally {
    await browser.close();
  }
});
