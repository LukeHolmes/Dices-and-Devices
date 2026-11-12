/**
 * Optional rule experiments (OFF by default). Enable via ?ruleExp=e1,e2,e3 or SIM_RULE_EXPERIMENTS.
 * Production / Heat0: no flags → zero behavior change.
 */
(function initRuleExperiments(global) {
    const PARSE_KEY = 'ruleExp';

    /** @type {{ e1: boolean, e2: boolean, e3: boolean }} */
    const parseFlags = (raw) => {
        const flags = { e1: false, e2: false, e3: false };
        if (!raw || typeof raw !== 'string') return flags;
        raw.split(/[,+\s]+/).forEach((tok) => {
            const t = tok.trim().toLowerCase();
            if (t === 'e1' || t === '1') flags.e1 = true;
            if (t === 'e2' || t === '2') flags.e2 = true;
            if (t === 'e3' || t === '3') flags.e3 = true;
            if (t === 'all') {
                flags.e1 = true;
                flags.e2 = true;
                flags.e3 = true;
            }
        });
        return flags;
    };

    const readFromUrl = () => {
        if (typeof window === 'undefined') return parseFlags('');
        const q = new URLSearchParams(window.location.search).get(PARSE_KEY);
        return parseFlags(q || '');
    };

    const TUNING = Object.freeze({
        /** E1: carved faces keep pip from replaced standard face (Ghost still uses face pip rules). */
        e1PreserveCarvePip: true,
        /** E2: after shop refresh, next stock roll biases missing GHOST_FACE / ECHO_FACE. */
        e2KitFaceRefreshPity: true,
        /**
         * E3: while link kit incomplete, apply the *smaller* of:
         * +$5 starting gold vs −$6 on the first street-tax sink when leaving shop.
         * Comparison picks +$5 gold (smaller player lift than a $6 sink waiver).
         */
        e3GoldBonus: 5,
        e3FirstSinkDiscount: 6,
        e3ReliefMode: 'gold',
    });

    const state = {
        flags: readFromUrl(),
        e3SinkReliefConsumed: false,
        e2PityKitFaceId: null,
    };

    const api = {
        TUNING,
        flags: () => ({ ...state.flags }),
        enabled: () => state.flags.e1 || state.flags.e2 || state.flags.e3,
        e1: () => state.flags.e1,
        e2: () => state.flags.e2,
        e3: () => state.flags.e3,
        setFlags: (raw) => {
            state.flags = typeof raw === 'string' ? parseFlags(raw) : { ...raw };
        },
        carvePipValue: (face, die, priorStandardFace) => {
            if (!state.flags.e1) return null;
            if (!face || face.id === 'GHOST_FACE') return null;
            if (typeof priorStandardFace?.value === 'number') return priorStandardFace.value;
            if (typeof die?.value === 'number' && die.value >= 1 && die.value <= 6) return die.value;
            return null;
        },
        applyCarveFace: (selectedItem, die, faceIdx) => {
            if (!selectedItem) return selectedItem;
            const prior = die?.faces?.[faceIdx];
            const pip = api.carvePipValue(selectedItem, die, prior);
            if (pip == null) return selectedItem;
            return { ...selectedItem, preservedPip: pip, carvePip: pip };
        },
        showingPipForFace: (face, die) => {
            if (!face || face.type === 'standard') return face?.value;
            if (state.flags.e1 && face.id !== 'GHOST_FACE') {
                if (typeof face.preservedPip === 'number') return face.preservedPip;
                if (typeof face.carvePip === 'number') return face.carvePip;
                if (typeof die?.value === 'number' && die.value >= 1 && die.value <= 6) return die.value;
            }
            return face.value;
        },
        queueKitFacePity: (faceId) => {
            if (!state.flags.e2 || !faceId) return;
            state.e2PityKitFaceId = faceId;
        },
        consumeKitFacePity: () => {
            const id = state.e2PityKitFaceId;
            state.e2PityKitFaceId = null;
            return id;
        },
        peekKitFacePity: () => state.e2PityKitFaceId,
        e3StartingGoldBonus: () => (state.flags.e3 && TUNING.e3ReliefMode === 'gold' ? TUNING.e3GoldBonus : 0),
        e3AdjustFirstSink: (sink, kitIncomplete) => {
            if (!state.flags.e3 || TUNING.e3ReliefMode !== 'sink' || !kitIncomplete) return sink;
            if (state.e3SinkReliefConsumed) return sink;
            if (sink <= 0) return sink;
            state.e3SinkReliefConsumed = true;
            return Math.max(0, sink - TUNING.e3FirstSinkDiscount);
        },
        resetRun: () => {
            state.e3SinkReliefConsumed = false;
            state.e2PityKitFaceId = null;
        },
        describe: () => ({
            flags: state.flags,
            tuning: TUNING,
        }),
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.GutterbonesRuleExperiments = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
