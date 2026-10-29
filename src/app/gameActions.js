/**
 * Run action implementations (generated — run `node scripts/generate-game-actions.cjs` after edits).
 */
import GutterbonesRules from "../systems/rules.js";
import GutterbonesStory from "../systems/story.js";
import GutterbonesRoutes from "../systems/routes.js";
import GutterbonesGamble from "../systems/gamble.js";
import * as catalog from "../data/catalog.js";

const {
  PERSONAS,
  RUN_SAVE_VERSION,
  RUN_PHASES,
  CATEGORIES,
  HAND_MASTERY_TUNING,
  ECONOMY_TUNING,
  BOSS_TUNING,
  FLOW_TUNING,
  WAGER_TUNING,
  GAMBLE_TUNING,
  EARLY_GAME_TUNING,
  INSANE_CONTRACT_MODIFIERS,
  DEBT_PAYDOWN_TUNING,
  FIXER_LINES,
  pickLine,
  DEFAULT_RUN_BUILD,
  mergeMetaState,
  saveMetaState,
  clearSavedRun,
  loadSavedRun,
  saveSavedRun,
  hydrateItem,
  hydratePath,
  bossById,
  PROGRAMS,
  getFlowMultiplier,
  getHandMasteryBonus,
} = catalog;

export function createGameActions(getScope) {
  const scope = getScope();
  const {
    phase,
    round,
    score,
    target,
    hands,
    discards,
    gold,
    debt,
    stash,
    persona,
    personaIdx,
    dice,
    kept,
    rolling,
    hasRolled,
    inventory,
    consumables,
    activeBoss,
    insaneContract,
    hardwareDisabled,
    flowStreak,
    handLevels,
    activeWager,
    history,
    usedCats,
    runStats,
    arcId,
    runClosed,
    reducedMotion,
    meta,
    paths,
    shopRefreshes,
    shopItems,
    gambleStake,
    currentRouteEffect,
    selectedItem,
    carvingDie,
    swapMode,
    swapIdx,
    currentTarget,
    canPlaceWager,
    wagerThreshold,
    analyzeRunFailure,
    generateShop,
    playStoryBeat,
    showMechanicPopup,
    spawnHitCallout,
    spawnPaperStamp,
    spawnFlying,
    cascadeTriggers,
    triggerCameraKick,
    patchSettings,
    scheduleTimeout,
    scheduleInterval,
    clearScheduledInterval,
    AudioSystem,
    setPhase,
    setPersona,
    setPersonaIdx,
    setRound,
    setScore,
    setTarget,
    setHands,
    setDiscards,
    setGold,
    setDebt,
    setStash,
    setInsaneContract,
    setInventory,
    setConsumables,
    setDice,
    setKept,
    setHasRolled,
    setUsedCats,
    setHandLevels,
    setFlowStreak,
    setShopItems,
    setShopRefreshes,
    setGambleStake,
    setActiveWager,
    setCurrentRouteEffect,
    setPaths,
    setActiveBoss,
    setBossIntro,
    setSelectedItem,
    setCarvingDie,
    setSwapMode,
    setSwapIdx,
    setHistory,
    setRunStats,
    setBustActive,
    setPayoutActive,
    setFlyingScores,
    setCinematic,
    setScoreResolution,
    setScoreBreakdown,
    setLossExplanation,
    setSoldItems,
    setCarveSparks,
    setPillBursts,
    setStoryBeat,
    setRunClosed,
    setFixerLine,
    setLastLaundered,
    setHasSavedRun,
    setMeta,
    setRolling,
    setFeltPulse,
    setActiveMechanicPopup,
    setShowMobileStash,
    setHitFlashActive,
    setScorePulse,
    setPowBurst,
    setTriggerCascade,
  } = scope;

  const getBossAdjustedTarget = (baseTarget, boss, roundNum) => {
        return GutterbonesRoutes.applyBossAdjustedTarget(baseTarget, boss, roundNum);
    };

  const calculateScore = (catId, currentDice) => GutterbonesRules.calculateScore(catId, currentDice, {
        handLevels, flowStreak, inventory, hardwareDisabled, activeBoss,
        CATEGORIES, HAND_MASTERY_TUNING, getFlowMultiplier, getHandMasteryBonus
    });

  const rollBones = () => {
        if (rollLockRef.current || rolling || hands <= 0) return;
        if (hasRolled && discards <= 0) return;
        const now = Date.now();
        if (now - lastRollStartedAtRef.current < 300) return;
        rollLockRef.current = true;
        lastRollStartedAtRef.current = now;
        const settleMs = 800;
        let toll = 0;
        if (activeBoss?.id === 'LOAN_SHARK') toll += debt > 0 ? BOSS_TUNING.loanSharkDebtToll : BOSS_TUNING.loanSharkToll;
        if (inventory.some(i => i.id === 'BLOOD_PACT')) toll += 1;
        if (insaneContract) toll += INSANE_CONTRACT_MODIFIERS.extraRollToll;
        if (activeBoss?.id === 'LOAN_SHARK') spawnHitCallout('BOSS: LOAN SHARK TOLL');
        setFixerLine(toll > 0 ? pickLine(FIXER_LINES.pressure) : pickLine(FIXER_LINES.roll));
        if (toll > 0) {
            setGold(g => {
                if (g >= toll) return g - toll;
                const shortage = toll - g;
                registerDebtSpike(shortage, 'shortage');
                return 0;
            });
        }
        AudioSystem.clatter();
        setRolling(true);
        setFeltPulse(true);
        triggerCameraKick('soft');
        scheduleTimeout(() => setFeltPulse(false), 650);
        if (hasRolled) setDiscards(d => d - 1);
        setHasRolled(true);
        const interval = scheduleInterval(() => setDice(prev => prev.map((d,i) => kept[i] ? d : { ...d, value: Math.ceil(Math.random()*6), faceId: null, faceLabel: null, faceStyle: null, type: 'standard' })), 70);
        scheduleTimeout(() => {
            clearScheduledInterval(interval);
            setDice(prev => prev.map((d,i) => {
                if (kept[i]) return d;
                const face = d.faces[Math.floor(Math.random() * d.faces.length)];
                const isStandard = face.type === 'standard';
                let value = face.value;
                if (activeBoss?.id === 'JUNKIE' && value === 6) value = 1;
                return { ...d, value, faceId: isStandard ? null : face.id, faceLabel: isStandard ? null : face.label, faceStyle: isStandard ? null : face.style, type: isStandard ? 'standard' : face.type };
            }));
            setRolling(false);
            rollLockRef.current = false;
            const pending = pendingPayoutRef.current;
            if (pending) {
                pendingPayoutRef.current = null;
                executePayout(pending);
            }
        }, settleMs);
    };

  const popPill = (idx) => {
        showMechanicPopup('PILL');
        if (discards <= 0 || rolling) return;
        patchSettings({ dismissPillPulse: true });
        if (activeBoss?.id === 'THE_RAID') {
            spawnHitCallout('BOSS: RAID PILL TOLL');
            setGold(g => {
                if (g >= 2) return g - 2;
                const shortage = 2 - g;
                registerDebtSpike(shortage, 'pill toll');
                return 0;
            });
        }
        if (inventory.some(i => i.id === 'BLACK_BOOK') && !hardwareDisabled) setGold(g => g + 1);
        setDiscards(d => d - 1);
        setActiveMechanicPopup(null);
        setDice(prev => {
            const next = [...prev];
            const die = next[idx];
            const face = die.faces[Math.floor(Math.random() * die.faces.length)];
            const isStandard = face.type === 'standard';
            let value = face.value;
            if (activeBoss?.id === 'JUNKIE' && value === 6) value = 1;
            next[idx] = {
                ...die,
                value,
                faceId: isStandard ? null : face.id,
                faceLabel: isStandard ? null : face.label,
                faceStyle: isStandard ? null : face.style,
                type: isStandard ? 'standard' : face.type,
                id: Math.random()
            };
            return next;
        });
        if (!reducedMotion) {
            const burstId = Math.random();
            setPillBursts(prev => [...prev, { id: burstId, idx }]);
            scheduleTimeout(() => setPillBursts(prev => prev.filter(p => p.id !== burstId)), 360);
        }
        AudioSystem.playTone(600, 'square', 0.1);
    };

  const handleProgram = (p) => {
        showMechanicPopup(`PROGRAM_${p.id}`);
        if (stash < p.cost || activeBoss?.id === 'INFORMANT') return;
        if (p.id === 'SNIFF') {
            const free = dice.map((_, i) => i).filter(i => !kept[i]);
            if (discards <= 0 || !free.length) return;
        }
        setStash(s => s - p.cost);
        if (p.id === 'SNIFF') {
            const free = dice.map((_, i) => i).filter(i => !kept[i]);
            popPill(free[Math.floor(Math.random() * free.length)]);
        }
        if (p.id === 'BRIBE') setTarget(t => Math.max(25, Math.floor(t * .85)));
        if (p.id === 'FIX') setDice(prev => prev.map((d,i) => i === 0 || d.faceId ? d : { ...d, value: prev[0].value }));
        if (p.id === 'LAUNDER') setDebt(0);
        setActiveMechanicPopup(null);
        setShowMobileStash(false);
    };

  const resumeRun = () => {
        const saved = loadSavedRun();
        if (!saved) return;
        const savedPersona = PERSONAS.find(p => p.id === saved.personaId) || PERSONAS[saved.personaIdx] || PERSONAS[0];
        setPersona(savedPersona);
        setPersonaIdx(Math.max(0, PERSONAS.findIndex(p => p.id === savedPersona.id)));
        setRound(saved.round || 1);
        setScore(saved.score || 0);
        setTarget(saved.target || EARLY_GAME_TUNING.openingTarget);
        setHands(saved.hands || savedPersona.plays);
        setDiscards(saved.discards ?? savedPersona.pills);
        setGold(saved.gold ?? savedPersona.cash);
        setDebt(saved.debt || 0);
        setStash(saved.stash || 0);
        setInsaneContract(!!saved.insaneContract);
        setInventory((saved.inventory || []).map(hydrateItem));
        setConsumables((saved.consumables || []).map(hydrateItem));
        setDice(saved.dice || []);
        setKept(saved.kept || [false,false,false,false,false]);
        setHasRolled(!!saved.hasRolled);
        setUsedCats(saved.usedCats || []);
        setHandLevels(saved.handLevels || {});
        setFlowStreak(saved.flowStreak || 0);
        setShopItems((saved.shopItems || []).map(hydrateItem));
        setShopRefreshes(saved.shopRefreshes || 0);
        setGambleStake(saved.gambleStake || 0);
        setActiveWager(saved.activeWager || null);
        setCurrentRouteEffect(saved.currentRouteEffect || null);
        setPaths((saved.paths || []).map(hydratePath));
        setActiveBoss(saved.activeBossId ? bossById(saved.activeBossId) : null);
        setBossIntro(null);
        setSelectedItem(hydrateItem(saved.selectedItem));
        setCarvingDie(saved.carvingDie ?? null);
        setSwapMode(!!saved.swapMode);
        setSwapIdx(saved.swapIdx ?? null);
        setHistory(saved.history || []);
        setRunStats(saved.runStats || { totalHeat: 0, biggestHustle: 0, finalBoss: '', build: { ...DEFAULT_RUN_BUILD } });
        setBustActive(false);
        setPayoutActive(false);
        setFlyingScores([]);
        setCinematic(null);
        setScoreResolution(null);
        setScoreBreakdown(null);
        setLossExplanation(null);
        setSoldItems([]);
        setCarveSparks([]);
        setPillBursts([]);
        setGambleStake(typeof saved.gambleStake === 'number' ? saved.gambleStake : 0);
        setActiveWager(saved.activeWager || null);
        setArcId(saved.arcId || GutterbonesStory?.DEFAULT_ARC_ID || 'witness');
        setStoryBeat(null);
        setRunClosed(false);
        setFixerLine('Back in the game. Pick your spot.');
        setPhase(saved.phase || 'PLAY');
    };

  const serializeRun = (phaseOverride = phase) => ({
        version: RUN_SAVE_VERSION,
        phase: phaseOverride,
        arcId,
        personaId: persona.id,
        personaIdx,
        round,
        score,
        target,
        hands,
        discards,
        gold,
        debt,
        stash,
        insaneContract,
        inventory,
        consumables,
        dice,
        kept,
        hasRolled,
        usedCats,
        handLevels,
        flowStreak,
        shopItems,
        shopRefreshes,
        gambleStake,
        activeWager,
        currentRouteEffect,
        paths: paths.map(path => ({ ...path, bossId: path.boss?.id, boss: undefined })),
        activeBossId: activeBoss?.id || null,
        selectedItem,
        carvingDie,
        swapMode,
        swapIdx,
        history,
        runStats
    });

  const persistRun = (phaseOverride = phase) => {
        if (runClosed || !RUN_PHASES.includes(phaseOverride)) return;
        const snapshot = serializeRun(phaseOverride);
        saveSavedRun(snapshot);
        setHasSavedRun(true);
    };

  const updateMeta = (updater) => {
        setMeta(prev => {
            const next = mergeMetaState(typeof updater === 'function' ? updater(prev) : updater);
            saveMetaState(next);
            return next;
        });
    };

  const awardLaunderedCash = ({ victory, totalHeat, cash }) => {
        const earned = Math.max(0, victory ? Math.floor(totalHeat / 10) + Math.max(0, cash) : Math.floor(totalHeat / 25));
        setLastLaundered(earned);
        setRunClosed(true);
        updateMeta(prev => ({
            ...prev,
            launderedCash: prev.launderedCash + earned,
            bestHeat: Math.max(prev.bestHeat || 0, totalHeat),
            totalRuns: (prev.totalRuns || 0) + 1,
            completedRuns: (prev.completedRuns || 0) + (victory ? 1 : 0)
        }));
        clearSavedRun();
        setHasSavedRun(false);
        return earned;
    };

  const executePayout = (catId) => {
        if (rolling || rollLockRef.current) {
            pendingPayoutRef.current = catId;
            return;
        }
        patchSettings({ dismissScoreHint: true });
        const result = calculateScore(catId, dice);
        const wager = activeWager;
        let wagerNet = 0;
        let projectedCash = gold;
        let settlementCash = gold;
        setUsedCats(prev => [...prev, catId]);
        setHands(h => h - 1);
        setKept([false,false,false,false,false]);
        setDiscards(persona.pills);
        setHasRolled(false);
        setSwapMode(false);
        setSwapIdx(null);
        const breakdownPayload = {
            id: Math.random(),
            categoryName: result.categoryName || CATEGORIES[catId]?.name || catId,
            chips: result.chips || 0,
            mult: result.mult || 0,
            flowMult: result.flowMult || 1,
            total: result.total || 0,
            explanationSteps: result.explanationSteps || []
        };
        setScoreBreakdown(breakdownPayload);
        scheduleTimeout(() => setScoreBreakdown(current => (current?.id === breakdownPayload.id ? null : current)), reducedMotion ? 4200 : 5600);
        if (result.valid) {
            setFixerLine(result.total >= 220 ? 'That was a statement hand.' : pickLine(FIXER_LINES.hit));
            setFlowStreak(prev => Math.min(FLOW_TUNING.maxStreak, prev + 1));
            setHandLevels(prev => ({
                ...prev,
                [catId]: Math.min(HAND_MASTERY_TUNING.maxLevel, (prev[catId] || HAND_MASTERY_TUNING.baseLevel) + 1)
            }));
            const nextScore = score + result.total;
            setScore(nextScore);
            if (result.total >= 120) {
                const resolutionPayload = {
                    id: Math.random(),
                    chips: result.chips,
                    mult: result.mult,
                    flowMult: result.flowMult || 1,
                    total: result.total
                };
                setScoreResolution(resolutionPayload);
                scheduleTimeout(() => setScoreResolution(current => (current?.id === resolutionPayload.id ? null : current)), reducedMotion ? 900 : 1100);
            }
            if (result.total >= 250) triggerCameraKick('hard');
            else if (result.total >= 80) triggerCameraKick('soft');
            if (result.total >= 150 && !reducedMotion) {
                setHitFlashActive(true);
                scheduleTimeout(() => setHitFlashActive(false), 120);
            }
            setScorePulse(true);
            scheduleTimeout(() => setScorePulse(false), 420);
            spawnFlying(result.total);
            if (result.total >= 400) spawnHitCallout('MONSTER HIT');
            else if (result.total >= 250) spawnHitCallout('BIG HIT');
            if (result.hardwareTriggerCount > 0) spawnHitCallout(`HARDWARE x${result.hardwareTriggerCount}`);
            cascadeTriggers(result.triggers);
            setRunStats(s => ({ ...s, totalHeat: s.totalHeat + result.total, biggestHustle: Math.max(s.biggestHustle, result.total) }));
            if (result.gDelta) setGold(g => Math.max(0, g + result.gDelta));
            const hustleCash = Math.min(ECONOMY_TUNING.hustleCashCap, Math.floor(result.total / ECONOMY_TUNING.hustleCashDivisor));
            if (hustleCash > 0) setGold(g => g + hustleCash);
            projectedCash = Math.max(0, gold + (result.gDelta || 0) + hustleCash);
            settlementCash = projectedCash;
            if (result.total >= ECONOMY_TUNING.debtReliefThreshold) {
                setDebt(d => Math.max(0, d - ECONOMY_TUNING.debtReliefPerBigHand));
            }
            if (activeBoss?.id !== 'INFORMANT') {
                let gain = Math.min(60, (result.total / currentTarget) * 100 * 2);
                if (inventory.some(i => i.id === 'BURNER_PHONE') && !hardwareDisabled) gain *= 1.5;
                if (persona.id === 'HUSTLER') gain *= 0.5;
                if (insaneContract) gain *= INSANE_CONTRACT_MODIFIERS.stashGainMultiplier;
                setStash(s => Math.min(100, s + gain));
            } else {
                spawnHitCallout('BOSS: STASH FROZEN');
            }
            setHistory(h => [...h, { id: Math.random(), round, category: catId, total: result.total, values: dice.map(d => d.value), triggers: result.triggers }]);
            spawnPaperStamp('FILED');
            const tier = result.total >= 250 ? 'max' : result.total >= 100 ? 'big' : result.total >= 30 ? 'mid' : 'small';
            AudioSystem.stinger(tier);
            if (result.total >= 30) {
                setPayoutCount(reducedMotion ? 4 : (result.total >= 250 ? 30 : result.total >= 100 ? 18 : 8));
                setPayoutActive(true);
                scheduleTimeout(() => setPayoutActive(false), reducedMotion ? 900 : 1800);
            }
            if (result.total >= 250 && !reducedMotion) {
                setPowBurst(true);
                scheduleTimeout(() => setPowBurst(false), 700);
            }
        } else {
            setFixerLine(pickLine(FIXER_LINES.bust));
            setFlowStreak(0);
            AudioSystem.playTone(80, 'sawtooth', 0.25);
        }
        if (wager) {
            const wagerWon = result.valid && result.total >= wager.threshold;
            if (wagerWon) {
                const wagerPayout = Math.max(wager.stake + 1, Math.round(wager.stake * WAGER_TUNING.payoutMultiplier));
                wagerNet = wagerPayout;
                setGold(g => g + wagerPayout);
                projectedCash += wagerPayout;
                settlementCash += wagerPayout;
                setFixerLine(`Side bet cashed: +$${wagerPayout}.`);
                spawnPaperStamp('BET HIT', '#0f766e');
            } else {
                setFixerLine('Side bet burned. Keep playing clean.');
                spawnPaperStamp('BET LOST');
            }
            setActiveWager(null);
        }
        const gained = result.valid ? result.total : 0;
        if (hands <= 1 && score + gained < currentTarget) {
            const finalHeat = runStats.totalHeat + gained;
            const projectedFlow = result.valid ? Math.min(FLOW_TUNING.maxStreak, flowStreak + 1) : 0;
            const analysis = analyzeRunFailure({
                score: score + gained,
                target: currentTarget,
                debt,
                hands: hands - 1,
                history: result.valid ? [...history, { round, total: result.total }] : history,
                attempts: usedCats.length + 1,
                roundNumber: round,
                boss: activeBoss,
                flowValue: projectedFlow
            });
            const lossPayload = { id: Math.random(), ...analysis };
            setLossExplanation(lossPayload);
            scheduleTimeout(() => setLossExplanation(current => (current?.id === lossPayload.id ? null : current)), reducedMotion ? 6500 : 8500);
            setRunStats(s => ({ ...s, finalBoss: activeBoss ? activeBoss.name : 'STREET GOONS' }));
            setGambleStake(0);
            setFixerLine('Quota missed. Keep your chin down.');
            awardLaunderedCash({ victory: false, totalHeat: finalHeat, cash: settlementCash });
            setBustActive(true);
            triggerCameraKick('hard');
            if (!reducedMotion) setCinematic('bust');
            AudioSystem.bust();
            const goRapSheet = () => {
                setScoreResolution(null);
                setPayoutActive(false);
                setPowBurst(false);
                setPhase('RAP_SHEET');
                if (!reducedMotion) scheduleTimeout(() => setCinematic(null), 350);
            };
            const bustDelay = reducedMotion ? 400 : 900;
            scheduleTimeout(() => {
                playStoryBeat(GutterbonesStory?.getBustPanel?.(arcId), goRapSheet);
            }, bustDelay);
        } else if (hands <= 1) {
            const quotaCleared = score + gained >= currentTarget;
            if (round >= 10) {
                setLossExplanation(null);
                setGambleStake(0);
                setFixerLine('You cleared the city. Time to disappear.');
                awardLaunderedCash({ victory: true, totalHeat: runStats.totalHeat + gained, cash: settlementCash });
                AudioSystem.paper();
                if (!reducedMotion) setCinematic('victory');
                const goVictory = () => {
                    setScoreResolution(null);
                    setPayoutActive(false);
                    setPowBurst(false);
                    setPhase('VICTORY');
                    if (!reducedMotion) scheduleTimeout(() => setCinematic(null), 800);
                };
                scheduleTimeout(() => {
                    playStoryBeat(GutterbonesStory?.getVictoryPanel?.(arcId), goVictory);
                }, reducedMotion ? 120 : 480);
            } else {
                const stake = GutterbonesGamble.baseStake(projectedCash);
                const allowGamble = round >= GAMBLE_TUNING.minRound && projectedCash >= GAMBLE_TUNING.minStake;
                if (allowGamble) {
                    setGambleStake(stake);
                    setFixerLine(quotaCleared
                        ? `Round ${round} quota cleared. ${pickLine(FIXER_LINES.gamble)}`
                        : pickLine(FIXER_LINES.gamble));
                    setPhase('GAMBLE');
                } else {
                    generateShop();
                    if (quotaCleared) {
                        setFixerLine(`Round ${round} quota cleared. Pick a route — Pawn/Smuggle pay +$15 bonus cash.`);
                    }
                    setPhase('SHOP');
                }
            }
        }
    };

  const payDebtFromCash = (amount) => {
        if (phase !== 'SHOP' || debt <= 0 || gold <= 0) return;
        const maxPaymentForDebt = Math.ceil(debt / DEBT_PAYDOWN_TUNING.reliefMultiplier);
        const payment = Math.min(amount, gold, maxPaymentForDebt);
        if (payment <= 0) return;
        const debtRelief = Math.min(debt, Math.max(1, Math.floor(payment * DEBT_PAYDOWN_TUNING.reliefMultiplier)));
        setGold(g => g - payment);
        setDebt(d => Math.max(0, d - debtRelief));
        spawnPaperStamp('PAID DOWN', '#0f766e');
        AudioSystem.playTone(420, 'triangle', 0.1);
    };

  const registerDebtSpike = (shortage, source = 'shortage') => {
        const debtSpike = Math.max(1, Math.ceil(shortage * ECONOMY_TUNING.shortageToDebtRatio));
        setDebt(d => d + debtSpike);
        const sourceLabel = source.toUpperCase();
        spawnHitCallout(`+DEBT (${sourceLabel})`);
        cascadeTriggers([{ name: 'DEBT', value: `+${debtSpike} ${sourceLabel}` }]);
        return debtSpike;
    };
  return {
    getBossAdjustedTarget,
    calculateScore,
    rollBones,
    popPill,
    handleProgram,
    resumeRun,
    serializeRun,
    persistRun,
    updateMeta,
    awardLaunderedCash,
    executePayout,
    payDebtFromCash,
    registerDebtSpike,
  };
}
