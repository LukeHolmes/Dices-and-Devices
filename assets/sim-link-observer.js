/**
 * Observer-only link funnel, cash-squeeze, and zero-RNG shadow scoring (no bot influence).
 */
(function initSimLinkObserver(global) {
    const STAGES = ['offered', 'bought', 'carved_separate', 'rolled_together', 'slot_aligned', 'scored'];

    const FAMILIES = Object.freeze({
        'ghost_echo→bookends_retrigger': {
            stockIds: ['BOOKENDS', 'GHOST_FACE', 'ECHO_FACE'],
            linkKey: 'ghost_echo→bookends_retrigger',
            needsCarve: ['GHOST_FACE', 'ECHO_FACE'],
        },
        'blood_ripple→fuse_spark': {
            stockIds: ['FUSE_BOX', 'BLOOD_6'],
            linkKey: 'blood_ripple→fuse_spark',
            needsCarve: ['BLOOD_6'],
        },
        'fuse_spark→engine_link': {
            stockIds: ['FUSE_BOX', 'ENGINE'],
            linkKey: 'fuse_spark→engine_link',
            needsCarve: [],
        },
        'wire_feed→crowbar_cascade': {
            stockIds: ['CROWBAR', 'WIREBAG_FACE'],
            linkKey: 'wire_feed→crowbar_cascade',
            needsCarve: ['WIREBAG_FACE'],
        },
    });

    const KIT_FACE_IDS = new Set(['GHOST_FACE', 'ECHO_FACE']);

    const faceIdAt = (d) => (
        d?.faceId
        || d?.faces?.[d.showingFace ?? 0]?.faceId
        || d?.faces?.[0]?.faceId
        || null
    );

    const inventoryIds = (inventory) => (inventory || []).map((i) => i?.id).filter(Boolean);

    const linkKey = (l) => (typeof l === 'string' ? l : `${l.from}→${l.to}`);

    const emptyStages = () => Object.fromEntries(STAGES.map((s) => [s, 0]));

    const PERMS5 = (() => {
        const out = [];
        const a = [0, 1, 2, 3, 4];
        const permute = (arr, l) => {
            if (l === arr.length) {
                out.push(arr.slice());
                return;
            }
            for (let i = l; i < arr.length; i += 1) {
                [arr[l], arr[i]] = [arr[i], arr[l]];
                permute(arr, l + 1);
                [arr[l], arr[i]] = [arr[i], arr[l]];
            }
        };
        permute(a, 0);
        return out;
    })();

    const reorderDice = (dice, order) => order.map((i) => dice[i]);

    const familyForItemId = (id) => {
        for (const [fam, cfg] of Object.entries(FAMILIES)) {
            if (cfg.stockIds.includes(id)) return fam;
        }
        return null;
    };

    const isActive = () => {
        const telem = typeof window !== 'undefined' ? window.__GB_SIM_TELEM__?.linkObserver : null;
        return !!(telem && telem.enabled);
    };

    const getObs = () => (isActive() ? window.__GB_SIM_TELEM__.linkObserver : null);

    const create = (opts = {}) => {
        const obs = {
            enabled: !!opts.enabled,
            policyRevision: opts.policyRevision || null,
            families: Object.fromEntries(Object.keys(FAMILIES).map((f) => [f, emptyStages()])),
            sameDieKitCarveCollisions: 0,
            kitCarveSites: {},
            shadow: { decisions: 0, missedLinks: 0, missedClears: 0 },
            cashSqueeze: {
                visits: 0,
                couldAffordAnyKitPiece: 0,
                couldNotAffordKitPiece: 0,
                twoPieceChainCostSamples: [],
            },
            _runFlags: {},
        };

        const bump = (family, stage) => {
            if (!obs.families[family]) obs.families[family] = emptyStages();
            obs.families[family][stage] += 1;
        };

        obs.recordShopKitOffers = (stock, gold, reserve) => {
            if (!obs.enabled) return;
            const ids = new Set((stock || []).map((s) => s.id));
            const seenFam = new Set();
            ids.forEach((id) => {
                const fam = familyForItemId(id);
                if (fam && !seenFam.has(fam)) {
                    seenFam.add(fam);
                    bump(fam, 'offered');
                }
            });
            obs.recordCashSqueezeVisit({ stock, gold, reserve });
        };

        obs.recordPurchase = (itemId) => {
            if (!obs.enabled) return;
            const fam = familyForItemId(itemId);
            if (fam) bump(fam, 'bought');
        };

        obs.recordCarve = (faceId, dieIdx, dice) => {
            if (!obs.enabled || !faceId) return;
            if (KIT_FACE_IDS.has(faceId)) {
                const other = faceId === 'GHOST_FACE' ? 'ECHO_FACE' : 'GHOST_FACE';
                const prevIdx = obs.kitCarveSites[other];
                if (prevIdx != null && prevIdx === dieIdx) {
                    obs.sameDieKitCarveCollisions += 1;
                }
                obs.kitCarveSites[faceId] = dieIdx;
                const hasGhost = obs.kitCarveSites.GHOST_FACE != null;
                const hasEcho = obs.kitCarveSites.ECHO_FACE != null;
                if (hasGhost && hasEcho && obs.kitCarveSites.GHOST_FACE !== obs.kitCarveSites.ECHO_FACE) {
                    bump('ghost_echo→bookends_retrigger', 'carved_separate');
                }
            }
            const fam = familyForItemId(faceId);
            if (fam && FAMILIES[fam].needsCarve.includes(faceId)) {
                const flag = `${fam}:carved`;
                if (!obs._runFlags[flag]) {
                    obs._runFlags[flag] = true;
                }
            }
            if (!dice) return;
            const fam2 = familyForItemId(faceId);
            if (fam2) obs.evaluateLaneMilestones(dice, []);
        };

        obs.evaluateLaneMilestones = (dice, inventory) => {
            if (!obs.enabled || !global.GutterbonesSimBotPolicy?.evaluateOrganicPredicates) return;
            const preds = global.GutterbonesSimBotPolicy.evaluateOrganicPredicates({ dice, inventory });
            const fam = preds.family;
            if (!fam || fam === 'other') return;
            const { ghost, echo } = global.GutterbonesSimBotPolicy.ghostEchoIndices?.(dice) || { ghost: [], echo: [] };
            if (ghost.length && echo.length) {
                bump(fam, 'rolled_together');
            }
            if (preds.fulfilled?.some((f) => f.includes('adjacent') || f.includes('end_values_match'))) {
                bump(fam, 'slot_aligned');
            }
        };

        obs.recordScoredLinks = (chainLinks) => {
            if (!obs.enabled) return;
            const keys = new Set((chainLinks || []).map(linkKey));
            for (const [fam, cfg] of Object.entries(FAMILIES)) {
                if (keys.has(cfg.linkKey)) bump(fam, 'scored');
            }
        };

        obs.recordCashSqueezeVisit = ({ stock, gold, reserve }) => {
            if (!obs.enabled) return;
            obs.cashSqueeze.visits += 1;
            const kitStock = (stock || []).filter((s) => ['BOOKENDS', 'GHOST_FACE', 'ECHO_FACE'].includes(s.id));
            const ghost = kitStock.find((s) => s.id === 'GHOST_FACE');
            const echo = kitStock.find((s) => s.id === 'ECHO_FACE');
            const twoPiece = (ghost?.price || 0) + (echo?.price || 0);
            if (twoPiece > 0) obs.cashSqueeze.twoPieceChainCostSamples.push(twoPiece);
            const affordAny = kitStock.some((s) => (gold || 0) >= (s.price || 0) + (reserve || 0)
                || (gold || 0) + 14 >= (s.price || 0));
            if (kitStock.length) {
                if (affordAny) obs.cashSqueeze.couldAffordAnyKitPiece += 1;
                else obs.cashSqueeze.couldNotAffordKitPiece += 1;
            }
        };

        obs.shadowBeforeScore = (ctx) => {
            if (!obs.enabled) return;
            const P = global.GutterbonesSimBotPolicy;
            if (!P || typeof ctx.calculateScore !== 'function') return;
            obs.shadow.decisions += 1;
            const legal = (ctx.scorablePayoutIds || []).filter((id) => !(ctx.usedCats || []).includes(id));
            const chosen = ctx.calculateScore(ctx.catId, ctx.dice);
            const chosenPairs = P.organicPairCount(chosen?.chainLinks);
            const chosenClear = P.clearsQuota(ctx.score, chosen?.total || 0, ctx.target);
            let bestPairs = chosenPairs;
            let bestClear = chosenClear;
            for (const order of PERMS5) {
                const lane = reorderDice(ctx.dice, order);
                for (const catId of legal) {
                    const r = ctx.calculateScore(catId, lane);
                    if (!r?.valid) continue;
                    const pairs = P.organicPairCount(r.chainLinks);
                    if (pairs > bestPairs) bestPairs = pairs;
                    if (P.clearsQuota(ctx.score, r.total, ctx.target)) bestClear = true;
                }
            }
            if (bestPairs > chosenPairs) obs.shadow.missedLinks += 1;
            if (bestClear && !chosenClear) obs.shadow.missedClears += 1;
        };

        obs.summarize = () => ({
            policyRevision: obs.policyRevision,
            families: obs.families,
            sameDieKitCarveCollisions: obs.sameDieKitCarveCollisions,
            shadow: { ...obs.shadow },
            cashSqueeze: {
                ...obs.cashSqueeze,
                twoPieceChainCostMedian: median(obs.cashSqueeze.twoPieceChainCostSamples),
            },
        });

        return obs;
    };

    const median = (arr) => {
        if (!arr.length) return 0;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const api = {
        STAGES,
        FAMILIES,
        create,
        isActive,
        getObs,
        faceIdAt,
    };

    if (typeof module !== 'undefined' && module.exports) api.create = create;
    global.GutterbonesSimLinkObserver = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
