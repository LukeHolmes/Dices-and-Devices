const GutterbonesGamble = (() => {
    const TUNING = Object.freeze({
        minRound: 3,
        stakeRate: 0.22,
        stakeCap: 30,
        minStake: 5,
        flowWinBonusPerStreak: 0.02,
        flowWinBonusCap: 0.12,
        tiers: Object.freeze([
            {
                id: 'SOFT',
                name: 'Soft Touch',
                blurb: 'Smaller stake, better odds.',
                stakeMult: 0.65,
                winChance: 0.58,
                winMult: 1,
                lossMult: 1
            },
            {
                id: 'FAIR',
                name: 'Fair Flip',
                blurb: 'Street-standard double or nothing.',
                stakeMult: 1,
                winChance: 0.5,
                winMult: 1,
                lossMult: 1
            },
            {
                id: 'HARD',
                name: 'Hard Flip',
                blurb: 'Long odds, bigger score if it lands.',
                stakeMult: 1,
                winChance: 0.38,
                winMult: 1.5,
                lossMult: 1
            }
        ])
    });

    const tierById = (tierId) => TUNING.tiers.find((t) => t.id === tierId) || TUNING.tiers[1];

    const baseStake = (gold) => {
        const cash = Math.max(0, Math.floor(Number(gold) || 0));
        return Math.min(
            TUNING.stakeCap,
            Math.max(TUNING.minStake, Math.floor(cash * TUNING.stakeRate))
        );
    };

    const stakeForTier = (gold, tierId) => {
        const tier = tierById(tierId);
        const scaled = Math.floor(baseStake(gold) * tier.stakeMult);
        return Math.max(TUNING.minStake, Math.min(TUNING.stakeCap, scaled));
    };

    const flowWinBonus = (flowStreak = 0) => (
        Math.min(TUNING.flowWinBonusCap, Math.max(0, Math.floor(Number(flowStreak) || 0)) * TUNING.flowWinBonusPerStreak)
    );

    const winProbability = (tierId, flowStreak = 0) => {
        const tier = tierById(tierId);
        const p = tier.winChance + flowWinBonus(flowStreak);
        return Math.min(0.95, Math.max(0.05, p));
    };

    const resolveFlip = ({ tierId = 'FAIR', flowStreak = 0, gold = 0, random = Math.random() }) => {
        const tier = tierById(tierId);
        const stake = stakeForTier(gold, tier.id);
        const pWin = winProbability(tier.id, flowStreak);
        const won = random < pWin;
        const winAmount = won ? Math.max(1, Math.round(stake * tier.winMult)) : 0;
        const lossAmount = won ? 0 : Math.max(1, Math.round(stake * tier.lossMult));
        return {
            won,
            stake,
            pWin,
            winAmount,
            lossAmount,
            tierId: tier.id,
            tierName: tier.name
        };
    };

    const allTiers = () => TUNING.tiers.slice();

    const formatWinPercent = (p) => `${Math.round(p * 100)}%`;

    return Object.freeze({
        TUNING,
        tierById,
        baseStake,
        stakeForTier,
        flowWinBonus,
        winProbability,
        resolveFlip,
        allTiers,
        formatWinPercent
    });
})();

export default GutterbonesGamble;
export { GutterbonesGamble };
