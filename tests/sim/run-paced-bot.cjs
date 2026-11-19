"use strict";

const SIM_VIRTUAL_STEP_MS = Number(process.env.SIM_VIRTUAL_STEP_MS || 16);

function clockModeActive() {
  return process.env.SIM_SEED_GAME === "1" && process.env.SIM_NODE_PACED !== "0";
}

async function ensurePlaywrightClock(context) {
  if (!clockModeActive()) return false;
  if (context.__gbClockInstalled) return true;
  await context.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
  context.__gbClockInstalled = true;
  return true;
}

async function drainClockCallbacks(page) {
  await page.evaluate(() => {
    const done = window.__GB_SIM_CLOCK_RESOLVE__;
    if (done) {
      window.__GB_SIM_CLOCK_RESOLVE__ = null;
      done();
    }
  });
}

async function advanceVirtualTime(page, ms) {
  const ctx = page.context();
  if (!ctx.__gbClockInstalled) return;
  const step = Math.max(1, SIM_VIRTUAL_STEP_MS);
  let left = Math.max(0, Number(ms) || 0);
  while (left > 0) {
    const chunk = Math.min(step, left);
    await ctx.clock.runFor(chunk);
    await drainClockCallbacks(page);
    left -= chunk;
  }
}

async function settleBootTimers(page, { totalMs = 4000 } = {}) {
  await advanceVirtualTime(page, totalMs);
}

async function waitForPredicateWithClock(page, expression, { timeoutMs = 120_000, stepMs = 32 } = {}) {
  const ctx = page.context();
  const useClock = Boolean(ctx.__gbClockInstalled);
  const wallDeadline = Date.now() + timeoutMs;
  const body = typeof expression === "string" ? expression : "!!window.__GB_E2E__";
  while (Date.now() < wallDeadline) {
    const ok = await page.evaluate(`(() => Boolean(${body}))()`);
    if (ok) return;
    if (useClock) {
      await ctx.clock.runFor(stepMs);
      await drainClockCallbacks(page);
    } else {
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }
  throw new Error("waitForPredicateWithClock: timeout");
}

async function gotoWithClock(page, url, options = {}) {
  const res = await page.goto(url, options);
  if (clockModeActive() && page.context().__gbClockInstalled) {
    await settleBootTimers(page, { totalMs: Number(process.env.SIM_BOOT_SETTLE_MS || 0) });
  }
  return res;
}

async function reloadWithClock(page, options = {}) {
  const res = await page.reload(options);
  if (clockModeActive() && page.context().__gbClockInstalled) {
    await settleBootTimers(page, { totalMs: Number(process.env.SIM_BOOT_SETTLE_MS || 0) });
  }
  return res;
}

async function pumpVirtualClock(page, botPromise, { maxSteps }) {
  const ctx = page.context();
  let settled = false;
  botPromise.finally(() => {
    settled = true;
  });
  const budget = Math.max(8000, maxSteps * 128);
  for (let tick = 0; tick < budget && !settled; tick += 1) {
    const snap = await page.evaluate(() => ({
      pending: window.__GB_SIM_PENDING_CLOCK_MS__ || 0,
      armed: Boolean(window.__GB_SIM_CLOCK_RESOLVE__),
    }));
    if (!snap.armed) {
      await new Promise((r) => setTimeout(r, 1));
      continue;
    }
    await page.evaluate(() => {
      window.__GB_SIM_PENDING_CLOCK_MS__ = 0;
    });
    if (snap.pending <= 0) {
      await drainClockCallbacks(page);
      continue;
    }
    const advance = Math.max(SIM_VIRTUAL_STEP_MS, snap.pending);
    await ctx.clock.runFor(advance);
    await drainClockCallbacks(page);
  }
  return await botPromise;
}

async function runBotEvaluateWithClock(page, evaluatePayload) {
  const ctx = page.context();
  await ensurePlaywrightClock(ctx);
  const botPromise = page.evaluate(
    async ({
      botSource,
      opts,
      linkObs: linkObsFlag,
      policyRev,
      seedGame: seedGameFlag,
      traceReplay: traceReplayFlag,
    }) => {
      window.__GB_SIM_AWAIT_CLOCK__ = true;
      window.__GB_SIM_PENDING_CLOCK_MS__ = 0;
      window.__GB_SIM_CLOCK_RESOLVE__ = null;
      window.__GB_SIM_STEP_TRACE__ = [];
      if (typeof window.__GB_SIM_INSTALL_VISUAL_DETERMINISM__ === "function") {
        window.__GB_SIM_INSTALL_VISUAL_DETERMINISM__();
      }
      if (linkObsFlag && typeof GutterbonesSimLinkObserver !== "undefined") {
        window.__GB_SIM_TELEM__ = window.__GB_SIM_TELEM__ || {
          hands: [],
          roundEvents: [],
          shopPolicySteps: [],
        };
        window.__GB_SIM_TELEM__.linkObserver = GutterbonesSimLinkObserver.create({
          enabled: true,
          policyRevision: policyRev,
        });
      }
      // eslint-disable-next-line no-eval
      const play = eval("(" + botSource + ")");
      if (seedGameFlag) {
        if (typeof window.__GB_SIM_INSTALL_GAME_SEED__ === "function") {
          window.__GB_SIM_INSTALL_GAME_SEED__(opts.seed);
          window.__GB_SIM_RNG_BOOT_LOCKED__ = true;
        } else if (typeof window.__GB_SIM_INSTALL_GAME_SEED__ === "function") {
          window.__GB_SIM_INSTALL_GAME_SEED__(opts.seed);
        } else if (typeof GutterbonesReplay !== "undefined" && GutterbonesReplay.mulberry32) {
          window.__GB_SIM_STEP_SYNC__ = true;
          const cosmetic = GutterbonesReplay.mulberry32(opts.seed + 1);
          const gameRandom = GutterbonesReplay.mulberry32(opts.seed);
          window.__GB_SIM_GAME_RANDOM__ = () => gameRandom();
          Math.random = () => cosmetic();
        }
      }
      if (traceReplayFlag) {
        window.__GB_SIM_TELEM__ = window.__GB_SIM_TELEM__ || {
          hands: [],
          roundEvents: [],
          shopPolicySteps: [],
          record(entry) {
            this.hands.push({ ...entry, at: this.hands.length });
          },
          recordRoundEvent(entry) {
            this.roundEvents.push({ ...entry, at: this.roundEvents.length });
          },
          recordShopPolicyStep(entry) {
            this.shopPolicySteps.push({ ...entry, at: this.shopPolicySteps.length });
          },
        };
        const telem = window.__GB_SIM_TELEM__;
        telem.replayEvents = [];
        for (const kind of ["record", "recordRoundEvent", "recordShopPolicyStep"]) {
          const record = telem[kind];
          telem[kind] = function replayWrapped(entry) {
            telem.replayEvents.push({ kind, entry });
            return record.call(this, entry);
          };
        }
      }
      try {
        return await play({ ...opts, traceSteps: true });
      } finally {
        delete window.__GB_SIM_AWAIT_CLOCK__;
        if (seedGameFlag) {
          delete window.__GB_SIM_GAME_RANDOM__;
          delete window.__GB_SIM_STEP_SYNC__;
        }
      }
    },
    evaluatePayload,
  );
  return pumpVirtualClock(page, botPromise, { maxSteps: evaluatePayload.opts.maxSteps });
}

async function prepareSimRunStart(page, gameSeed) {
  if (!clockModeActive()) return;
  await page.evaluate((seed) => {
    if (typeof window.__GB_SIM_INSTALL_GAME_SEED__ === "function") {
      window.__GB_SIM_INSTALL_GAME_SEED__(seed);
      window.__GB_SIM_RNG_DRAW_COUNT__ = 0;
    }
    const e2e = window.__GB_E2E__;
    if (!e2e || e2e.__simStartWrapped) return;
    const orig = e2e.startNewRun;
    if (typeof orig !== "function") return;
    e2e.__simStartWrapped = true;
    e2e.startNewRun = function simWrappedStartNewRun() {
      if (typeof window.__GB_SIM_UNLOCK_GAME_RNG__ === "function") {
        window.__GB_SIM_GAME_SEED__ = (Number(seed) || 1) >>> 0;
        window.__GB_SIM_UNLOCK_GAME_RNG__();
      } else if (typeof window.__GB_SIM_INSTALL_GAME_SEED__ === "function") {
        window.__GB_SIM_INSTALL_GAME_SEED__(seed);
      }
      return orig.call(this);
    };
  }, gameSeed);
}

async function installDeterministicNetwork(context) {
  if (!clockModeActive()) return;
  const blockFonts =
    process.env.SIM_BLOCK_REMOTE_FONTS !== "0"
    && !context.__gbFontRoutesInstalled;
  if (!blockFonts) return;
  await context.route(/fonts\.(googleapis|gstatic)\.com/i, (route) => route.abort());
  context.__gbFontRoutesInstalled = true;
}

module.exports = {
  clockModeActive,
  ensurePlaywrightClock,
  installDeterministicNetwork,
  runBotEvaluateWithClock,
  prepareSimRunStart,
  gotoWithClock,
  reloadWithClock,
  waitForPredicateWithClock,
  advanceVirtualTime,
  settleBootTimers,
  SIM_VIRTUAL_STEP_MS,
};