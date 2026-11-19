/* Injected via Playwright addInitScript when SIM_SEED_GAME=1 (harness only). */
(function harnessDeterminismShim() {
  if (window.__GB_SIM_HARNESS_SHIM__) return;
  window.__GB_SIM_HARNESS_SHIM__ = true;

  window.__GB_SIM_INSTALL_GAME_SEED__ = function installGameSeed(seed) {
    const mulberry32 = (a) => {
      return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const draw = mulberry32((Number(seed) || 1) >>> 0);
    const rng = () => draw();
    Math.random = rng;
    window.__GB_SIM_GAME_RANDOM__ = rng;
    window.__GB_SIM_STEP_SYNC__ = true;
    return true;
  };

  window.__GB_SIM_HARNESS_REV__ = "2026-11-18-harness-seed-v1";
})();