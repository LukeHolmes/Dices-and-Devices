"use strict";

function num(t) {
  const m = String(t).match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function chooseInner(btn, ph, strategy, rng, st, log) {
  const names = btn.map((b) => b.t);
  const U = names.map((n) => n.toUpperCase());
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
      for (let k = 0; k < U.length; k++) {
        if (U[k].includes(p)) return k;
      }
    }
    return null;
  };

  if (ph === "TITLE") return find("PLAY");
  if (ph === "LINEUP") {
    if (strategy === "edge" && rng() < 0.25) {
      const c = U.map((n, k) => (n.includes("N.Y.P.D.") ? k : -1)).filter((k) => k >= 0);
      if (c.length) return c[Math.floor(rng() * c.length)];
    }
    return find("NEW RUN");
  }
  if (ph === "RAP_SHEET" || ph === "VICTORY") return null;
  let k = find("CONTINUE", "NEXT", "GOT IT", "DISMISS");
  if (k != null && ph !== "SHOP") return k;
  if (ph === "PLAY") {
    const cats = btn
      .map((b, i) => (/\bLV\d/i.test(b.t) || (b.lk && b.lk.startsWith("payout-row-")) ? i : -1))
      .filter((i) => i >= 0);
    const roll = find("ROLL");
    if (cats.length) {
      const vals = cats.map((i) => {
        const bust = U[i].includes("BUST");
        return [(bust ? -1 : num(btn[i].t) || 0), i];
      });
      vals.sort((a, b) => b[0] - a[0]);
      const best = vals[0];
      log._paytab = 0;
      if (strategy === "random") {
        const r = rng();
        if (r < 0.25 && roll != null) return roll;
        if (r < 0.4 && btn.some((b) => b.t.startsWith("Bone slot"))) {
          const dice = btn.map((b, i) => (b.t.startsWith("Bone slot") ? i : -1)).filter((i) => i >= 0);
          return dice[Math.floor(rng() * dice.length)];
        }
        return cats[Math.floor(rng() * cats.length)];
      }
      if (strategy === "rapid") return cats[Math.floor(rng() * cats.length)] ?? roll;
      if (strategy === "edge") {
        const dice = btn.map((b, i) => (b.t.startsWith("Bone slot") ? i : -1)).filter((i) => i >= 0);
        if (dice.length && rng() < 0.3) return dice[Math.floor(rng() * dice.length)];
        if (rng() < 0.25) return cats[Math.floor(rng() * cats.length)];
        if (rng() < 0.1) return Math.floor(rng() * btn.length);
      }
      const need = Math.max(0, (st.target || 0) - (st.score || 0)) / Math.max(1, st.hands || 1);
      if (best[0] >= need * 0.8 || roll == null) return best[1];
      return roll;
    }
    if (roll != null) return roll;
    const t = log._paytab || 0;
    log._paytab = t + 1;
    k = findContains(t % 2 ? "PAYOUTS" : "ALLEY");
    if (k != null) return k;
    if (strategy !== "greedy" && rng() < 0.1) return Math.floor(rng() * btn.length);
    return null;
  }
  if (ph === "SHOP") {
    const buys = btn.map((b, i) => (b.t.includes("$") && !U[i].includes("HIT") ? i : -1)).filter((i) => i >= 0);
    const hit = findContains("HIT THE STREETS");
    const routes = btn.map((b, i) => (U[i].includes("NEXT QUOTA") ? i : -1)).filter((i) => i >= 0);
    if (routes.length && !st.selectedShopPathId && (log._shopclicks || 0) % 8 >= 3) {
      return strategy !== "greedy" ? routes[Math.floor(rng() * routes.length)] : routes[0];
    }
    const cnt = log._shopclicks || 0;
    log._shopclicks = cnt + 1;
    if (strategy === "greedy" && buys.length && cnt % 8 < 4) return buys[Math.floor(rng() * buys.length)];
    if (strategy !== "greedy" && rng() < 0.45) return Math.floor(rng() * btn.length);
    if (hit != null && cnt % 8 >= 4) return hit;
    if (buys.length && rng() < 0.4) return buys[Math.floor(rng() * buys.length)];
    return hit != null ? hit : Math.floor(rng() * btn.length);
  }
  if (ph === "GAMBLE" && strategy === "greedy") {
    k = findContains("TAKE", "SAFE");
    return k != null ? k : Math.floor(rng() * btn.length);
  }
  if (strategy === "greedy") {
    k = findContains("TAKE", "CONFIRM", "DONE", "LEAVE", "SKIP", "BACK");
    if (k != null && rng() < 0.6) return k;
  }
  return Math.floor(rng() * btn.length);
}

function choose(btn, ph, strategy, rng, st, log) {
  const U = btn.map((b) => b.t.toUpperCase());
  for (let k = 0; k < btn.length; k++) {
    if (btn[k].lk === "stuck-recovery-continue") return k;
  }
  const tap = (() => {
    for (const p of ["TAP TO CONTINUE", "SKIP — STRAIGHT", "CLEARED"]) {
      for (let k = 0; k < U.length; k++) {
        if (U[k].includes(p)) return k;
      }
    }
    return null;
  })();
  if (tap != null) return tap;
  const BAD = ["FORFEIT", "EXIT TO", "ABANDON", "TITLE", "SYSTEM", "QUIT", "MAIN MENU", "RESET", "DELETE", "WIPE"];
  if (!(strategy === "edge" && rng() < 0.02)) {
    const keep = btn.filter((b) => !BAD.some((w) => b.t.toUpperCase().includes(w)));
    if (keep.length && keep.length < btn.length) {
      const idx = keep.map((b) => btn.indexOf(b));
      const sub = chooseInner(keep, ph, strategy, rng, st, log);
      return sub == null ? null : idx[sub];
    }
  }
  return chooseInner(btn, ph, strategy, rng, st, log);
}

module.exports = { choose };
