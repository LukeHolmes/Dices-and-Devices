/**
 * Sim/builder bot policy (revision-switchable). Game rules unchanged — chooses actions only.
 */
(function initSimBotPolicy(global) {
    const LEGACY_REVISION = '2026-11-11-phase-b-v1';
    const WP2_REVISION = '2026-11-12-wp2-v1';
    const WP2_LANE_REVISION = '2026-11-12-wp2-lane-v1';

    const ORGANIC_PAIR_KEYS = [
        'blood_ripple→fuse_spark',
        'fuse_spark→engine_link',
        'ghost_echo→bookends_retrigger',
        'wire_feed→crowbar_cascade',
    ];

    const SETUP_REACH_MAX = 3;

    const linkKey = (l) => (typeof l === 'string' ? l : `${l.from}→${l.to}`);

    const organicPairCount = (chainLinks) => {
        const keys = (chainLinks || []).map(linkKey);
        return keys.filter((k) => ORGANIC_PAIR_KEYS.includes(k)).length;
    };

    const clearsQuota = (score, lineTotal, target) => score + lineTotal >= target;

    const inventoryIds = (inventory) => (inventory || []).map((i) => (typeof i === 'string' ? i : i?.id)).filter(Boolean);

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

    const ghostEchoMinDistance = (dice) => {
        const { ghost, echo } = ghostEchoIndices(dice);
        if (!ghost.length || !echo.length) return Infinity;
        let min = Infinity;
        ghost.forEach((g) => {
            echo.forEach((e) => {
                if (g === e) return;
                min = Math.min(min, Math.abs(g - e));
            });
        });
        return min;
    };

    const ghostEchoAdjacent = (dice) => ghostEchoMinDistance(dice) === 1;

    const lanesGhostEchoReach = (dice) => {
        const { ghost, echo } = ghostEchoIndices(dice);
        if (!ghost.length || !echo.length) return { inReach: false, ghost, echo, minDist: ghostEchoMinDistance(dice) };
        const minDist = ghostEchoMinDistance(dice);
        const inReach = minDist === 1;
        return { inReach, ghost, echo, minDist };
    };

    const hasLinkKit = (inventory, dice) => {
        const ids = inventoryIds(inventory);
        const { ghost, echo } = ghostEchoIndices(dice || []);
        const bookendsFamily = ids.includes('BOOKENDS') && (ghost.length || echo.length);
        const bloodFuse = ids.includes('FUSE_BOX') || ghost.length; // coarse: carved lane + fuse hardware families
        const wireCrowbar = ids.includes('CROWBAR') || ids.includes('WIREBAG');
        return {
            eligible: !!(bookendsFamily || (ids.includes('ENGINE') && ghost.length) || wireCrowbar),
            bookendsFamily,
            inventory: ids,
            hasGhost: ghost.length > 0,
            hasEcho: echo.length > 0,
        };
    };

    /**
     * Bot-side mirror of organic link preconditions (no rule changes). Returns steering reasons only.
     */
    const evaluateOrganicPredicates = (ctx = {}) => {
        const dice = ctx.dice || [];
        const kit = hasLinkKit(ctx.inventory, dice);
        const unfulfilled = [];
        const fulfilled = [];
        const { ghost, echo } = ghostEchoIndices(dice);
        const end0 = dice[0]?.value;
        const end4 = dice[4]?.value;
        const chainLinking = ctx.chainLinkingEnabled !== false;

        if (!kit.eligible) {
            return {
                linkKitEligible: false,
                family: null,
                fulfilled,
                unfulfilled: ['kit:none'],
                sameHandLowRisk: false,
                usefulSetupReroll: false,
            };
        }

        if (kit.bookendsFamily) {
            if (!kit.inventory.includes('BOOKENDS')) unfulfilled.push('bookends:missing_hardware');
            else fulfilled.push('bookends:has_hardware');
            if (!ghost.length) unfulfilled.push('ghost_echo:missing_ghost_face');
            else fulfilled.push('ghost_echo:ghost_present');
            if (!echo.length) unfulfilled.push('ghost_echo:missing_echo_face');
            else fulfilled.push('ghost_echo:echo_present');
            const reach = lanesGhostEchoReach(dice);
            if (!reach.inReach) {
                unfulfilled.push(reach.minDist <= SETUP_REACH_MAX
                    ? 'ghost_echo:not_adjacent_yet'
                    : 'ghost_echo:out_of_setup_reach');
            } else fulfilled.push('ghost_echo:adjacent');
            if (end0 == null || end4 == null || end0 !== end4) {
                unfulfilled.push('bookends:end_values_mismatch');
            } else fulfilled.push('bookends:end_values_match');
            if (chainLinking && end0 === end4) {
                const face0 = faceIdAt(dice[0]);
                const face4 = faceIdAt(dice[4]);
                if (face0 !== face4 && !reach.inReach) {
                    unfulfilled.push('bookends:need_ghost_value_link');
                } else if (face0 !== face4 && reach.inReach) {
                    fulfilled.push('bookends:ghost_value_link_path');
                } else if (face0 === face4) {
                    fulfilled.push('bookends:face_match_path');
                }
            }
        }

        const sameHandLowRisk = kit.bookendsFamily
            && ghostEchoAdjacent(dice)
            && end0 === end4
            && kit.inventory.includes('BOOKENDS');

        const usefulSetupReroll = kit.eligible
            && unfulfilled.some((r) => /not_adjacent|missing_|mismatch|out_of_setup/.test(r))
            && (ghost.length || echo.length);

        return {
            linkKitEligible: kit.eligible,
            family: kit.bookendsFamily ? 'ghost_echo→bookends_retrigger' : 'other',
            fulfilled,
            unfulfilled,
            sameHandLowRisk,
            usefulSetupReroll,
            minGhostEchoDist: ghostEchoMinDistance(dice),
        };
    };

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

    const pickCategoryLane = (ctx) => {
        const valid = (ctx.candidates || []).filter((c) => c.valid);
        if (!valid.length) return null;
        const preds = evaluateOrganicPredicates(ctx);
        const clearing = valid.filter((c) => clearsQuota(ctx.score, c.total, ctx.target));
        const linkClearing = clearing.filter((c) => organicPairCount(c.chainLinks) > 0);
        if (linkClearing.length) {
            const best = linkClearing.reduce((a, b) => (a.total >= b.total ? a : b));
            return {
                ...best,
                decision: 'lane_clear_with_link',
                organicPairs: organicPairCount(best.chainLinks),
                predicates: preds,
            };
        }
        if (clearing.length && preds.linkKitEligible && preds.usefulSetupReroll && !preds.sameHandLowRisk) {
            const best = clearing.reduce((a, b) => (a.total >= b.total ? a : b));
            return {
                ...best,
                decision: 'lane_defer_clear_pool',
                organicPairs: organicPairCount(best.chainLinks),
                predicates: preds,
            };
        }
        const pool = clearing.length ? clearing : valid;
        let best = null;
        let bestRank = -1;
        pool.forEach((c) => {
            const pairs = organicPairCount(c.chainLinks);
            const setupBonus = preds.linkKitEligible && pairs > 0 ? 2_000_000 : 0;
            const rank = setupBonus + pairs * 1_000_000 + c.total;
            if (rank > bestRank) {
                bestRank = rank;
                best = {
                    ...c,
                    decision: clearing.length
                        ? (pairs ? 'lane_clear_organic' : 'clear_quota')
                        : 'lane_build_organic',
                    organicPairs: pairs,
                    predicates: preds,
                };
            }
        });
        return best;
    };

    const pickCategory = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        if (rev === WP2_LANE_REVISION) return pickCategoryLane(ctx);
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

    const shouldRerollLane = (ctx) => {
        const { score, target, hands, discards, bestTotal, dice, inventory } = ctx;
        const gap = Math.max(0, target - score);
        const preds = evaluateOrganicPredicates(ctx);
        const mustScore = hands <= 1 || discards <= 0;
        if (mustScore) {
            return { reroll: false, reason: 'must_score_last_hand_or_no_discards', predicates: preds };
        }
        const clearsNow = bestTotal >= gap;
        if (clearsNow && preds.sameHandLowRisk) {
            return { reroll: false, reason: 'lane_score_link_clear_same_hand', predicates: preds };
        }
        if (clearsNow && preds.linkKitEligible && preds.usefulSetupReroll && discards > 0) {
            return {
                reroll: true,
                reason: 'lane_defer_clear_for_setup',
                predicates: preds,
                unfulfilled: preds.unfulfilled,
            };
        }
        if (clearsNow) {
            return { reroll: false, reason: 'clear_available', predicates: preds };
        }
        if (preds.linkKitEligible && preds.usefulSetupReroll && discards > 0) {
            return {
                reroll: true,
                reason: 'lane_setup_reroll',
                predicates: preds,
                unfulfilled: preds.unfulfilled,
            };
        }
        const reach = lanesGhostEchoReach(dice);
        if (preds.linkKitEligible && !reach.inReach && discards > 0 && reach.minDist <= SETUP_REACH_MAX) {
            return {
                reroll: true,
                reason: 'lane_bring_kit_in_reach',
                predicates: preds,
                unfulfilled: preds.unfulfilled,
            };
        }
        if (hasLinkKit(inventory, dice).bookendsFamily && dice?.length >= 5) {
            const end0 = dice[0]?.value;
            const end4 = dice[4]?.value;
            if (end0 != null && end4 != null && end0 !== end4 && discards > 0) {
                return {
                    reroll: true,
                    reason: 'lane_match_bookend_values',
                    predicates: preds,
                    unfulfilled: preds.unfulfilled,
                };
            }
        }
        return shouldRerollWp2({ ...ctx, inventory });
    };

    const shouldReroll = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        if (rev === WP2_LANE_REVISION) return shouldRerollLane(ctx);
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

    const keepKeptLane = (ctx) => {
        const dice = ctx.dice || [];
        const ids = inventoryIds(ctx.inventory);
        const kept = dice.map(() => false);
        const { ghost, echo } = ghostEchoIndices(dice);
        ghost.forEach((i) => { kept[i] = true; });
        echo.forEach((i) => { kept[i] = true; });
        if (ids.includes('BOOKENDS')) {
            kept[0] = true;
            kept[4] = true;
        }
        if (kept.some(Boolean)) return kept;
        return keepKeptWp2(dice);
    };

    const selectKeptSlots = (ctx) => {
        const rev = ctx.revision || LEGACY_REVISION;
        let kept;
        let reason;
        if (rev === WP2_LANE_REVISION) {
            kept = keepKeptLane(ctx);
            reason = 'lane_preserve_kit_and_bookends';
        } else if (rev === WP2_REVISION) {
            kept = keepKeptWp2(ctx.dice);
            reason = 'wp2_preserve_lone_ghost_echo';
        } else {
            kept = keepKeptLegacy(ctx.dice);
            reason = 'legacy_pair_or_top_values';
        }
        return { kept, reason };
    };

    const mustBankClear = (ctx) => {
        const {
            revision,
            score,
            target,
            bestTotal,
            hands,
            discards,
        } = ctx;
        if (revision === LEGACY_REVISION) return false;
        if (!clearsQuota(score, bestTotal, target)) return false;
        if (revision === WP2_REVISION) return true;
        if (revision === WP2_LANE_REVISION) {
            const preds = evaluateOrganicPredicates(ctx);
            if (!preds.linkKitEligible) return true;
            if (preds.sameHandLowRisk) return true;
            const candidates = ctx.candidates || [];
            const linkClear = candidates.some(
                (c) => c.valid && clearsQuota(score, c.total, target) && organicPairCount(c.chainLinks) > 0,
            );
            if (linkClear) return true;
            if (hands > 1 && (discards || 0) > 0 && preds.usefulSetupReroll) return false;
            return true;
        }
        return false;
    };

    const api = {
        LEGACY_REVISION,
        WP2_REVISION,
        WP2_LANE_REVISION,
        ORGANIC_PAIR_KEYS,
        SETUP_REACH_MAX,
        organicPairCount,
        clearsQuota,
        evaluateOrganicPredicates,
        hasLinkKit,
        pickCategory,
        shouldReroll,
        selectKeptSlots,
        mustBankClear,
        lanesGhostEchoReach,
        ghostEchoMinDistance,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.GutterbonesSimBotPolicy = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
