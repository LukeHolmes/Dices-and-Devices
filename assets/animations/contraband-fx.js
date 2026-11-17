/* Gutterbones 1977 — presentation-only contraband spritesheet renderer.
 * No gameplay, RNG, scoring, persistence or audio dependencies. Designed for
 * non-blocking, post-commit visual cues; host game chooses when to call play().
 */
(function initContrabandFx(global) {
  'use strict';

  const EFFECTS = Object.freeze([
    'mult', 'cash', 'wild', 'blood-6', 'echo', 'shiv',
    'wirebag', 'ghost', 'fuse', 'magnet', 'mark', 'double-down',
  ]);
  const EFFECT_SET = new Set(EFFECTS);
  const COLS = 4;
  const ROWS = 2;
  const FRAMES = COLS * ROWS;

  /**
   * @param {{document?: Document, window?: Window, basePath?: string,
   *  frameMs?: number, maxConcurrent?: number}} options
   * @returns {{play: Function, cancel: Function, cancelAll: Function,
   *  preload: Function, destroy: Function, activeCount: Function}}
   */
  function createRenderer(options = {}) {
    const win = options.window || global;
    const doc = options.document || win.document;
    if (!win || !doc || typeof doc.createElement !== 'function') {
      throw new Error('Contraband effects require a browser DOM');
    }
    const basePath = String(options.basePath || 'assets/animations/contraband/').replace(/\/?$/, '/');
    const frameMs = Math.max(16, Math.floor(Number(options.frameMs) || 95));
    const maxConcurrent = Math.max(1, Math.min(10, Math.floor(Number(options.maxConcurrent) || 5)));
    const active = new Map();  // DOM anchor -> entry
    const recentEventIds = new Set();
    const recentEventQueue = [];
    let destroyed = false;

    function reducedMotion(flag) {
      if (flag === true) return true;
      try {
        return Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (_) { return false; }
    }

    function cancel(anchor) {
      const entry = active.get(anchor);
      if (!entry) return;
      entry.cancelled = true;
      if (entry.raf != null) win.cancelAnimationFrame(entry.raf);
      entry.node.remove();
      active.delete(anchor);
    }

    function cancelAll() {
      for (const anchor of [...active.keys()]) cancel(anchor);
    }

    function seen(eventId) {
      if (eventId == null) return false;
      const id = String(eventId);
      if (recentEventIds.has(id)) return true;
      recentEventIds.add(id);
      recentEventQueue.push(id);
      if (recentEventQueue.length > 128) recentEventIds.delete(recentEventQueue.shift());
      return false;
    }

    /**
     * Play a visual effect after a committed game event only.
     * @param {string} effect Known slug: e.g. 'echo' or 'blood-6'
     * @param {Element} anchor Existing die DOM node; not modified by renderer
     * @param {{eventId?:string, reducedMotion?:boolean, size?:number}} opts
     */
    function play(effect, anchor, opts = {}) {
      if (destroyed) return { played: false, reason: 'destroyed' };
      if (!EFFECT_SET.has(effect)) return { played: false, reason: 'unknown-effect' };
      if (!anchor || typeof anchor.getBoundingClientRect !== 'function' || !anchor.isConnected) {
        return { played: false, reason: 'missing-anchor' };
      }
      if (reducedMotion(opts.reducedMotion)) return { played: false, reason: 'reduced-motion' };
      if (seen(opts.eventId)) return { played: false, reason: 'duplicate-event' };

      cancel(anchor); // Never stack on one die.
      if (active.size >= maxConcurrent) cancel(active.keys().next().value);
      const rect = anchor.getBoundingClientRect();
      if (!rect.width || !rect.height) return { played: false, reason: 'hidden-anchor' };
      const size = Math.max(32, Math.min(160, Number(opts.size) || Math.max(rect.width, rect.height) * 1.4));
      const node = doc.createElement('div');
      node.setAttribute('aria-hidden', 'true');
      node.dataset.gbContrabandEffect = effect;
      const css = node.style;
      css.position = 'fixed';
      css.left = `${rect.left + rect.width / 2}px`;
      css.top = `${rect.top + rect.height / 2}px`;
      css.transform = 'translate(-50%, -50%)';
      css.width = `${size}px`;
      css.height = `${size}px`;
      css.pointerEvents = 'none';
      css.userSelect = 'none';
      css.zIndex = '210';
      css.backgroundImage = `url("${basePath}${effect}-8frame-spritesheet.png")`;
      css.backgroundRepeat = 'no-repeat';
      css.backgroundSize = '400% 200%';
      css.backgroundPosition = '0% 0%';
      css.contain = 'strict';
      doc.body.appendChild(node);
      const entry = { node, raf: null, cancelled: false, frame: 0 };
      active.set(anchor, entry);
      let startedAt = null;
      const tick = (timestamp) => {
        if (entry.cancelled) return;
        if (startedAt === null) startedAt = timestamp;
        const frame = Math.min(FRAMES, Math.floor((timestamp - startedAt) / frameMs));
        if (frame >= FRAMES || !anchor.isConnected) { cancel(anchor); return; }
        if (frame !== entry.frame) {
          entry.frame = frame;
          const x = frame % COLS;
          const y = Math.floor(frame / COLS);
          css.backgroundPosition = `${x * 100 / (COLS - 1)}% ${y * 100 / (ROWS - 1)}%`;
        }
        entry.raf = win.requestAnimationFrame(tick);
      };
      entry.raf = win.requestAnimationFrame(tick);
      return { played: true, cancel: () => cancel(anchor) };
    }

    function preload(effects = EFFECTS) {
      if (!win.Image) return Promise.resolve([]);
      return Promise.all(effects.filter(id => EFFECT_SET.has(id)).map(id => new Promise(resolve => {
        const img = new win.Image();
        img.onload = () => resolve({ effect: id, ok: true });
        img.onerror = () => resolve({ effect: id, ok: false });
        img.src = `${basePath}${id}-8frame-spritesheet.png`;
      })));
    }

    const onHidden = () => { if (doc.hidden) cancelAll(); };
    doc.addEventListener?.('visibilitychange', onHidden);
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAll();
      recentEventIds.clear();
      recentEventQueue.length = 0;
      doc.removeEventListener?.('visibilitychange', onHidden);
    }
    return { play, cancel, cancelAll, preload, destroy, activeCount: () => active.size };
  }

  const exported = Object.freeze({ EFFECTS, createRenderer });
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (global && global.document) global.GutterbonesContrabandFx = exported;
})(typeof window !== 'undefined' ? window : undefined);
