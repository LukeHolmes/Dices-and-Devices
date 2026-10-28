import GutterbonesRules from "../systems/rules.js";
import GutterbonesOnboarding from "../systems/onboarding.js";
import GutterbonesGamble from "../systems/gamble.js";

export const PERSONAS = [
    { id: 'STREET_RAT', name: 'The Street Rat', alias: 'DEFAULT', cash: 20, plays: 4, pills: 3, quirk: 'No gimmick. Just a kid with a pocket full of raw bones.', loadout: '5x Standard Bones', color: 'bg-gray-600', portraitSrc: 'assets/personas/street-rat.png', portraitAlt: 'The Street Rat' },
    { id: 'HUSTLER', name: 'The Hustler', alias: 'DEEP POCKETS', cash: 50, plays: 4, pills: 2, quirk: 'Starts flush with cash, but the Stash fills 50% slower.', loadout: '5x Standard Bones', color: 'bg-yellow-700', portraitSrc: 'assets/personas/hustler.png', portraitAlt: 'The Hustler' },
    { id: 'ENFORCER', name: 'The Enforcer', alias: 'BRUISER', cash: 10, plays: 4, pills: 0, quirk: 'Zero pills. No second chances. Starts with a Blood 6.', loadout: '1x Blood 6, 4x Standard', color: 'bg-red-900', portraitSrc: 'assets/personas/enforcer.png', portraitAlt: 'The Enforcer' },
    { id: 'CARD_COUNTER', name: 'The Counter', alias: 'BRAINIAC', cash: 15, plays: 4, pills: 3, quirk: 'Starts with The Black Book. Quota starts 20% higher.', loadout: 'The Black Book, 5x Standard', color: 'bg-blue-900', portraitSrc: 'assets/personas/card-counter.png', portraitAlt: 'The Counter' }
];

export const FACE_DATABASE = {
    MULT_FACE: { id: 'MULT_FACE', value: 0, label: '+1 MULT', style: 'bg-[#111] text-[#0df] border-[#0df]', type: 'modifier', cost: 12, rarity: 'common' },
    GOLD_FACE: { id: 'GOLD_FACE', value: 0, label: '+$2 CASH', style: 'bg-[#1a1a00] text-[#d6b85c] border-[#d6b85c]', type: 'modifier', cost: 10, rarity: 'common' },
    WILD_FACE: { id: 'WILD_FACE', value: 'W', label: 'WILD', style: 'bg-[#1a001a] text-[#ff007f] border-[#ff007f]', type: 'wild', cost: 18, rarity: 'rare' },
    BLOOD_6: { id: 'BLOOD_6', value: 6, label: 'BLOOD 6', style: 'bg-[#2b0808] text-[#ff1111] border-[#ff1111]', type: 'blood', cost: 16, rarity: 'danger' },
    ECHO_FACE: { id: 'ECHO_FACE', value: 0, label: 'ECHO', style: 'bg-[#111] text-[#0df] border-[#0df]', type: 'adjacent', cost: 16, rarity: 'rare' },
    SHIV_FACE: { id: 'SHIV_FACE', value: 0, label: 'THE SHIV', style: 'bg-[#1a0000] text-[#ff1111] border-[#ff1111]', type: 'destructive', cost: 22, rarity: 'danger' },
    WIREBAG_FACE: { id: 'WIREBAG_FACE', value: 0, label: 'WIREBAG', style: 'bg-[#001111] text-[#0df] border-[#0df] border-dashed', type: 'parasite', cost: 14, rarity: 'danger' },
    GHOST_FACE: { id: 'GHOST_FACE', value: 0, label: 'GHOST', style: 'bg-transparent text-white border-white border-dashed opacity-70', type: 'ethereal', cost: 20, rarity: 'rare' }
};

export const DEVISES = {
    CENTERPIECE: { id: 'CENTERPIECE', name: 'The Centerpiece', desc: 'Slot 3 bone triggers base value and face bonuses twice.', cost: 20, rarity: 'rare' },
    BOOKENDS: { id: 'BOOKENDS', name: 'The Bookends', desc: 'If Slot 1 and 5 match exactly, +30 chips.', cost: 18, rarity: 'common' },
    ENGINE: { id: 'ENGINE', name: 'The Engine', desc: 'Slot 1 adds mult for each higher-value bone to its right. Max +4.', cost: 25, rarity: 'rare' },
    LOADED_DIE: { id: 'LOADED_DIE', name: 'Weighted Core', desc: '+10 chips on Triad.', cost: 12, rarity: 'common' },
    BLOOD_PACT: { id: 'BLOOD_PACT', name: 'Blood Pact', desc: 'x3 mult, but -$1 per roll.', cost: 20, rarity: 'danger' },
    BRASS_KNUCKLES: { id: 'BRASS_KNUCKLES', name: 'Brass Knuckles', desc: 'If all scoring bones are 1s, 2s, or 3s, +3 mult.', cost: 18, rarity: 'common' },
    BLACK_BOOK: { id: 'BLACK_BOOK', name: 'The Black Book', desc: 'Gain $1 when you pop a pill.', cost: 20, rarity: 'rare' },
    BURNER_PHONE: { id: 'BURNER_PHONE', name: 'Burner Phone', desc: 'The Stash fills 50% faster.', cost: 25, rarity: 'rare' },
    SHADY_LEDGER: { id: 'SHADY_LEDGER', name: 'Shady Ledger', desc: 'Debt no longer spikes quota. Lose 1 Play while in debt.', cost: 28, rarity: 'danger' },
    CROWBAR: { id: 'CROWBAR', name: 'The Crowbar', desc: '+1 mult for each Blood or Destructive face showing. Max +5.', cost: 22, rarity: 'common' }
};

export const PROGRAMS = [
    { id: 'SNIFF', name: 'SNIFF', desc: 'Reroll one random free bone.', cost: 25 },
    { id: 'BRIBE', name: 'BRIBE', desc: '-15% quota.', cost: 60 },
    { id: 'FIX', name: 'FIX GAME', desc: 'Match plain bones to Slot 1.', cost: 80 },
    { id: 'LAUNDER', name: 'LAUNDER', desc: 'Clear debt.', cost: 100 }
];

export const MECHANIC_HINTS = {
    PILL: {
        title: 'PILL REROLL',
        body: 'Spend 1 Pill to reroll this single bone. During THE RAID, each pill also costs $2. If The Black Book is active, pill use grants +$1.'
    },
    PROGRAM_SNIFF: {
        title: 'SNIFF (25% STASH)',
        body: 'Rerolls one random free (unkept) bone. It uses the same reroll rules as pills.'
    },
    PROGRAM_BRIBE: {
        title: 'BRIBE (60% STASH)',
        body: 'Reduces current quota by 15%. Great when target pressure is getting too high.'
    },
    PROGRAM_FIX: {
        title: 'FIX GAME (80% STASH)',
        body: 'Matches plain bones to Slot 1 value. Useful for forcing sets or stabilizing weak rolls.'
    },
    PROGRAM_LAUNDER: {
        title: 'LAUNDER (100% STASH)',
        body: 'Clears current debt immediately.'
    }
};

export const BUILD_IDS = {
    UNKNOWN: 'UNKNOWN',
    MULT_ENGINE: 'MULT_ENGINE',
    BLOOD_RISK: 'BLOOD_RISK',
    CASH_CONTROL: 'CASH_CONTROL',
    SET_CONSISTENCY: 'SET_CONSISTENCY',
    CHAOS: 'CHAOS_DESTRUCTIVE'
};

export const DEFAULT_RUN_BUILD = { primary: BUILD_IDS.UNKNOWN, peakConfidence: 0, keyItems: [] };

export const BUILD_UI = {
    [BUILD_IDS.UNKNOWN]: { label: 'FORMING', accent: 'text-gray-400', border: 'border-gray-600' },
    [BUILD_IDS.MULT_ENGINE]: { label: 'MULT ENGINE', accent: 'text-[#0df]', border: 'border-cyan-700/50' },
    [BUILD_IDS.BLOOD_RISK]: { label: 'BLOOD RISK', accent: 'text-red-400', border: 'border-red-800/50' },
    [BUILD_IDS.CASH_CONTROL]: { label: 'CASH CONTROL', accent: 'text-[#d6b85c]', border: 'border-[#c78b16]/40' },
    [BUILD_IDS.SET_CONSISTENCY]: { label: 'SET CONSISTENCY', accent: 'text-emerald-300', border: 'border-emerald-800/40' },
    [BUILD_IDS.CHAOS]: { label: 'CHAOS', accent: 'text-fuchsia-300', border: 'border-fuchsia-700/40' }
};

export const BUILD_TIPS = {
    [BUILD_IDS.UNKNOWN]: ['Keep rolling to reveal your angle.', 'Contraband faces and hardware define the story.'],
    [BUILD_IDS.MULT_ENGINE]: ['Stack multipliers early.', 'Prioritize scaling over raw chip totals when flow is warm.'],
    [BUILD_IDS.BLOOD_RISK]: ['Manage risk vs reward on toll faces.', 'Pair burst chips with mult when you can clear quota.'],
    [BUILD_IDS.CASH_CONTROL]: ['Convert heat into cash upgrades.', 'Black Book rewards disciplined pill timing.'],
    [BUILD_IDS.SET_CONSISTENCY]: ['Lean on reliable categories while variance stays low.', 'Avoid overloading exotic faces if you want clean lines.'],
    [BUILD_IDS.CHAOS]: ['Expect swingy hands - plan spare plays.', 'Destructive faces trade stability for spikes.']
};

export const BUILD_STYLE_BLURBS = {
    [BUILD_IDS.UNKNOWN]: { scale: 'Unknown scaling curve', consistency: 'Still reading the table' },
    [BUILD_IDS.MULT_ENGINE]: { scale: 'High scaling build', consistency: 'Variance rises with mult chains' },
    [BUILD_IDS.BLOOD_RISK]: { scale: 'Burst-heavy pressure', consistency: 'Swingy - tolls and spikes' },
    [BUILD_IDS.CASH_CONTROL]: { scale: 'Moderate heat scaling', consistency: 'Steadier economy pacing' },
    [BUILD_IDS.SET_CONSISTENCY]: { scale: 'Linear chip gains', consistency: 'High table consistency' },
    [BUILD_IDS.CHAOS]: { scale: 'Volatile spikes', consistency: 'Low predictability' }
};

export const ITEM_ARCHETYPE_TAGS = {
    MULT_FACE: [BUILD_IDS.MULT_ENGINE],
    ECHO_FACE: [BUILD_IDS.MULT_ENGINE],
    ENGINE: [BUILD_IDS.MULT_ENGINE],
    CROWBAR: [BUILD_IDS.MULT_ENGINE, BUILD_IDS.BLOOD_RISK],
    CENTERPIECE: [BUILD_IDS.MULT_ENGINE],
    BLOOD_6: [BUILD_IDS.BLOOD_RISK],
    BLOOD_PACT: [BUILD_IDS.BLOOD_RISK],
    SHIV_FACE: [BUILD_IDS.BLOOD_RISK, BUILD_IDS.CHAOS],
    GOLD_FACE: [BUILD_IDS.CASH_CONTROL],
    BLACK_BOOK: [BUILD_IDS.CASH_CONTROL],
    WIREBAG_FACE: [BUILD_IDS.CASH_CONTROL, BUILD_IDS.CHAOS],
    GHOST_FACE: [BUILD_IDS.CHAOS, BUILD_IDS.MULT_ENGINE],
    WILD_FACE: [BUILD_IDS.CHAOS, BUILD_IDS.SET_CONSISTENCY],
    BOOKENDS: [BUILD_IDS.SET_CONSISTENCY],
    BRASS_KNUCKLES: [BUILD_IDS.SET_CONSISTENCY],
    LOADED_DIE: [BUILD_IDS.SET_CONSISTENCY],
    DIRTY_WAD: [BUILD_IDS.CASH_CONTROL]
};

export const getArchetypeTagsForItemId = (itemId) => {
    if (!itemId) return [];
    return ITEM_ARCHETYPE_TAGS[itemId] ? [...ITEM_ARCHETYPE_TAGS[itemId]] : [];
};

export const synergyLabelForItem = (itemId, primaryBuild) => {
    const tags = getArchetypeTagsForItemId(itemId);
    if (!tags.length || primaryBuild === BUILD_IDS.UNKNOWN) return null;
    if (tags.includes(primaryBuild)) {
        const ui = BUILD_UI[primaryBuild] || BUILD_UI[BUILD_IDS.UNKNOWN];
        return `Synergy: ${ui.label}`;
    }
    const hit = tags.find((t) => t !== BUILD_IDS.UNKNOWN);
    if (!hit) return null;
    const ui = BUILD_UI[hit];
    return ui ? `Synergy: ${ui.label}` : null;
};

export const itemFitsCurrentBuild = (itemId, primaryBuild) => {
    if (!itemId || primaryBuild === BUILD_IDS.UNKNOWN) return false;
    return getArchetypeTagsForItemId(itemId).includes(primaryBuild);
};

export const countCarvedFace = (dice, faceId) => {
    let n = 0;
    (dice || []).forEach((die) => {
        (die.faces || []).forEach((f) => {
            if (f && f.id === faceId) n += 1;
        });
    });
    return n;
};

export const diceShowsFace = (dice, faceId) => {
    if (countCarvedFace(dice, faceId) > 0) return true;
    return (dice || []).some((d) => d.faceId === faceId);
};

export const countSpecialFaceSlots = (dice) => {
    let n = 0;
    (dice || []).forEach((die) => {
        (die.faces || []).forEach((f) => {
            if (f && f.id && f.id !== 'standard') n += 1;
        });
    });
    return n;
};

export const aggregateHistoryTriggers = (history, maxHands = 10) => {
    const slice = (history || []).slice(-maxHands);
    const parts = [];
    slice.forEach((h) => {
        (h.triggers || []).forEach((t) => {
            parts.push(`${t.name || ''} ${t.value || ''}`);
        });
    });
    return parts.join(' | ');
};

export const deriveKeyItems = (primaryBuild, inventory, dice, flowStreak = 0) => {
    const out = [];
    const push = (id) => {
        if (!id || out.includes(id) || out.length >= 6) return;
        const tags = getArchetypeTagsForItemId(id);
        if (tags.includes(primaryBuild)) out.push(id);
    };
    (inventory || []).forEach((i) => push(i.id));
    (dice || []).forEach((die) => {
        (die.faces || []).forEach((f) => {
            if (f && f.id && f.id !== 'standard') push(f.id);
        });
    });
    if (flowStreak >= 3 && (primaryBuild === BUILD_IDS.MULT_ENGINE || primaryBuild === BUILD_IDS.SET_CONSISTENCY) && out.length < 6) {
        out.push('FLOW_STREAK');
    }
    return out;
};

export const analyzeBuild = ({ inventory, dice, history, flowStreak }) => {
    const inv = new Set((inventory || []).map((i) => i.id));
    const multCount = countCarvedFace(dice, 'MULT_FACE');
    const goldCount = countCarvedFace(dice, 'GOLD_FACE');
    const hasBlood6 = diceShowsFace(dice, 'BLOOD_6');
    const chaosCount = ['SHIV_FACE', 'WIREBAG_FACE', 'GHOST_FACE'].filter((fid) => diceShowsFace(dice, fid)).length;
    const histText = aggregateHistoryTriggers(history, 12);
    const multHits = (histText.match(/\+MULT|ENGINE|CROWBAR|GHOST/g) || []).length;
    const bloodHits = (histText.match(/BLOOD|PACT|SHIV/g) || []).length;
    const cashHits = (histText.match(/CASH|WIRE/g) || []).length;
    const totals = (history || []).map((h) => h.total).filter((t) => typeof t === 'number' && !Number.isNaN(t));
    const weights = {
        [BUILD_IDS.MULT_ENGINE]: 0,
        [BUILD_IDS.BLOOD_RISK]: 0,
        [BUILD_IDS.CASH_CONTROL]: 0,
        [BUILD_IDS.SET_CONSISTENCY]: 0,
        [BUILD_IDS.CHAOS]: 0
    };
    const sig = {
        [BUILD_IDS.MULT_ENGINE]: [],
        [BUILD_IDS.BLOOD_RISK]: [],
        [BUILD_IDS.CASH_CONTROL]: [],
        [BUILD_IDS.SET_CONSISTENCY]: [],
        [BUILD_IDS.CHAOS]: []
    };

    let w = 0;
    if (multCount >= 2) { w += 3.2; sig[BUILD_IDS.MULT_ENGINE].push('board:2+MULT'); }
    else if (multCount === 1) { w += 1.2; sig[BUILD_IDS.MULT_ENGINE].push('board:MULT'); }
    if (inv.has('ENGINE')) { w += 2.6; sig[BUILD_IDS.MULT_ENGINE].push('inv:ENGINE'); }
    if (inv.has('CROWBAR')) { w += 1.4; sig[BUILD_IDS.MULT_ENGINE].push('inv:CROWBAR'); }
    if (multHits >= 4) { w += 2.4; sig[BUILD_IDS.MULT_ENGINE].push('hist:mult_heavy'); }
    else if (multHits >= 1) { w += 0.9; sig[BUILD_IDS.MULT_ENGINE].push('hist:mult_light'); }
    if (flowStreak >= 2 && (multCount >= 1 || inv.has('ENGINE'))) { w += 0.6; sig[BUILD_IDS.MULT_ENGINE].push('flow:mult'); }
    weights[BUILD_IDS.MULT_ENGINE] = w;

    w = 0;
    if (hasBlood6) { w += 3; sig[BUILD_IDS.BLOOD_RISK].push('board:BLOOD_6'); }
    if (inv.has('BLOOD_PACT')) { w += 2.5; sig[BUILD_IDS.BLOOD_RISK].push('inv:PACT'); }
    if (inv.has('CROWBAR')) { w += 1.1; sig[BUILD_IDS.BLOOD_RISK].push('inv:CROWBAR'); }
    if (bloodHits >= 4) { w += 2.2; sig[BUILD_IDS.BLOOD_RISK].push('hist:blood_pressure'); }
    else if (bloodHits >= 1) { w += 0.8; sig[BUILD_IDS.BLOOD_RISK].push('hist:blood_trace'); }
    if (diceShowsFace(dice, 'SHIV_FACE')) { w += 0.9; sig[BUILD_IDS.BLOOD_RISK].push('board:SHIV'); }
    weights[BUILD_IDS.BLOOD_RISK] = w;

    w = 0;
    if (goldCount >= 2) { w += 3; sig[BUILD_IDS.CASH_CONTROL].push('board:2+GOLD'); }
    else if (goldCount === 1) { w += 1.1; sig[BUILD_IDS.CASH_CONTROL].push('board:GOLD'); }
    if (inv.has('BLACK_BOOK')) { w += 2.2; sig[BUILD_IDS.CASH_CONTROL].push('inv:BLACK_BOOK'); }
    if (cashHits >= 3) { w += 2; sig[BUILD_IDS.CASH_CONTROL].push('hist:cash_triggers'); }
    else if (cashHits >= 1) { w += 0.7; sig[BUILD_IDS.CASH_CONTROL].push('hist:cash_light'); }
    weights[BUILD_IDS.CASH_CONTROL] = w;

    w = 0;
    if (totals.length >= 4) {
        const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
        const variance = totals.reduce((a, t) => a + (t - mean) ** 2, 0) / Math.max(1, totals.length);
        const stdev = Math.sqrt(variance);
        const cv = mean > 8 ? stdev / mean : 1;
        if (cv < 0.38 && mean > 22) { w += 3; sig[BUILD_IDS.SET_CONSISTENCY].push('hist:low_variance'); }
        if (totals.length >= 6) { w += 0.8; sig[BUILD_IDS.SET_CONSISTENCY].push('hist:volume'); }
    }
    const specials = countSpecialFaceSlots(dice);
    if (specials <= 4 && totals.length >= 3) { w += 1.2; sig[BUILD_IDS.SET_CONSISTENCY].push('board:clean_loadout'); }
    weights[BUILD_IDS.SET_CONSISTENCY] = w;

    w = chaosCount * 1.4;
    if (diceShowsFace(dice, 'WIREBAG_FACE')) { w += 0.8; sig[BUILD_IDS.CHAOS].push('board:WIREBAG'); }
    if (diceShowsFace(dice, 'GHOST_FACE')) { w += 0.7; sig[BUILD_IDS.CHAOS].push('board:GHOST'); }
    if (diceShowsFace(dice, 'WILD_FACE')) { w += 0.5; sig[BUILD_IDS.CHAOS].push('board:WILD'); }
    if ((histText.match(/WIRE|SHIV|GHOST|PACT/g) || []).length >= 5) { w += 1.2; sig[BUILD_IDS.CHAOS].push('hist:volatile'); }
    weights[BUILD_IDS.CHAOS] = w;

    let primaryBuild = BUILD_IDS.UNKNOWN;
    let best = 1.35;
    Object.keys(weights).forEach((k) => {
        if (weights[k] > best) {
            best = weights[k];
            primaryBuild = k;
        }
    });

    const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    let secondaryTag = null;
    if (primaryBuild !== BUILD_IDS.UNKNOWN && sorted.length > 1) {
        const topW = sorted[0][1];
        const runner = sorted.find(([id]) => id !== primaryBuild);
        if (runner && runner[1] >= topW * 0.38 && runner[1] >= 1.05) {
            const ui = BUILD_UI[runner[0]];
            if (ui) secondaryTag = ui.label;
        }
    }

    const denom = Object.values(weights).reduce((a, v) => a + v, 0) + 0.01;
    let confidence = primaryBuild === BUILD_IDS.UNKNOWN ? 0 : Math.min(1, best / (denom * 0.72 + 0.35));
    if (totals.length < 2 && primaryBuild !== BUILD_IDS.UNKNOWN) confidence *= 0.82;

    const signals = primaryBuild === BUILD_IDS.UNKNOWN
        ? ['run:still_open']
        : (sig[primaryBuild] || []).slice(0, 8);

    return { primaryBuild, secondaryTag, confidence, signals };
};

export const BUILD_SYNERGY_CALLOUT = {
    [BUILD_IDS.MULT_ENGINE]: 'MULT CHAIN UP',
    [BUILD_IDS.BLOOD_RISK]: 'BLOOD SYNERGY UP',
    [BUILD_IDS.CASH_CONTROL]: 'ECONOMY BUILD UP',
    [BUILD_IDS.SET_CONSISTENCY]: 'LINE LOCK UP',
    [BUILD_IDS.CHAOS]: 'CHAOS SPIKE UP'
};

export const CONSUMABLES = {
    SECOND_WIND: { id: 'SECOND_WIND', name: 'Second Wind', desc: '+1 Play this round.', cost: 32, rarity: 'common', type: 'consumable', icon: '+1' },
    SMELLING_SALTS: { id: 'SMELLING_SALTS', name: 'Smelling Salts', desc: '+2 Pills immediately.', cost: 24, rarity: 'common', type: 'consumable', icon: '+P' },
    DIRTY_WAD: { id: 'DIRTY_WAD', name: 'Dirty Wad', desc: '+$12 cash on use.', cost: 30, rarity: 'rare', type: 'consumable', icon: '+$' }
};

export const BOSSES = {
    BOUNCER: { id: 'BOUNCER', name: 'THE BOUNCER', desc: 'Quota +50%', color: 'text-gray-300', applyTarget: t => Math.floor(t * 1.5), portraitSrc: 'assets/bosses/bouncer.png', portraitAlt: 'The Bouncer' },
    LOAN_SHARK: { id: 'LOAN_SHARK', name: 'THE LOAN SHARK', desc: '-$2 per roll', color: 'text-red-500', portraitSrc: 'assets/bosses/loan-shark.png', portraitAlt: 'The Loan Shark' },
    JUNKIE: { id: 'JUNKIE', name: 'THE JUNKIE', desc: 'All 6s roll as 1s', color: 'text-[#ff007f]', portraitSrc: 'assets/bosses/junkie.png', portraitAlt: 'The Junkie' },
    CROOKED_COP: { id: 'CROOKED_COP', name: 'CROOKED COP', desc: 'Hardware disabled', color: 'text-blue-400', portraitSrc: 'assets/bosses/crooked-cop.png', portraitAlt: 'Crooked Cop' },
    INFORMANT: { id: 'INFORMANT', name: 'THE INFORMANT', desc: 'Stash frozen', color: 'text-yellow-400', portraitSrc: 'assets/bosses/informant.png', portraitAlt: 'The Informant' },
    THE_RAID: { id: 'THE_RAID', name: 'THE RAID', desc: 'Final job. Quota 300%. Pills cost $2.', color: 'text-red-600 animate-pulse', applyTarget: t => Math.floor(t * 3), portraitSrc: 'assets/bosses/the-raid.png', portraitAlt: 'The Raid' }
};

export const PATHS = [
    { id: 'LOCAL', name: 'BACK ALLEY', desc: 'Standard hustle.', mod: 1, color: 'border-gray-600 text-gray-400' },
    { id: 'PAWN', name: 'PAWN SHOP', desc: '+20% quota, +$15.', mod: 1.2, reward: 15, color: 'border-[#c78b16] text-[#c78b16]' },
    { id: 'HIDEOUT', name: 'SAFEHOUSE CUT', desc: '+9% quota, +1 Play, -1 Pill.', mod: 1.09, handDelta: 1, discardDelta: -1, color: 'border-cyan-500 text-cyan-400' },
    { id: 'SMUGGLE', name: 'SMUGGLE RUN', desc: '+25% quota, +$15, random one-shot.', mod: 1.25, reward: 15, grantRandomConsumable: true, color: 'border-emerald-500 text-emerald-400' },
    { id: 'VIP', name: 'VIP ROOM', desc: '+40% quota, full Stash.', mod: 1.4, fillStash: true, color: 'border-[#ff007f] text-[#ff007f]' }
];

export const ECONOMY_TUNING = {
    shortageToDebtRatio: 0.75,
    hustleCashDivisor: 140,
    hustleCashCap: 4,
    debtReliefThreshold: 180,
    debtReliefPerBigHand: 1
};

export const BOSS_TUNING = {
    loanSharkToll: 2,
    loanSharkDebtToll: 1,
    debtQuotaPenaltyRatio: 1.5,
    debtQuotaPenaltyCap: 120,
    earlyBossRoundCap: 4,
    earlyBouncerRelief: 0.9,
    raidQuotaRelief: 0.92,
    bossPathTargetRelief: 0.93
};

export const SHOP_TUNING = {
    earlyDangerRoundGate: 5,
    maxAffordableBuffer: 25
};

export const EARLY_GAME_TUNING = {
    openingTarget: 130,
    counterOpeningMultiplier: 1.15,
    debtPenaltyStartsRound: 4,
    bossPathStartsRound: 4
};

export const ROUND_CURVE_TUNING = {
    earlyMaxRound: 3,
    midMaxRound: 6,
    early: { pathModWeight: 0.7, flatIncrease: 28 },
    mid: { pathModWeight: 0.95, flatIncrease: 42 },
    late: { pathModWeight: 1.1, flatIncrease: 58 }
};

export const PROGRESSION_GUARDRAILS = {
    minGrowthRate: 1.08,
    earlyMaxGrowthRate: 1.35,
    midMaxGrowthRate: 1.42,
    lateMaxGrowthRate: 1.5,
    dangerCapRound: 6,
    maxEarlyDangerOffers: 1
};

export const SHOP_AGENCY_TUNING = {
    refreshBaseCost: 10,
    refreshRoundTax: 2,
    refreshEscalation: 5,
    sellRate: 0.6
};

export const getShopRefreshCost = (roundNum, refreshCount) => Math.max(
    6,
    SHOP_AGENCY_TUNING.refreshBaseCost +
        ((roundNum - 1) * SHOP_AGENCY_TUNING.refreshRoundTax) +
        (refreshCount * SHOP_AGENCY_TUNING.refreshEscalation)
);

export const getHardwareSellValue = (item) => Math.max(2, Math.floor((item?.cost || 10) * SHOP_AGENCY_TUNING.sellRate));

export const HAND_MASTERY_TUNING = {
    baseLevel: 1,
    chipPerLevel: 5,
    maxLevel: 8
};

export const getHandMasteryBonus = (level) => Math.max(
    0,
    ((level || HAND_MASTERY_TUNING.baseLevel) - HAND_MASTERY_TUNING.baseLevel) * HAND_MASTERY_TUNING.chipPerLevel
);

export const FLOW_TUNING = {
    streakStep: 0.06,
    maxStreak: 6
};

export const getFlowMultiplier = (streak = 0) => 1 + (Math.max(0, Math.min(FLOW_TUNING.maxStreak, streak)) * FLOW_TUNING.streakStep);

export const WAGER_TUNING = {
    baseThreshold: 110,
    roundThresholdStep: 8,
    payoutMultiplier: 1.75,
    stakeOptions: [5, 10, 15]
};

export const GAMBLE_TUNING = GutterbonesGamble.TUNING;

export const DEBT_PAYDOWN_TUNING = {
    reliefMultiplier: 1.1
};

export const INSANE_CONTRACT_MODIFIERS = {
    targetMultiplier: 1.28,
    debtPenaltyMultiplier: 1.35,
    stashGainMultiplier: 0.75,
    extraRollToll: 1,
    playPenalty: 1
};

export const INSANE_CONTRACT_RULES = [
    'Quota +28%',
    'Debt pressure +35%',
    'Stash gain -25%',
    '+$1 toll on every roll',
    '-1 Play each round'
];

export const STREET_INTEL = {
    personas: {
        STREET_RAT: 'Runs light, moves fast, and survives on instinct. Nothing fancy, but every scrap can become leverage.',
        HUSTLER: 'Knows every back-room table in the borough. Starts rich, burns bright, and pays for it with slower stash momentum.',
        ENFORCER: 'An ex-collector with cracked knuckles and no patience. Starts rough, no pills, and swings heavy from hand one.',
        CARD_COUNTER: 'Reads patterns, marks tells, and weaponizes math. Opens with The Black Book but draws bigger heat from the start.'
    },
    bosses: {
        BOUNCER: 'Owns the club doors and skims every take. If you cannot clear his inflated quota, you are out on the curb.',
        LOAN_SHARK: 'Fronts cash with a smile and collects with interest. Every roll costs tribute, especially when you already owe.',
        JUNKIE: 'A chaos broker who salts the bones. Sixes twist into ones when he is around, shredding high-roll plans.',
        CROOKED_COP: 'Badge on paper, extortionist in practice. Hardware goes dark while the cop watches your table.',
        INFORMANT: 'Knows every stash route in the district. Locks your stash progress until you force your way through.',
        THE_RAID: 'Not a person but a citywide crackdown. Triple pressure, expensive pills, and no room for sloppy hands.'
    }
};

export const FIXER_LINES = {
    start: [
        'Keep it tidy. Quota is watching.',
        'Play smart. The alley only forgives once.',
        'No hero plays. Just clean payouts.'
    ],
    roll: [
        'Bones are live. Make it count.',
        'Read the table before you lock.',
        'Don\'t chase ghosts unless you mean it.'
    ],
    pressure: [
        'Toll is up. Keep cash in your coat.',
        'Debt collectors smell weakness.',
        'You\'re bleeding cash. Close this hand.'
    ],
    hit: [
        'That hand sang. Keep the rhythm.',
        'Good cut. File the next one clean.',
        'Sharp work. Build on it.'
    ],
    bust: [
        'Dead hand. Reset your head.',
        'You forced it. Don\'t do that twice.',
        'Cold bones. Next hand, cleaner.'
    ],
    boss: [
        'Boss turf ahead. No sloppy lines.',
        'You\'re on a watched table now.',
        'Eyes up. This one bites back.'
    ],
    gamble: [
        'Side action time. No tears either way.',
        'Pick your flip — soft, fair, or hard.',
        'Take the safe cut or press your luck.'
    ]
};

export const pickLine = (bucket) => {
    if (!bucket || bucket.length === 0) return '';
    return bucket[Math.floor(Math.random() * bucket.length)];
};

export const describeRouteEffects = (path) => {
    if (!path) return [];
    const notes = [];
    if (path.mod && path.mod !== 1) notes.push(`Quota x${path.mod.toFixed(2)}`);
    if (path.reward) notes.push(`+$${path.reward} cash`);
    if (path.fillStash) notes.push('Stash to 100');
    if (path.handDelta) notes.push(`${path.handDelta > 0 ? '+' : ''}${path.handDelta} play`);
    if (path.discardDelta) notes.push(`${path.discardDelta > 0 ? '+' : ''}${path.discardDelta} pill`);
    if (path.grantRandomConsumable) notes.push('Random one-shot');
    return notes;
};

export const CATEGORIES = {
    ONES: { id: 'ONES', name: 'Aces' },
    TWOS: { id: 'TWOS', name: 'Deuces' },
    THREES: { id: 'THREES', name: 'Treys' },
    FOURS: { id: 'FOURS', name: 'Fours' },
    FIVES: { id: 'FIVES', name: 'Fives' },
    SIXES: { id: 'SIXES', name: 'Sixes' },
    TOK: { id: 'TOK', name: 'Triad' },
    FOK: { id: 'FOK', name: 'Quad' },
    FH: { id: 'FH', name: 'Full Ride' },
    SS: { id: 'SS', name: 'Short Run' },
    LS: { id: 'LS', name: 'Long Run' },
    Y: { id: 'Y', name: 'THE JACKPOT' },
    C: { id: 'C', name: 'Slop' }
};

export const ONBOARDING_THRESHOLDS = GutterbonesOnboarding?.THRESHOLDS || {
    BASIC_COMBOS: 2,
    ALL_CATEGORIES: 5,
    RARE_FACES: 3
};

export const getAvailableCategories = (meta) => {
    const runs = meta?.totalRuns || 0;
    const allIds = Object.keys(CATEGORIES);
    const limited = GutterbonesOnboarding?.getAvailableCategoryIds(runs);
    if (limited === null) return allIds;
    return limited.filter((id) => allIds.includes(id));
};

export const getCategoryUnlockInfo = (meta) => (
    GutterbonesOnboarding?.getCategoryUnlockInfo(meta?.totalRuns || 0, Object.keys(CATEGORIES))
    || { totalRuns: 0, available: Object.keys(CATEGORIES), locked: [], lockedDetails: [], nextThreshold: null, runsUntilNext: 0 }
);

export const isShopFaceAvailable = (face, meta) => {
    const runs = meta?.totalRuns || 0;
    if (runs < ONBOARDING_THRESHOLDS.RARE_FACES && face.rarity !== 'common') return false;
    return true;
};

export const STORAGE_KEYS = {
    run: 'gutterbones1977:run:v1',
    meta: 'gutterbones1977:meta:v1',
    settings: 'gutterbones1977:settings:v1'
};

export const DEFAULT_SETTINGS = {
    audioMuted: false,
    audioVolume: 0.82,
    dismissPillPulse: false,
    dismissScoreHint: false,
    dismissBossHint: false
};

export const loadSettingsState = () => {
    const stored = loadJson(STORAGE_KEYS.settings);
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
    return {
        audioMuted: typeof stored.audioMuted === 'boolean' ? stored.audioMuted : DEFAULT_SETTINGS.audioMuted,
        audioVolume: typeof stored.audioVolume === 'number' && !Number.isNaN(stored.audioVolume)
            ? Math.max(0, Math.min(1, stored.audioVolume))
            : DEFAULT_SETTINGS.audioVolume,
        dismissPillPulse: !!stored.dismissPillPulse,
        dismissScoreHint: !!stored.dismissScoreHint,
        dismissBossHint: !!stored.dismissBossHint
    };
};

export const saveSettingsState = (settings) => {
    saveJson(STORAGE_KEYS.settings, {
        audioMuted: !!settings.audioMuted,
        audioVolume: Math.max(0, Math.min(1, settings.audioVolume)),
        dismissPillPulse: !!settings.dismissPillPulse,
        dismissScoreHint: !!settings.dismissScoreHint,
        dismissBossHint: !!settings.dismissBossHint
    });
};

export const RUN_SAVE_VERSION = 2;
export const RUN_PHASES = ['PLAY', 'SHOP', 'CARVING', 'GAMBLE'];

export const DEFAULT_META_STATE = {
    version: 1,
    launderedCash: 0,
    unlockedPersonaIds: ['STREET_RAT', 'HUSTLER'],
    unlockedFaceIds: ['MULT_FACE', 'GOLD_FACE', 'BLOOD_6'],
    unlockedHardwareIds: ['BOOKENDS', 'LOADED_DIE', 'BRASS_KNUCKLES', 'BLACK_BOOK', 'BURNER_PHONE', 'CROWBAR'],
    purchasedUpgradeIds: [],
    bestHeat: 0,
    totalRuns: 0,
    completedRuns: 0
};

export const SAFEHOUSE_UPGRADES = [
    { id: 'unlock-enforcer', name: 'Bring in The Enforcer', desc: 'Adds The Enforcer to The Lineup.', cost: 120, type: 'persona', unlocks: ['ENFORCER'] },
    { id: 'unlock-counter', name: 'Hire The Counter', desc: 'Adds The Counter and his Black Book start.', cost: 180, type: 'persona', unlocks: ['CARD_COUNTER'] },
    { id: 'rare-faces', name: 'Bribe the Bone Carver', desc: 'Adds Wild, Echo, and Ghost faces to future shops.', cost: 220, type: 'faces', unlocks: ['WILD_FACE', 'ECHO_FACE', 'GHOST_FACE'] },
    { id: 'danger-faces', name: 'Meet the Knife Man', desc: 'Adds Shiv and Wirebag faces to future shops.', cost: 260, type: 'faces', unlocks: ['SHIV_FACE', 'WIREBAG_FACE'] },
    { id: 'high-end-hardware', name: 'Call the Fence', desc: 'Adds Centerpiece, Engine, and Shady Ledger hardware.', cost: 300, type: 'hardware', unlocks: ['CENTERPIECE', 'ENGINE', 'SHADY_LEDGER'] }
];

export const mergeMetaState = (stored = {}) => ({
    ...DEFAULT_META_STATE,
    ...stored,
    unlockedPersonaIds: [...new Set([...(DEFAULT_META_STATE.unlockedPersonaIds || []), ...((stored && stored.unlockedPersonaIds) || [])])],
    unlockedFaceIds: [...new Set([...(DEFAULT_META_STATE.unlockedFaceIds || []), ...((stored && stored.unlockedFaceIds) || [])])],
    unlockedHardwareIds: [...new Set([...(DEFAULT_META_STATE.unlockedHardwareIds || []), ...((stored && stored.unlockedHardwareIds) || [])])],
    purchasedUpgradeIds: [...new Set(((stored && stored.purchasedUpgradeIds) || []))]
});

export const loadJson = (key) => {
    try {
        const raw = window.localStorage?.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.warn('Unable to load local save data', err);
        return null;
    }
};

export const saveJson = (key, value) => {
    try {
        window.localStorage?.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn('Unable to save local data', err);
    }
};

export const loadMetaState = () => mergeMetaState(loadJson(STORAGE_KEYS.meta) || {});
export const saveMetaState = (meta) => saveJson(STORAGE_KEYS.meta, meta);

export const normalizeSavedRun = (raw) => GutterbonesRules.normalizeSavedRun(raw, {
    RUN_SAVE_VERSION, RUN_PHASES, WAGER_TUNING, DEFAULT_RUN_BUILD, BUILD_IDS
});

export const loadSavedRun = () => normalizeSavedRun(loadJson(STORAGE_KEYS.run));
export const saveSavedRun = (run) => saveJson(STORAGE_KEYS.run, { ...run, version: RUN_SAVE_VERSION });
export const clearSavedRun = () => {
    try { window.localStorage?.removeItem(STORAGE_KEYS.run); } catch (err) { console.warn('Unable to clear saved run', err); }
};

export const itemById = (id) => FACE_DATABASE[id] || DEVISES[id] || CONSUMABLES[id] || null;
export const bossById = (id) => BOSSES[id] || null;
export const hydrateItem = (item) => item?.id && itemById(item.id) ? { ...itemById(item.id), ...item } : item;
export const hydratePath = (path) => path ? { ...path, boss: path.bossId ? bossById(path.bossId) : (path.boss?.id ? bossById(path.boss.id) : path.boss) } : path;

export const standardFaces = () => [1,2,3,4,5,6].map(v => ({ id: 'standard', value: v, type: 'standard', label: String(v), style: '' }));
export const makeBone = () => ({ id: Math.random(), value: 1, faces: standardFaces(), faceId: null, faceLabel: null, faceStyle: null, type: 'standard' });
export const rarityClass = r => r === 'rare' ? 'glow-rare' : r === 'danger' ? 'glow-danger' : '';
export const riskNotes = item => {
    if (!item) return [];
    if (item.rarity === 'danger') return ['HIGH RISK'];
    if (item.id === 'GHOST_FACE') return ['STRAIGHTS RISK'];
    if (item.id === 'BLOOD_PACT') return ['ROLL TOLL'];
    return [];
};
export const verdictGlowForFace = (faceId, type) => {
    if (!faceId || faceId === 'standard') return null;
    const byFace = {
        WILD_FACE: 'rgba(255, 0, 127, 0.65)',
        BLOOD_6: 'rgba(255, 45, 45, 0.62)',
        ECHO_FACE: 'rgba(0, 221, 255, 0.6)',
        SHIV_FACE: 'rgba(255, 72, 38, 0.68)',
        WIREBAG_FACE: 'rgba(0, 221, 255, 0.55)',
        GHOST_FACE: 'rgba(234, 234, 255, 0.58)',
        MULT_FACE: 'rgba(0, 221, 255, 0.5)',
        GOLD_FACE: 'rgba(214, 184, 92, 0.56)'
    };
    if (byFace[faceId]) return byFace[faceId];
    if (type === 'blood') return 'rgba(255, 45, 45, 0.62)';
    if (type === 'danger') return 'rgba(255, 0, 127, 0.58)';
    return 'rgba(214, 184, 92, 0.52)';
};
export const impactProfileForFace = (faceId, type) => {
    if (!faceId || faceId === 'standard') return null;
    const byFace = {
        BLOOD_6: { colors: ['#ff3131', '#ff6b3d'], count: 7 },
        SHIV_FACE: { colors: ['#ff5a3d', '#ffd166'], count: 7 },
        WILD_FACE: { colors: ['#ff007f', '#00ddff'], count: 8 },
        ECHO_FACE: { colors: ['#00ddff', '#9be7ff'], count: 6 },
        WIREBAG_FACE: { colors: ['#00ddff', '#67e8f9'], count: 6 },
        GHOST_FACE: { colors: ['#f5f3ff', '#dbeafe'], count: 5 },
        GOLD_FACE: { colors: ['#facc15', '#fde68a'], count: 5 },
        MULT_FACE: { colors: ['#00ddff', '#a5f3fc'], count: 5 }
    };
    if (byFace[faceId]) return byFace[faceId];
    if (type === 'blood') return { colors: ['#ff3131', '#ff6b3d'], count: 6 };
    if (type === 'danger') return { colors: ['#ff007f', '#ff6b3d'], count: 6 };
    return null;
};


