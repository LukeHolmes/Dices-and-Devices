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
  { name: "390x844", width: 390, height: 844, minDiceRowPct: 8.4, minAlleyWidthPct: 0, mobile: true },
  { name: "1366x768", width: 1366, height: 768, minDiceRowPct: 5.2, minAlleyWidthPct: 62, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, minDiceRowPct: 4.2, minAlleyWidthPct: 64, mobile: false },
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
    assert.ok(m.usedRowHeight > 0 && m.usedRowHeight <= 22, `used row height ${m.usedRowHeight}px`);
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
