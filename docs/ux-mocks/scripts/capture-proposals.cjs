"use strict";
/**
 * High-fidelity UX proposal screenshots from production index.html (real dice, hand, alley).
 * Injects mock-only CSS — no index.html edits.
 * Usage: node docs/ux-mocks/scripts/capture-proposals.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { chromium } = require("playwright");
const { createGame, plain } = require("../../../tests/helpers/game.cjs");
const fixtures = require("../../../tests/fixtures/runs.cjs");

const ROOT = path.join(__dirname, "../../..");
const OUT = path.join(ROOT, "docs/ux-mocks/mock-screenshots");
const PROPS = path.join(ROOT, "docs/ux-mocks/proposals");
const RUN_KEY = "gutterbones1977:run:v1";

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "1366x768", width: 1366, height: 768 },
  { id: "1920x1080", width: 1920, height: 1080 },
];

const DICE_ROW_THRESH = {
  "390x844": 8,
  "1366x768": 5,
  "1920x1080": 5,
};

const OPTIONS = [
  { id: "a", css: "option-a.css", prefix: "option-a" },
  { id: "b", css: "option-b.css", prefix: "option-b" },
  { id: "c", css: "option-c.css", prefix: "option-c" },
];

function loadProposalCss(filename) {
  let raw = fs.readFileSync(path.join(PROPS, filename), "utf8");
  raw = raw.replace(/@import\s+url\(["']?\.\/shared\.css["']?\)\s*;?/g, "");
  const shared = fs.readFileSync(path.join(PROPS, "shared.css"), "utf8");
  return `${shared}\n${raw}`;
}

function fixturePostRoll() {
  return fixtures.run({
    phase: "PLAY",
    round: 4,
    score: 62,
    target: 161,
    hands: 2,
    discards: 2,
    gold: 28,
    hasRolled: true,
    flowStreak: 2,
    dice: fixtures.dice([2, 2, 2, 3, 4]),
    activeBossId: "LOAN_SHARK",
    inventory: [
      { id: "ENGINE", name: "The Engine", instanceId: "ux-mock-1" },
      { id: "FUSE_BOX", name: "Fuse Box", instanceId: "ux-mock-2" },
    ],
    currentRouteEffect: {
      name: "BACK ALLEY",
      effects: ["Standard hustle"],
    },
  });
}

const measureDiceSpace = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vpArea = vw * vh;
  const measureEl = (sel, name) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return { name, hidden: true, display: style.display };
    }
    const r = el.getBoundingClientRect();
    const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const visibleArea = visW * visH;
    const clipOut =
      r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2;
    return {
      name,
      widthPx: Math.round(r.width),
      heightPx: Math.round(r.height),
      topPx: Math.round(r.top),
      leftPx: Math.round(r.left),
      visibleAreaPx: Math.round(visibleArea),
      pctOfViewport: +(100 * (visibleArea / vpArea)).toFixed(2),
      pctOfViewportHeight: +(100 * (r.height / vh)).toFixed(2),
      clippedAtViewportEdge: clipOut,
    };
  };
  const wraps = [...document.querySelectorAll(".play-dice-lane .bone-slot-wrap")];
  let boneUnion = null;
  if (wraps.length) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    wraps.forEach((el) => {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    const visW = Math.max(0, Math.min(right, vw) - Math.max(left, 0));
    const visH = Math.max(0, Math.min(bottom, vh) - Math.max(top, 0));
    boneUnion = {
      name: "dice-bones-union",
      widthPx: Math.round(w),
      heightPx: Math.round(h),
      visibleAreaPx: Math.round(visW * visH),
      pctOfViewport: +(100 * ((visW * visH) / vpArea)).toFixed(2),
      clippedAtViewportEdge: left < -2 || top < -2 || right > vw + 2 || bottom > vh + 2,
    };
  }
  const dieBtns = [...document.querySelectorAll(".play-dice-lane .bone-die-btn")];
  let dieUnion = null;
  if (dieBtns.length) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    dieBtns.forEach((el) => {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    const visW = Math.max(0, Math.min(right, vw) - Math.max(left, 0));
    const visH = Math.max(0, Math.min(bottom, vh) - Math.max(top, 0));
    dieUnion = {
      name: "dice-faces-union",
      visibleAreaPx: Math.round(visW * visH),
      pctOfViewport: +(100 * ((visW * visH) / vpArea)).toFixed(2),
    };
  }

  const overlapsDieFace = (die, other) => {
    if (!die || !other || other.offsetParent === null) return false;
    const dr = die.getBoundingClientRect();
    const pr = other.getBoundingClientRect();
    const ix = Math.max(0, Math.min(dr.right, pr.right) - Math.max(dr.left, pr.left));
    const iy = Math.max(0, Math.min(dr.bottom, pr.bottom) - Math.max(dr.top, pr.top));
    return ix * iy > 24;
  };

  const pillOnFace = (() => {
    for (const slot of document.querySelectorAll(".bone-slot-wrap")) {
      const die = slot.querySelector(".bone-die-btn");
      const pill = slot.querySelector(".bone-pill-control");
      const intel = slot.querySelector(".bone-face-intel-btn");
      if (overlapsDieFace(die, pill) || overlapsDieFace(die, intel)) return true;
    }
    return false;
  })();

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

  return {
    viewport: { width: vw, height: vh },
    diceLane: measureEl('[data-layout-key="play-dice-lane"]', "dice-lane-row"),
    diceBonesUnion: boneUnion,
    diceFacesUnion: dieUnion,
    pillOverlapsFace: pillOnFace,
    runIntelChipOverlap: intelOverlap,
    alley: measureEl('[data-layout-key="play-alley"]', "dice-tray"),
    hand: measureEl(".gutter-roll-hand-sprite", "hand-sprite"),
    hud: measureEl('[data-layout-key="play-hud"]', "control-strip"),
    ledger: measureEl('[data-layout-key="play-ledger-column"]', "payout-ledger"),
  };
};

async function resumeFixture(page, builder) {
  const payload = plain(createGame(fixtures.snapshot()).api.normalizeSavedRun(builder()));
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
}

async function prepareScene(page, optionId) {
  await page.evaluate(
    (id) => {
      const root = document.getElementById("root-gutterbones");
      if (root) root.setAttribute("data-ux-mock", id);
      window.__GB_LAYOUT_AUDIT__?.stabilizePlayChromeForCapture?.();
      window.scrollTo(0, 0);
      document.querySelectorAll(".score-row-valid-accent, .payout-tier-live, .payout-tier-best").forEach((row) => {
        row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });
      const modsBtn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("MODS"));
      if (modsBtn?.getAttribute("aria-expanded") === "true") modsBtn.click();
      window.__GB_LAYOUT_AUDIT__?.triggerRollHandOverlayFx?.();
      window.__GB_LAYOUT_AUDIT__?.freezeRollHandThrowAt?.(520);
      const intelToggle = document.querySelector('[data-layout-key="run-intel-details-toggle"]');
      if (
        id === "b" &&
        window.innerWidth >= 768 &&
        intelToggle &&
        intelToggle.textContent?.includes("DETAILS")
      ) {
        intelToggle.click();
      }
    },
    optionId,
  );
  await page.waitForTimeout(350);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const cssByOption = Object.fromEntries(OPTIONS.map((o) => [o.id, loadProposalCss(o.css)]));

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(ROOT, rel.replace(/^\//, ""));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".css": "text/css" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), proposals: [] };

  try {
    for (const opt of OPTIONS) {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(`${baseUrl}/index.html?layoutAudit=1`, {
            waitUntil: "networkidle",
            timeout: 120_000,
          });
          await resumeFixture(page, fixturePostRoll);
          await page.addStyleTag({ content: cssByOption[opt.id] });
          await prepareScene(page, opt.id);
          await page.waitForTimeout(450);

          const metrics = await page.evaluate(measureDiceSpace);
          const outFile = `${opt.prefix}_${vp.id}.png`;
          await page.screenshot({ path: path.join(OUT, outFile), scale: "css" });

          const lane =
            metrics.diceLane?.pctOfViewport ??
            metrics.diceBonesUnion?.pctOfViewport ??
            "?";
          const clip = metrics.diceLane?.clippedAtViewportEdge ?? false;
          const minPct = DICE_ROW_THRESH[vp.id];
          const qa = [];
          if (typeof lane === "number" && lane < minPct) qa.push(`dice-row ${lane}% < ${minPct}%`);
          if (metrics.pillOverlapsFace) qa.push("pill overlaps face");
          if (metrics.runIntelChipOverlap) qa.push("run-intel overlap");
          if (clip) qa.push("dice clipped");
          const status = qa.length ? `WARN ${qa.join("; ")}` : "OK";
          console.log(`${status} ${opt.prefix} @ ${vp.id} dice-row-share=${lane}%`);
          report.proposals.push({
            option: opt.id,
            prefix: opt.prefix,
            viewport: vp.id,
            screenshot: `mock-screenshots/${outFile}`,
            metrics,
            qa: { issues: qa, diceRowSharePct: lane },
          });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  fs.writeFileSync(path.join(OUT, "proposal-measurements.json"), JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.join(OUT, "proposal-measurements.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
