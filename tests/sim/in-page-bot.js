async function runBotSession({ maxSteps, seed, strategy, stuckThreshold, maxFallbacks }) {
  window.__GB_SIM_BOT_SESSION__ = true;
  try {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = { _shopclicks: 0, _paytab: 0, _gambleExit: false };
  let fallbacks = 0;
  let stuck = 0;
  let lastSig = null;
  let maxRound = 1;
  let lastRound = 1;
  let lastPh = null;
  let started = false;

  const mulberry32 = (a) => {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rng = mulberry32((Number(seed) || 1) >>> 0);

  localStorage.removeItem("gutterbones1977:run:v1");

  const scan = () => {
    document.querySelectorAll("[data-pt]").forEach((e) => e.removeAttribute("data-pt"));
    const W = innerWidth;
    const H = innerHeight;
    const out = [];
    let i = 0;
    for (const b of document.querySelectorAll("button,[role=button]")) {
      if (b.disabled || !b.getClientRects().length) continue;
      const cs = getComputedStyle(b);
      if (cs.visibility === "hidden" || cs.pointerEvents === "none" || +cs.opacity === 0) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const t = (b.innerText || b.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (cx < 0 || cy < 0 || cx > W || cy > H) continue;
      const el = document.elementFromPoint(cx, cy);
      if (!(el && (b === el || b.contains(el)))) continue;
      b.setAttribute("data-pt", String(i));
      out.push({ i, t, lk: b.getAttribute("data-layout-key") || "", pr: b.getAttribute("data-payout-row") || "" });
      i++;
    }
    const st = window.__GB_E2E__ ? window.__GB_E2E__.getState() : null;
    return { btn: out, st };
  };

  const num = (t) => {
    const m = String(t).match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };

  const isCatRow = (b) => /\bLV\d/i.test(b.t) || (b.lk && b.lk.startsWith("payout-row-") && b.pr && b.pr !== "more");

  const bossIntroUp = () =>
    !!(document.querySelector('[data-layout-key="boss-intro-overlay"]')
      || window.__GB_E2E__?.isBossIntroVisible?.());

  const chooseInner = (btn, ph, st) => {
    const U = btn.map((b) => b.t.toUpperCase());
    const isThreatBadge = (idx) =>
      btn[idx].lk === "next-threat-badge-trigger" || btn[idx].lk === "next-threat-badge-close";
    const find = (...prefs) => {
      for (const p of prefs) {
        for (let k = 0; k < U.length; k++) {
          if (isThreatBadge(k)) continue;
          if (p === "NEXT" && (U[k].includes("THREAT") || U[k].includes("BOSS NOW"))) continue;
          if (U[k].startsWith(p)) return k;
        }
      }
      return null;
    };
    const findContains = (...prefs) => {
      for (const p of prefs) {
        for (let k = 0; k < U.length; k++) if (U[k].includes(p)) return k;
      }
      return null;
    };
    if (ph === "TITLE") return find("PLAY");
    if (ph === "LINEUP") {
      if (strategy === "edge" && rng() < 0.25) {
        const c = U.map((n, k) => (n.includes("N.Y.P.D.") ? k : -1)).filter((x) => x >= 0);
        if (c.length) return c[Math.floor(rng() * c.length)];
      }
      return find("NEW RUN");
    }
    if (ph === "RAP_SHEET" || ph === "VICTORY") return null;
    let k = find("CONTINUE", "NEXT", "GOT IT", "DISMISS");
    if (k != null && ph !== "SHOP" && ph !== "PLAY" && ph !== "CARVING") return k;
    const shopBot = strategy === "builder" || strategy === "greedy";
    if (shopBot && ph === "CARVING") {
      if (strategy === "builder") return null;
      const done = findContains("RETURN", "BACK TO", "CONFIRM", "DONE");
      log._carveTries = (log._carveTries || 0) + 1;
      if (log._carveTries > 6 && done != null) return done;
      const face = btn.findIndex((b) => /BLOOD|SHIV|GHOST|FUSE|WIRE|MULT/i.test(b.t));
      if (face >= 0) return face;
      const bone = btn.findIndex((b) => /BONE \d/i.test(b.t));
      if (bone >= 0) return bone;
      return done;
    }
    if (shopBot && ph === "SHOP") {
      const debt = Number(st?.debt) || 0;
      const gold = Number(st?.gold) || 0;
      const payDebt = findContains("PAY DEBT", "PAY DOWN", "CLEAR DEBT", "REDUCE DEBT");
      if (payDebt != null && debt >= 3 && gold > debt + 6) return payDebt;
      if (strategy === "builder") {
        const routes = btn.map((b, i) =>
          (b.lk === "shop-route-card" || U[i].includes("NEXT QUOTA") ? i : -1),
        ).filter((x) => x >= 0);
        if (routes.length && !st?.selectedShopPathId) {
          const hw = routes.find((i) => U[i].includes("HARDWARE") || U[i].includes("MOD") || U[i].includes("PAWN"));
          return hw != null ? hw : routes[0];
        }
        return null;
      }
      const scoreBuy = (i) => {
        const t = U[i];
        let w = 0;
        if (t.includes("ENGINE")) w += 100;
        else if (t.includes("FUSE BOX") || t.includes("FUSE_BOX")) w += 92;
        else if (t.includes("CROWBAR")) w += 88;
        else if (t.includes("BLOOD") || t.includes("SHIV")) w += 85;
        else if (t.includes("GHOST") || t.includes("WIRE")) w += 78;
        else if (t.includes("CARVE") || t.includes("FACE")) w += 72;
        else if (t.includes("DEBT COLLECTOR")) w += 55;
        const price = num(btn[i].t);
        if (price != null && price <= gold) w += 15;
        return w - (price || 12) * 0.22;
      };
      const buys = btn.map((_, i) => (btn[i].t.includes("$") && !U[i].includes("HIT") ? i : -1)).filter((x) => x >= 0);
      if (buys.length) {
        buys.sort((a, b) => scoreBuy(b) - scoreBuy(a));
        if (scoreBuy(buys[0]) > 8) return buys[0];
      }
      const routes = btn.map((b, i) =>
        (b.lk === "shop-route-card" || U[i].includes("NEXT QUOTA") ? i : -1),
      ).filter((x) => x >= 0);
      if (routes.length && !st?.selectedShopPathId) {
        const hw = routes.find((i) => U[i].includes("HARDWARE") || U[i].includes("MOD") || U[i].includes("PAWN"));
        return hw != null ? hw : routes[0];
      }
      const inv = Number(st?.inventoryCount) || 0;
      const hit = findContains("HIT THE STREETS");
      if (hit != null && st?.selectedShopPathId && (inv >= 1 || (st.round || 1) >= 4 || buys.length === 0)) return hit;
      return buys[0] != null ? buys[0] : null;
    }
    if (ph === "PLAY") {
      if (bossIntroUp()) {
        const cont = find("CONTINUE");
        if (cont != null) return cont;
        const tap = findContains("TAP TO CONTINUE");
        if (tap != null) return tap;
      }
      const cats = btn.map((b, i) => (isCatRow(b) ? i : -1)).filter((x) => x >= 0);
      const roll = find("ROLL");
      const hasRolled = window.__GB_E2E__?.getHasRolled?.();
      if (cats.length) {
        const vals = cats.map((i) => [(U[i].includes("BUST") ? -1 : num(btn[i].t) || 0), i]);
        vals.sort((a, b) => b[0] - a[0]);
        const need = Math.max(0, (st.target || 0) - (st.score || 0)) / Math.max(1, st.hands || 1);
        if (!hasRolled && roll != null) return roll;
        if (strategy === "random") {
          if (rng() < 0.25 && roll != null) return roll;
          return cats[Math.floor(rng() * cats.length)];
        }
        if (strategy === "rapid") return cats[Math.floor(rng() * cats.length)] ?? roll;
        if (vals[0][0] >= need * 0.8 || roll == null) return vals[0][1];
        return roll;
      }
      if (roll != null) return roll;
      const t = log._paytab || 0;
      log._paytab = t + 1;
      k = findContains(t % 2 ? "PAYOUTS" : "ALLEY");
      if (k != null) return k;
      return null;
    }
    if (ph === "SHOP") {
      if (strategy === "builder") return null;
      const buys = btn.map((b, i) => (b.t.includes("$") && !U[i].includes("HIT") ? i : -1)).filter((x) => x >= 0);
      const hit = findContains("HIT THE STREETS");
      const routes = btn.map((b, i) =>
        b.lk === "shop-route-card" || U[i].includes("NEXT QUOTA") ? i : -1,
      ).filter((x) => x >= 0);
      if (hit != null && routes.length <= 1) return hit;
      if (routes.length && !st?.selectedShopPathId) {
        return strategy !== "greedy" ? routes[Math.floor(rng() * routes.length)] : routes[0];
      }
      log._shopclicks = (log._shopclicks || 0) + 1;
      if (strategy === "greedy" && buys.length && !st?.selectedShopPathId && routes.length > 1 && log._shopclicks % 6 < 2) {
        return buys[0];
      }
      if (hit != null && (st?.selectedShopPathId || !routes.length)) return hit;
      if (routes.length) return routes[0];
      return buys[0] != null ? buys[0] : null;
    }
    if (ph === "GAMBLE") {
      k = findContains("TAKE", "SAFE", "SKIP", "LEAVE", "CASH OUT");
      if (k != null) return k;
      if (strategy === "edge" && rng() < 0.15) {
        k = findContains("DOUBLE", "RISK");
        if (k != null) return k;
      }
    }
    if (ph === "CARVING") {
      if (strategy === "builder") return null;
      k = findContains("RETURN TO SHOP", "BACK TO BONES");
      if (k != null) return k;
      const bone = btn.findIndex((b) => /BONE \d/i.test(b.t));
      if (bone >= 0) return bone;
      const face = btn.findIndex((b) => /FACE \d/i.test(b.t));
      if (face >= 0) return face;
      return btn.length ? 0 : null;
    }
    return btn.length ? 0 : null;
  };

  const choose = (btn, ph, st) => {
    const U = btn.map((b) => b.t.toUpperCase());
    for (let k = 0; k < btn.length; k++) if (btn[k].lk === "stuck-recovery-continue") return k;
    for (const p of ["TAP TO CONTINUE", "SKIP — STRAIGHT", "CLEARED"]) {
      for (let k = 0; k < U.length; k++) if (U[k].includes(p)) return k;
    }
    return chooseInner(btn, ph, st);
  };

  const e2eUnstick = (ph) => {
    const e = window.__GB_E2E__;
    if (!e) return false;
    try {
      e.skipIntroOverlays?.();
      e.dismissBossIntro?.();
      e.dismissOverlays?.();
    } catch (err) {
      return false;
    }
    if (ph === "CARVING") {
      const exit = document.querySelector('[data-layout-key="carving-exit"]');
      if (exit) {
        exit.click();
        return true;
      }
      const tile = document.querySelector("button.carving-die-tile");
      if (tile) {
        tile.click();
        return true;
      }
      return false;
    }
    if (ph !== "PLAY") return false;
    const hasRolled = e.getHasRolled?.();
    if (!hasRolled) {
      if (!e.isRollDisabled?.()) {
        const rollBtn = document.querySelector('[data-tutorial="roll-btn"]:not([disabled])');
        if (rollBtn) {
          rollBtn.click();
          return true;
        }
      }
      e.rollOnce?.();
      return true;
    }
    e.advanceRunPhase?.();
    e.focusPlayPayoutsTab?.();
    if (innerWidth < 900) {
      const tabs = document.querySelectorAll("button.gb-tappable-label");
      for (const tab of tabs) {
        if ((tab.innerText || "").toUpperCase().includes("PAYOUTS")) {
          tab.click();
          break;
        }
      }
    }
    const best = e.pickBestOpenCategory?.();
    if (best) {
      const btn = document.querySelector(`button[data-payout-row="${best.catId}"]:not([disabled])`);
      if (btn) {
        btn.click();
        return true;
      }
    }
    const rows = [...document.querySelectorAll('button[data-payout-row]:not([disabled])')].filter(
      (r) => r.getAttribute("data-payout-row") !== "more",
    );
    if (rows.length) {
      rows[0].click();
      return true;
    }
    return false;
  };

  try {
    window.__GB_E2E__.goLineup();
    if (strategy === "builder" && window.__GB_E2E__.selectPersonaByIndex) {
      if (!window.__GB_E2E__.selectPersonaByIndex(0)) {
        if (!window.__GB_E2E__.selectPersonaByIndex(3)) {
          window.__GB_E2E__.selectPersonaByIndex(1);
        }
      }
    } else {
      window.__GB_E2E__.selectFirstPersona();
    }
    window.__GB_E2E__.seedRunRng?.(seed);
    window.__GB_E2E__.startNewRun();
    window.__GB_E2E__.skipIntroOverlays?.();
    await wait(120);
    window.__GB_E2E__.skipIntroOverlays?.();
  } catch (e) {
    return { stuck: true, reason: "boot_failed", detail: String(e), seed, strategy, steps: 0, maxRound: 1 };
  }
  await wait(400);

  for (let step = 0; step < maxSteps; step++) {
    const { btn, st } = scan();
    const ph = (st && st.phase) || "?";
    if (ph !== lastPh) {
      if (lastPh === "CARVING") log._carveTries = 0;
      lastPh = ph;
    }
    if (ph === "PLAY") started = true;
    if (st && (ph === "PLAY" || ph === "SHOP" || ph === "GAMBLE") && st.round > maxRound) {
      maxRound = st.round;
    }
    if (started && st && st.round != null && st.round < lastRound) {
      return {
        stuck: true,
        reason: "round_regression",
        maxRound,
        phase: ph,
        seed,
        strategy,
        steps: step,
      };
    }
    if (st && st.round != null) lastRound = st.round;

    if (ph === "VICTORY" || ph === "RAP_SHEET") {
      return {
        stuck: false,
        outcome: ph === "VICTORY" ? "WIN" : "BUST",
        maxRound,
        phase: ph,
        seed,
        strategy,
        steps: step + 1,
      };
    }

    if (ph === "GAMBLE") {
      log._gambleTries = (log._gambleTries || 0) + 1;
      if (log._gambleTries === 1 || log._gambleTries % 5 === 0) {
        window.__GB_E2E__.takeSafeCut?.();
        window.__GB_E2E__.abortGamble?.();
        const safeBtn = [...document.querySelectorAll("button")].find((b) =>
          (b.innerText || b.getAttribute("aria-label") || "").toUpperCase().includes("TAKE SAFE CUT"),
        );
        if (safeBtn && !safeBtn.disabled) safeBtn.click();
      }
      await wait(160);
      continue;
    }
    log._gambleTries = 0;

    if (st?.roundClearVisible) {
      window.__GB_E2E__?.finishRoundClear?.();
      await wait(120);
      continue;
    }

    const shopBot = strategy === "builder" || strategy === "greedy";
    if (shopBot && ph === "SHOP") {
      log._carvingPhase = false;
      log._shopPasses = (log._shopPasses || 0) + 1;
      const invNow = Number(st?.inventoryCount) || 0;
      const organicReady = strategy === "builder" && window.__GB_E2E__?.isOrganicChainReady?.();
      const minInv = strategy === "builder" ? 2 : 1;
      const shopRound = Number(st?.round) || 1;
      const kitStalled =
        strategy === "builder"
        && !organicReady
        && log._shopPasses > 10
        && shopRound >= 2;
      const builderStreets =
        strategy === "builder"
          ? organicReady || kitStalled || log._shopPasses > 28
          : organicReady
            || log._shopPasses > 18
            || window.__GB_E2E__?.shouldLeaveShopForPacing?.();
      if (log._shopPasses <= 20 && window.__GB_E2E__?.buyPreferredShopItem?.()) {
        await wait(90);
        continue;
      }
      if (
        st?.selectedShopPathId
        && (builderStreets || (strategy !== "builder" && (invNow >= minInv || log._shopPasses > 14 || (st.round || 1) >= 4)))
      ) {
        if (window.__GB_E2E__?.hitStreets?.()) {
          log._shopPasses = 0;
          await wait(120);
          continue;
        }
      }
      const kitIncomplete = strategy === "builder" && !window.__GB_E2E__?.isOrganicChainReady?.();
      if (
        kitIncomplete
        && shopRound >= 2
        && log._shopPasses <= 18
        && window.__GB_E2E__?.refreshShopForChainKit?.()
      ) {
        await wait(90);
        continue;
      }
      if (
        shopRound < 3
        && log._shopPasses <= 2
        && window.__GB_E2E__?.refreshShopIfDry?.()
      ) {
        await wait(90);
        continue;
      }
      if (
        !st?.selectedShopPathId
        && (window.__GB_E2E__?.pickBuilderShopPath?.() || window.__GB_E2E__?.clickShopRouteCard?.())
      ) {
        await wait(80);
        continue;
      }
    }
    if (shopBot && ph === "CARVING") {
      if (!log._carvingPhase) {
        log._carvingPhase = true;
        log._carveTries = 0;
      }
      log._carveTries = (log._carveTries || 0) + 1;
      if (log._carveTries > 24) {
        log._carveTries = 0;
        if (window.__GB_E2E__?.abortCarving?.()) {
          await wait(80);
          continue;
        }
      }
      if (window.__GB_E2E__?.autoCarvePreferred?.()) {
        await wait(180);
        continue;
      }
      if (window.__GB_E2E__?.abortCarving?.()) {
        log._carveTries = 0;
        await wait(80);
        continue;
      }
    }

    const names = btn.map((b) => b.t);
    const sig = JSON.stringify([ph, st && st.score, st && st.gold, st && st.hands, st && st.round, names.slice(0, 12)]);
    stuck = sig === lastSig ? stuck + 1 : 0;
    lastSig = sig;

    if (started && ph === "PLAY" && st && st.hands === 0 && st.score >= st.target) {
      window.__GB_E2E__?.advanceRunPhase?.();
      window.__GB_E2E__?.dismissOverlays?.();
      await wait(120);
      continue;
    }
    if (started && ph === "PLAY" && st && st.hands === 0 && st.score < st.target) {
      window.__GB_E2E__.recoverLastHand?.();
      window.__GB_E2E__.dismissOverlays?.();
      await wait(160);
      continue;
    }

    if (stuck >= stuckThreshold) {
      const s = window.__GB_E2E__.getState();
      if (s.phase === "SHOP") {
        if (strategy === "builder" && !window.__GB_E2E__?.isOrganicChainReady?.()) {
          window.__GB_E2E__.buyPreferredShopItem?.() || window.__GB_E2E__.refreshShopForChainKit?.();
        } else {
          window.__GB_E2E__.clickShopRouteCard?.();
          window.__GB_E2E__.hitStreets();
        }
      }
      else if (s.phase === "GAMBLE") {
        window.__GB_E2E__.takeSafeCut?.();
        window.__GB_E2E__.abortGamble?.();
      } else if (s.phase === "PLAY") {
        window.__GB_E2E__.advanceRunPhase?.();
        window.__GB_E2E__.scoreFirstPayoutRow?.() || e2eUnstick("PLAY");
      } else if (s.phase === "CARVING") {
        window.__GB_E2E__.autoCarvePreferred?.() || window.__GB_E2E__.abortCarving?.() || e2eUnstick("CARVING");
      } else if (s.roundClearVisible) window.__GB_E2E__.finishRoundClear();
      else if (!e2eUnstick(ph)) window.__GB_E2E__.dismissOverlays();
      fallbacks++;
      if (fallbacks > maxFallbacks) {
        return {
          stuck: true,
          reason: "softlock_no_progress",
          detail: "fallbacks>" + maxFallbacks,
          maxRound,
          phase: ph,
          seed,
          strategy,
          steps: step,
        };
      }
      stuck = 0;
      await wait(80);
      continue;
    }

    if (ph === "PLAY") {
      window.__GB_E2E__?.skipIntroOverlays?.();
      window.__GB_E2E__?.dismissBossIntro?.();
      if (
        st?.roundClearVisible
        || bossIntroUp()
        || document.querySelector('[data-layout-key="score-breakdown-overlay"]')
        || document.querySelector('[data-layout-key="score-resolution-overlay"]')
      ) {
        window.__GB_E2E__?.dismissOverlays?.();
      }
      const locks = window.__GB_E2E__?.getPlayLocks?.();
      if (locks?.rolling || locks?.rollLocked) {
        await wait(60);
        continue;
      }
      if (!window.__GB_E2E__?.getHasRolled?.()) {
        window.__GB_E2E__?.rollOnce?.();
        await wait(50);
        continue;
      }
      if (
        (strategy === "builder" || strategy === "greedy")
        && window.__GB_E2E__?.autoPlayHand?.()
      ) {
        await wait(50);
        continue;
      }
      if (
        (strategy === "edge" || strategy === "random")
        && window.__GB_E2E__?.getHasRolled?.()
        && window.__GB_E2E__?.scoreFirstPayoutRow?.()
      ) {
        await wait(45);
        continue;
      }
      if (st?.score >= st?.target && st?.hands > 0) {
        window.__GB_E2E__?.advanceRunPhase?.();
        await wait(80);
        continue;
      }
      if (st?.roundClearVisible) {
        window.__GB_E2E__?.finishRoundClear?.();
        await wait(80);
        continue;
      }
      if (bossIntroUp()) {
        await wait(60);
        continue;
      }
    }

    let pick = choose(btn, ph, st || {});
    if (pick == null && ph === "PLAY") {
      window.__GB_E2E__.scoreFirstPayoutRow?.() || e2eUnstick(ph);
    }
    else if (pick != null) {
      const b = document.querySelector('[data-pt="' + pick + '"]');
      if (b) b.click();
    }
    await wait(strategy === "rapid" ? 25 : strategy === "greedy" ? 45 : 32);
  }

  window.__GB_E2E__.forceForfeitRun?.();
  await wait(600);
  const afterForfeit = window.__GB_E2E__.getState();
  if (afterForfeit.phase === "RAP_SHEET" || afterForfeit.phase === "VICTORY") {
    return {
      stuck: false,
      outcome: afterForfeit.phase === "VICTORY" ? "WIN" : "BUST",
      maxRound,
      phase: afterForfeit.phase,
      seed,
      strategy,
      steps: maxSteps,
      detail: "sim_forfeit_escape",
    };
  }

  const final = window.__GB_E2E__.getState();
  return {
    stuck: true,
    reason: "incomplete",
    detail: "max_steps:" + maxSteps + ",phase:" + final.phase,
    outcome: "INCOMPLETE:" + final.phase,
    maxRound,
    phase: final.phase,
    seed,
    strategy,
    steps: maxSteps,
  };
  } finally {
    window.__GB_SIM_BOT_SESSION__ = false;
  }
}
