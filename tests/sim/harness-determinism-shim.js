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
    window.requestAnimationFrame = function patchedRaf(cb) {
      return window.setTimeout(() => cb(performance.now()), 16);
    };
    window.cancelAnimationFrame = function patchedCaf(id) {
      window.clearTimeout(id);
    };
  };

  const mulberry32 = (a) => {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const deriveSeed32 = (baseU32, label) => {
    const s = `${baseU32 >>> 0}:${label}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const BOOT_DRAW = 0.375;
  let gameDraw = null;
  let cosmeticDraw = null;

  window.__GB_SIM_RNG_DRAW_COUNT__ = 0;
  window.__GB_SIM_COSMETIC_DRAW_COUNT__ = 0;
  window.__GB_SIM_RNG_BOOT_LOCKED__ = true;
  window.__GB_SIM_LAST_GAME_DRAW_SITE__ = null;
  window.__GB_SIM_GAME_DRAW_LOG__ = [];

  const captureGameCallSite = () => {
    try {
      const stack = String(new Error().stack || "").split("\n");
      for (let i = 2; i < stack.length; i += 1) {
        const line = stack[i].trim();
        if (!line) continue;
        if (line.includes("harness-determinism-shim")) continue;
        if (line.includes("__GB_SIM_GAME_RANDOM__")) continue;
        if (line.includes("taggedGameRandom")) continue;
        return line.length > 140 ? `${line.slice(0, 137)}...` : line;
      }
    } catch (_) {
      /* ignore */
    }
    return "(unknown)";
  };

  const pushGameDrawRecord = (n, site, value) => {
    const log = window.__GB_SIM_GAME_DRAW_LOG__;
    if (log.length >= 25000) return;
    log.push({ n, site, v: value });
  };

  const taggedGameRandom = () => {
    if (window.__GB_SIM_RNG_BOOT_LOCKED__) return BOOT_DRAW;
    if (!gameDraw) return BOOT_DRAW;
    const n = (window.__GB_SIM_RNG_DRAW_COUNT__ = (window.__GB_SIM_RNG_DRAW_COUNT__ || 0) + 1);
    const site = captureGameCallSite();
    window.__GB_SIM_LAST_GAME_DRAW_SITE__ = site;
    const value = gameDraw();
    pushGameDrawRecord(n, site, value);
    return value;
  };

  const cosmeticRandom = () => {
    if (window.__GB_SIM_RNG_BOOT_LOCKED__) return BOOT_DRAW;
    if (!cosmeticDraw) return BOOT_DRAW;
    window.__GB_SIM_COSMETIC_DRAW_COUNT__ = (window.__GB_SIM_COSMETIC_DRAW_COUNT__ || 0) + 1;
    return cosmeticDraw();
  };

  window.__GB_SIM_INSTALL_GAME_SEED__ = function installGameSeed(seed) {
    const seedU32 = (Number(seed) || 1) >>> 0;
    window.__GB_SIM_GAME_SEED__ = seedU32;
    const gameSeed = deriveSeed32(seedU32, "game");
    const cosmeticSeed = deriveSeed32(seedU32, "cosmetic");
    gameDraw = mulberry32(gameSeed);
    cosmeticDraw = mulberry32(cosmeticSeed);
    window.__GB_SIM_RNG_DRAW_COUNT__ = 0;
    window.__GB_SIM_COSMETIC_DRAW_COUNT__ = 0;
    window.__GB_SIM_GAME_DRAW_LOG__ = [];
    window.__GB_SIM_LAST_GAME_DRAW_SITE__ = null;
    Math.random = cosmeticRandom;
    window.__GB_SIM_GAME_RANDOM__ = taggedGameRandom;
    return true;
  };

  window.__GB_SIM_RESET_COSMETIC_STREAM__ = function resetCosmeticStream() {
    if (window.__GB_SIM_GAME_SEED__ == null) return false;
    const cosmeticSeed = deriveSeed32(window.__GB_SIM_GAME_SEED__, "cosmetic");
    cosmeticDraw = mulberry32(cosmeticSeed);
    window.__GB_SIM_COSMETIC_DRAW_COUNT__ = 0;
    return true;
  };

  window.__GB_SIM_UNLOCK_GAME_RNG__ = function unlockGameRng() {
    window.__GB_SIM_RNG_BOOT_LOCKED__ = false;
    if (window.__GB_SIM_GAME_SEED__ != null) {
      window.__GB_SIM_INSTALL_GAME_SEED__(window.__GB_SIM_GAME_SEED__);
    }
    return true;
  };

  Math.random = cosmeticRandom;
  window.__GB_SIM_GAME_RANDOM__ = taggedGameRandom;
  window.__GB_SIM_STEP_SYNC__ = true;

  window.__GB_SIM_HARNESS_REV__ = "2026-11-19-harness-clock-v4b";
})();