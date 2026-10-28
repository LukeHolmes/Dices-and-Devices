const GutterbonesRules = (() => {
    const resolveDice = (currentDice) => {
        let resolved = currentDice.map(d => ({...d}));
        for (let i = 0; i < 5; i++) {
            if (resolved[i].faceId === 'ECHO_FACE' && i > 0) resolved[i] = { ...resolved[i-1], faceLabel: 'ECHOED', isEchoed: true };
        }
        const destroyed = new Set();
        resolved.forEach((d, i) => {
            if (d.faceId === 'SHIV_FACE' || (d.isEchoed && d.faceId === 'SHIV_FACE')) {
                if (i < 4) destroyed.add(i + 1);
            }
        });
        return { resolved, destroyed };
    };

    const calculateScore = (catId, currentDice, context) => {
        const { handLevels, flowStreak, inventory, hardwareDisabled, activeBoss,
            CATEGORIES, HAND_MASTERY_TUNING, getFlowMultiplier, getHandMasteryBonus } = context;
        const { resolved, destroyed } = resolveDice(currentDice);
        const standardVals = resolved.filter((d, i) => !destroyed.has(i) && typeof d.value === 'number' && d.value > 0 && d.faceId !== 'GHOST_FACE').map(d => d.value);
        const wilds = resolved.filter((d, i) => !destroyed.has(i) && d.value === 'W').length;
        const sum = standardVals.reduce((a,b)=>a+b,0) + wilds * 6;
        const counts = {};
        standardVals.forEach(x => counts[x] = (counts[x] || 0) + 1);
        const cArr = Object.values(counts);
        const maxCount = cArr.length ? Math.max(...cArr) : 0;
        const handLevel = handLevels[catId] || HAND_MASTERY_TUNING.baseLevel;
        const flowMult = getFlowMultiplier(flowStreak);
        let chips = 0, mult = 1, valid = false, gDelta = 0, triggers = [];
        const explanationSteps = [];
        let hardwareTriggerCount = 0;
        const categoryName = CATEGORIES[catId]?.name || catId;
        const pushStep = (type, label, value, impact) => {
            explanationSteps.push({ type, label, value, impact });
        };
        switch(catId) {
            case 'ONES': valid = true; chips = ((counts[1] || 0) + wilds) * 1; break;
            case 'TWOS': valid = true; chips = ((counts[2] || 0) + wilds) * 2; break;
            case 'THREES': valid = true; chips = ((counts[3] || 0) + wilds) * 3; break;
            case 'FOURS': valid = true; chips = ((counts[4] || 0) + wilds) * 4; break;
            case 'FIVES': valid = true; chips = ((counts[5] || 0) + wilds) * 5; break;
            case 'SIXES': valid = true; chips = ((counts[6] || 0) + wilds) * 6; break;
            case 'TOK': valid = maxCount + wilds >= 3; if (valid) { chips = 20; mult *= 2; } break;
            case 'FOK': valid = maxCount + wilds >= 4; if (valid) { chips = 35; mult *= 3; } break;
            case 'FH': {
                const scoringBones = resolved.filter((d, i) => !destroyed.has(i) && (d.value === 'W' || (typeof d.value === 'number' && d.value > 0))).length;
                valid = scoringBones >= 5 && ((cArr.includes(3) && cArr.includes(2)) || (wilds >= 1 && cArr.length <= 2 && maxCount >= 2));
                if (valid) { chips = 30; mult *= 3; }
                break;
            }
            case 'SS': {
                const has = req => req.filter(v => !standardVals.includes(v)).length <= wilds;
                valid = has([1,2,3,4]) || has([2,3,4,5]) || has([3,4,5,6]);
                if (valid) { chips = 30; mult *= 2; }
                break;
            }
            case 'LS': {
                const has = req => req.filter(v => !standardVals.includes(v)).length <= wilds;
                valid = has([1,2,3,4,5]) || has([2,3,4,5,6]);
                if (valid) { chips = 40; mult *= 3; }
                break;
            }
            case 'Y': valid = maxCount + wilds >= 5; if (valid) { chips = 50; mult *= 5; } break;
            case 'C': valid = true; chips = sum; break;
        }
        if (!valid) {
            pushStep('system', 'INVALID PAYOUT', `${categoryName} did not match this hand.`, 0);
            return { valid: false, chips: 0, mult: 0, total: 0, gDelta: 0, triggers: [], flowMult, explanationSteps, hardwareTriggerCount, categoryName };
        }
        pushStep('base', `${categoryName.toUpperCase()} BASE`, `${chips} chips`, chips);
        pushStep('multiplier', 'CATEGORY MULT', `x${mult.toFixed(2)}`, `x${mult.toFixed(2)}`);
        const masteryBonus = getHandMasteryBonus(handLevel);
        if (masteryBonus > 0) {
            chips += masteryBonus;
            triggers.push({ name: 'MASTERY', value: `+${masteryBonus}` });
            pushStep('modifier', 'HAND MASTERY', `+${masteryBonus} chips`, masteryBonus);
        }
        resolved.forEach((d, i) => {
            if (destroyed.has(i)) return;
            const face = d.faceId;
            if (face === 'MULT_FACE') { mult += 1; triggers.push({ name: '+MULT', value: '+1x' }); pushStep('multiplier', 'FACE: +MULT', '+1x multiplier', '+1x'); }
            if (face === 'GOLD_FACE') { gDelta += 2; triggers.push({ name: 'CASH', value: '+$2' }); pushStep('modifier', 'FACE: GOLD', '+$2 cash', '+$2'); }
            if (face === 'BLOOD_6') { chips += 20; gDelta -= 1; triggers.push({ name: 'BLOOD', value: '+20/-$1' }); pushStep('modifier', 'FACE: BLOOD 6', '+20 chips, -$1', '+20 / -$1'); }
            if (face === 'SHIV_FACE') { chips += 40; triggers.push({ name: 'SHIV', value: '+40' }); pushStep('modifier', 'FACE: SHIV', '+40 chips', 40); }
            if (face === 'WIREBAG_FACE') { mult -= 1; gDelta += 4; triggers.push({ name: 'WIRE', value: '-1x/+$4' }); pushStep('penalty', 'FACE: WIREBAG', '-1x, +$4', '-1x / +$4'); }
            if (face === 'GHOST_FACE') { mult += 2; triggers.push({ name: 'GHOST', value: '+2x' }); pushStep('multiplier', 'FACE: GHOST', '+2x multiplier', '+2x'); }
        });
        const unclampedMult = mult;
        mult = Math.max(0.5, mult);
        if (mult !== unclampedMult) pushStep('system', 'MULTIPLIER FLOOR', 'Multiplier cannot drop below x0.50', `x${mult.toFixed(2)}`);
        if (!hardwareDisabled) {
            inventory.forEach(item => {
                if (item.id === 'CENTERPIECE') {
                    const center = resolved[2];
                    if (center && !destroyed.has(2)) {
                        let centerChips = 0;
                        let centerMult = 0;
                        if (typeof center.value === 'number') {
                            chips += center.value;
                            centerChips += center.value;
                        }
                        if (center.faceId === 'MULT_FACE') { mult += 1; centerMult += 1; }
                        if (center.faceId === 'GHOST_FACE') { mult += 2; centerMult += 2; }
                        if (center.faceId === 'GOLD_FACE') { gDelta += 2; triggers.push({ name: 'CENTER', value: '+$2' }); }
                        triggers.push({ name: 'CENTER', value: 'slot 3' });
                        hardwareTriggerCount += 1;
                        pushStep('modifier', 'HARDWARE: CENTERPIECE', `Slot 3 copy${centerChips ? ` +${centerChips} chips` : ''}${centerMult ? ` +${centerMult}x` : ''}`, `${centerChips ? `+${centerChips}` : ''}${centerMult ? `${centerChips ? ' / ' : ''}+${centerMult}x` : ''}` || 'TRIGGERED');
                    }
                }
                if (item.id === 'BOOKENDS' && resolved[0].value === resolved[4].value && resolved[0].faceId === resolved[4].faceId && !destroyed.has(0) && !destroyed.has(4)) {
                    chips += 30;
                    triggers.push({ name: 'BOOKENDS', value: '+30' });
                    hardwareTriggerCount += 1;
                    pushStep('modifier', 'HARDWARE: BOOKENDS', '+30 chips', 30);
                }
                if (item.id === 'ENGINE') {
                    const anchor = resolved[0].value;
                    if (typeof anchor === 'number' && !destroyed.has(0)) {
                        const bonus = Math.min(4, resolved.slice(1).filter((d, idx) => !destroyed.has(idx + 1) && typeof d.value === 'number' && d.value > anchor).length);
                        if (bonus) {
                            mult += bonus;
                            triggers.push({ name: 'ENGINE', value: `+${bonus}x` });
                            hardwareTriggerCount += 1;
                            pushStep('multiplier', 'HARDWARE: ENGINE', `+${bonus}x multiplier`, `+${bonus}x`);
                        }
                    }
                }
                if (item.id === 'LOADED_DIE' && catId === 'TOK') {
                    chips += 10;
                    triggers.push({ name: 'LOADED', value: '+10' });
                    hardwareTriggerCount += 1;
                    pushStep('modifier', 'HARDWARE: WEIGHTED CORE', '+10 chips on Triad', 10);
                }
                if (item.id === 'BLOOD_PACT') {
                    mult *= 3;
                    triggers.push({ name: 'PACT', value: 'x3' });
                    hardwareTriggerCount += 1;
                    pushStep('multiplier', 'HARDWARE: BLOOD PACT', 'Tripled multiplier', 'x3');
                }
                if (item.id === 'BRASS_KNUCKLES' && standardVals.length > 0 && standardVals.every(v => v <= 3)) {
                    mult += 3;
                    triggers.push({ name: 'KNUCKLES', value: '+3x' });
                    hardwareTriggerCount += 1;
                    pushStep('multiplier', 'HARDWARE: BRASS KNUCKLES', '+3x on low faces', '+3x');
                }
                if (item.id === 'CROWBAR') {
                    const count = Math.min(5, resolved.filter((d,i) => !destroyed.has(i) && (d.type === 'blood' || d.type === 'destructive' || d.faceId === 'BLOOD_6' || d.faceId === 'SHIV_FACE')).length);
                    if (count) {
                        mult += count;
                        triggers.push({ name: 'CROWBAR', value: `+${count}x` });
                        hardwareTriggerCount += 1;
                        pushStep('multiplier', 'HARDWARE: CROWBAR', `+${count}x from blood/destructive faces`, `+${count}x`);
                    }
                }
            });
        } else if (inventory.length > 0) {
            pushStep('penalty', `BOSS: ${activeBoss?.name || 'CROOKED COP'}`, 'Hardware triggers disabled this hand', 'NO HARDWARE');
        }
        if (flowMult > 1) triggers.push({ name: 'FLOW', value: `x${flowMult.toFixed(2)}` });
        pushStep('multiplier', 'FLOW STREAK', `x${flowMult.toFixed(2)} flow multiplier`, `x${flowMult.toFixed(2)}`);
        const total = Math.floor(chips * mult * flowMult);
        pushStep('system', 'FINAL FORMULA', `${chips} x ${mult.toFixed(2)} x ${flowMult.toFixed(2)}`, total);
        return { valid: true, chips, mult, total, flowMult, gDelta, triggers, explanationSteps, hardwareTriggerCount, categoryName };
    };

    const normalizeSavedRun = (raw, context) => {
        const { RUN_SAVE_VERSION, RUN_PHASES, WAGER_TUNING, DEFAULT_RUN_BUILD, BUILD_IDS } = context;
        if (!raw || typeof raw !== 'object') return null;
        if (typeof raw.personaId !== 'string' || !Array.isArray(raw.dice) || raw.dice.length !== 5) return null;
        const normalized = { ...raw };
        normalized.version = RUN_SAVE_VERSION;
        if (!RUN_PHASES.includes(normalized.phase)) normalized.phase = 'PLAY';
        if (!Array.isArray(normalized.consumables)) normalized.consumables = [];
        if (!normalized.handLevels || typeof normalized.handLevels !== 'object' || Array.isArray(normalized.handLevels)) normalized.handLevels = {};
        if (typeof normalized.flowStreak !== 'number' || Number.isNaN(normalized.flowStreak)) normalized.flowStreak = 0;
        if (typeof normalized.gambleStake !== 'number' || Number.isNaN(normalized.gambleStake)) normalized.gambleStake = 0;
        if (!normalized.activeWager || typeof normalized.activeWager !== 'object') normalized.activeWager = null;
        else {
            normalized.activeWager = {
                stake: Math.max(0, Math.floor(Number(normalized.activeWager.stake) || 0)),
                threshold: Math.max(WAGER_TUNING.baseThreshold, Math.floor(Number(normalized.activeWager.threshold) || WAGER_TUNING.baseThreshold))
            };
            if (!normalized.activeWager.stake) normalized.activeWager = null;
        }
        if (!normalized.currentRouteEffect || typeof normalized.currentRouteEffect !== 'object') normalized.currentRouteEffect = null;
        else if (!Array.isArray(normalized.currentRouteEffect.effects)) normalized.currentRouteEffect = { ...normalized.currentRouteEffect, effects: [] };
        if (typeof normalized.arcId !== 'string' || !normalized.arcId) normalized.arcId = 'witness';
        if (!normalized.runStats || typeof normalized.runStats !== 'object') {
            normalized.runStats = { totalHeat: 0, biggestHustle: 0, finalBoss: '', build: { ...DEFAULT_RUN_BUILD } };
        } else {
            const rs = normalized.runStats;
            const b = rs.build && typeof rs.build === 'object' ? rs.build : {};
            normalized.runStats = {
                totalHeat: typeof rs.totalHeat === 'number' && !Number.isNaN(rs.totalHeat) ? rs.totalHeat : 0,
                biggestHustle: typeof rs.biggestHustle === 'number' && !Number.isNaN(rs.biggestHustle) ? rs.biggestHustle : 0,
                finalBoss: typeof rs.finalBoss === 'string' ? rs.finalBoss : '',
                build: {
                    primary: typeof b.primary === 'string' ? b.primary : BUILD_IDS.UNKNOWN,
                    peakConfidence: typeof b.peakConfidence === 'number' && !Number.isNaN(b.peakConfidence) ? b.peakConfidence : 0,
                    keyItems: Array.isArray(b.keyItems) ? b.keyItems.filter((x) => typeof x === 'string') : []
                }
            };
        }
        return normalized;
    };

    return Object.freeze({ resolveDice, calculateScore, normalizeSavedRun });
})();

export default GutterbonesRules;
export { GutterbonesRules };
