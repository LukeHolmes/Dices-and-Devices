/* Injected via Playwright addInitScript when SIM_SEED_GAME=1 (harness only). */
(function harnessDeterminismShim() {
  if (window.__GB_SIM_HARNESS_SHIM__) return;
  window.__GB_SIM_HARNESS_SHIM__ = true;

  const BASE_SETTINGS = {
    pacing: "fast",
    reducedMotionPref: true,
    tutorialCompleted: true,
    skippedAlleyIntro: true,
  };
  const BASE_META = {
    totalRuns: 12,
    victories: 2,
    unlockedPersonaIds: ["STREET_RAT", "HUSTLER", "ENFORCER", "CARD_COUNTER", "GRINDER"],
    unlockedFaceIds: [
      "MULT_FACE",
      "GOLD_FACE",
      "BLOOD_6",
      "WILD_FACE",
      "ECHO_FACE",
      "GHOST_FACE",
      "SHIV_FACE",
      "WIREBAG_FACE",
      "MAGNET_FACE",
      "MARK_FACE",
      "FUSE_FACE",
      "DOUBLE_DOWN_FACE",
    ],
    unlockedHardwareIds: [
      "BOOKENDS",
      "LOADED_DIE",
      "BRASS_KNUCKLES",
      "BLACK_BOOK",
      "BURNER_PHONE",
      "CROWBAR",
      "ENGINE",
      "FUSE_BOX",
      "MIRROR_RIG",
      "DEBT_COLLECTOR",
      "HOT_STREAK_COIL",
      "CENTERPIECE",
    ],
    purchasedUpgradeIds: ["rig-shop", "rare-faces", "danger-faces", "chain-manual"],
  };

  window.__GB_SIM_APPLY_BASE_STORAGE__ = function applyBaseStorage() {
    try {
      localStorage.setItem("gutterbones1977:settings:v1", JSON.stringify(BASE_SETTINGS));
      localStorage.setItem("gutterbones1977:meta:v1", JSON.stringify(BASE_META));
      localStorage.removeItem("gutterbones1977:run:v1");
    } catch (_) {
      /* ignore */
    }
  };

  window.__GB_SIM_INSTALL_VISUAL_DETERMINISM__ = function installVisualDeterminism() {
    if (document.getElementById("gb-sim-harness-css")) return;
    const style = document.createElement("style");
    style.id = "gb-sim-harness-css";
    style.textContent =
      "*,*::before,*::after{animation-duration:0.001ms!important;animation-delay:0s!important;"
      + "transition-duration:0.001ms!important;transition-delay:0s!important;}";
    (document.head || document.documentElement).appendChild(style);
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function patchedRaf(cb) {
      return window.setTimeout(() => cb(performance.now()), 16);
    };
    window.cancelAnimationFrame = function patchedCaf(id) {
      window.clearTimeout(id);
    };
  };

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

  window.__GB_SIM_HARNESS_REV__ = "2026-11-19-harness-clock-v1";
})();