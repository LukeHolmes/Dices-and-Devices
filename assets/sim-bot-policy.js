/**
 * Sim/builder bot policy (revision-switchable). Game rules unchanged — chooses actions only.
 */
(function initSimBotPolicy(global) {
    const LEGACY_REVISION = '2026-11-11-phase-b-v1';
    const WP2_REVISION = '2026-11-12-wp2-v1';

    const ORGANIC_PAIR_KEYS = [
        'blood_ripple→fuse_spark',
        'fuse_spark→engine_link',
        'ghost_echo→bookends_retrigger',
        'wire_feed→crowbar_cascade',
    ];

    const linkKey = (l) => (typeof l === 'string' ? l : `${l.from}→${l.to}`);

    const organicPairCount = (chainLinks) => {
        const keys = (chainLinks || []).map(linkKey);
        return keys.filter((k) => ORGANIC_PAIR_KEYS.includes(k)).length;
    };

  const clearsQuota = (score, total, target) => score + total >= target;

    const pickCategoryLegacy = ({ candidates, score, target }) => {
        let best = null;
        (candidates || []).forEach((c) => {
            if (!c.valid) return;
            if (!best || c.total > best.total) best = c;
        });
        return best ? { ...best, decision: 'max_chips' } : null;
    };

    const pickCategoryWp2 = ({ candidates, score, target }) => {
        const valid = (candidates || []).filter((c) => c.valid);
        if (!valid.length) return null;
        const clearing = valid.filter((c) => clearsQuota(score, c.total, target));
        const pool = clearing.length ? clearing : valid;
        let best = null;
        let bestRank = -1;
        pool.forEach((c) => {
            const pairs = organicPairCount(c.chainLinks);
            const rank = pairs * 1_000_000 + c.total;
            if (rank > bestRank) {
                bestRank = rank;
                best = { ...c, decision: clearing.length ? 'clear_quota' : 'organic_link_aware', organicPairs: pairs };
            }
        });
        return best;
    };

    const pickCategory = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        if (rev === WP2_REVISION) return pickCategoryWp2(ctx);
        return pickCategoryLegacy(ctx);
    };

    const shouldRerollLegacy = ({ score, target, hands, discards, bestTotal, e2eGreedy }) => {
        const gap = Math.max(0, target - score);
        const need = gap / Math.max(1, hands);
        const mustScore = hands <= 1 || discards <= 0;
        const minPlay = e2eGreedy ? 1 : Math.min(gap, Math.max(12, Math.ceil(need * 0.58)));
        if (mustScore) return { reroll: false, reason: 'must_score_last_hand_or_no_discards' };
        if (bestTotal < minPlay && discards > 0) return { reroll: true, reason: 'weak_non_clear_below_min_play' };
        return { reroll: false, reason: 'score_best_line' };
    };

    const faceIdAt = (d) => (
        d?.faceId
        || d?.faces?.[d.showingFace ?? 0]?.faceId
        || d?.faces?.[0]?.faceId
        || null
    );

    const ghostEchoIndices = (dice) => {
        const ghost = [];
        const echo = [];
        (dice || []).forEach((d, i) => {
            const fid = faceIdAt(d);
            if (fid === 'GHOST_FACE' || d?.isGhost) ghost.push(i);
            if (fid === 'ECHO_FACE' || d?.isEchoed) echo.push(i);
        });
        return { ghost, echo };
    };

    const lanesGhostEchoReach = (dice) => {
        const { ghost, echo } = ghostEchoIndices(dice);
        if (!ghost.length || !echo.length) return { inReach: false, ghost, echo };
        const inReach = ghost.some((g) => echo.some((e) => e !== g && Math.abs(g - e) <= 1));
        return { inReach, ghost, echo };
    };

    const shouldRerollWp2 = (ctx) => {
        const base = shouldRerollLegacy(ctx);
        if (base.reroll) return base;
        const { score, target, hands, discards, bestTotal, dice } = ctx;
        const mustScore = hands <= 1 || discards <= 0;
        if (mustScore) return { reroll: false, reason: 'must_score_last_hand_or_no_discards' };
        const gap = Math.max(0, target - score);
        const need = gap / Math.max(1, hands);
        if (bestTotal >= gap) return { reroll: false, reason: 'clear_available' };
        const reach = lanesGhostEchoReach(dice);
        const kitPieces = ghostEchoIndices(dice);
        if ((kitPieces.ghost.length || kitPieces.echo.length) && !reach.inReach && discards > 0) {
            return { reroll: true, reason: 'reroll_to_bring_ghost_echo_in_reach' };
        }
        if (bestTotal < Math.ceil(need * 0.45) && discards > 0) {
            return { reroll: true, reason: 'weak_non_clear_reroll' };
        }
        return { reroll: false, reason: 'score_best_line' };
    };

    const shouldReroll = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        if (rev === WP2_REVISION) return shouldRerollWp2(ctx);
        return shouldRerollLegacy(ctx);
    };

    const keepKeptLegacy = (dice) => {
        const counts = {};
        dice.forEach((d) => {
            const v = d.value;
            counts[v] = (counts[v] || 0) + 1;
        });
        let pairV = -1;
        let pairN = 0;
        Object.keys(counts).forEach((v) => {
            const n = counts[v];
            if (n >= 2 && (n > pairN || (n === pairN && Number(v) > pairV))) {
                pairV = Number(v);
                pairN = n;
            }
        });
        if (pairV >= 0) return dice.map((d) => d.value === pairV);
        const ranked = dice.map((d, i) => ({ v: d.value, i })).sort((a, b) => b.v - a.v);
        const keepIdx = new Set(ranked.slice(0, Math.min(3, ranked.length)).map((x) => x.i));
        return dice.map((_, i) => keepIdx.has(i));
    };

    const keepKeptWp2 = (dice) => {
        const { ghost, echo } = ghostEchoIndices(dice);
        if (ghost.length === 1 && echo.length === 1) {
            return dice.map((_, i) => i === ghost[0] || i === echo[0]);
        }
        if (ghost.length === 1 && echo.length === 0) {
            return dice.map((_, i) => i === ghost[0]);
        }
        if (echo.length === 1 && ghost.length === 0) {
            return dice.map((_, i) => i === echo[0]);
        }
        return keepKeptLegacy(dice);
    };

    const selectKeptSlots = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        const kept = rev === WP2_REVISION ? keepKeptWp2(ctx.dice) : keepKeptLegacy(ctx.dice);
        return { kept, reason: rev === WP2_REVISION ? 'wp2_preserve_lone_ghost_echo' : 'legacy_pair_or_top_values' };
    };

    const mustBankClear = ({ revision, score, target, bestTotal, hands }) => {
        if (revision !== WP2_REVISION) return false;
        return clearsQuota(score, bestTotal, target);
    };

    const api = {
        LEGACY_REVISION,
        WP2_REVISION,
        ORGANIC_PAIR_KEYS,
        organicPairCount,
        clearsQuota,
        pickCategory,
        shouldReroll,
        selectKeptSlots,
        mustBankClear,
        lanesGhostEchoReach,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.GutterbonesSimBotPolicy = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
