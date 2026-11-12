"use strict";
/**
 * Option C play layout: dice share, pills, mobile payout strip, coach hint.
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
  { name: "390x844", width: 390, height: 844, minDiceRowPct: 9.5 },
  { name: "1366x768", width: 1366, height: 768, minDiceRowPct: 5 },
  { name: "1920x1080", width: 1920, height: 1080, minDiceRowPct: 4 },
];

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

async function resumePostRoll(page) {
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
  await page.evaluate(() => window.__GB_LAYOUT_AUDIT__?.freezeRollHandThrowAt?.(520));
  await page.waitForTimeout(400);
}

const measurePlayLayout = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vpArea = vw * vh;
  const slots = [...document.querySelectorAll(".bone-slot-wrap")];
  let lanePct = 0;
  if (slots.length) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    slots.forEach((el) => {
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
  let handOnPill = false;
  const hand = document.querySelector(".gutter-roll-hand-sprite");
  const firstPill = document.querySelector(".bone-slot-wrap .bone-pill-control");
  for (const slot of document.querySelectorAll(".bone-slot-wrap")) {
    const die = slot.querySelector(".bone-die-btn");
    const pill = slot.querySelector(".bone-pill-control");
    if (overlapsDieFace(die, pill)) pillOnFace = true;
  }
  if (hand && firstPill) {
    const hr = hand.getBoundingClientRect();
    const pr = firstPill.getBoundingClientRect();
    const ix = Math.max(0, Math.min(hr.right, pr.right) - Math.max(hr.left, pr.left));
    const iy = Math.max(0, Math.min(hr.bottom, pr.bottom) - Math.max(hr.top, pr.top));
    handOnPill = ix * iy > 16;
  }
  const hint = document.querySelector('[data-layout-key="play-score-hint"]');
  const hintClipped =
    !hint
    || !(hint.textContent || "").includes("best preview")
    || hint.scrollHeight > hint.clientHeight + 2;
  const payoutRows = [...document.querySelectorAll('[data-layout-key="play-ledger-column"] [data-payout-row]:not([data-payout-row="more"])')].filter(
    (el) => {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return st.display !== "none" && r.width > 8 && r.height > 8;
    },
  );
  const strip = document.querySelector(".payout-sheet-rows--mobile-strip");
  const intelOverlap = (() => {
    const chips = [...document.querySelectorAll(".run-intel-chip")];
    for (let i = 0; i < chips.length; i += 1) {
      const a = chips[i].getBoundingClientRect();
      for (let j = i + 1; j < chips.length; j += 1) {
        const b = chips[j].getBoundingClientRect();
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ix > 4 && iy > 4) return true;
      }
    }
    return false;
  })();
  const diceClipped = [...document.querySelectorAll(".bone-die-btn")].some((die) => {
    const r = die.getBoundingClientRect();
    return r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1;
  });
  return {
    lanePct,
    pillOnFace,
    handOnPill,
    hintClipped,
    hintOk: hint && !hintClipped,
    payoutRows: payoutRows.length,
    mobileStrip: !!strip,
    intelOverlap,
    diceClipped,
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
      assert.equal(m.handOnPill, false, "hand overlaps first pill");
      assert.equal(m.diceClipped, false, "dice lane clipped");
      assert.equal(m.hintOk, true, "coach hint missing or clipped");
      assert.equal(m.intelOverlap, false, "run intel overlap");
      if (vp.width < 768) {
        assert.equal(m.mobileStrip, true, "mobile payout strip class");
        assert.ok(m.payoutRows >= 3, `payout rows visible ${m.payoutRows}`);
      }
    } finally {
      await browser.close();
    }
  });
}
