const GutterbonesRoutes = (() => {
    const BOSS_TUNING = Object.freeze({
        debtQuotaPenaltyRatio: 1.5,
        debtQuotaPenaltyCap: 120,
        earlyBossRoundCap: 4,
        earlyBouncerRelief: 0.9,
        raidQuotaRelief: 0.92,
        bossPathTargetRelief: 0.93
    });

    const EARLY_GAME_TUNING = Object.freeze({
        debtPenaltyStartsRound: 4
    });

    const ROUND_CURVE_TUNING = Object.freeze({
        earlyMaxRound: 3,
        midMaxRound: 6,
        early: { pathModWeight: 0.7, flatIncrease: 28 },
        mid: { pathModWeight: 0.95, flatIncrease: 42 },
        late: { pathModWeight: 1.1, flatIncrease: 58 }
    });

    const PROGRESSION_GUARDRAILS = Object.freeze({
        minGrowthRate: 1.08,
        earlyMaxGrowthRate: 1.35,
        midMaxGrowthRate: 1.42,
        lateMaxGrowthRate: 1.5
    });

    const INSANE_CONTRACT_MODIFIERS = Object.freeze({
        targetMultiplier: 1.28,
        debtPenaltyMultiplier: 1.35,
        playPenalty: 1
    });

    const roundCurveFor = (nextRound) => (
        nextRound <= ROUND_CURVE_TUNING.earlyMaxRound
            ? ROUND_CURVE_TUNING.early
            : nextRound <= ROUND_CURVE_TUNING.midMaxRound
                ? ROUND_CURVE_TUNING.mid
                : ROUND_CURVE_TUNING.late
    );

    const growthCapFor = (nextRound) => (
        nextRound <= ROUND_CURVE_TUNING.earlyMaxRound
            ? PROGRESSION_GUARDRAILS.earlyMaxGrowthRate
            : nextRound <= ROUND_CURVE_TUNING.midMaxRound
                ? PROGRESSION_GUARDRAILS.midMaxGrowthRate
                : PROGRESSION_GUARDRAILS.lateMaxGrowthRate
    );

    const applyBossAdjustedTarget = (baseTarget, boss, roundNum) => {
        if (!boss?.applyTarget) return baseTarget;
        let adjusted = boss.applyTarget(baseTarget);
        if (boss.id === 'BOUNCER' && roundNum <= BOSS_TUNING.earlyBossRoundCap) {
            adjusted = Math.floor(adjusted * BOSS_TUNING.earlyBouncerRelief);
        }
        if (boss.id === 'THE_RAID') {
            adjusted = Math.floor(adjusted * BOSS_TUNING.raidQuotaRelief);
        }
        return adjusted;
    };

    const describePathModifiers = (path) => {
        if (!path) return [];
        const notes = [];
        if (path.mod && path.mod !== 1) notes.push(`Quota x${path.mod.toFixed(2)} (scaled by round curve)`);
        if (path.reward) notes.push(`+$${path.reward} cash on pick`);
        if (path.fillStash) notes.push('Stash to 100% on pick');
        if (path.handDelta) notes.push(`${path.handDelta > 0 ? '+' : ''}${path.handDelta} play next round`);
        if (path.discardDelta) notes.push(`${path.discardDelta > 0 ? '+' : ''}${path.discardDelta} pill next round`);
        if (path.grantRandomConsumable) notes.push('Random one-shot on pick');
        return notes;
    };

    const sideBetPayout = (stake, payoutMultiplier = 1.75) => (
        Math.max(stake + 1, Math.round(stake * payoutMultiplier))
    );

    const wagerThresholdForRound = (round, tuning = { baseThreshold: 110, roundThresholdStep: 8 }) => (
        tuning.baseThreshold + Math.max(0, round - 1) * tuning.roundThresholdStep
    );

    const projectNextRound = ({
        path,
        round,
        target,
        debt = 0,
        insaneContract = false,
        hasLedger = false,
        personaPlays = 4,
        personaPills = 3
    }) => {
        const warnings = [];
        const effectLines = describePathModifiers(path);
        const nextRound = Math.max(1, Math.floor(Number(round) || 0)) + 1;
        const currentTarget = Math.max(1, Math.floor(Number(target) || 0));
        const roundCurve = roundCurveFor(nextRound);
        const scaledPathMod = 1 + (((path?.mod || 1) - 1) * roundCurve.pathModWeight);
        let nextTarget = Math.floor(currentTarget * scaledPathMod) + roundCurve.flatIncrease;

        let debtPenaltyApplied = 0;
        if (!hasLedger && debt > 0 && nextRound >= EARLY_GAME_TUNING.debtPenaltyStartsRound) {
            debtPenaltyApplied = Math.min(
                BOSS_TUNING.debtQuotaPenaltyCap,
                Math.floor(debt * BOSS_TUNING.debtQuotaPenaltyRatio)
            );
            if (insaneContract) {
                debtPenaltyApplied = Math.floor(debtPenaltyApplied * INSANE_CONTRACT_MODIFIERS.debtPenaltyMultiplier);
            }
            nextTarget += debtPenaltyApplied;
            effectLines.push(`Debt pressure +${debtPenaltyApplied} quota`);
        }

        if (path?.boss && nextRound <= BOSS_TUNING.earlyBossRoundCap) {
            nextTarget = Math.floor(nextTarget * BOSS_TUNING.bossPathTargetRelief);
            effectLines.push('Boss turf: early-route quota relief applied');
        }

        const growthCap = growthCapFor(nextRound);
        const minTarget = Math.floor(currentTarget * PROGRESSION_GUARDRAILS.minGrowthRate);
        const maxTarget = Math.floor(currentTarget * growthCap);
        const beforeGuardrail = nextTarget;
        nextTarget = Math.max(minTarget, Math.min(nextTarget, maxTarget));
        if (nextTarget === minTarget && beforeGuardrail < minTarget) {
            warnings.push(`Quota growth clamped to minimum (+${Math.round((PROGRESSION_GUARDRAILS.minGrowthRate - 1) * 100)}%)`);
            effectLines.push(`Guardrail: quota floored at ${nextTarget}`);
        } else if (nextTarget === maxTarget && beforeGuardrail > maxTarget) {
            warnings.push(`Quota growth clamped to maximum (+${Math.round((growthCap - 1) * 100)}%)`);
            effectLines.push(`Guardrail: quota capped at ${nextTarget}`);
        }

        if (insaneContract) {
            nextTarget = Math.floor(nextTarget * INSANE_CONTRACT_MODIFIERS.targetMultiplier);
            effectLines.push('Insane contract: quota +28%');
        }

        const delta = nextTarget - currentTarget;
        effectLines.unshift(`Next quota base: ${nextTarget} (${delta >= 0 ? '+' : ''}${delta} vs this round)`);

        const nextTargetDisplay = applyBossAdjustedTarget(nextTarget, path?.boss, nextRound);
        if (path?.boss?.applyTarget && nextTargetDisplay !== nextTarget) {
            effectLines.push(`Boss ${path.boss.name}: displayed quota ~${nextTargetDisplay} (applyTarget during round)`);
        } else if (path?.boss) {
            effectLines.push(`Boss ${path.boss.name}: ${path.boss.desc}`);
        }

        const baseHands = Math.max(
            1,
            personaPlays
                - (hasLedger && debt > 0 ? 1 : 0)
                - (insaneContract ? INSANE_CONTRACT_MODIFIERS.playPenalty : 0)
        );
        const nextHands = Math.max(1, baseHands + (path?.handDelta || 0));
        const nextDiscards = Math.max(0, personaPills + (path?.discardDelta || 0));

        if (nextHands !== personaPlays) {
            effectLines.push(`Plays next round: ${nextHands}`);
        }
        if (nextDiscards !== personaPills) {
            effectLines.push(`Pills next round: ${nextDiscards}`);
        }

        return {
            nextRound,
            nextTarget,
            nextTargetDisplay,
            nextHands,
            nextDiscards,
            effectLines,
            warnings
        };
    };

    return Object.freeze({
        BOSS_TUNING,
        ROUND_CURVE_TUNING,
        projectNextRound,
        applyBossAdjustedTarget,
        describePathModifiers,
        sideBetPayout,
        wagerThresholdForRound
    });
})();

export default GutterbonesRoutes;
export { GutterbonesRoutes };
