const GutterbonesOnboarding = (() => {
    const THRESHOLDS = Object.freeze({
        BASIC_COMBOS: 2,
        ALL_CATEGORIES: 5,
        RARE_FACES: 3
    });

    const getAvailableCategoryIds = (totalRuns = 0) => {
        const runs = Math.max(0, Math.floor(Number(totalRuns) || 0));
        if (runs < THRESHOLDS.BASIC_COMBOS) {
            return ['ONES', 'TWOS', 'THREES', 'FOURS', 'FIVES', 'SIXES', 'TOK', 'FH', 'C'];
        }
        if (runs < THRESHOLDS.ALL_CATEGORIES) {
            return ['ONES', 'TWOS', 'THREES', 'FOURS', 'FIVES', 'SIXES', 'TOK', 'FOK', 'FH', 'C'];
        }
        return null;
    };

    const unlockRunForCategory = (categoryId) => {
        if (categoryId === 'FOK') return THRESHOLDS.BASIC_COMBOS;
        if (categoryId === 'SS' || categoryId === 'LS' || categoryId === 'Y') return THRESHOLDS.ALL_CATEGORIES;
        return 0;
    };

    const getCategoryUnlockInfo = (totalRuns, allCategoryIds) => {
        const runs = Math.max(0, Math.floor(Number(totalRuns) || 0));
        const all = Array.isArray(allCategoryIds) ? allCategoryIds : [];
        const limited = getAvailableCategoryIds(runs);
        const available = limited === null ? all : limited.filter((id) => all.includes(id));
        const availableSet = new Set(available);
        const locked = all.filter((id) => !availableSet.has(id));
        const lockedDetails = locked.map((id) => {
            const need = unlockRunForCategory(id);
            const runsUntil = need > runs ? need - runs : 0;
            return { id, unlockAtRun: need, runsUntil };
        });
        let nextThreshold = null;
        let runsUntilNext = 0;
        if (runs < THRESHOLDS.BASIC_COMBOS) {
            nextThreshold = THRESHOLDS.BASIC_COMBOS;
            runsUntilNext = THRESHOLDS.BASIC_COMBOS - runs;
        } else if (runs < THRESHOLDS.ALL_CATEGORIES) {
            nextThreshold = THRESHOLDS.ALL_CATEGORIES;
            runsUntilNext = THRESHOLDS.ALL_CATEGORIES - runs;
        }
        return {
            totalRuns: runs,
            available,
            locked,
            lockedDetails,
            nextThreshold,
            runsUntilNext
        };
    };

    return Object.freeze({
        THRESHOLDS,
        getAvailableCategoryIds,
        getCategoryUnlockInfo,
        unlockRunForCategory
    });
})();

export default GutterbonesOnboarding;
export { GutterbonesOnboarding };
