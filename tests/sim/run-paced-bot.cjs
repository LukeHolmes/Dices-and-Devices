"use strict";

const SIM_VIRTUAL_STEP_MS = Number(process.env.SIM_VIRTUAL_STEP_MS || 16);

async function ensurePlaywrightClock(context) {
  if (process.env.SIM_SEED_GAME !== "1") return false;
  if (context.__gbClockInstalled) return true;
  await context.clock.install({ time: new Date("2026-01-01T00:00:00.000Z") });
  context.__gbClockInstalled = true;
  return true;
}

async function pumpVirtualClock(page, botPromise, { maxSteps }) {
  const ctx = page.context();
  let settled = false;
  botPromise.finally(() => {
    settled = true;
  });
  const budget = Math.max(8000, maxSteps * 128);
  for (let tick = 0; tick < budget && !settled; tick += 1) {
    const pendingMs = await page.evaluate(() => {
      const ms = window.__GB_SIM_PENDING_CLOCK_MS__ || 0;
      window.__GB_SIM_PENDING_CLOCK_MS__ = 0;
      return ms;
    });
    const advance = Math.max(SIM_VIRTUAL_STEP_MS, pendingMs || SIM_VIRTUAL_STEP_MS);
    await ctx.clock.runFor(advance);
    await page.evaluate(() => {
      const done = window.__GB_SIM_CLOCK_RESOLVE__;
      if (done) {
        window.__GB_SIM_CLOCK_RESOLVE__ = null;
        done();
      }
    });
  }
  if (!settled) {
    await ctx.clock.runFor(SIM_VIRTUAL_STEP_MS);
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
        } else if (typeof GutterbonesReplay !== "undefined" && GutterbonesReplay.mulberry32) {
          window.__GB_SIM_STEP_SYNC__ = true;
          const gameRandom = GutterbonesReplay.mulberry32(opts.seed);
          window.__GB_SIM_GAME_RANDOM__ = () => gameRandom();
          Math.random = () => gameRandom();
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

module.exports = {
  ensurePlaywrightClock,
  runBotEvaluateWithClock,
  SIM_VIRTUAL_STEP_MS,
};