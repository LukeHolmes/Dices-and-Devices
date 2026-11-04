async function runBotSession({ maxSteps, seed, strategy, stuckThreshold, maxFallbacks }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = { _shopclicks: 0 };
  let fallbacks = 0;
  let stuck = 0;
  let lastSig = null;
  let maxRound = 1;
  let lastRound = 1;
  let started = false;

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
      out.push({ i, t, lk: b.getAttribute("data-layout-key") || "" });
      i++;
    }
    const st = window.__GB_E2E__ ? window.__GB_E2E__.getState() : null;
    return { btn: out, st };
  };

  const num = (t) => {
    const m = String(t).match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };

  const chooseInner = (btn, ph, st) => {
    const U = btn.map((b) => b.t.toUpperCase());
    const find = (...prefs) => {
      for (const p of prefs) {
        for (let k = 0; k < U.length; k++) if (U[k].startsWith(p)) return k;
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
    if (ph === "LINEUP") return find("NEW RUN");
    if (ph === "RAP_SHEET" || ph === "VICTORY") return null;
    let k = find("CONTINUE", "NEXT", "GOT IT", "DISMISS");
    if (k != null && ph !== "SHOP") return k;
    if (ph === "PLAY") {
      const cats = btn.map((b, i) => (b.t.includes(" LV") ? i : -1)).filter((x) => x >= 0);
      const roll = find("ROLL");
      if (cats.length) {
        const vals = cats.map((i) => [(U[i].includes("BUST") ? -1 : num(btn[i].t) || 0), i]);
        vals.sort((a, b) => b[0] - a[0]);
        const need = Math.max(0, (st.target || 0) - (st.score || 0)) / Math.max(1, st.hands || 1);
        if (vals[0][0] >= need * 0.8 || roll == null) return vals[0][1];
        return roll;
      }
      return roll;
    }
    if (ph === "SHOP") {
      const buys = btn.map((b, i) => (b.t.includes("$") && !U[i].includes("HIT") ? i : -1)).filter((x) => x >= 0);
      const hit = findContains("HIT THE STREETS");
      const routes = btn.map((b, i) => (U[i].includes("NEXT QUOTA") ? i : -1)).filter((x) => x >= 0);
      if (routes.length && !st.selectedShopPathId && (log._shopclicks || 0) % 8 >= 3) return routes[0];
      log._shopclicks = (log._shopclicks || 0) + 1;
      if (strategy === "greedy" && buys.length && log._shopclicks % 8 < 4) return buys[0];
      if (hit != null && log._shopclicks % 8 >= 4) return hit;
      return hit != null ? hit : buys[0] != null ? buys[0] : null;
    }
    if (ph === "GAMBLE" && strategy === "greedy") {
      k = findContains("TAKE", "SAFE");
      if (k != null) return k;
    }
    return btn.length ? 0 : null;
  };

  const choose = (btn, ph, st) => {
    for (let k = 0; k < btn.length; k++) if (btn[k].lk === "stuck-recovery-continue") return k;
    for (const p of ["TAP TO CONTINUE", "CLEARED"]) {
      for (let k = 0; k < btn.length; k++) if (btn[k].t.toUpperCase().includes(p)) return k;
    }
    return chooseInner(btn, ph, st);
  };

  try {
    window.__GB_E2E__.goLineup();
    window.__GB_E2E__.selectFirstPersona();
    window.__GB_E2E__.startNewRun();
  } catch (e) {
    return { stuck: true, reason: "boot_failed", detail: String(e), seed, strategy };
  }
  await wait(400);

  for (let step = 0; step < maxSteps; step++) {
    const { btn, st } = scan();
    const ph = (st && st.phase) || "?";
    if (ph === "PLAY") started = true;
    if (st && st.round > maxRound) maxRound = st.round;
    if (started && st && st.round != null && st.round < lastRound) {
      return { stuck: true, reason: "round_regression", maxRound, phase: ph, seed, strategy, steps: step };
    }
    if (st && st.round != null) lastRound = st.round;

    if (ph === "VICTORY" || ph === "RAP_SHEET") {
      return { stuck: false, outcome: ph === "VICTORY" ? "WIN" : "BUST", maxRound, phase: ph, seed, strategy, steps: step };
    }

    const names = btn.map((b) => b.t);
    const sig = JSON.stringify([ph, st && st.score, st && st.gold, st && st.hands, st && st.round, names.slice(0, 10)]);
    stuck = sig === lastSig ? stuck + 1 : 0;
    lastSig = sig;

    if (started && ph === "PLAY" && st && st.hands === 0 && st.score >= st.target) {
      window.__GB_E2E__.dismissOverlays();
      window.__GB_E2E__.forceRoundWin();
      await wait(120);
      continue;
    }

    if (stuck >= stuckThreshold) {
      const s = window.__GB_E2E__.getState();
      if (s.phase === "SHOP") window.__GB_E2E__.hitStreets();
      else if (s.roundClearVisible) window.__GB_E2E__.finishRoundClear();
      else window.__GB_E2E__.dismissOverlays();
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

    const pick = choose(btn, ph, st || {});
    if (pick != null) {
      const b = document.querySelector('[data-pt="' + pick + '"]');
      if (b) b.click();
    }
    await wait(strategy === "rapid" ? 25 : strategy === "greedy" ? 45 : 32);
  }

  const final = window.__GB_E2E__.getState();
  return {
    stuck: false,
    outcome: "INCOMPLETE:" + final.phase,
    maxRound,
    phase: final.phase,
    seed,
    strategy,
    steps: maxSteps,
  };
}
