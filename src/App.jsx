import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PERSONAS,
  FACE_DATABASE,
  DEVISES,
  PROGRAMS,
  MECHANIC_HINTS,
  BUILD_IDS,
  DEFAULT_RUN_BUILD,
  BUILD_UI,
  BUILD_TIPS,
  BUILD_STYLE_BLURBS,
  ITEM_ARCHETYPE_TAGS,
  getArchetypeTagsForItemId,
  synergyLabelForItem,
  itemFitsCurrentBuild,
  countCarvedFace,
  diceShowsFace,
  countSpecialFaceSlots,
  aggregateHistoryTriggers,
  deriveKeyItems,
  analyzeBuild,
  BUILD_SYNERGY_CALLOUT,
  CONSUMABLES,
  BOSSES,
  PATHS,
  ECONOMY_TUNING,
  BOSS_TUNING,
  SHOP_TUNING,
  EARLY_GAME_TUNING,
  ROUND_CURVE_TUNING,
  PROGRESSION_GUARDRAILS,
  SHOP_AGENCY_TUNING,
  getShopRefreshCost,
  getHardwareSellValue,
  HAND_MASTERY_TUNING,
  getHandMasteryBonus,
  FLOW_TUNING,
  getFlowMultiplier,
  WAGER_TUNING,
  GAMBLE_TUNING,
  DEBT_PAYDOWN_TUNING,
  INSANE_CONTRACT_MODIFIERS,
  INSANE_CONTRACT_RULES,
  STREET_INTEL,
  FIXER_LINES,
  pickLine,
  describeRouteEffects,
  CATEGORIES,
  ONBOARDING_THRESHOLDS,
  getAvailableCategories,
  getCategoryUnlockInfo,
  isShopFaceAvailable,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  loadSettingsState,
  saveSettingsState,
  RUN_SAVE_VERSION,
  RUN_PHASES,
  DEFAULT_META_STATE,
  SAFEHOUSE_UPGRADES,
  mergeMetaState,
  loadJson,
  saveJson,
  loadMetaState,
  saveMetaState,
  normalizeSavedRun,
  loadSavedRun,
  saveSavedRun,
  clearSavedRun,
  itemById,
  bossById,
  hydrateItem,
  hydratePath,
  standardFaces,
  makeBone,
  rarityClass,
  riskNotes,
  verdictGlowForFace,
  impactProfileForFace,
} from "./data/catalog.js";
import GutterbonesRules from "./systems/rules.js";
import GutterbonesOnboarding from "./systems/onboarding.js";
import GutterbonesStory from "./systems/story.js";
import GutterbonesRoutes from "./systems/routes.js";
import GutterbonesGamble from "./systems/gamble.js";

const GAME_BRANDING = window.__GUTTERBONES_BRANDING__ || Object.freeze({
    title: 'GUTTERBONES',
    year: '1977',
    get displayName() { return 'GUTTERBONES 1977'; },
    get loadingMessage() { return 'LOADING GUTTERBONES 1977…'; }
});
const IS_DEV_BUILD = !!(typeof window !== 'undefined' && window.__GUTTERBONES_DEV__);

const AudioSystem = window.GutterbonesAudio || {
    init() {},
    setVolume() {},
    setMuted() {},
    isMuted() { return true; },
    loadSettings() {},
    getSettings() { return { audioMuted: true, audioVolume: 0.82 }; },
    startAmbient() {},
    stopAmbient() {},
    playNoiseBurst() {},
    playTone() {},
    clatter() {},
    payout() {},
    stinger() {},
    bossSting() {},
    bust() {},
    paper() {}
};

const AUDIO_VOLUME_STEPS = [0.35, 0.55, 0.82, 1];
const formatVolumeLabel = (v) => {
    const pct = Math.round(v * 100);
    if (pct <= 40) return 'LOW';
    if (pct <= 65) return 'MID';
    if (pct <= 90) return 'HIGH';
    return 'MAX';
};

const CashRain = ({ count = 24, reducedMotion = false }) => {
    const cappedCount = Math.max(0, Math.min(count, reducedMotion ? 8 : 36));
    const bills = useMemo(() => Array.from({ length: cappedCount }, (_, i) => ({
        id: i,
        depth: reducedMotion ? 'mid' : (i % 3 === 0 ? 'near' : i % 3 === 1 ? 'mid' : 'far'),
        left: `${Math.random() * 100}%`,
        tx: `${(Math.random() - .5) * 620}px`,
        delay: reducedMotion ? '0s' : `${Math.random() * 0.55}s`,
        label: i % 3 === 0 ? '$100' : i % 3 === 1 ? '$50' : '$20'
    })), [cappedCount, reducedMotion]);
    return (
        <div className="absolute inset-0 pointer-events-none z-[200]">
            {bills.map((bill) => (
                <div key={bill.id} className={`cash-bill ${bill.depth} absolute w-16 h-7`} style={{ left: bill.left, '--tx': bill.tx, animationDelay: bill.delay }}>
                    <div className="cash-bill-inner text-[#1a2408] font-bold text-xs flex items-center justify-center">{bill.label}</div>
                </div>
            ))}
        </div>
    );
};

const Bone = ({ data, rolling, kept, selected, slot, onClick, onPill, onExplainPill, raidPill, reducedMotion, canPill = true, pillPulse = false }) => {
    const ref = useRef({
        locked: false,
        vars: {
            '--idle-delay': `${(slot * 0.18) + (Math.random() * 1.2)}s`,
            '--roll-dur': '0.86s',
            '--roll-delay': '0ms',
            '--rf': '0deg'
        }
    });
    const [verdictColor, setVerdictColor] = useState(null);
    const [settleJolt, setSettleJolt] = useState(false);
    const [impactParticles, setImpactParticles] = useState([]);
    if (rolling && !ref.current.locked) {
        ref.current = {
            locked: true,
            vars: {
                '--idle-delay': ref.current.vars['--idle-delay'],
                '--tx1': `${(Math.random()-.5)*240}px`,
                '--ty1': `${(Math.random()-.5)*150-80}px`,
                '--tx2': `${(Math.random()-.5)*80}px`,
                '--ty2': `${(Math.random()-.5)*40}px`,
                '--r1': `${Math.random()*900}deg`,
                '--r2': `${Math.random()*1200}deg`,
                '--rf': `${(Math.random()-.5)*45}deg`,
                '--roll-dur': `${(0.72 + Math.random() * 0.33).toFixed(2)}s`,
                '--roll-delay': `${Math.floor(Math.random() * 80)}ms`
            }
        };
    }
    if (!rolling && ref.current.locked) ref.current = { locked: false, vars: ref.current.vars };
    useEffect(() => {
        if (rolling) return;
        const glow = verdictGlowForFace(data.faceId, data.type);
        const profile = impactProfileForFace(data.faceId, data.type);
        let glowId = null;
        let joltId = null;
        let particleId = null;
        if (glow) {
            setVerdictColor(glow);
            glowId = setTimeout(() => setVerdictColor(null), 420);
        }
        if (profile) {
            setSettleJolt(true);
            joltId = setTimeout(() => setSettleJolt(false), reducedMotion ? 80 : 150);
            if (!reducedMotion) {
                const particles = Array.from({ length: profile.count }, (_, idx) => ({
                    id: `${data.id}-${idx}`,
                    color: profile.colors[idx % profile.colors.length],
                    px: `${(Math.random() - .5) * 44}px`,
                    py: `${(Math.random() - 1.05) * 38}px`,
                    left: `${42 + ((Math.random() - .5) * 22)}%`,
                    top: `${48 + ((Math.random() - .5) * 16)}%`
                }));
                setImpactParticles(particles);
                particleId = setTimeout(() => setImpactParticles([]), 360);
            }
        } else {
            setSettleJolt(false);
            setImpactParticles([]);
        }
        return () => {
            if (glowId) clearTimeout(glowId);
            if (joltId) clearTimeout(joltId);
            if (particleId) clearTimeout(particleId);
        };
    }, [rolling, data.faceId, data.type, data.id, reducedMotion]);
    return (
        <div className="relative group">
            <div className="text-[10px] text-center mb-2 font-mono text-[#d6b85c] opacity-60">SLOT 0{slot + 1}</div>
            <button onClick={onClick} className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg bg-[#d4cfc5] border border-[#8c8880] shadow-2xl relative transition-all duration-300 flex items-center justify-center overflow-hidden ${rolling ? 'bone-rolling bone-depth-roll' : 'bone-depth-idle'} ${!rolling && !kept && !selected ? 'bone-idle' : ''} ${kept ? 'bone-kept' : ''} ${settleJolt ? 'bone-settle-jolt' : ''} ${selected ? 'ring-4 ring-[#0df] z-50' : ''}`} style={{ ...ref.current.vars, '--rest-rotate': ref.current.vars['--rf'] || '0deg' }}>
                {verdictColor && !rolling && <div className="absolute inset-0 rounded-lg pointer-events-none bone-verdict-glow" style={{ '--verdict-color': verdictColor }} />}
                {impactParticles.map((particle) => <span key={particle.id} className="impact-particle" style={{ color: particle.color, left: particle.left, top: particle.top, '--px': particle.px, '--py': particle.py }} />)}
                {rolling ? <span className="font-serif italic text-3xl opacity-30">?</span> : data.faceId && data.faceId !== 'standard' ? (
                    <div className={`absolute inset-1 rounded flex flex-col items-center justify-center border ${data.faceStyle}`}>
                        <div className="font-serif text-3xl leading-none">{data.faceLabel.charAt(0)}</div>
                        <div className="text-[8px] uppercase tracking-tighter text-center leading-none mt-1 hidden sm:block">{data.faceLabel}</div>
                    </div>
                ) : <span className="font-serif text-5xl text-gray-900 opacity-80">{data.value}</span>}
            </button>
            {!rolling && (
                <button
                    type="button"
                    disabled={!canPill}
                    onClick={(e) => { e.stopPropagation(); if (canPill) onPill(); }}
                    onMouseEnter={onExplainPill}
                    onFocus={onExplainPill}
                    title={canPill ? 'Pill reroll this bone' : 'No pills left'}
                    aria-label={canPill ? 'Reroll this bone (spend 1 pill)' : 'No pills remaining'}
                    className={`absolute -top-3 -right-3 z-50 flex min-h-11 min-w-11 md:min-h-8 md:min-w-9 items-center justify-center rounded-full border border-[#0df]/70 bg-black px-1.5 font-mono text-[9px] font-bold text-[#0df] shadow-[0_0_10px_rgba(0,221,255,.25)] transition-opacity ${canPill ? 'opacity-100 hover:bg-[#0a1520]' : 'cursor-not-allowed opacity-35'} ${pillPulse && canPill ? 'animate-pulse ring-2 ring-[#ff007f]/80' : ''}`}
                >
                    PILL
                    {raidPill && canPill && <span className="absolute -bottom-4 text-[8px] font-bold font-mono text-red-500">-$2</span>}
                </button>
            )}
        </div>
    );
};

const ScorePreview = ({ result }) => {
    if (!result.valid) return null;
    return (
        <div className="absolute right-2 top-1 bg-black/90 border border-cyan-400 text-xs font-mono p-2 z-50 w-40 rounded shadow-xl pointer-events-none">
            <div>CHIPS: {result.chips}</div>
            <div>MULT: x{result.mult.toFixed(2)}</div>
            {result.gDelta !== 0 && <div>CASH: {result.gDelta > 0 ? '+' : ''}{result.gDelta}</div>}
            {result.triggers.length > 0 && (
                <div className="mt-1 border-t border-gray-600 pt-1">
                    {result.triggers.map((t, i) => (
                        <div key={i} className="text-[10px] text-cyan-300">
                            {t.name} {t.value}
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-1 text-yellow-400 font-bold">TOTAL: {result.total}</div>
        </div>
    );
};

const CategoryUnlockFooter = ({ meta }) => {
    const info = getCategoryUnlockInfo(meta);
    if (!info.locked.length) return null;
    return (
        <div className="mt-2 pt-2 border-t border-dashed border-gray-500 text-[10px] font-mono text-left space-y-1">
            <div className="font-bold text-gray-800 tracking-wide">LOCKED PAYOUTS</div>
            <p className="text-gray-600 leading-snug">
                The fixer holds rows back until you survive more contracts. Completed runs: <b>{info.totalRuns}</b>.
            </p>
            {info.lockedDetails.map((row) => (
                <div key={row.id} className="text-gray-700 leading-snug">
                    <span className="font-bold">{CATEGORIES[row.id]?.name || row.id}</span>
                    {row.unlockAtRun > 0 && (
                        <span>{row.runsUntil > 0 ? ` — unlocks at ${row.unlockAtRun} runs (${row.runsUntil} to go)` : ` — unlocks at ${row.unlockAtRun} runs`}</span>
                    )}
                </div>
            ))}
        </div>
    );
};

const LockedPayoutRow = ({ cat, runsUntil, unlockAtRun }) => (
    <div
        className="w-full flex justify-between items-center py-2 px-2 border-b border-dashed border-gray-400 text-xs md:text-base opacity-55 cursor-not-allowed"
        aria-disabled="true"
        title={runsUntil > 0 ? `Unlocks after ${unlockAtRun} completed runs (${runsUntil} to go)` : `Unlocks after ${unlockAtRun} completed runs`}
    >
        <span className="flex flex-col items-start text-gray-600">
            <span className="font-bold line-through decoration-gray-500/80">{cat.name}</span>
            <span className="text-[10px] font-mono text-gray-500 mt-0.5">
                {runsUntil > 0 ? `Unlocks after ${unlockAtRun} runs · ${runsUntil} to go` : `Unlocks after ${unlockAtRun} runs`}
            </span>
        </span>
        <span className="text-[10px] font-mono font-bold text-gray-500 tracking-wide">LOCKED</span>
    </div>
);

const ScoreRow = ({ id, cat, result, used, canScore, onScore, handLevel = HAND_MASTERY_TUNING.baseLevel }) => {
    const [hover, setHover] = useState(false);
    const triggers = (result.triggers || []).slice(0, 2);
    const masteryBonus = getHandMasteryBonus(handLevel);
    return (
        <button
            onClick={() => onScore(id)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            disabled={!canScore}
            className={`score-row w-full flex justify-between items-center py-2 px-2 border-b border-dashed transition-all text-xs md:text-base relative ${used ? 'opacity-55 border-gray-400' : canScore && result.valid ? 'bg-black/10 hover:bg-black/20 border-transparent font-bold score-row-ready' : canScore ? 'text-red-700 hover:bg-red-100 border-gray-400 score-row-danger' : 'border-gray-400 opacity-70'}`}
        >
            {hover && canScore && result.valid && <ScorePreview result={result} />}
            <span className="flex flex-col items-start">
                <span className="flex items-center gap-1">
                    <span>{cat.name}</span>
                    <span className="text-[10px] px-1 rounded border border-gray-500 text-gray-600">LV{handLevel}</span>
                </span>
                {masteryBonus > 0 && <span className="text-[10px] text-green-700 font-mono">+{masteryBonus} mastery chips</span>}
                {canScore && result.valid && triggers.length > 0 && <span className="flex flex-wrap gap-1 mt-1">{triggers.map((t, i) => <span key={i} className="preview-badge badge-pop" style={{ animationDelay: `${i * 80}ms` }}>{t.name} {t.value}</span>)}</span>}
            </span>
            <span>{used ? <span className="paid-stamp">PAID</span> : (canScore && result.valid ? result.total : (canScore ? 'BUST' : '-'))}</span>
        </button>
    );
};

const BossIntro = ({ boss, target, onDone, reducedMotion }) => {
    const [typed, setTyped] = useState('');
    const [showDesc, setShowDesc] = useState(false);
    useEffect(() => {
        if (!boss) return;
        if (reducedMotion) {
            setTyped(boss.name);
            setShowDesc(true);
            const doneId = window.setTimeout(onDone, 900);
            return () => window.clearTimeout(doneId);
        }
        setTyped('');
        setShowDesc(false);
        const chars = boss.name.split('');
        let idx = 0;
        let revealId = null;
        const typer = window.setInterval(() => {
            idx += 1;
            setTyped(chars.slice(0, idx).join(''));
            if (idx >= chars.length) {
                window.clearInterval(typer);
                revealId = window.setTimeout(() => setShowDesc(true), 120);
            }
        }, 40);
        const id = window.setTimeout(onDone, 1600);
        return () => {
            window.clearTimeout(id);
            if (revealId) window.clearTimeout(revealId);
            window.clearInterval(typer);
        };
    }, [boss, reducedMotion]);
    if (!boss) return null;
    const microByBoss = {
        LOAN_SHARK: 'IOUs flutter onto the table.',
        JUNKIE: 'Neon sputters. Digits scramble.',
        CROOKED_COP: 'Red-blue wash sweeps the room.',
        INFORMANT: 'The stash line freezes over.',
        BOUNCER: 'Quota stamp slams into place.',
        THE_RAID: 'Sirens drown out the alley.'
    };
    return (
        <div className="absolute inset-0 z-[250] flex items-center justify-center overflow-hidden">
            <div className="boss-intro-backdrop" aria-hidden></div>
            <div className="absolute inset-0 bg-black/55 pointer-events-none z-[1]"></div>
            {!reducedMotion && <div className="absolute top-0 left-0 right-0 h-1/4 bg-red-900/40 boss-blind-top z-[2]"></div>}
            {!reducedMotion && <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-red-900/40 boss-blind-bottom z-[2]"></div>}
            <div className="border-4 border-red-800 bg-[#111] p-8 max-w-lg text-center shadow-2xl relative overflow-hidden z-[3]" style={{ animation: 'bossIntro .35s ease-out forwards' }}>
                <BossPortrait boss={boss} variant="intro" />
                <div className="font-mono text-red-500 tracking-[.4em] text-xs mb-3">TURF WAR</div>
                <h2 className={`${boss.color} font-marker text-5xl mb-3 min-h-[3rem]`}>{typed}{!reducedMotion && <span className="opacity-60">_</span>}</h2>
                <p className={`font-mono text-gray-300 transition-opacity duration-300 ${showDesc ? 'opacity-100' : 'opacity-0'}`}>{boss.desc}</p>
                <p className="font-mono text-xs text-gray-500 mt-3">Quota: {target}</p>
                <p className="font-mono text-[10px] text-red-300/70 mt-2">{microByBoss[boss.id]}</p>
            </div>
        </div>
    );
};

const RiskBadges = ({ item }) => {
    const notes = riskNotes(item);
    if (!notes.length) return null;
    return <div className="flex flex-wrap gap-1 mt-2">{notes.map(n => <span key={n} className="risk-badge">{n}</span>)}</div>;
};

const HistoryPanel = ({ history }) => (
    <div className="space-y-2 max-h-48 overflow-y-auto">
        {history.length === 0 ? <div className="text-xs opacity-50 font-mono">No paid hands logged.</div> : [...history].reverse().slice(0, 6).map(h => (
            <div key={h.id} className="border border-black/30 bg-white/30 p-2 font-mono text-xs">
                <div className="flex justify-between"><span>R{h.round} {CATEGORIES[h.category]?.name}</span><b>{h.total}</b></div>
                <div className="opacity-70">Bones: [{h.values.join(', ')}]</div>
                {h.triggers.length > 0 && <div className="opacity-70">Hooks: {h.triggers.map(t => t.name).join(', ')}</div>}
            </div>
        ))}
    </div>
);

const PersonaPortrait = ({ persona, variant = 'lineup' }) => {
    const [failed, setFailed] = useState(false);
    const src = persona.portraitSrc;
    const alt = persona.portraitAlt || persona.name || '';
    if (!src || failed) {
        if (variant === 'lore') {
            return <div className={`w-16 h-20 shrink-0 rounded border border-gray-600 ${persona.color}`} aria-hidden />;
        }
        if (variant === 'rap') {
            return <div className={`w-24 h-32 rounded-t-full rounded-b-lg border-b-4 border-gray-600 ${persona.color}`} aria-hidden />;
        }
        return <div className={`w-24 h-28 rounded-t-[50px] rounded-b-lg ${persona.color}`} aria-hidden />;
    }
    if (variant === 'lore') {
        return (
            <img
                src={src}
                alt={alt}
                className="w-16 h-20 shrink-0 rounded border border-gray-600 object-cover object-top bg-[#121113]"
                onError={() => setFailed(true)}
            />
        );
    }
    if (variant === 'rap') {
        return (
            <img
                src={src}
                alt={alt}
                className="max-h-[9.25rem] w-auto max-w-[min(100%,11rem)] object-contain object-bottom"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            className="max-h-[7.75rem] w-auto max-w-[92%] object-contain object-bottom drop-shadow-[0_5px_14px_rgba(0,0,0,0.9)]"
            onError={() => setFailed(true)}
        />
    );
};

const BOSS_PORTRAIT_FALLBACK = {
    BOUNCER: 'bg-gray-800 border border-gray-600',
    LOAN_SHARK: 'bg-red-950 border border-red-700',
    JUNKIE: 'bg-[#2a0017] border border-[#ff007f]/40',
    CROOKED_COP: 'bg-slate-900 border border-blue-800',
    INFORMANT: 'bg-[#2a2408] border border-yellow-700/50',
    THE_RAID: 'bg-red-950 border border-red-600'
};

const BossPortrait = ({ boss, variant = 'intro' }) => {
    const [failed, setFailed] = useState(false);
    if (!boss) return null;
    const src = boss.portraitSrc;
    const alt = boss.portraitAlt || boss.name || '';
    const fb = BOSS_PORTRAIT_FALLBACK[boss.id] || 'bg-gray-900 border border-gray-600';
    if (!src || failed) {
        if (variant === 'lore') return <div className={`w-16 h-20 shrink-0 rounded ${fb}`} aria-hidden />;
        if (variant === 'banner') return <div className={`h-9 w-9 shrink-0 rounded ${fb}`} aria-hidden />;
        if (variant === 'intel') return <div className={`w-11 h-11 shrink-0 rounded ${fb}`} aria-hidden />;
        return <div className={`mx-auto mb-4 w-28 h-36 max-w-[42%] rounded border-2 border-red-800/60 ${fb}`} aria-hidden />;
    }
    if (variant === 'lore') {
        return <img src={src} alt={alt} className="w-16 h-20 shrink-0 rounded border border-gray-600 object-cover object-top bg-[#121113]" onError={() => setFailed(true)} />;
    }
    if (variant === 'banner') {
        return <img src={src} alt="" className="h-9 w-9 shrink-0 rounded object-cover object-top border border-red-800/50 bg-black" onError={() => setFailed(true)} />;
    }
    if (variant === 'intel') {
        return <img src={src} alt="" className="w-11 h-11 shrink-0 rounded object-cover object-top border border-gray-600 bg-black" onError={() => setFailed(true)} />;
    }
    return (
        <img src={src} alt={alt} className="mx-auto mb-4 max-h-44 w-auto max-w-[min(48vw,12rem)] object-contain object-top drop-shadow-[0_6px_16px_rgba(0,0,0,0.75)]" onError={() => setFailed(true)} />
    );
};

const ONBOARDING_STEPS = [
    { title: 'ROLL YOUR BONES', desc: 'Hit ROLL to throw all 5 bones onto the felt.' },
    { title: 'KEEP THE GOOD ONES', desc: 'Click any bone to lock it. Kept bones stay safe on the next roll.' },
    { title: 'PICK A PAYOUT', desc: 'Choose one row on THE PAYOUTS sheet. That scores your hand.' },
    { title: 'BEAT THE QUOTA', desc: 'Street heat must reach the quota before your plays run out. Each payout row costs one play — invalid hands still burn a play.' },
    { title: 'POP A PILL', desc: 'Pills reroll a single bone. Tap the PILL badge on any die after you roll. On THE RAID, each pill also costs $2.' },
    { title: 'BOSS TURF', desc: 'Some jobs bring a boss. The red banner rewrites the rules — higher quota, tolls, frozen stash, or disabled hardware. Read it every round.' },
    { title: 'STASH PROGRAMS', desc: 'Strong payouts fill your stash bar. Spend it on programs: SNIFF (25%) rerolls a free bone; BRIBE (60%) cuts quota 15%; FIX GAME (80%) matches plain bones to slot 1; LAUNDER (100%) clears debt. The Informant boss freezes stash.' }
];

const ONBOARDING_BADGES = ['STEP 01', 'STEP 02', 'STEP 03', 'STEP 04', 'STEP 05', 'STEP 06', 'STEP 07'];
const ONBOARDING_KICKERS = ['THROW', 'LOCK', 'SCORE', 'QUOTA', 'PILL', 'BOSS', 'STASH'];

const FirstRunOverlay = ({ onDismiss }) => {
    const [step, setStep] = useState(0);
    return (
        <div className="absolute inset-0 z-[600] bg-black/85 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-md w-full bg-[#1a1a1a] border-4 border-[#c78b16] rounded-xl p-6 md:p-8 shadow-2xl relative">
                <div className="font-mono text-[10px] text-[#0df] tracking-[.4em] mb-4 text-center">FIRST TIME ON THE BLOCK</div>
                <div className="flex justify-center gap-2 mb-6">
                    {ONBOARDING_STEPS.map((_, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === step ? 'bg-[#ff007f] scale-125' : i < step ? 'bg-[#0df]' : 'bg-gray-700'}`} />
                    ))}
                </div>
                <div key={step} className="text-center mb-6">
                    <div className="inline-flex flex-col items-center justify-center mb-5 px-6 py-3 border border-[#0df]/50 bg-black/50 rounded-lg shadow-[0_0_18px_rgba(0,221,255,.12)]">
                        <div className="font-mono text-[10px] tracking-[.35em] text-[#0df]">{ONBOARDING_BADGES[step]}</div>
                        <div className="font-marker text-3xl text-[#d6b85c] mt-1">{ONBOARDING_KICKERS[step]}</div>
                    </div>
                    <h3 className="font-marker text-3xl text-[#ff007f] mb-3">{ONBOARDING_STEPS[step].title}</h3>
                    <p className="font-mono text-sm text-gray-300 leading-relaxed">{ONBOARDING_STEPS[step].desc}</p>
                </div>
                <div className="flex gap-3">
                    {step > 0 && <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-[#0df] hover:text-[#0df] transition-colors rounded">BACK</button>}
                    {step < ONBOARDING_STEPS.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)} className="flex-1 py-3 bg-[#c78b16] text-black font-mono font-bold text-sm shadow-[0_4px_0_#5c4305] active:translate-y-1 active:shadow-none rounded">NEXT</button>
                    ) : (
                        <button onClick={onDismiss} className="flex-1 py-3 bg-[#ff007f] text-white font-marker text-xl italic shadow-[0_4px_0_#7a003d] active:translate-y-1 active:shadow-none rounded">LET'S HUSTLE</button>
                    )}
                </div>
                <button onClick={onDismiss} className="absolute top-3 right-3 text-gray-600 hover:text-white font-mono text-xs transition-colors">SKIP</button>
            </div>
        </div>
    );
};

const StoryPanelOverlay = ({ beat, reducedMotion, onFinish }) => {
    const [exiting, setExiting] = useState(false);
    const [charIdx, setCharIdx] = useState(0);
    const [imageFailed, setImageFailed] = useState(false);
    const finishRef = useRef(onFinish);
    finishRef.current = onFinish;

    const finish = () => {
        if (exiting) return;
        setExiting(true);
        window.setTimeout(() => finishRef.current?.(), 280);
    };

    useEffect(() => {
        if (!beat) return undefined;
        setExiting(false);
        setCharIdx(0);
        setImageFailed(false);
        let cancelled = false;
        const caption = beat.caption || '';
        const holdMs = reducedMotion
            ? (GutterbonesStory?.getReducedMotionHold?.() || 1000)
            : (beat.holdMs || 1800);
        let typeInterval = null;
        if (!reducedMotion && caption.length) {
            typeInterval = window.setInterval(() => {
                setCharIdx((n) => {
                    if (n >= caption.length) return n;
                    return n + 1;
                });
            }, 30);
        } else {
            setCharIdx(caption.length);
        }
        const holdTimer = window.setTimeout(() => {
            if (!cancelled) finish();
        }, holdMs);
        return () => {
            cancelled = true;
            if (typeInterval) window.clearInterval(typeInterval);
            window.clearTimeout(holdTimer);
        };
    }, [beat?.src, reducedMotion]);

    useEffect(() => {
        if (imageFailed) finish();
    }, [imageFailed]);

    if (!beat) return null;

    return (
        <div
            role="dialog"
            aria-label="Story panel"
            className={`fixed inset-0 z-[650] flex flex-col items-center justify-center bg-black cursor-pointer ${exiting ? 'story-panel-fade-out' : 'story-panel-fade-in'}`}
            onClick={finish}
        >
            <div className="relative w-full max-w-3xl mx-auto px-4 flex-1 flex items-center justify-center overflow-hidden">
                {!imageFailed && (
                    <img
                        src={beat.src}
                        alt=""
                        className={`max-h-[min(62vh,520px)] w-full object-contain object-center drop-shadow-[0_12px_40px_rgba(0,0,0,0.85)] ${reducedMotion ? '' : 'story-ken-burns'}`}
                        onError={() => setImageFailed(true)}
                    />
                )}
            </div>
            <div className="w-full max-w-3xl px-4 pb-8 pointer-events-none">
                <div className="bg-black/70 border border-[#00ddff]/30 rounded px-4 py-3 text-center">
                    <p className="font-mono text-sm italic text-[#e8e6e1] leading-relaxed min-h-[2.5rem]">
                        {beat.caption?.slice(0, charIdx) || beat.caption}
                    </p>
                </div>
                <div className="text-center mt-2 font-mono text-[10px] text-gray-500 tracking-widest">TAP OR SPACE TO SKIP</div>
            </div>
        </div>
    );
};

const UnlockNotification = ({ message, onDone }) => {
    useEffect(() => {
        const id = setTimeout(onDone, 3200);
        return () => clearTimeout(id);
    }, [onDone]);
    return (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[550] pointer-events-none" style={{ animation: 'badgePop .3s ease-out forwards' }}>
            <div className="bg-black/90 border-2 border-[#0df] rounded-lg px-5 py-3 shadow-2xl flex items-center gap-3" style={{ boxShadow: '0 0 20px rgba(0,221,255,.3)' }}>
                <span className="text-[#0df] text-sm font-mono font-bold">NEW</span>
                <div>
                    <div className="font-mono text-[10px] text-[#0df] tracking-[.3em]">UNLOCKED</div>
                    <div className="font-mono text-sm text-white">{message}</div>
                </div>
            </div>
        </div>
    );
};

const ScoreResolutionOverlay = ({ data, reducedMotion }) => {
    if (!data) return null;
    return (
        <div className="absolute inset-0 z-[560] pointer-events-none flex items-center justify-center p-4">
            <div className={`readable-panel rounded-xl px-7 py-5 ${reducedMotion ? '' : 'animate-[stampSlam_.22s_cubic-bezier(.25,1,.5,1)_forwards]'}`}>
                <div className="font-mono text-xs text-[#0df] tracking-[.35em] text-center mb-3">SCORE RESOLUTION</div>
                <div className="font-mono text-base text-center text-gray-100">
                    <span className="text-yellow-300">{data.chips}</span> CHIPS x <span className="text-cyan-300">{data.mult.toFixed(2)}x</span>
                    {data.flowMult > 1 && <> x <span className="text-[#ff9fcf]">{data.flowMult.toFixed(2)} FLOW</span></>}
                </div>
                <div className="font-marker text-5xl text-[#ff007f] text-center mt-2">{data.total}</div>
            </div>
        </div>
    );
};

const ScoreBreakdownOverlay = ({ result, reducedMotion, onDismiss }) => {
    if (!result) return null;
    const stepTone = (type) => {
        if (type === 'base') return 'border-[#d6b85c] text-[#f9e7b0]';
        if (type === 'multiplier') return 'border-cyan-400/40 text-cyan-200';
        if (type === 'modifier') return 'border-emerald-500/35 text-emerald-200';
        if (type === 'penalty') return 'border-red-500/40 text-red-200';
        return 'border-gray-600/40 text-gray-200';
    };
    const impactText = (impact) => {
        if (typeof impact === 'number') {
            if (impact > 0) return `+${impact}`;
            return String(impact);
        }
        return impact;
    };
    return (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[575] pointer-events-none w-[min(94vw,42rem)]">
            <button
                type="button"
                onClick={onDismiss}
                className={`pointer-events-auto w-full readable-panel border-[#ff007f]/80 rounded-xl px-5 py-4 text-left ${reducedMotion ? '' : 'animate-[stampSlam_.22s_cubic-bezier(.25,1,.5,1)_forwards]'}`}
            >
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="font-mono text-xs tracking-[.32em] text-[#ff9fcf]">SCORE EXPLANATION</div>
                        <div className="font-mono text-sm text-gray-200 mt-1">{result.categoryName || 'HAND'} - tap to dismiss</div>
                    </div>
                    <div className="font-marker text-5xl text-[#ff007f] leading-none">{result.total}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 font-mono text-xs">
                    <div className="border border-yellow-500/60 bg-yellow-900/30 rounded px-3 py-2 text-yellow-100">CHIPS <span className="block text-xl leading-none mt-1">{result.chips}</span></div>
                    <div className="border border-cyan-500/60 bg-cyan-900/30 rounded px-3 py-2 text-cyan-100">MULT <span className="block text-xl leading-none mt-1">{result.mult.toFixed(2)}x</span></div>
                    <div className="border border-fuchsia-500/60 bg-fuchsia-900/30 rounded px-3 py-2 text-fuchsia-100">FLOW <span className="block text-xl leading-none mt-1">{result.flowMult.toFixed(2)}x</span></div>
                    <div className="border border-[#ff007f]/70 bg-[#ff007f]/25 rounded px-3 py-2 text-[#ffd1e8]">TOTAL <span className="block text-xl leading-none mt-1">{result.total}</span></div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(result.explanationSteps || []).map((step, idx) => (
                        <div key={`${step.label}-${idx}`} className={`border rounded-lg px-3 py-2 text-sm font-mono bg-black/80 ${stepTone(step.type)}`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="tracking-wide">{step.label}</span>
                                <span className="font-bold">{impactText(step.impact)}</span>
                            </div>
                            <div className="opacity-90 text-xs mt-1">{step.value}</div>
                        </div>
                    ))}
                </div>
            </button>
        </div>
    );
};

const LossExplanationOverlay = ({ data, reducedMotion }) => {
    if (!data) return null;
    return (
        <div className="absolute inset-x-0 bottom-5 z-[590] pointer-events-none px-4 flex justify-center">
            <div className={`readable-panel border-red-600/80 rounded-xl p-5 w-[min(96vw,48rem)] ${reducedMotion ? '' : 'animate-[stampSlam_.24s_cubic-bezier(.25,1,.5,1)_forwards]'}`}>
                <div className="font-marker text-4xl md:text-5xl text-red-300 text-center mb-2">YOU LOST BECAUSE...</div>
                <div className="font-mono text-center text-red-100 text-base md:text-lg mb-4 leading-relaxed">{data.primaryReason}</div>
                {data.contributors?.length > 0 && (
                    <div className="mb-4 bg-red-950/35 border border-red-500/35 rounded-lg p-3">
                        <div className="font-mono text-xs tracking-[.28em] text-red-200 mb-2">WHAT HURT</div>
                        <div className="space-y-2 text-sm font-mono text-gray-100">
                            {data.contributors.slice(0, 3).map((item, idx) => <div key={`${item}-${idx}`}>- {item}</div>)}
                        </div>
                    </div>
                )}
                {data.tips?.length > 0 && (
                    <div className="bg-cyan-950/35 border border-cyan-500/35 rounded-lg p-3">
                        <div className="font-mono text-xs tracking-[.28em] text-[#0df] mb-2">NEXT RUN TIP</div>
                        <div className="space-y-2 text-sm font-mono text-cyan-100">
                            {data.tips.slice(0, 2).map((tip, idx) => <div key={`${tip}-${idx}`}>- {tip}</div>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MechanicPopup = ({ hint, onDone }) => {
    useEffect(() => {
        const id = setTimeout(onDone, 2800);
        return () => clearTimeout(id);
    }, [hint, onDone]);
    if (!hint) return null;
    return (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[620] pointer-events-none w-[min(94vw,34rem)]">
            <div className="readable-panel border-[#c78b16]/80 rounded-xl px-5 py-4">
                <div className="font-mono text-xs text-[#ffd37a] tracking-[.25em] mb-2">{hint.title}</div>
                <div className="font-mono text-sm text-gray-100 leading-relaxed">{hint.body}</div>
            </div>
        </div>
    );
};

const ActiveModifiers = ({ inventory, boss, insaneContract }) => {
    const hasBoss = !!boss;
    const hasInventory = inventory.length > 0;
    const hasContract = !!insaneContract;
    if (!hasBoss && !hasInventory && !hasContract) return null;
    return (
        <div className="absolute bottom-4 left-4 readable-panel px-3 py-3 text-xs font-mono z-50 rounded-xl min-w-48 max-w-64 hidden lg:block">
            <div className="text-[#0df] mb-2 tracking-[.18em] font-bold">ACTIVE MODIFIERS</div>
            {hasContract && (
                <div className="mb-2">
                    <div className="text-[#ff007f]">CONTRACT: INSANE</div>
                    <div className="text-[#ffb3d9] leading-relaxed">Quota up, toll up, plays down.</div>
                </div>
            )}
            {hasBoss && (
                <div className="mb-2">
                    <div className="flex gap-2 items-start">
                        <BossPortrait boss={boss} variant="intel" />
                        <div className="min-w-0">
                            <div className="text-red-400">BOSS: {boss.name}</div>
                            <div className="text-red-100 leading-relaxed">{boss.desc}</div>
                        </div>
                    </div>
                </div>
            )}
            {hasInventory && (
                <div className="text-cyan-200 space-y-1">
                    {inventory.map(item => (
                        <div key={item.id}>{item.name}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RunIntelPanel = ({ flowMultiplier, activeWager, insaneContract, routeEffect, boss, consumables, upcomingPaths = [], inline = false }) => (
    <div className={`${inline ? 'relative w-full' : 'absolute top-16 right-4 z-[80] w-[min(88vw,21rem)]'} readable-panel rounded-xl p-4 text-xs font-mono`}>
        <div className="text-[#0df] tracking-[.25em] mb-3 font-bold">RUN INTEL</div>
        <div className="space-y-2 text-gray-100">
            <div className="flex justify-between gap-3"><span className="text-gray-400">FLOW</span><span className={flowMultiplier > 1 ? 'text-[#0df] font-bold' : 'text-gray-300'}>x{flowMultiplier.toFixed(2)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-400">WAGER</span><span className={activeWager ? 'text-emerald-300 font-bold' : 'text-gray-300'}>{activeWager ? `$${activeWager.stake} @ ${activeWager.threshold}+` : 'NONE'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-400">CONTRACT</span><span className={insaneContract ? 'text-[#ff9fcf] font-bold' : 'text-gray-300'}>{insaneContract ? 'INSANE' : 'STANDARD'}</span></div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="text-gray-400 mb-1 tracking-[.12em]">ROUTE MODIFIERS</div>
            {routeEffect ? (
                <div>
                    <div className="text-[#f4d67b] font-bold">{routeEffect.name}</div>
                    <div className="text-gray-100 leading-relaxed">{routeEffect.effects?.join(' / ') || 'No special modifiers'}</div>
                </div>
            ) : (
                <div className="text-gray-300">No active route modifier.</div>
            )}
            {upcomingPaths.length > 0 && (
                <div className="mt-2 space-y-1">
                    <div className="text-gray-400 tracking-[.1em]">SHOP ROUTES (preview)</div>
                    {upcomingPaths.slice(0, 3).map((p) => {
                        const preview = typeof p._projection === 'object' ? p._projection : null;
                        return (
                            <div key={p.id} className="text-gray-200 leading-snug border-l-2 border-gray-700 pl-2">
                                <span className="text-[#f4d67b] font-bold">{p.name}</span>
                                {preview ? (
                                    <span className="text-gray-300"> — quota ~{preview.nextTargetDisplay ?? preview.nextTarget}, {preview.nextHands} plays{p.boss ? `, ${p.boss.name}` : ''}</span>
                                ) : (
                                    <span className="text-gray-400"> — {p.desc}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="text-gray-400 mb-1 tracking-[.12em]">BOSS EFFECT</div>
            {boss ? (
                <div className="flex gap-2 items-start">
                    <BossPortrait boss={boss} variant="intel" />
                    <div className="min-w-0">
                        <div className={`font-bold leading-tight ${boss.color}`}>{boss.name}</div>
                        <div className="text-gray-100 leading-snug">{boss.desc}</div>
                    </div>
                </div>
            ) : (
                <div className="text-gray-300">None active.</div>
            )}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="text-gray-400 mb-1 tracking-[.12em]">POCKETED ONE-SHOTS</div>
            {consumables.length ? (
                <div className="text-emerald-300">{consumables.map(item => item.name).join(', ')}</div>
            ) : (
                <div className="text-gray-300">None</div>
            )}
        </div>
    </div>
);

const RouteChoiceCard = ({ path, projection, onPick }) => {
    const quota = projection?.nextTargetDisplay ?? projection?.nextTarget;
    const aria = `${path.name}, next quota about ${quota}${path.boss ? `, boss ${path.boss.name}` : ''}${projection?.nextHands ? `, ${projection.nextHands} plays` : ''}`;
    return (
        <button
            type="button"
            onClick={() => onPick(path)}
            aria-label={aria}
            className={`w-full min-h-[44px] p-4 border-2 rounded text-left hover:bg-white/5 transition-all ${path.color}`}
        >
            <div className="font-bold text-xl uppercase tracking-wider">{path.name}</div>
            <div className="text-xs opacity-70 mt-1 font-mono">{path.desc}</div>
            {projection && (
                <div className="mt-2 font-mono text-sm text-yellow-200">
                    Next quota: <span className="font-bold text-white">~{quota}</span>
                </div>
            )}
            {projection?.effectLines?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[10px] font-mono text-gray-300 list-disc list-inside">
                    {projection.effectLines.slice(0, 5).map((line, idx) => (
                        <li key={idx}>{line}</li>
                    ))}
                </ul>
            )}
            {path.boss && (
                <div className="mt-3 pt-2 border-t border-current flex gap-2 items-start text-[10px] font-bold font-mono">
                    <BossPortrait boss={path.boss} variant="intel" />
                    <div className="min-w-0">
                        <span className="text-white">BOSS:</span> {path.boss.name} — {path.boss.desc}
                    </div>
                </div>
            )}
        </button>
    );
};

const BuildIndicator = ({ analysis, inline = false }) => {
    const ui = BUILD_UI[analysis.primaryBuild] || BUILD_UI[BUILD_IDS.UNKNOWN];
    const tier = analysis.confidence >= 0.72 ? 'HIGH' : analysis.confidence >= 0.42 ? 'MED' : 'LOW';
    return (
        <div className={`${inline ? 'relative w-full' : 'absolute top-16 left-4 z-[82] w-[min(88vw,15rem)]'} rounded-xl readable-panel ${ui.border} px-3 py-3 font-mono text-xs pointer-events-none`}>
            <div className="tracking-[.22em] text-gray-400 mb-1 font-bold">BUILD INTEL</div>
            <div className={`${ui.accent} font-bold leading-tight tracking-wide text-sm`}>BUILD: {ui.label}</div>
            {analysis.secondaryTag && <div className="text-gray-300 mt-1 truncate">TAG: {analysis.secondaryTag}</div>}
            <div className="text-gray-300 mt-1">CONF: <span className={tier === 'HIGH' ? 'text-[#0df] font-bold' : 'text-gray-100'}>{tier}</span></div>
        </div>
    );
};

const RunBuildFootprint = ({ runBuild }) => {
    const primary = runBuild?.primary || BUILD_IDS.UNKNOWN;
    const ui = BUILD_UI[primary] || BUILD_UI[BUILD_IDS.UNKNOWN];
    const tips = BUILD_TIPS[primary] || BUILD_TIPS[BUILD_IDS.UNKNOWN];
    const blurbs = BUILD_STYLE_BLURBS[primary] || BUILD_STYLE_BLURBS[BUILD_IDS.UNKNOWN];
    const keys = (runBuild?.keyItems || []).filter(Boolean);
    const formatKey = (k) => {
        if (k === 'FLOW_STREAK') return 'FLOW STREAK';
        const meta = itemById(k);
        return meta?.name || meta?.label || k;
    };
    return (
        <div className="mt-4 border-2 border-black/70 bg-white/40 p-3 rounded font-mono text-xs text-left">
            <div className="text-[10px] tracking-[.3em] text-gray-600 mb-2">RUN ARCHETYPE</div>
            <div className={`text-base font-bold ${ui.accent}`}>RUN TYPE: {ui.label}</div>
            <div className="text-[11px] text-gray-700 mt-2 leading-relaxed">
                <div><span className="opacity-60">STYLE - </span>{blurbs.scale}</div>
                <div><span className="opacity-60">CONSISTENCY - </span>{blurbs.consistency}</div>
            </div>
            {keys.length > 0 && (
                <div className="mt-2 text-[11px]">
                    <span className="opacity-60">KEY COMPONENTS - </span>
                    <span className="text-gray-900">{keys.map(formatKey).join(' / ')}</span>
                </div>
            )}
            <div className="mt-3 border-t border-black/20 pt-2 text-[10px] text-gray-700 space-y-1">
                {tips.slice(0, 3).map((t, i) => <div key={i}>- {t}</div>)}
            </div>
        </div>
    );
};

const HelpOverlay = ({ onClose }) => (
    <div className="absolute inset-0 z-[760] bg-black/85 p-4 md:p-8 flex items-center justify-center" onClick={onClose}>
        <div className="w-full max-w-2xl bg-[#1a1a1a] border-4 border-[#c78b16] rounded-xl p-5 md:p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-3">
                <h3 className="font-marker text-3xl text-[#ff007f] italic">HELP DOSSIER</h3>
                <button onClick={onClose} className="font-mono text-xs text-gray-400 hover:text-white">CLOSE</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm font-mono">
                <div className="bg-black/50 border border-gray-700 rounded p-3">
                    <div className="text-[#0df] mb-2 tracking-wider">CORE LOOP</div>
                    <ul className="space-y-1 text-gray-200">
                        <li>1. Roll bones.</li>
                        <li>2. Keep what you want.</li>
                        <li>3. Pick one payout row.</li>
                        <li>4. Beat quota (heat ≥ target) before plays run out.</li>
                    </ul>
                </div>
                <div className="bg-black/50 border border-gray-700 rounded p-3">
                    <div className="text-[#0df] mb-2 tracking-wider">QUOTA &amp; PLAYS</div>
                    <ul className="space-y-1 text-gray-200">
                        <li>Heat is the score you bank toward the round quota.</li>
                        <li>Each payout row you use costs one play.</li>
                        <li>Invalid hands score 0 but still consume a play.</li>
                        <li>Debt and some bosses raise pressure on later rounds.</li>
                    </ul>
                </div>
                <div className="bg-black/50 border border-gray-700 rounded p-3">
                    <div className="text-[#0df] mb-2 tracking-wider">PILLS + STASH</div>
                    <ul className="space-y-1 text-gray-200">
                        <li>Pills reroll one slot immediately (PILL badge on each bone).</li>
                        <li>Stash fills from strong hands.</li>
                        <li>SNIFF rerolls one random free slot.</li>
                        <li>BRIBE, FIX GAME, and LAUNDER spend stash.</li>
                    </ul>
                </div>
                <div className="bg-black/50 border border-gray-700 rounded p-3">
                    <div className="text-[#0df] mb-2 tracking-wider">HEAT BOSSES</div>
                    <ul className="space-y-1 text-gray-200 text-[11px] leading-relaxed">
                        {Object.values(BOSSES).map((boss) => (
                            <li key={boss.id}><span className={boss.color}>{boss.name}:</span> {boss.desc}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-black/50 border border-gray-700 rounded p-3 md:col-span-2">
                    <div className="text-[#0df] mb-2 tracking-wider">ROUTES &amp; GAMBLE</div>
                    <ul className="space-y-1 text-gray-200 text-[11px] leading-relaxed mb-3">
                        <li><span className="text-[#f4d67b]">BACK ALLEY:</span> Standard quota curve — safe default.</li>
                        <li><span className="text-[#c78b16]">PAWN SHOP:</span> Higher quota for +$15 cash on pick.</li>
                        <li><span className="text-cyan-400">SAFEHOUSE CUT:</span> Moderate quota, +1 play, −1 pill.</li>
                        <li><span className="text-emerald-400">SMUGGLE RUN:</span> High quota, cash, and a random one-shot.</li>
                        <li><span className="text-[#ff007f]">VIP ROOM:</span> Steep quota but refills stash to 100%.</li>
                        <li><span className="text-red-400">TURF WAR:</span> From round 4 on even shop stops — last route adds a boss (quota rules on the banner).</li>
                    </ul>
                    <p className="text-gray-200 text-[11px] leading-relaxed mb-2">
                        <span className="text-[#0df]">Double or nothing</span> appears when you clear a round with ${GAMBLE_TUNING.minStake}+ cash from round {GAMBLE_TUNING.minRound} onward.
                        <b className="text-gray-100"> Safe cut</b> keeps all cash and skips the flip;
                        <b className="text-gray-100"> Flip tiers</b> — Soft (better odds, smaller stake), Fair (50/50), Hard (lower odds, +50% win payout). Flow streak adds a small win bonus (up to +{Math.round(GAMBLE_TUNING.flowWinBonusCap * 100)}%).
                    </p>
                    <p className="text-gray-200 text-[11px] leading-relaxed">
                        <span className="text-[#0df]">Side bets</span> lock before your first roll. Threshold starts at {WAGER_TUNING.baseThreshold} heat and rises +{WAGER_TUNING.roundThresholdStep} each round.
                        Wins pay about {WAGER_TUNING.payoutMultiplier}× stake (stake is spent when you place the bet).
                    </p>
                </div>
                <div className="bg-black/50 border border-gray-700 rounded p-3 md:col-span-2">
                    <div className="text-[#0df] mb-2 tracking-wider">SURVIVAL NOTES</div>
                    <p className="text-gray-200 leading-relaxed">
                        Cash keeps you flexible in the shop; stash keeps you alive mid-round.
                        Locked payout rows on the sheet unlock as you survive more runs — the fixer does not trust you with the full board on night one.
                    </p>
                </div>
            </div>
        </div>
    </div>
);

const SystemMenu = ({
    onResume,
    onRestart,
    onOpenHelp,
    onExitToLineup,
    reducedMotion,
    onToggleReducedMotion,
    audioMuted,
    onToggleAudioMuted,
    audioVolume,
    onCycleAudioVolume
}) => (
    <div className="absolute inset-0 z-[750] bg-black/70 p-4 md:p-8 flex items-start justify-end" onClick={onResume}>
        <div className="w-full max-w-sm bg-[#1a1a1a] border-4 border-[#0df] rounded-xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-mono text-xs tracking-[.3em] text-[#0df] mb-3">SYSTEM MENU</div>
            <div className="space-y-2 font-mono text-sm">
                <button onClick={onResume} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#0df]">RESUME HUSTLE</button>
                <button onClick={onRestart} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#c78b16]">RESTART RUN</button>
                <button onClick={onOpenHelp} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#ff007f]">HELP DOSSIER</button>
                <button onClick={onToggleReducedMotion} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#0df]">
                    ACCESSIBILITY: REDUCED MOTION {reducedMotion ? 'ON' : 'OFF'}
                </button>
                <button onClick={onToggleAudioMuted} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#c78b16]">
                    SOUND {audioMuted ? 'MUTED' : 'ON'}
                </button>
                <button onClick={onCycleAudioVolume} disabled={audioMuted} className="w-full text-left px-3 py-2 border border-gray-700 bg-black/40 hover:border-[#c78b16] disabled:opacity-40 disabled:hover:border-gray-700">
                    VOLUME: {formatVolumeLabel(audioVolume)} ({Math.round(audioVolume * 100)}%)
                </button>
                <button onClick={onExitToLineup} className="w-full text-left px-3 py-2 border border-red-900 bg-red-950/40 hover:border-red-500 text-red-300">EXIT TO LINEUP</button>
            </div>
        </div>
    </div>
);

const CaseFilesPanel = ({ tab, onChangeTab, onClose }) => (
    <div className="absolute inset-0 z-[740] bg-black/85 p-4 md:p-8 flex items-center justify-center" onClick={onClose}>
        <div className="w-full max-w-4xl bg-[#101010] border-4 border-[#c78b16] rounded-xl p-4 md:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-gray-700 pb-3 mb-4">
                <div>
                    <h3 className="font-marker text-3xl text-[#ff007f] italic">CASE FILES</h3>
                    <div className="font-mono text-xs text-gray-400">Street Intel on operators and heat sources.</div>
                </div>
                <button onClick={onClose} className="self-start md:self-auto font-mono text-xs text-gray-400 hover:text-white">CLOSE</button>
            </div>
            <div className="flex gap-2 mb-4">
                <button onClick={() => onChangeTab('personas')} className={`px-3 py-2 font-mono text-xs border ${tab === 'personas' ? 'border-[#ff007f] text-white bg-[#2a0017]' : 'border-gray-700 text-gray-300 bg-black/40'}`}>OPERATORS</button>
                <button onClick={() => onChangeTab('bosses')} className={`px-3 py-2 font-mono text-xs border ${tab === 'bosses' ? 'border-[#ff007f] text-white bg-[#2a0017]' : 'border-gray-700 text-gray-300 bg-black/40'}`}>HEAT BOSSES</button>
                <button onClick={() => onChangeTab('archive')} className={`px-3 py-2 font-mono text-xs border ${tab === 'archive' ? 'border-[#ff007f] text-white bg-[#2a0017]' : 'border-gray-700 text-gray-300 bg-black/40'}`}>ARCHIVE</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {tab === 'personas' && PERSONAS.map((p) => (
                    <article key={p.id} className="border border-gray-700 bg-black/40 rounded p-3">
                        <div className="flex gap-3">
                            <PersonaPortrait persona={p} variant="lore" />
                            <div className="min-w-0 flex-1">
                                <div className="font-marker text-2xl text-[#d6b85c]">{p.name}</div>
                                <div className="font-mono text-[11px] text-[#0df] mb-2">ALIAS: {p.alias}</div>
                                <p className="font-mono text-xs text-gray-200 leading-relaxed">{STREET_INTEL.personas[p.id]}</p>
                                <div className="mt-2 text-[11px] font-mono text-gray-400">Loadout: {p.loadout}</div>
                            </div>
                        </div>
                    </article>
                ))}
                {tab === 'bosses' && Object.values(BOSSES).map((boss) => (
                    <article key={boss.id} className="border border-gray-700 bg-black/40 rounded p-3">
                        <div className="flex gap-3">
                            <BossPortrait boss={boss} variant="lore" />
                            <div className="min-w-0 flex-1">
                                <div className={`font-marker text-2xl ${boss.color}`}>{boss.name}</div>
                                <div className="font-mono text-[11px] text-gray-300 mb-2">{boss.desc}</div>
                                <p className="font-mono text-xs text-gray-200 leading-relaxed">{STREET_INTEL.bosses[boss.id]}</p>
                            </div>
                        </div>
                    </article>
                ))}
                {tab === 'archive' && (
                    <div className="md:col-span-2 grid gap-3">
                        <section className="border border-gray-700 bg-black/40 rounded p-3">
                            <div className="font-mono text-[11px] tracking-[.25em] text-cyan-300 mb-2">STORY ARCS (RANDOM EACH RUN)</div>
                            <p className="font-mono text-xs text-gray-200 leading-relaxed mb-3">
                                Each contract deals one of five crime-comic threads. Panels play at run open, between rounds, and on bust or escape. Missing art skips silently; captions still land.
                            </p>
                            <div className="grid md:grid-cols-2 gap-2">
                                {(GutterbonesStory?.ARC_IDS || []).map((id) => {
                                    const arc = GutterbonesStory?.getArc?.(id);
                                    if (!arc) return null;
                                    return (
                                        <article key={id} className="border border-gray-800 rounded p-2 bg-black/30">
                                            <div className="font-marker text-lg text-[#ff007f]">{arc.title}</div>
                                            <div className="font-mono text-[10px] text-gray-400 mt-1">{arc.logline}</div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                        <section className="border border-gray-700 bg-black/40 rounded p-3">
                            <div className="font-mono text-[11px] tracking-[.25em] text-cyan-300 mb-2">PAYOUT SHEET PROGRESSION</div>
                            <p className="font-mono text-xs text-gray-200 leading-relaxed">
                                The fixer limits which payout rows you can hit early on. Quad unlocks after <b>{ONBOARDING_THRESHOLDS.BASIC_COMBOS}</b> completed runs;
                                Short Run, Long Run, and Jackpot unlock after <b>{ONBOARDING_THRESHOLDS.ALL_CATEGORIES}</b>.
                                Rare shop faces appear after <b>{ONBOARDING_THRESHOLDS.RARE_FACES}</b> runs.
                            </p>
                        </section>
                        <section className="border border-gray-700 bg-black/40 rounded p-3">
                            <div className="font-mono text-[11px] tracking-[.25em] text-cyan-300 mb-2">CONTRABAND FACES</div>
                            <div className="grid md:grid-cols-2 gap-2">
                                {Object.values(FACE_DATABASE).map((face) => (
                                    <article key={face.id} className="border border-gray-800 rounded p-2 bg-black/30">
                                        <div className="font-mono text-xs text-white">{face.label}</div>
                                        <div className="font-mono text-[10px] text-gray-400">TYPE: {face.type} / COST: ${face.cost}</div>
                                    </article>
                                ))}
                            </div>
                        </section>
                        <section className="border border-gray-700 bg-black/40 rounded p-3">
                            <div className="font-mono text-[11px] tracking-[.25em] text-cyan-300 mb-2">HARDWARE</div>
                            <div className="grid md:grid-cols-2 gap-2">
                                {Object.values(DEVISES).map((devise) => (
                                    <article key={devise.id} className="border border-gray-800 rounded p-2 bg-black/30">
                                        <div className="font-mono text-xs text-white">{devise.name}</div>
                                        <div className="font-mono text-[10px] text-gray-300 leading-snug">{devise.desc}</div>
                                        <div className="font-mono text-[10px] text-gray-500">COST: ${devise.cost}</div>
                                    </article>
                                ))}
                            </div>
                        </section>
                        <section className="border border-gray-700 bg-black/40 rounded p-3">
                            <div className="font-mono text-[11px] tracking-[.25em] text-cyan-300 mb-2">TACTICAL CONSUMABLES</div>
                            <div className="grid md:grid-cols-2 gap-2">
                                {Object.values(CONSUMABLES).map((item) => (
                                    <article key={item.id} className="border border-gray-800 rounded p-2 bg-black/30">
                                        <div className="font-mono text-xs text-white">{item.icon || '[]'} {item.name}</div>
                                        <div className="font-mono text-[10px] text-gray-300 leading-snug">{item.desc}</div>
                                        <div className="font-mono text-[10px] text-gray-500">COST: ${item.cost}</div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    </div>
);

function App() {
    const [phase, setPhase] = useState('LINEUP');
    const [personaIdx, setPersonaIdx] = useState(0);
    const [persona, setPersona] = useState(PERSONAS[0]);
    const [round, setRound] = useState(1);
    const [score, setScore] = useState(0);
    const [target, setTarget] = useState(150);
    const [hands, setHands] = useState(4);
    const [discards, setDiscards] = useState(3);
    const [gold, setGold] = useState(20);
    const [debt, setDebt] = useState(0);
    const [stash, setStash] = useState(0);
    const [stashDirection, setStashDirection] = useState(1);
    const [inventory, setInventory] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [dice, setDice] = useState([]);
    const [kept, setKept] = useState([false,false,false,false,false]);
    const [rolling, setRolling] = useState(false);
    const [hasRolled, setHasRolled] = useState(false);
    const [usedCats, setUsedCats] = useState([]);
    const [handLevels, setHandLevels] = useState({});
    const [flowStreak, setFlowStreak] = useState(0);
    const [shopItems, setShopItems] = useState([]);
    const [shopRefreshes, setShopRefreshes] = useState(0);
    const [paths, setPaths] = useState([]);
    const [currentRouteEffect, setCurrentRouteEffect] = useState(null);
    const [activeBoss, setActiveBoss] = useState(null);
    const [bossIntro, setBossIntro] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [carvingDie, setCarvingDie] = useState(null);
    const [swapMode, setSwapMode] = useState(false);
    const [swapIdx, setSwapIdx] = useState(null);
    const [payoutActive, setPayoutActive] = useState(false);
    const [payoutCount, setPayoutCount] = useState(18);
    const [bustActive, setBustActive] = useState(false);
    const [feltPulse, setFeltPulse] = useState(false);
    const [scorePulse, setScorePulse] = useState(false);
    const [displayScore, setDisplayScore] = useState(0);
    const [displayGold, setDisplayGold] = useState(20);
    const [cashDropFlash, setCashDropFlash] = useState(false);
    const [powBurst, setPowBurst] = useState(false);
    const [hitFlashActive, setHitFlashActive] = useState(false);
    const [hitCallouts, setHitCallouts] = useState([]);
    const [triggerCascade, setTriggerCascade] = useState([]);
    const [paperStamps, setPaperStamps] = useState([]);
    const [cinematic, setCinematic] = useState(null);
    const [bossKick, setBossKick] = useState(false);
    const [soldItems, setSoldItems] = useState([]);
    const [carveSparks, setCarveSparks] = useState([]);
    const [pillBursts, setPillBursts] = useState([]);
    const [typedCase, setTypedCase] = useState('CASE #');
    const [showIncarceratedStamp, setShowIncarceratedStamp] = useState(false);
    const [history, setHistory] = useState([]);
    const [runStats, setRunStats] = useState({ totalHeat: 0, biggestHustle: 0, finalBoss: '', build: { ...DEFAULT_RUN_BUILD } });
    const [flyingScores, setFlyingScores] = useState([]);
    const [showMobileStash, setShowMobileStash] = useState(false);
    const [insaneContract, setInsaneContract] = useState(false);
    const [meta, setMeta] = useState(loadMetaState);
    const [hasSavedRun, setHasSavedRun] = useState(() => !!loadSavedRun());
    const [lastLaundered, setLastLaundered] = useState(0);
    const [runClosed, setRunClosed] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const [audioSettings, setAudioSettings] = useState(() => loadSettingsState());
    const [showFirstRunOverlay, setShowFirstRunOverlay] = useState(false);
    const [arcId, setArcId] = useState(GutterbonesStory?.DEFAULT_ARC_ID || 'witness');
    const [storyBeat, setStoryBeat] = useState(null);
    const storyFinishRef = useRef(null);
    const [unlockNotification, setUnlockNotification] = useState(null);
    const [mechanicPopup, setMechanicPopup] = useState(null);
    const [scoreResolution, setScoreResolution] = useState(null);
    const [scoreBreakdown, setScoreBreakdown] = useState(null);
    const [lossExplanation, setLossExplanation] = useState(null);
    const [showSystemMenu, setShowSystemMenu] = useState(false);
    const [showHelpOverlay, setShowHelpOverlay] = useState(false);
    const [showLorePanel, setShowLorePanel] = useState(false);
    const [loreTab, setLoreTab] = useState('personas');
    const [gambleStake, setGambleStake] = useState(0);
    const [activeWager, setActiveWager] = useState(null);
    const [showDevPanel, setShowDevPanel] = useState(false);
    const [devSmokeResults, setDevSmokeResults] = useState([]);
    const [fixerLine, setFixerLine] = useState(pickLine(FIXER_LINES.start));
    const [activeMechanicPopup, setActiveMechanicPopup] = useState(null);
    const [cameraKick, setCameraKick] = useState('');
    const prevTotalRunsRef = useRef(meta.totalRuns);
    const lastMechanicPopupRef = useRef({ key: '', at: 0 });
    const scoreAnimRef = useRef(0);
    const goldAnimRef = useRef(0);
    const prevGoldRef = useRef(20);
    const prevStashRef = useRef(0);
    const timeoutIdsRef = useRef(new Set());
    const intervalIdsRef = useRef(new Set());
    const buildCalloutPrevRef = useRef(null);
    const synergyCalloutAtRef = useRef(0);

    const scheduleTimeout = (fn, ms) => {
        const id = window.setTimeout(() => {
            timeoutIdsRef.current.delete(id);
            fn();
        }, ms);
        timeoutIdsRef.current.add(id);
        return id;
    };
    const scheduleInterval = (fn, ms) => {
        const id = window.setInterval(fn, ms);
        intervalIdsRef.current.add(id);
        return id;
    };
    const clearScheduledTimeout = (id) => {
        window.clearTimeout(id);
        timeoutIdsRef.current.delete(id);
    };
    const clearScheduledInterval = (id) => {
        window.clearInterval(id);
        intervalIdsRef.current.delete(id);
    };
    const showMechanicPopup = (hintKey) => {
        const hint = MECHANIC_HINTS[hintKey];
        if (!hint) return;
        const now = Date.now();
        const prev = lastMechanicPopupRef.current;
        if (prev.key === hintKey && (now - prev.at) < 1200) return;
        lastMechanicPopupRef.current = { key: hintKey, at: now };
        const id = Math.random();
        setMechanicPopup({ id, ...hint });
        scheduleTimeout(() => {
            setMechanicPopup(current => (current?.id === id ? null : current));
        }, 2800);
    };
    const triggerCameraKick = (kind = 'soft') => {
        if (reducedMotion) return;
        setCameraKick('');
        requestAnimationFrame(() => setCameraKick(kind));
        scheduleTimeout(() => setCameraKick(''), kind === 'hard' ? 260 : 200);
    };
    const toggleMechanicPopup = (popupId) => setActiveMechanicPopup(current => (current === popupId ? null : popupId));

    const getBossAdjustedTarget = (baseTarget, boss, roundNum) => {
        return GutterbonesRoutes.applyBossAdjustedTarget(baseTarget, boss, roundNum);
    };

    const currentTarget = getBossAdjustedTarget(target, activeBoss, round);
    const hardwareDisabled = activeBoss?.id === 'CROOKED_COP';
    const rollReady = !rolling && hands > 0 && !swapMode && (!hasRolled || discards > 0);
    const pressureLevel = phase === 'PLAY' && !reducedMotion
        ? (hands <= 1 ? 'high' : (debt > 0 || (discards <= 1 && hasRolled) ? 'low' : ''))
        : '';
    const inRunPhase = RUN_PHASES.includes(phase);
    const shopRefreshCost = getShopRefreshCost(round, shopRefreshes);
    const flowMultiplier = getFlowMultiplier(flowStreak);
    const wagerThreshold = GutterbonesRoutes.wagerThresholdForRound(round, WAGER_TUNING);
    const canPlaceWager = phase === 'PLAY' && !rolling && !hasRolled && !activeWager && hands > 0;
    const debtClearCashNeeded = Math.min(gold, Math.ceil(debt / DEBT_PAYDOWN_TUNING.reliefMultiplier));
    const selectedPersonaUnlocked = meta.unlockedPersonaIds.includes(PERSONAS[personaIdx].id);

    useEffect(() => {
        const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!mediaQuery) return;
        const onChange = () => setReducedMotion(mediaQuery.matches);
        onChange();
        if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onChange);
        else mediaQuery.addListener(onChange);
        return () => {
            if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', onChange);
            else mediaQuery.removeListener(onChange);
        };
    }, []);

    const applyAudioSettings = (next) => {
        setAudioSettings(next);
        AudioSystem.loadSettings(next);
        AudioSystem.setVolume(next.audioVolume);
        AudioSystem.setMuted(next.audioMuted);
        saveSettingsState(next);
    };

    const patchSettings = (patch) => {
        setAudioSettings((prev) => {
            const next = { ...prev, ...patch };
            AudioSystem.loadSettings(next);
            AudioSystem.setVolume(next.audioVolume);
            AudioSystem.setMuted(next.audioMuted);
            saveSettingsState(next);
            return next;
        });
    };

    useEffect(() => {
        AudioSystem.loadSettings(audioSettings);
        AudioSystem.setVolume(audioSettings.audioVolume);
        AudioSystem.setMuted(audioSettings.audioMuted);
    }, []);

    useEffect(() => {
        if (audioSettings.audioMuted) {
            AudioSystem.stopAmbient();
            return undefined;
        }
        if (phase === 'PLAY') {
            AudioSystem.init();
            AudioSystem.startAmbient();
        } else {
            AudioSystem.stopAmbient();
        }
        return undefined;
    }, [phase, audioSettings.audioMuted]);

    useEffect(() => {
        if (inRunPhase) return;
        setShowSystemMenu(false);
        setShowHelpOverlay(false);
        setShowDevPanel(false);
    }, [inRunPhase]);

    useEffect(() => {
        if (phase === 'LINEUP' || phase === 'SAFEHOUSE') return;
        setShowLorePanel(false);
    }, [phase]);
    useEffect(() => {
        if (phase !== 'PLAY') setActiveMechanicPopup(null);
    }, [phase]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key !== 'Escape' || !inRunPhase) return;
            if (showFirstRunOverlay || bossIntro || storyBeat) return;
            if (showHelpOverlay) {
                setShowHelpOverlay(false);
                return;
            }
            setShowSystemMenu(open => !open);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [inRunPhase, showFirstRunOverlay, showHelpOverlay, bossIntro, storyBeat]);

    useEffect(() => {
        if (!storyBeat) return undefined;
        const onKeyDown = (event) => {
            if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
                event.preventDefault();
                storyFinishRef.current?.();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [storyBeat]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && showLorePanel) setShowLorePanel(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showLorePanel]);

    useEffect(() => {
        if (!IS_DEV_BUILD) return undefined;
        const onKeyDown = (event) => {
            if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return;
            event.preventDefault();
            setShowDevPanel(open => !open);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (!IS_DEV_BUILD && showDevPanel) setShowDevPanel(false);
    }, [showDevPanel]);

    useEffect(() => () => {
        timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
        intervalIdsRef.current.forEach((id) => window.clearInterval(id));
        timeoutIdsRef.current.clear();
        intervalIdsRef.current.clear();
        AudioSystem.stopAmbient();
    }, []);

    useEffect(() => {
        const prev = prevTotalRunsRef.current;
        const curr = meta.totalRuns;
        prevTotalRunsRef.current = curr;
        if (prev === curr) return;
        if (prev < ONBOARDING_THRESHOLDS.BASIC_COMBOS && curr >= ONBOARDING_THRESHOLDS.BASIC_COMBOS) {
            setUnlockNotification('Quad (FOK) unlocked on the payout sheet — 2 runs survived.');
        } else if (prev < ONBOARDING_THRESHOLDS.RARE_FACES && curr >= ONBOARDING_THRESHOLDS.RARE_FACES) {
            setUnlockNotification('Rare contraband now appears in Back Alley shops (3 runs).');
        } else if (prev < ONBOARDING_THRESHOLDS.ALL_CATEGORIES && curr >= ONBOARDING_THRESHOLDS.ALL_CATEGORIES) {
            setUnlockNotification('Full payout sheet unlocked — Short Run, Long Run, Jackpot (5 runs).');
        }
    }, [meta.totalRuns]);

    const playStoryBeat = (panel, onDone) => {
        if (!panel || !panel.src) {
            onDone?.();
            return;
        }
        storyFinishRef.current = () => {
            setStoryBeat(null);
            onDone?.();
        };
        setStoryBeat(panel);
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

    const purchaseSafehouseUpgrade = (upgrade) => {
        if (meta.purchasedUpgradeIds.includes(upgrade.id) || meta.launderedCash < upgrade.cost) return;
        updateMeta(prev => {
            const next = {
                ...prev,
                launderedCash: prev.launderedCash - upgrade.cost,
                purchasedUpgradeIds: [...new Set([...prev.purchasedUpgradeIds, upgrade.id])]
            };
            if (upgrade.type === 'persona') next.unlockedPersonaIds = [...new Set([...prev.unlockedPersonaIds, ...upgrade.unlocks])];
            if (upgrade.type === 'faces') next.unlockedFaceIds = [...new Set([...prev.unlockedFaceIds, ...upgrade.unlocks])];
            if (upgrade.type === 'hardware') next.unlockedHardwareIds = [...new Set([...prev.unlockedHardwareIds, ...upgrade.unlocks])];
            return next;
        });
        AudioSystem.paper();
        spawnPaperStamp('PAID', '#0f766e');
    };

    const spawnFlying = (value) => {
        const id = Math.random();
        setFlyingScores(prev => [...prev, { id, value, x: window.innerWidth / 2, y: window.innerHeight * .45 }]);
        scheduleTimeout(() => setFlyingScores(prev => prev.filter(f => f.id !== id)), 1100);
    };

    const spawnHitCallout = (label) => {
        const id = Math.random();
        setHitCallouts(prev => [...prev, { id, label }]);
        scheduleTimeout(() => setHitCallouts(prev => prev.filter(item => item.id !== id)), 820);
    };

    const spawnPaperStamp = (text, color = '#d30000') => {
        const id = Math.random();
        setPaperStamps(prev => [...prev, { id, text, color }]);
        scheduleTimeout(() => setPaperStamps(prev => prev.filter(s => s.id !== id)), 900);
    };

    const cascadeTriggers = (triggers = []) => {
        const rows = triggers.slice(0, reducedMotion ? 1 : 4).map((t, i) => ({ id: `${t.name}-${i}-${Math.random()}`, label: `${t.name} ${t.value}`, delay: i * 80 }));
        setTriggerCascade(rows);
        scheduleTimeout(() => setTriggerCascade([]), 950);
    };

    const buildAnalysis = useMemo(
        () => analyzeBuild({ inventory, dice, history, flowStreak }),
        [inventory, dice, history, flowStreak]
    );

    useEffect(() => {
        if (!inRunPhase) return;
        setRunStats((s) => {
            const prevB = { ...DEFAULT_RUN_BUILD, ...(s.build || {}) };
            if (buildAnalysis.confidence > prevB.peakConfidence) {
                return {
                    ...s,
                    build: {
                        primary: buildAnalysis.primaryBuild,
                        peakConfidence: buildAnalysis.confidence,
                        keyItems: deriveKeyItems(buildAnalysis.primaryBuild, inventory, dice, flowStreak)
                    }
                };
            }
            return s;
        });
    }, [inRunPhase, buildAnalysis, inventory, dice, flowStreak]);

    useEffect(() => {
        if (!inRunPhase) return;
        const prev = buildCalloutPrevRef.current;
        buildCalloutPrevRef.current = { p: buildAnalysis.primaryBuild, c: buildAnalysis.confidence };
        if (!prev) return;
        if (buildAnalysis.primaryBuild === BUILD_IDS.UNKNOWN) return;
        if (buildAnalysis.primaryBuild === prev.p && buildAnalysis.confidence > prev.c + 0.075) {
            const now = Date.now();
            if (now - synergyCalloutAtRef.current < 1400) return;
            const line = BUILD_SYNERGY_CALLOUT[buildAnalysis.primaryBuild];
            if (line) {
                spawnHitCallout(line);
                synergyCalloutAtRef.current = now;
            }
        }
    }, [inRunPhase, buildAnalysis.primaryBuild, buildAnalysis.confidence]);

    const registerDebtSpike = (shortage, source = 'shortage') => {
        const debtSpike = Math.max(1, Math.ceil(shortage * ECONOMY_TUNING.shortageToDebtRatio));
        setDebt(d => d + debtSpike);
        const sourceLabel = source.toUpperCase();
        spawnHitCallout(`+DEBT (${sourceLabel})`);
        cascadeTriggers([{ name: 'DEBT', value: `+${debtSpike} ${sourceLabel}` }]);
        return debtSpike;
    };

    useEffect(() => {
        cancelAnimationFrame(scoreAnimRef.current);
        const from = displayScore;
        const to = score;
        const start = performance.now();
        const dur = reducedMotion ? 260 : 620;
        const rising = to > from;
        const overshoot = (!reducedMotion && rising) ? Math.max(1, Math.min(24, Math.round((to - from) * 0.035))) : 0;
        const peak = to + overshoot;
        const tick = (ts) => {
            const p = Math.min(1, (ts - start) / dur);
            let next = from + (to - from) * (1 - Math.pow(1 - p, 3));
            if (overshoot > 0) {
                if (p < 0.72) {
                    const p1 = p / 0.72;
                    next = from + (peak - from) * (1 - Math.pow(1 - p1, 3));
                } else {
                    const p2 = (p - 0.72) / 0.28;
                    next = peak + (to - peak) * (1 - Math.pow(1 - p2, 2));
                }
            }
            setDisplayScore(Math.round(next));
            if (p < 1) scoreAnimRef.current = requestAnimationFrame(tick);
        };
        scoreAnimRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(scoreAnimRef.current);
    }, [score, reducedMotion]);

    useEffect(() => {
        cancelAnimationFrame(goldAnimRef.current);
        const from = displayGold;
        const to = gold;
        const start = performance.now();
        const dur = 250;
        const tick = (ts) => {
            const p = Math.min(1, (ts - start) / dur);
            const eased = 1 - Math.pow(1 - p, 2);
            setDisplayGold(Math.round(from + (to - from) * eased));
            if (p < 1) goldAnimRef.current = requestAnimationFrame(tick);
        };
        goldAnimRef.current = requestAnimationFrame(tick);
        if (gold < prevGoldRef.current) {
            setCashDropFlash(true);
            scheduleTimeout(() => setCashDropFlash(false), 320);
        }
        prevGoldRef.current = gold;
        return () => cancelAnimationFrame(goldAnimRef.current);
    }, [gold]);

    useEffect(() => {
        const prev = prevStashRef.current;
        if (stash > prev) setStashDirection(1);
        else if (stash < prev) setStashDirection(-1);
        prevStashRef.current = stash;
    }, [stash]);

    useEffect(() => {
        if (phase !== 'RAP_SHEET') {
            setTypedCase('CASE #');
            setShowIncarceratedStamp(false);
            return;
        }
        const full = 'CASE #77-0492';
        let idx = 0;
        const id = scheduleInterval(() => {
            idx += 1;
            setTypedCase(full.slice(0, idx));
            if (idx >= full.length) clearScheduledInterval(id);
        }, 50);
        const stampId = scheduleTimeout(() => setShowIncarceratedStamp(true), 450);
        return () => { clearScheduledInterval(id); clearScheduledTimeout(stampId); };
    }, [phase, reducedMotion]);

    useEffect(() => {
        if (!RUN_PHASES.includes(phase)) return;
        persistRun(phase);
    }, [phase, runClosed, arcId, persona.id, personaIdx, round, score, target, hands, discards, gold, debt, stash, insaneContract, inventory, consumables, dice, kept, hasRolled, usedCats, handLevels, flowStreak, shopItems, shopRefreshes, gambleStake, activeWager, currentRouteEffect, paths, activeBoss, selectedItem, carvingDie, swapMode, swapIdx, history, runStats]);

    const startRun = () => {
        const p = PERSONAS[personaIdx];
        if (!meta.unlockedPersonaIds.includes(p.id)) return;
        const runArcId = GutterbonesStory?.pickRandomArcId?.(Math.random()) || GutterbonesStory?.DEFAULT_ARC_ID || 'witness';
        const arcMeta = GutterbonesStory?.getArc?.(runArcId);
        setArcId(runArcId);
        const openingTargetBase = p.id === 'CARD_COUNTER'
            ? Math.floor(EARLY_GAME_TUNING.openingTarget * EARLY_GAME_TUNING.counterOpeningMultiplier)
            : EARLY_GAME_TUNING.openingTarget;
        clearSavedRun();
        setHasSavedRun(false);
        setRunClosed(false);
        AudioSystem.init();
        AudioSystem.paper();
        setPersona(p);
        setRound(1);
        setScore(0);
        setTarget(insaneContract ? Math.floor(openingTargetBase * INSANE_CONTRACT_MODIFIERS.targetMultiplier) : openingTargetBase);
        setHands(Math.max(1, p.plays - (insaneContract ? INSANE_CONTRACT_MODIFIERS.playPenalty : 0)));
        setDiscards(p.pills);
        setGold(p.cash);
        setDebt(0);
        setStash(0);
        setUsedCats([]);
        setHandLevels({});
        setFlowStreak(0);
        setShopRefreshes(0);
        setCurrentRouteEffect(null);
        setActiveBoss(null);
        setBossIntro(null);
        setBossKick(false);
        setCinematic(null);
        setScoreResolution(null);
        setScoreBreakdown(null);
        setLossExplanation(null);
        setGambleStake(0);
        setHasRolled(false);
        setKept([false,false,false,false,false]);
        setHistory([]);
        setFixerLine(arcMeta?.title ? `Story arc: ${arcMeta.title}. ${pickLine(FIXER_LINES.start)}` : pickLine(FIXER_LINES.start));
        setSoldItems([]);
        setCarveSparks([]);
        setPillBursts([]);
        setActiveWager(null);
        setRunStats({ totalHeat: 0, biggestHustle: 0, finalBoss: '', build: { ...DEFAULT_RUN_BUILD } });
        buildCalloutPrevRef.current = null;
        synergyCalloutAtRef.current = 0;
        setInventory(p.id === 'CARD_COUNTER' ? [DEVISES.BLACK_BOOK] : []);
        setConsumables([]);
        const bones = Array(5).fill(0).map(makeBone);
        if (p.id === 'ENFORCER') bones[0].faces[5] = FACE_DATABASE.BLOOD_6;
        setDice(bones);
        setShowSystemMenu(false);
        setShowHelpOverlay(false);
        const enterPlay = () => {
            setPhase('PLAY');
            if (meta.totalRuns === 0) setShowFirstRunOverlay(true);
        };
        const prologue = GutterbonesStory?.getProloguePanel?.(runArcId);
        playStoryBeat(prologue, enterPlay);
    };

    const calculateScore = (catId, currentDice) => GutterbonesRules.calculateScore(catId, currentDice, {
        handLevels, flowStreak, inventory, hardwareDisabled, activeBoss,
        CATEGORIES, HAND_MASTERY_TUNING, getFlowMultiplier, getHandMasteryBonus
    });

    const analyzeRunFailure = ({ score, target, debt, hands, history, attempts = 0, roundNumber = round, boss = activeBoss, flowValue = flowStreak }) => {
        const shortage = Math.max(0, target - score);
        const contributors = [];
        const tips = [];
        let primaryReason = shortage > 0
            ? `Missed quota by ${shortage} (${score}/${target}).`
            : 'Plays ran out before the run stabilized.';

        if (shortage > 0) contributors.push(`Final tally landed at ${score}/${target}.`);

        const hasLedger = inventory.some(item => item.id === 'SHADY_LEDGER');
        if (debt > 0) {
            const debtPenalty = !hasLedger && roundNumber >= EARLY_GAME_TUNING.debtPenaltyStartsRound
                ? Math.min(BOSS_TUNING.debtQuotaPenaltyCap, Math.floor(debt * BOSS_TUNING.debtQuotaPenaltyRatio))
                : 0;
            if (debtPenalty > 0) contributors.push(`Debt pressure raised quota pacing by about +${debtPenalty}.`);
            else contributors.push(`Debt remained active at $${debt}.`);
            tips.push('Pay down debt in shop before chasing high-risk lines.');
        }

        if (boss) {
            contributors.push(`${boss.name} effect: ${boss.desc}.`);
            tips.push(`Play around ${boss.name.toUpperCase()} before committing your final hand.`);
        }

        const roundHistory = history.filter(entry => entry.round === roundNumber);
        const validHands = roundHistory.length;
        const invalidHands = Math.max(0, attempts - validHands);
        if (invalidHands >= 2) {
            contributors.push(`${invalidHands} low-value/invalid payouts consumed your plays.`);
            tips.push('Open with reliable categories to avoid dead hands.');
        }

        const bestRoundHit = roundHistory.reduce((best, entry) => Math.max(best, entry.total || 0), 0);
        if (bestRoundHit < Math.max(40, Math.floor(target * 0.32))) contributors.push('No high-value hand landed this round.');
        if (flowValue <= 1) contributors.push('Flow multiplier never climbed above x1.00.');
        if (hardwareDisabled && inventory.length > 0) contributors.push('Hardware was suppressed by CROOKED COP.');

        if (tips.length === 0) tips.push('Build around Triad/Quad early, then spike with multipliers.');
        if (shortage >= Math.max(30, Math.floor(target * 0.2))) tips.unshift('Prioritize one 120+ payout line before your last play.');
        if (hands <= 1 && score < target) primaryReason = `Out of plays with ${target - score} heat still needed.`;

        return {
            primaryReason,
            contributors: contributors.slice(0, 3),
            tips: tips.slice(0, 2)
        };
    };

    const rollBones = () => {
        if (rolling || hands <= 0) return;
        if (hasRolled && discards <= 0) return;
        const settleMs = 1120;
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

    const executePayout = (catId) => {
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
                scheduleTimeout(() => setScoreResolution(current => (current?.id === resolutionPayload.id ? null : current)), reducedMotion ? 1200 : 1600);
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
                setPhase('RAP_SHEET');
                if (!reducedMotion) scheduleTimeout(() => setCinematic(null), 350);
            };
            const bustDelay = reducedMotion ? 400 : 900;
            scheduleTimeout(() => {
                playStoryBeat(GutterbonesStory?.getBustPanel?.(arcId), goRapSheet);
            }, bustDelay);
        } else if (hands <= 1) {
            if (round >= 10) {
                setLossExplanation(null);
                setGambleStake(0);
                setFixerLine('You cleared the city. Time to disappear.');
                awardLaunderedCash({ victory: true, totalHeat: runStats.totalHeat + gained, cash: settlementCash });
                AudioSystem.paper();
                if (!reducedMotion) setCinematic('victory');
                const goVictory = () => {
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
                    setFixerLine(pickLine(FIXER_LINES.gamble));
                    setPhase('GAMBLE');
                } else {
                    generateShop();
                    setPhase('SHOP');
                }
            }
        }
    };

    const resolveGamble = (doubleDown, tierId = 'FAIR') => {
        if (phase !== 'GAMBLE') return;
        if (doubleDown) {
            const outcome = GutterbonesGamble.resolveFlip({
                tierId,
                flowStreak,
                gold,
                random: Math.random()
            });
            setGambleStake(outcome.stake);
            if (outcome.won) {
                setGold(g => g + outcome.winAmount);
                setFixerLine(`${outcome.tierName} hit. +$${outcome.winAmount}.`);
                spawnPaperStamp('DOUBLE', '#0f766e');
                AudioSystem.playTone(980, 'square', 0.14);
            } else {
                setGold(g => Math.max(0, g - outcome.lossAmount));
                setFixerLine(`${outcome.tierName} missed. −$${outcome.lossAmount}.`);
                spawnPaperStamp('BUSTED BET');
                AudioSystem.playTone(120, 'sawtooth', 0.18);
            }
        } else {
            setFixerLine('Safe cut taken. Cash survives.');
        }
        setGambleStake(0);
        generateShop();
        setPhase('SHOP');
    };

    const placeSideWager = (stake) => {
        if (!canPlaceWager) return;
        if (stake <= 0 || gold < stake) return;
        setGold(g => g - stake);
        setActiveWager({ stake, threshold: wagerThreshold });
        setFixerLine(`Side bet locked: $${stake} on ${wagerThreshold}+ heat.`);
        spawnPaperStamp('SIDE BET', '#0f766e');
        AudioSystem.playTone(560, 'triangle', 0.11);
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

    const useConsumable = (idx) => {
        if (phase !== 'PLAY' || rolling) return;
        const item = consumables[idx];
        if (!item) return;
        setConsumables(prev => prev.filter((_, i) => i !== idx));
        if (item.id === 'SECOND_WIND') setHands(h => h + 1);
        if (item.id === 'SMELLING_SALTS') setDiscards(d => d + 2);
        if (item.id === 'DIRTY_WAD') setGold(g => g + 12);
        setFixerLine(`Used ${item.name}. Stay sharp.`);
        spawnPaperStamp('USED', '#0f766e');
        AudioSystem.playTone(700, 'triangle', 0.1);
        setShowMobileStash(false);
    };

    const generateShop = ({ preservePaths = false, preserveRefreshes = false } = {}) => {
        const faces = Object.values(FACE_DATABASE).filter(face => meta.unlockedFaceIds.includes(face.id) && isShopFaceAvailable(face, meta));
        const hardware = Object.values(DEVISES).filter(d => meta.unlockedHardwareIds.includes(d.id) && !inventory.some(i => i.id === d.id));
        const consumablePoolSeed = Object.values(CONSUMABLES);
        const consumableOfferChance = round <= 3 ? 0.65 : round <= 6 ? 0.45 : 0.3;
        const affordabilityCeiling = gold + Math.min(SHOP_TUNING.maxAffordableBuffer, Math.floor(stash / 4));
        const baseWeight = (item) => {
            let weight = 0;
            if (item.cost <= gold) weight += 4;
            else if (item.cost <= affordabilityCeiling) weight += 2;
            else weight -= 1;
            if (item.rarity === 'common') weight += round <= 3 ? 2 : 1;
            if (item.rarity === 'rare') weight += round >= 3 ? 2 : 0;
            if (item.rarity === 'danger') weight += round >= SHOP_TUNING.earlyDangerRoundGate ? 1 : -2;
            if (item.type === 'consumable') weight += round <= 4 ? 1 : 0;
            if (!item.type) weight += 1;
            return weight;
        };
        const weightedSort = (items) => items
            .map(item => ({ item, weight: baseWeight(item) + (Math.random() * 0.35) }))
            .sort((a, b) => b.weight - a.weight)
            .map(entry => entry.item);

        const facePool = weightedSort(faces);
        const hardwarePool = weightedSort(hardware);
        const consumablePool = weightedSort(consumablePoolSeed);
        const picks = [];
        if (facePool.length) picks.push(facePool.shift());
        if (hardwarePool.length) picks.push(hardwarePool.shift());
        if (consumablePool.length && picks.length < 4 && Math.random() < consumableOfferChance) picks.push(consumablePool.shift());

        const remainder = weightedSort([...facePool, ...hardwarePool, ...consumablePool]);
        while (picks.length < 4 && remainder.length) {
            const next = remainder.shift();
            if (picks.some(item => item.id === next.id)) continue;
            picks.push(next);
        }

        if (!picks.some(item => item.cost <= gold)) {
            const immediateFallback = weightedSort([...faces, ...hardware, ...consumablePoolSeed].filter(item => item.cost <= gold && !picks.some(p => p.id === item.id)))[0];
            if (immediateFallback) {
                const replaceIdx = Math.max(0, picks.length - 1);
                picks[replaceIdx] = immediateFallback;
            }
        }

        if (!picks.some(item => item.cost <= gold)) {
            const fallback = weightedSort([...faces, ...hardware, ...consumablePoolSeed].filter(item => item.cost <= affordabilityCeiling))[0];
            if (fallback && !picks.some(item => item.id === fallback.id)) {
                const replaceIdx = Math.max(0, picks.length - 1);
                picks[replaceIdx] = fallback;
            }
        }

        if (round <= PROGRESSION_GUARDRAILS.dangerCapRound) {
            const safePool = weightedSort([...faces, ...hardware, ...consumablePoolSeed].filter(item => item.rarity !== 'danger' && !picks.some(p => p.id === item.id)));
            const dangerIndices = picks
                .map((item, idx) => ({ item, idx }))
                .filter(entry => entry.item.rarity === 'danger')
                .map(entry => entry.idx);
            if (dangerIndices.length > PROGRESSION_GUARDRAILS.maxEarlyDangerOffers) {
                dangerIndices.slice(PROGRESSION_GUARDRAILS.maxEarlyDangerOffers).forEach((idx) => {
                    const replacement = safePool.shift();
                    if (replacement) picks[idx] = replacement;
                });
            }
        }

        setShopItems(picks.slice(0, 4));
        if (!preserveRefreshes) setShopRefreshes(0);
        if (preservePaths) return;
        if (round === 9) {
            setPaths([{ id: 'RAID', name: 'THE RAID', desc: 'Final encounter.', color: 'border-red-600 text-red-600 animate-pulse', boss: BOSSES.THE_RAID, mod: 1 }]);
        } else {
            const next = [...PATHS];
            if (round >= EARLY_GAME_TUNING.bossPathStartsRound && round % 2 === 0) {
                const b = [BOSSES.BOUNCER, BOSSES.LOAN_SHARK, BOSSES.JUNKIE, BOSSES.CROOKED_COP, BOSSES.INFORMANT][Math.floor(Math.random()*5)];
                const bossIdx = Math.max(0, next.length - 1);
                next[bossIdx] = { ...next[bossIdx], id: 'BOSS', name: 'TURF WAR', desc: `${b.name}: ${b.desc}`, color: 'border-red-600 text-red-600 animate-pulse', boss: b };
            }
            setPaths(next);
        }
    };

    const refreshShop = () => {
        if (phase !== 'SHOP') return;
        const cost = getShopRefreshCost(round, shopRefreshes);
        if (gold < cost) return;
        setGold(g => g - cost);
        setShopRefreshes(count => count + 1);
        generateShop({ preservePaths: true, preserveRefreshes: true });
        spawnPaperStamp('REROLLED', '#0f766e');
        AudioSystem.playTone(950, 'triangle', 0.1);
    };

    const sellInventoryItem = (item) => {
        if (phase !== 'SHOP') return;
        const saleValue = getHardwareSellValue(item);
        setInventory(prev => prev.filter(entry => entry.id !== item.id));
        setGold(g => g + saleValue);
        spawnPaperStamp('FENCED', '#0f766e');
        AudioSystem.playTone(520, 'square', 0.1);
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

    const handlePurchase = (item) => {
        if (soldItems.includes(item.id)) return;
        setSoldItems(prev => [...prev, item.id]);
        setFixerLine(gold >= item.cost ? `Bought ${item.name || item.label}.` : `Loan on ${item.name || item.label}. Watch that debt.`);
        AudioSystem.playTone(item.rarity === 'danger' ? 180 : 1200, 'square', 0.15);
        spawnPaperStamp('SOLD');
        scheduleTimeout(() => {
            setGold(g => {
                if (g >= item.cost) return g - item.cost;
                const shortage = item.cost - g;
                registerDebtSpike(shortage, 'shop loan');
                return 0;
            });
            if (item.type === 'consumable') {
                setConsumables(prev => [...prev, { ...item, instanceId: Math.random() }]);
                setShopItems(prev => prev.filter(i => i.id !== item.id));
            } else if (item.type) {
                setSelectedItem(item);
                setCarvingDie(null);
                setPhase('CARVING');
            } else {
                setInventory(prev => [...prev, item]);
                setShopItems(prev => prev.filter(i => i.id !== item.id));
            }
            setSoldItems(prev => prev.filter(id => id !== item.id));
        }, 220);
    };

    const executeCarve = (dieIdx, faceIdx) => {
        if (!selectedItem) return;
        setDice(prev => {
            const next = [...prev];
            const target = { ...next[dieIdx], faces: [...next[dieIdx].faces] };
            target.faces[faceIdx] = selectedItem;
            next[dieIdx] = target;
            return next;
        });
        setShopItems(prev => prev.filter(i => i.id !== selectedItem.id));
        setSelectedItem(null);
        setCarvingDie(null);
        if (!reducedMotion) {
            const sparks = Array.from({ length: 6 }, (_, i) => ({
                id: `${Date.now()}-${i}`,
                x: `${45 + ((Math.random() - .5) * 20)}%`,
                y: `${45 + ((Math.random() - .5) * 20)}%`,
                sx: `${(Math.random() - .5) * 80}px`,
                sy: `${(Math.random() - 1.1) * 70}px`
            }));
            setCarveSparks(sparks);
            scheduleTimeout(() => setCarveSparks([]), 360);
        }
        setPhase('SHOP');
    };

    const routeProjectionInput = () => ({
        round,
        target,
        debt,
        insaneContract,
        hasLedger: inventory.some(i => i.id === 'SHADY_LEDGER'),
        personaPlays: persona.plays,
        personaPills: persona.pills
    });

    const projectPath = (path) => GutterbonesRoutes.projectNextRound({ path, ...routeProjectionInput() });

    const bestPreviewHeat = (phase === 'PLAY' && hasRolled && !rolling)
        ? getAvailableCategories(meta).reduce((max, catId) => {
            const result = calculateScore(catId, dice);
            return result.valid && result.total > max ? result.total : max;
        }, 0)
        : null;
    const shopRoutePreviews = phase === 'SHOP'
        ? paths.map((p) => ({ ...p, _projection: projectPath(p) }))
        : [];

    const handleAdvance = (path) => {
        const projection = projectPath(path);
        const nextRound = projection.nextRound;
        const storyPanel = GutterbonesStory?.getRoundTransitionPanel?.(arcId, nextRound);
        setRound(r => r + 1);
        setScore(0);
        setTarget(projection.nextTarget);
        setHands(projection.nextHands);
        setDiscards(projection.nextDiscards);
        setUsedCats([]);
        setFlowStreak(0);
        setHasRolled(false);
        setKept([false,false,false,false,false]);
        setCurrentRouteEffect({ name: path.name, effects: describeRouteEffects(path) });
        setActiveBoss(path.boss || null);
        if (path.boss) {
            setFixerLine(pickLine(FIXER_LINES.boss));
            setBossIntro(path.boss);
            if (meta.totalRuns < 3 && !audioSettings.dismissBossHint) {
                spawnHitCallout('BOSS RULES — READ BANNER');
                patchSettings({ dismissBossHint: true });
            }
            if (!reducedMotion) setBossKick(true);
            triggerCameraKick('hard');
            AudioSystem.bossSting();
            if (!reducedMotion) scheduleTimeout(() => setBossKick(false), 280);
        } else {
            setFixerLine('Fresh block. Read the room and roll.');
        }
        if (path.reward) setGold(g => g + path.reward);
        if (path.fillStash && path.boss?.id !== 'INFORMANT') setStash(100);
        if (path.grantRandomConsumable) {
            const pool = Object.values(CONSUMABLES);
            const drop = pool[Math.floor(Math.random() * pool.length)];
            if (drop) {
                setConsumables(prev => [...prev, { ...drop, instanceId: Math.random() }]);
                setFixerLine(`Smuggle bonus pocketed: ${drop.name}.`);
            }
        }
        setRunClosed(false);
        const commitAdvance = () => setPhase('PLAY');
        playStoryBeat(storyPanel, commitAdvance);
    };

    const grantRandomConsumable = () => {
        const pool = Object.values(CONSUMABLES);
        const drop = pool[Math.floor(Math.random() * pool.length)];
        if (!drop) return;
        setConsumables(prev => [...prev, { ...drop, instanceId: Math.random() }]);
        setFixerLine(`DEV: granted ${drop.name}.`);
    };

    const forceBoss = (bossId) => {
        const boss = bossById(bossId);
        if (!boss) return;
        setActiveBoss(boss);
        setBossIntro(boss);
        setFixerLine(`DEV: forced boss ${boss.name}.`);
    };

    const runDevSmokeChecks = () => {
        const checks = [
            { id: 'flow-baseline', label: 'Flow baseline is x1.00', pass: getFlowMultiplier(0) === 1 },
            { id: 'wager-options', label: 'Wager options valid', pass: Array.isArray(WAGER_TUNING.stakeOptions) && WAGER_TUNING.stakeOptions.length >= 2 },
            { id: 'consumables-catalog', label: 'Consumables have valid costs', pass: Object.values(CONSUMABLES).every(item => Number.isFinite(item.cost) && item.cost > 0) },
            { id: 'routes-variants', label: 'Route variants available', pass: PATHS.some(path => path.id === 'HIDEOUT') && PATHS.some(path => path.id === 'SMUGGLE') },
            {
                id: 'route-projection',
                label: 'Route projection returns finite quota',
                pass: (() => {
                    const sample = GutterbonesRoutes.projectNextRound({
                        path: PATHS[0],
                        round: 2,
                        target: 130,
                        debt: 0,
                        insaneContract: false,
                        hasLedger: false,
                        personaPlays: 4,
                        personaPills: 3
                    });
                    return Number.isFinite(sample.nextTarget) && sample.nextTarget > 0 && Number.isFinite(sample.nextTargetDisplay);
                })()
            },
            {
                id: 'gamble-tiers',
                label: 'Gamble tiers resolve with finite stakes',
                pass: (() => {
                    const out = GutterbonesGamble.resolveFlip({ tierId: 'FAIR', flowStreak: 2, gold: 40, random: 0.99 });
                    return out.stake >= GAMBLE_TUNING.minStake && Number.isFinite(out.pWin) && out.pWin > 0.5;
                })()
            },
            {
                id: 'save-shape',
                label: 'Run snapshot includes critical fields',
                pass: (() => {
                    const snap = serializeRun(phase);
                    return ['activeWager', 'consumables', 'flowStreak', 'handLevels', 'gambleStake'].every(key => key in snap);
                })()
            }
        ];
        setDevSmokeResults(checks);
        setFixerLine(checks.every(check => check.pass) ? 'DEV smoke checks passed.' : 'DEV smoke checks found failures.');
    };

    return (
        <div className={`w-full h-[100dvh] bg-[#121113] text-[#d6b85c] overflow-hidden relative selection:bg-[#ff007f] selection:text-white touch-manipulation select-none ${bossKick ? 'boss-kick' : ''}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#262422_1px,transparent_1px),linear-gradient(180deg,rgba(255,0,127,0.05)_0%,rgba(0,221,255,0.05)_100%)] bg-[length:4px_4px,100%_100%] pointer-events-none z-0"></div>
            {(phase === 'LINEUP' || phase === 'SAFEHOUSE') && <div className="meta-stairwell-backdrop" aria-hidden />}
            <div className="ambient-grain"></div>
            <div className="ambient-vignette"></div>
            <div className="ambient-leak"></div>
            {inRunPhase && (
                <button onClick={() => setShowSystemMenu(true)} className="absolute top-3 right-24 z-[700] px-3 py-1 border border-gray-600 bg-black/70 text-[10px] font-mono tracking-widest hover:border-[#ff007f]">
                    SYSTEM
                </button>
            )}
            {payoutActive && <CashRain count={payoutCount} reducedMotion={reducedMotion} />}
            {bustActive && <div className="absolute inset-0 z-[200] bg-red-600/20 animate-pulse pointer-events-none"></div>}
            {bossIntro && <BossIntro boss={bossIntro} target={currentTarget} onDone={() => setBossIntro(null)} reducedMotion={reducedMotion} />}
            {storyBeat && (
                <StoryPanelOverlay
                    beat={storyBeat}
                    reducedMotion={reducedMotion}
                    onFinish={() => storyFinishRef.current?.()}
                />
            )}
            {showFirstRunOverlay && phase === 'PLAY' && !storyBeat && <FirstRunOverlay onDismiss={() => setShowFirstRunOverlay(false)} />}
            {unlockNotification && <UnlockNotification message={unlockNotification} onDone={() => setUnlockNotification(null)} />}
            {mechanicPopup && <MechanicPopup hint={mechanicPopup} onDone={() => setMechanicPopup(null)} />}
            {scoreResolution && <ScoreResolutionOverlay data={scoreResolution} reducedMotion={reducedMotion} />}
            {scoreBreakdown && <ScoreBreakdownOverlay result={scoreBreakdown} reducedMotion={reducedMotion} onDismiss={() => setScoreBreakdown(null)} />}
            {lossExplanation && <LossExplanationOverlay data={lossExplanation} reducedMotion={reducedMotion} />}
            {showLorePanel && <CaseFilesPanel tab={loreTab} onChangeTab={setLoreTab} onClose={() => setShowLorePanel(false)} />}
            {showSystemMenu && inRunPhase && (
                <SystemMenu
                    onResume={() => setShowSystemMenu(false)}
                    onRestart={() => {
                        setShowSystemMenu(false);
                        setShowHelpOverlay(false);
                        startRun();
                    }}
                    onOpenHelp={() => {
                        setShowSystemMenu(false);
                        setShowHelpOverlay(true);
                    }}
                    onExitToLineup={() => {
                        persistRun(phase);
                        setShowSystemMenu(false);
                        setShowHelpOverlay(false);
                        setPhase('LINEUP');
                    }}
                    reducedMotion={reducedMotion}
                    onToggleReducedMotion={() => setReducedMotion(v => !v)}
                    audioMuted={audioSettings.audioMuted}
                    onToggleAudioMuted={() => {
                        const nextMuted = !audioSettings.audioMuted;
                        applyAudioSettings({ ...audioSettings, audioMuted: nextMuted });
                        if (!nextMuted) {
                            AudioSystem.init();
                            AudioSystem.playTone(520, 'sine', 0.08);
                        }
                    }}
                    audioVolume={audioSettings.audioVolume}
                    onCycleAudioVolume={() => {
                        const idx = AUDIO_VOLUME_STEPS.findIndex((v) => Math.abs(v - audioSettings.audioVolume) < 0.02);
                        const nextIdx = idx < 0 ? 0 : (idx + 1) % AUDIO_VOLUME_STEPS.length;
                        const nextVol = AUDIO_VOLUME_STEPS[nextIdx];
                        applyAudioSettings({ ...audioSettings, audioVolume: nextVol });
                        AudioSystem.init();
                        AudioSystem.playTone(440 + nextIdx * 80, 'sine', 0.07);
                    }}
                />
            )}
            {showHelpOverlay && inRunPhase && <HelpOverlay onClose={() => setShowHelpOverlay(false)} />}
            {inRunPhase && phase !== 'PLAY' && (
                <>
                    <BuildIndicator analysis={buildAnalysis} />
                    <RunIntelPanel
                        flowMultiplier={flowMultiplier}
                        activeWager={activeWager}
                        insaneContract={insaneContract}
                        routeEffect={currentRouteEffect}
                        boss={activeBoss}
                        consumables={consumables}
                        upcomingPaths={shopRoutePreviews}
                    />
                </>
            )}
            {IS_DEV_BUILD && showDevPanel && inRunPhase && (
                <div className="absolute bottom-4 right-4 z-[820] w-80 bg-black/95 border-2 border-fuchsia-500 rounded p-3 shadow-2xl text-[10px] font-mono">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-fuchsia-300 tracking-[.25em]">DEV QA PANEL</div>
                        <button onClick={() => setShowDevPanel(false)} className="text-gray-400 hover:text-white">CLOSE</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <button onClick={() => setGold(g => g + 10)} className="border border-gray-700 px-1 py-1 text-emerald-300 hover:bg-emerald-900/30">+$10 CASH</button>
                        <button onClick={() => setDebt(d => d + 5)} className="border border-gray-700 px-1 py-1 text-red-300 hover:bg-red-900/30">+5 DEBT</button>
                        <button onClick={() => setScore(s => s + 100)} className="border border-gray-700 px-1 py-1 text-cyan-300 hover:bg-cyan-900/30">+100 HEAT</button>
                        <button onClick={() => setDebt(0)} className="border border-gray-700 px-1 py-1 text-red-200 hover:bg-red-900/30">CLEAR DEBT</button>
                        <button onClick={grantRandomConsumable} className="border border-gray-700 px-1 py-1 text-emerald-200 hover:bg-emerald-900/30">GRANT ONE-SHOT</button>
                        <button onClick={() => generateShop({ preservePaths: phase === 'SHOP', preserveRefreshes: true })} className="border border-gray-700 px-1 py-1 text-cyan-200 hover:bg-cyan-900/30">REROLL SHOP</button>
                    </div>
                    <div className="border-t border-gray-800 pt-2 mt-1">
                        <div className="text-gray-400 mb-1">FORCE BOSS</div>
                        <div className="flex flex-wrap gap-1">
                            {Object.values(BOSSES).filter(boss => boss.id !== 'THE_RAID').map((boss) => (
                                <button key={boss.id} onClick={() => forceBoss(boss.id)} className="border border-gray-700 px-1 py-1 text-[9px] text-red-300 hover:bg-red-900/30">
                                    {boss.name.replace('THE ', '')}
                                </button>
                            ))}
                        </div>
                    </div>
                    {phase === 'SHOP' && (
                        <div className="border-t border-gray-800 pt-2 mt-2">
                            <div className="text-gray-400 mb-1">FORCE ROUTE ADVANCE</div>
                            <div className="flex flex-wrap gap-1">
                                {paths.map((path) => (
                                    <button key={path.id} onClick={() => handleAdvance(path)} className="border border-gray-700 px-1 py-1 text-[9px] text-yellow-300 hover:bg-yellow-900/30">
                                        {path.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="border-t border-gray-800 pt-2 mt-2">
                        <button onClick={runDevSmokeChecks} className="w-full border border-fuchsia-700 px-2 py-1 text-fuchsia-300 hover:bg-fuchsia-900/30">RUN DEV SMOKE CHECKS</button>
                        {devSmokeResults.length > 0 && (
                            <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                                {devSmokeResults.map((check) => (
                                    <div key={check.id} className={`border px-2 py-1 ${check.pass ? 'border-emerald-700 text-emerald-300' : 'border-red-700 text-red-300'}`}>
                                        {check.pass ? 'PASS' : 'FAIL'} - {check.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {hitFlashActive && <div className="absolute inset-0 z-[340] bg-white/20 pointer-events-none" />}
            {flyingScores.map(item => <div key={item.id} className="fly-score" style={{ left: item.x, top: item.y }}>+{item.value}</div>)}
            {hitCallouts.map(item => <div key={item.id} className="fly-score text-[#ff007f]" style={{ left: '50%', top: '34%', fontSize: '2.5rem', letterSpacing: '.08em' }}>{item.label}</div>)}
            {triggerCascade.length > 0 && <div className="trigger-cascade">{triggerCascade.map(row => <div key={row.id} className="trigger-cascade-row mb-1 text-xs font-mono bg-black/70 border border-cyan-500/40 px-2 py-1 rounded" style={{ animationDelay: `${row.delay}ms` }}>{row.label}</div>)}</div>}
            {powBurst && <div className="pow-burst">POW!</div>}
            {paperStamps.map(stamp => <div key={stamp.id} className="stamp-overlay" style={{ '--stamp-color': stamp.color }}>{stamp.text}</div>)}
            {cinematic && <div className="cinematic-iris"></div>}
            {cinematic === 'bust' && <div className="cinematic-siren"></div>}

            {phase === 'LINEUP' && (
                <div className="h-full flex flex-col items-center justify-center relative z-20 overflow-y-auto p-6">
                    <h1 className="font-marker text-[#ff007f] text-5xl md:text-7xl tracking-[0.12em] italic mb-3 animate-[flicker_4s_infinite]">{GAME_BRANDING.displayName}</h1>
                    <div className="font-mono text-sm text-[#d6b85c] mb-6 flex flex-wrap gap-3 items-center justify-center">
                        <span>Safehouse Cash: <b className="text-green-400">${meta.launderedCash}</b></span>
                        <span>Best Heat: <b className="text-red-400">{meta.bestHeat}</b></span>
                        <span>Runs: <b>{meta.totalRuns}</b></span>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4 w-full max-w-6xl mb-8">
                        {PERSONAS.map((p, i) => {
                            const unlocked = meta.unlockedPersonaIds.includes(p.id);
                            const unlock = SAFEHOUSE_UPGRADES.find(u => u.type === 'persona' && u.unlocks.includes(p.id));
                            return (
                                <button key={p.id} disabled={!unlocked} onClick={() => { if (!unlocked) return; AudioSystem.init(); AudioSystem.paper(); setPersonaIdx(i); spawnPaperStamp('SELECTED', '#be185d'); }} className={`paper-card paper-lift relative bg-[#e8e6e1] text-black p-4 pb-8 shadow-2xl text-left transform transition-all ${personaIdx === i ? 'rotate-0 ring-4 ring-[#ff007f]' : i % 2 ? 'rotate-2 hover:rotate-0' : '-rotate-2 hover:rotate-0'} ${!unlocked ? 'grayscale opacity-60 cursor-not-allowed' : ''}`} style={{ '--paper-rot': personaIdx === i ? '0deg' : (i % 2 ? '2deg' : '-2deg') }}>
                                    <div className="h-36 bg-[#111] shadow-inner relative overflow-hidden flex items-end justify-center mb-4">
                                        <PersonaPortrait persona={p} variant="lineup" />
                                        <div className="absolute bottom-2 bg-white px-2 py-1 border-2 border-black font-mono text-black text-xs font-bold">N.Y.P.D. - {p.alias}</div>
                                    </div>
                                    <div className="font-marker text-2xl">{p.name}</div>
                                    <div className="font-mono text-xs mt-2">Cash ${p.cash} / Pills {p.pills} / Plays {p.plays}</div>
                                    <p className="text-xs mt-3 italic">{p.quirk}</p>
                                    {!unlocked && <div className="absolute inset-0 bg-black/70 text-white flex flex-col items-center justify-center p-4 text-center font-mono"><div className="text-[#ff007f] font-bold mb-2">LOCKED</div><div className="text-xs">Safehouse: {unlock ? `$${unlock.cost}` : 'Unknown Contact'}</div></div>}
                                </button>
                            );
                        })}
                    </div>
                    <div className={`w-full max-w-4xl mb-6 border-2 rounded-lg p-4 ${insaneContract ? 'border-[#ff007f] bg-[#2a0017]/70' : 'border-gray-700 bg-black/40'}`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div className="font-marker text-2xl italic text-[#ff007f]">INSANE CONTRACT</div>
                                <div className="font-mono text-xs text-gray-300">Hardcore street terms. Extra risk, no hidden rules.</div>
                            </div>
                            <button onClick={() => setInsaneContract(v => !v)} className={`px-5 py-2 border-2 font-mono tracking-wider ${insaneContract ? 'border-[#ff007f] bg-[#ff007f] text-black' : 'border-gray-600 bg-black/50 text-gray-200 hover:border-[#ff007f]'}`}>
                                {insaneContract ? 'ACTIVE' : 'OFF'}
                            </button>
                        </div>
                        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] font-mono text-gray-200">
                            {INSANE_CONTRACT_RULES.map((rule) => (
                                <div key={rule} className="border border-gray-700 rounded px-2 py-1 bg-black/35">{rule}</div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {hasSavedRun && <button onClick={resumeRun} className="px-8 py-4 bg-[#0df] border-4 border-[#064b52] text-black text-xl md:text-2xl font-mono tracking-widest shadow-[0_5px_0_#064b52] hover:bg-cyan-200 active:translate-y-1 active:shadow-none transition-all">RESUME HUSTLE</button>}
                        <button onClick={startRun} disabled={!selectedPersonaUnlocked} className="px-12 py-4 bg-[#c78b16] border-4 border-[#4a1111] text-[#121113] text-xl md:text-2xl font-mono tracking-widest shadow-[0_5px_0_#4a1111] hover:bg-[#d6b85c] active:translate-y-1 active:shadow-none transition-all disabled:grayscale disabled:opacity-50">OFFER CONTRACT</button>
                        <button onClick={() => { setLoreTab('personas'); setShowLorePanel(true); }} className="px-8 py-4 bg-[#2a0017] border-4 border-[#7a003d] text-[#ff9fcf] text-xl md:text-2xl font-mono tracking-widest hover:bg-[#3b0120] transition-all">CASE FILES</button>
                        <button onClick={() => setPhase('SAFEHOUSE')} className="px-8 py-4 bg-[#1a1a1a] border-4 border-[#c78b16] text-[#d6b85c] text-xl md:text-2xl font-mono tracking-widest hover:bg-[#2a2114] transition-all">SAFEHOUSE</button>
                    </div>
                    <div className="mt-6 font-mono text-[10px] tracking-[0.18em] text-[#d6b85c]/70 text-center">
                        Website &amp; contact:{' '}
                        <a href="https://lukeholmes.github.io/" target="_blank" rel="noopener noreferrer" className="text-[#0df] hover:text-white underline decoration-[#0df]/50 underline-offset-4">lukeholmes.github.io</a>
                    </div>
                </div>
            )}

            {phase === 'SAFEHOUSE' && (
                <div className="h-full flex items-center justify-center relative z-30 overflow-y-auto p-6 bg-black/50">
                    <div className="w-full max-w-5xl bg-[#E2D1B8] text-black border-l-[18px] border-[#c4b59d] shadow-[10px_20px_30px_black] p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-black pb-4 mb-6 gap-3">
                            <div><div className="font-marker text-4xl md:text-5xl">THE SAFEHOUSE</div><div className="font-mono text-sm opacity-70">Spend laundered cash on permanent contacts.</div></div>
                            <div className="font-mono text-2xl text-green-800 font-bold">${meta.launderedCash}</div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {SAFEHOUSE_UPGRADES.map(upgrade => {
                                const bought = meta.purchasedUpgradeIds.includes(upgrade.id);
                                const canBuy = meta.launderedCash >= upgrade.cost && !bought;
                                return (
                                    <div key={upgrade.id} className={`paper-card border-2 p-4 bg-white/50 ${bought ? 'border-green-700' : 'border-black'}`} style={{ '--paper-rot': '-0.8deg' }}>
                                        <div className="flex justify-between gap-3"><div><div className="font-marker text-2xl">{upgrade.name}</div><div className="font-mono text-xs opacity-70 mt-1">{upgrade.desc}</div></div><div className="font-mono font-bold text-lg">${upgrade.cost}</div></div>
                                        <div className="font-mono text-[10px] mt-3 opacity-60">UNLOCKS: {upgrade.unlocks.join(', ')}</div>
                                        <button onClick={() => purchaseSafehouseUpgrade(upgrade)} disabled={!canBuy} className={`mt-4 w-full py-2 font-mono font-bold border-2 ${bought ? 'border-green-700 text-green-800 bg-green-100' : canBuy ? 'border-black bg-[#c78b16] text-black hover:bg-yellow-500' : 'border-gray-500 text-gray-500 bg-gray-200'}`}>{bought ? 'CONTACT SECURED' : canBuy ? 'PAY THE BRIBE' : 'NEED MORE CASH'}</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="grid md:grid-cols-3 gap-3 font-mono text-xs bg-black/10 border border-black/20 p-3 mb-6">
                            <div><b>Personas:</b> {meta.unlockedPersonaIds.length}/{PERSONAS.length}</div>
                            <div><b>Contraband Faces:</b> {meta.unlockedFaceIds.length}/{Object.keys(FACE_DATABASE).length}</div>
                            <div><b>Hardware:</b> {meta.unlockedHardwareIds.length}/{Object.keys(DEVISES).length}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => { setLoreTab('bosses'); setShowLorePanel(true); }} className="px-8 py-3 bg-[#2a0017] text-[#ff9fcf] font-bold font-mono border-2 border-[#7a003d] hover:bg-[#3b0120] transition-colors">STREET INTEL</button>
                            <button onClick={() => setPhase('LINEUP')} className="px-8 py-3 bg-white text-black font-bold font-mono border-2 border-black hover:bg-[#ff007f] hover:text-white transition-colors">BACK TO LINEUP</button>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'PLAY' && (
                <div className={`h-full flex flex-col p-3 md:p-6 max-w-7xl mx-auto z-40 relative ${cameraKick === 'hard' ? 'camera-kick-hard' : cameraKick === 'soft' ? 'camera-kick-soft' : ''}`}>
                    {pressureLevel && <div className={`pressure-overlay ${pressureLevel}`}></div>}
                    {activeBoss?.id === 'CROOKED_COP' && !reducedMotion && <div className="cop-lights-sweep"></div>}
                    <ActiveModifiers inventory={inventory} boss={activeBoss} insaneContract={insaneContract} />
                    <div className="flex flex-col bg-black/90 border-4 border-gray-900 rounded-xl mb-3 md:mb-6 shadow-lg">
                        {activeBoss && <div className="boss-banner-scan px-4 py-2 border-b border-red-900 bg-red-950/40 font-mono text-xs flex items-center gap-3"><BossPortrait boss={activeBoss} variant="banner" /><div className="flex-1 flex justify-between gap-2 min-w-0"><span className={`${activeBoss.color} font-bold shrink-0`}>{activeBoss.name}</span><span className="text-gray-300 text-right leading-snug">{activeBoss.desc}</span></div></div>}
                        <div className="flex justify-between items-center p-3 md:p-4">
                            <div className="hidden sm:block">
                                <div className="text-xs uppercase opacity-50">The Fixer</div>
                                <div className="text-xl md:text-2xl font-bold text-[#ff007f] font-marker">LOU "THE SNAKE"</div>
                                {insaneContract && <div className="mt-1 text-[10px] font-mono text-[#ff9fcf] tracking-[.2em]">INSANE CONTRACT</div>}
                                <div className="mt-1 max-w-[15rem] text-[10px] font-mono text-gray-300 leading-tight">{fixerLine}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs opacity-50">STREET HEAT</div>
                                <div className={`text-3xl md:text-5xl font-black font-mono tracking-tighter ${displayScore >= currentTarget * 0.8 ? 'text-[#ff007f]' : 'text-red-600'} ${scorePulse ? 'score-pulse' : ''} ${activeBoss?.id === 'JUNKIE' ? 'junkie-glitch' : ''}`}>{displayScore.toString().padStart(4, '0')} <span className={`text-xl md:text-3xl opacity-50 ${activeBoss?.id === 'BOUNCER' ? 'bouncer-quota-thump' : ''}`}>/ {currentTarget}</span></div>
                                <div className={`font-mono text-[10px] mt-1 tracking-[.25em] ${flowStreak > 0 ? 'text-[#0df]' : 'text-gray-500'}`}>FLOW x{flowMultiplier.toFixed(2)}</div>
                                <div className="font-mono text-[9px] md:text-[10px] text-gray-400 mt-1 tracking-wide">Plays {hands} · Quota {currentTarget} · Pills {discards}</div>
                            </div>
                            {!audioSettings.dismissScoreHint && hasRolled && !rolling && usedCats.length === 0 && (
                            <div className="mx-3 md:mx-4 mb-1 px-3 py-2 border border-[#0df]/40 bg-cyan-950/30 font-mono text-[10px] md:text-xs text-cyan-100 text-center tracking-wide">
                                Tap a payout row on the left to score this hand.
                            </div>
                        )}
                        <div className="flex gap-3 md:gap-6 text-right">
                                <div><div className="text-[10px] opacity-50">CASH</div><div className={`text-xl md:text-2xl font-mono ${debt > 0 ? 'text-red-500' : ''} ${cashDropFlash ? 'hud-cash-drop' : ''}`}>${displayGold}{debt > 0 && <span className={`text-xs ${activeBoss?.id === 'LOAN_SHARK' ? 'loan-shark-debt' : 'debt-pulse'}`}> (-{debt})</span>}</div></div>
                                <div className="relative">
                                    <div className="text-[10px] opacity-50 flex items-center justify-end gap-1">
                                        <span>PILLS</span>
                                        <button
                                            onClick={() => toggleMechanicPopup('pills')}
                                            className="w-4 h-4 rounded-full border border-cyan-500/60 text-cyan-300 text-[10px] leading-none hover:border-cyan-300 hover:text-cyan-100"
                                            aria-label="Show pills mechanic details"
                                        >
                                            ?
                                        </button>
                                    </div>
                                    <div className={`text-xl md:text-2xl text-[#0df] font-mono ${discards <= 1 ? 'danger-count-pulse' : ''}`}>{discards}</div>
                                    {activeMechanicPopup === 'pills' && (
                                        <div className="mechanic-popover absolute right-0 top-full mt-2 w-72 text-left z-[140]">
                                            <div className="font-mono text-sm text-cyan-100 leading-relaxed">Tap the PILL badge on a bone to reroll that slot instantly.</div>
                                            <div className="font-mono text-xs text-gray-100 mt-2 leading-relaxed">Each pill spends 1 charge. During THE RAID, each use also costs $2 (or adds debt if short).</div>
                                            {inventory.some(i => i.id === 'BLACK_BOOK') && !hardwareDisabled && (
                                                <div className="font-mono text-xs text-emerald-200 mt-2">BLACK BOOK active: gain +$1 when you pop a pill.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div><div className="text-[10px] opacity-50">PLAYS</div><div className={`text-xl md:text-2xl text-white font-mono ${hands <= 1 ? 'danger-count-pulse' : ''}`}>{hands}</div></div>
                            </div>
                        </div>
                        <div className="px-3 md:px-4 pb-3 border-t border-gray-800 pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="font-mono text-[10px] text-gray-400 space-y-0.5">
                                {activeWager
                                    ? `SIDE BET LIVE: $${activeWager.stake} on ${activeWager.threshold}+ heat (win +$${GutterbonesRoutes.sideBetPayout(activeWager.stake, WAGER_TUNING.payoutMultiplier)})`
                                    : (
                                        <>
                                            <div>SIDE BET: choose stake before first roll — need {wagerThreshold}+ heat this round</div>
                                            {hasRolled ? (
                                                <div className={bestPreviewHeat >= wagerThreshold ? 'text-emerald-400' : 'text-amber-400/90'}>
                                                    Best preview: {bestPreviewHeat} vs {wagerThreshold}+ target
                                                </div>
                                            ) : (
                                                <div className="text-gray-500">Roll first to preview heat on the board.</div>
                                            )}
                                        </>
                                    )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {WAGER_TUNING.stakeOptions.map((stake) => {
                                    const winPayout = GutterbonesRoutes.sideBetPayout(stake, WAGER_TUNING.payoutMultiplier);
                                    const disabled = !canPlaceWager || gold < stake;
                                    const disabledReason = gold < stake ? 'Not enough cash' : !canPlaceWager ? 'Bet locked after first roll' : '';
                                    return (
                                        <button
                                            key={stake}
                                            onClick={() => placeSideWager(stake)}
                                            disabled={disabled}
                                            aria-disabled={disabled}
                                            aria-label={disabled ? `Bet $${stake}, win +$${winPayout}, ${disabledReason}` : `Bet $${stake}, win +$${winPayout} if ${wagerThreshold} plus heat`}
                                            title={disabled ? disabledReason : undefined}
                                            className="px-2 py-1.5 min-h-[44px] border border-emerald-700/70 text-emerald-300 bg-emerald-950/20 font-mono text-[10px] hover:bg-emerald-900/30 disabled:opacity-35 disabled:cursor-not-allowed text-left"
                                        >
                                            <div className="font-bold">BET ${stake}</div>
                                            <div className="text-emerald-400/90">Win +${winPayout}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={() => setShowMobileStash(true)} className="md:hidden w-full bg-gray-800 text-gray-300 py-2 border-t border-gray-700 text-[10px] font-mono font-bold tracking-widest">OPEN STASH / HARDWARE</button>
                    </div>
                    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-6 min-h-0 overflow-hidden">
                        <div className="order-2 md:order-1 md:col-span-3 min-h-0 bg-[#e8e6e1] text-gray-900 p-3 md:p-4 font-mono border-2 border-black md:-rotate-1 shadow-2xl overflow-y-auto max-h-[26vh] md:max-h-full">
                            <h2 className="text-center font-bold border-b-2 border-black pb-2 mb-2 sticky top-0 bg-[#e8e6e1]">THE PAYOUTS</h2>
                            {(() => {
                                const unlockInfo = getCategoryUnlockInfo(meta);
                                const availableSet = new Set(unlockInfo.available);
                                const lockedById = Object.fromEntries(unlockInfo.lockedDetails.map((row) => [row.id, row]));
                                const rows = Object.values(CATEGORIES).map((cat) => {
                                    if (availableSet.has(cat.id)) {
                                        return (
                                            <ScoreRow key={cat.id} id={cat.id} cat={cat} handLevel={handLevels[cat.id] || HAND_MASTERY_TUNING.baseLevel} result={calculateScore(cat.id, dice)} used={usedCats.includes(cat.id)} canScore={hasRolled && !usedCats.includes(cat.id) && !rolling} onScore={executePayout} />
                                        );
                                    }
                                    const gate = lockedById[cat.id];
                                    return (
                                        <LockedPayoutRow
                                            key={cat.id}
                                            cat={cat}
                                            unlockAtRun={gate?.unlockAtRun || 0}
                                            runsUntil={gate?.runsUntil ?? 0}
                                        />
                                    );
                                });
                                if (unlockInfo.locked.length) rows.push(<CategoryUnlockFooter key="cat-unlock" meta={meta} />);
                                return rows;
                            })()}
                        </div>
                        <div className={`order-1 md:order-2 flex-1 md:col-span-6 min-h-[36vh] md:min-h-0 felt-surface border-8 md:border-[12px] border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center relative shadow-inner overflow-hidden ${feltPulse ? 'felt-roll-pulse' : ''}`}>
                            <div className={`felt-edge-ring ${rolling ? 'felt-edge-ring-roll' : ''}`}></div>
                            <div className="felt-smoke">
                                <div className="felt-smoke-wisp left-[-8%] top-[12%]" style={{ '--sx': '52px', '--sy': '-20px', '--dur': '52s' }}></div>
                                <div className="felt-smoke-wisp right-[-12%] top-[46%]" style={{ '--sx': '-62px', '--sy': '-36px', '--dur': '44s' }}></div>
                                <div className="felt-smoke-wisp left-[28%] bottom-[-14%]" style={{ '--sx': '34px', '--sy': '-48px', '--dur': '58s' }}></div>
                            </div>
                            {pillBursts.map((pill) => <div key={pill.id} className="pill-burst" style={{ left: `${18 + (pill.idx * 15)}%`, top: '72%', '--pill-x': `${(pill.idx - 2) * 30}px`, '--pill-y': '-90px' }}></div>)}
                            <div className="absolute top-5 text-2xl md:text-3xl text-[#ff007f] font-marker opacity-20 tracking-widest italic animate-[flicker_4s_infinite]">THE ALLEYWAY</div>
                            <div className={`flex gap-2 md:gap-4 mb-14 md:mb-16 z-30 ${rolling ? 'dice-lane-roll' : 'dice-lane-idle'}`}>
                                {dice.map((d, i) => <Bone key={d.id} data={d} slot={i} rolling={rolling && !kept[i]} kept={kept[i]} selected={swapIdx === i} raidPill={activeBoss?.id === 'THE_RAID'} reducedMotion={reducedMotion} canPill={discards > 0 && hasRolled && !rolling} pillPulse={!audioSettings.dismissPillPulse && meta.totalRuns === 0 && hasRolled && discards > 0} onExplainPill={() => showMechanicPopup('PILL')} onPill={() => popPill(i)} onClick={() => {
                                    if (swapMode) {
                                        if (swapIdx === null) setSwapIdx(i);
                                        else {
                                            setDice(prev => { const n = [...prev]; [n[swapIdx], n[i]] = [n[i], n[swapIdx]]; return n; });
                                            setKept(prev => { const n = [...prev]; [n[swapIdx], n[i]] = [n[i], n[swapIdx]]; return n; });
                                            setSwapIdx(null); setSwapMode(false); AudioSystem.playTone(400, 'triangle', .1);
                                        }
                                    } else if (!rolling && hasRolled) {
                                        setKept(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
                                        AudioSystem.playTone(800, 'sine', .1);
                                    }
                                }} />)}
                            </div>
                            <div className="flex gap-3 md:gap-4 w-full px-4 md:px-12 absolute bottom-5 z-30">
                                <button onClick={() => setSwapMode(!swapMode)} disabled={rolling || !hasRolled} className={`flex-1 rounded border-4 font-bold text-sm md:text-xl transition-all font-mono py-3 ${swapMode ? 'bg-[#0df] text-black border-white' : 'bg-[#c78b16] text-black border-[#5c4305] disabled:opacity-50'}`}>{swapMode ? 'CANCEL' : 'SHUFFLE'}</button>
                                <button onClick={rollBones} disabled={!rollReady} className={`flex-1 bg-[#ff007f] text-white border-4 border-[#4a0024] shadow-[0_6px_0_#7a003d] font-marker text-2xl md:text-3xl italic tracking-tight active:translate-y-1 active:shadow-none disabled:grayscale disabled:opacity-50 py-3 ${rollReady ? 'roll-ready-pulse' : ''}`}>ROLL 'EM {(activeBoss?.id === 'LOAN_SHARK' || inventory.some(i=>i.id==='BLOOD_PACT') || insaneContract) && <span className="text-[10px] bg-red-900 border border-red-500 px-1 ml-2 font-mono">TOLL</span>}</button>
                            </div>
                        </div>
                        <div className={`${showMobileStash ? 'fixed inset-0 bg-black/95 z-[120] p-6 flex' : 'hidden'} order-3 md:order-3 md:static md:col-span-3 md:flex flex-col gap-4 min-h-0 overflow-y-auto pr-1`}>
                            <button onClick={() => setShowMobileStash(false)} className="md:hidden self-end bg-red-900 text-white px-4 py-2 font-mono border border-red-500 rounded">CLOSE</button>
                            <div className="hidden md:flex flex-col gap-3">
                                <BuildIndicator analysis={buildAnalysis} inline />
                                <RunIntelPanel
                                    flowMultiplier={flowMultiplier}
                                    activeWager={activeWager}
                                    insaneContract={insaneContract}
                                    routeEffect={currentRouteEffect}
                                    boss={activeBoss}
                                    consumables={consumables}
                                    inline
                                />
                            </div>
                            <div className="bg-black/90 border-4 border-gray-900 rounded-xl p-4 shadow-xl">
                                <div className={`flex items-center justify-center gap-2 border-b pb-2 ${activeBoss?.id === 'INFORMANT' ? 'border-yellow-500' : 'border-[#0df]'}`}>
                                    <h3 className={`text-center font-mono ${activeBoss?.id === 'INFORMANT' ? 'text-yellow-500' : 'text-[#0df]'}`}>THE STASH {activeBoss?.id === 'INFORMANT' && '(FROZEN)'}</h3>
                                    <button
                                        onClick={() => toggleMechanicPopup('stash')}
                                        className="w-4 h-4 rounded-full border border-cyan-500/60 text-cyan-300 text-[10px] leading-none hover:border-cyan-300 hover:text-cyan-100"
                                        aria-label="Show stash program details"
                                    >
                                        ?
                                    </button>
                                </div>
                                {activeMechanicPopup === 'stash' && (
                                    <div className="mechanic-popover mt-3 text-left">
                                        <div className="font-mono text-sm text-cyan-100 leading-relaxed">Build stash with strong payouts, then spend it on programs.</div>
                                        <div className="mechanic-popover-list mt-2 space-y-1">
                                            {PROGRAMS.map(program => (
                                                <div key={program.id} className="font-mono text-xs text-gray-100 leading-relaxed">
                                                    <span className="text-[#0df]">{program.name}</span> ({program.cost}%): {program.desc}
                                                </div>
                                            ))}
                                        </div>
                                        {activeBoss?.id === 'INFORMANT' && (
                                            <div className="font-mono text-xs text-yellow-200 mt-2">INFORMANT active: stash growth and program use are blocked this round.</div>
                                        )}
                                    </div>
                                )}
                                <div className={`h-6 bg-black border border-gray-600 rounded overflow-hidden mt-4 p-1 grid grid-cols-10 gap-1 ${activeBoss?.id === 'INFORMANT' ? 'informant-shimmer' : ''}`}>
                                    {Array.from({ length: 10 }, (_, idx) => {
                                        const filled = stash >= (idx + 1) * 10;
                                        const leading = filled && stash < (idx + 2) * 10;
                                        const segColor = stash >= 80 ? 'bg-white' : stash >= 50 ? 'bg-[#ff007f]' : 'bg-[#0df]';
                                        const delay = reducedMotion ? 0 : (stashDirection >= 0 ? idx * 36 : (9 - idx) * 22);
                                        return <div key={idx} className={`rounded-sm transition-[background-color,transform,opacity] duration-200 ease-out ${filled ? `${segColor} ${leading ? 'animate-pulse' : ''} scale-y-100 opacity-100` : 'bg-gray-800 scale-y-75 opacity-60'}`} style={{ transitionDelay: `${delay}ms` }}></div>;
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-4">{PROGRAMS.map(p => <button key={p.id} disabled={stash < p.cost || activeBoss?.id === 'INFORMANT'} onMouseEnter={() => showMechanicPopup(`PROGRAM_${p.id}`)} onFocus={() => showMechanicPopup(`PROGRAM_${p.id}`)} onClick={() => handleProgram(p)} title={p.desc} className="flex flex-col items-center py-2 px-1 rounded border border-gray-700 bg-gray-900/50 hover:border-[#ff007f] disabled:opacity-50 disabled:grayscale"><span className="font-mono text-xs">{p.name}</span><span className="text-[10px] text-[#0df]">{p.cost}%</span></button>)}</div>
                                <div className="mt-4 border-t border-gray-800 pt-3">
                                    <div className="font-mono text-[10px] text-emerald-300 tracking-wider mb-2">TACTICAL CONSUMABLES</div>
                                    {consumables.length === 0 ? (
                                        <div className="font-mono text-[10px] text-gray-600">No one-shots pocketed.</div>
                                    ) : (
                                        <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                                            {consumables.map((item, idx) => (
                                                <button key={item.instanceId || `${item.id}-${idx}`} onClick={() => useConsumable(idx)} disabled={rolling || phase !== 'PLAY'} className="w-full flex items-center justify-between gap-2 border border-emerald-700/60 bg-emerald-950/20 px-2 py-1 text-left hover:bg-emerald-900/30 disabled:opacity-40">
                                                    <span className="font-mono text-[10px] text-emerald-200 truncate">{item.icon || 'USE'} {item.name}</span>
                                                    <span className="font-mono text-[10px] text-emerald-400">USE</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-black/90 border-4 border-gray-900 rounded-xl p-4 flex-1 shadow-xl flex flex-col min-h-0">
                                <h3 className={`text-center border-b pb-2 font-mono text-sm ${hardwareDisabled ? 'text-blue-500 border-blue-500' : 'text-gray-500 border-gray-700'}`}>HARDWARE {hardwareDisabled && '(DISABLED)'}</h3>
                                <div className="flex-1 overflow-y-auto mt-2 flex flex-col gap-2">{inventory.length === 0 ? <div className="text-center text-xs opacity-30 mt-4 font-mono">NO HARDWARE</div> : inventory.map(item => {
                                    const syn = synergyLabelForItem(item.id, buildAnalysis.primaryBuild);
                                    return (
                                        <div key={item.id} className={`group p-2 border border-gray-800 bg-gray-900/50 rounded ${hardwareDisabled ? 'opacity-30 grayscale' : ''}`}>
                                            <div className="text-sm font-bold text-white leading-none">{item.name}</div>
                                            <div className="text-[10px] opacity-70 leading-tight font-mono">{item.desc}</div>
                                            <RiskBadges item={item} />
                                            {syn && <div className="max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 group-hover:mt-1 transition-all text-[9px] font-mono text-cyan-300/90 leading-snug">{syn}</div>}
                                        </div>
                                    );
                                })}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'GAMBLE' && (
                <div className="h-full flex items-center justify-center p-4 z-[320] relative overflow-hidden">
                    <div className="gamble-backdrop" aria-hidden></div>
                    <div className="w-full max-w-2xl border-4 border-[#ff007f] bg-[#111] rounded-xl p-6 md:p-8 shadow-2xl relative z-10 max-h-[92vh] overflow-y-auto">
                        <div className="font-mono text-[10px] tracking-[.35em] text-[#0df] mb-2 text-center">SIDE ACTION</div>
                        <h2 className="font-marker text-4xl text-center text-[#ff007f] italic mb-3">DOUBLE OR NOTHING</h2>
                        <p className="font-mono text-xs text-gray-400 text-center mb-2">
                            Base stake from cash: <b className="text-yellow-300">${GutterbonesGamble.baseStake(gold)}</b>
                            {' '}(22% rate, min ${GAMBLE_TUNING.minStake}, cap ${GAMBLE_TUNING.stakeCap})
                        </p>
                        {flowStreak > 0 && (
                            <p className="font-mono text-[11px] text-[#0df] text-center mb-2">
                                Flow streak +{GutterbonesGamble.formatWinPercent(GutterbonesGamble.flowWinBonus(flowStreak))} win odds on every tier.
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => resolveGamble(false)}
                            aria-label={`Take safe cut, keep all ${gold} dollars, enter shop`}
                            className="w-full py-3 px-2 min-h-[44px] mb-4 border-2 border-gray-600 bg-black/50 text-gray-200 font-mono hover:border-[#0df] text-left"
                        >
                            <div className="font-bold">TAKE SAFE CUT</div>
                            <div className="text-[11px] text-gray-400 mt-1">Keep all ${gold}. Enter shop — no flip.</div>
                        </button>
                        <div className="font-mono text-[10px] tracking-[.2em] text-gray-500 text-center mb-2">PICK YOUR FLIP</div>
                        <div className="grid sm:grid-cols-3 gap-2">
                            {GutterbonesGamble.allTiers().map((tier) => {
                                const tierStake = GutterbonesGamble.stakeForTier(gold, tier.id);
                                const pWin = GutterbonesGamble.winProbability(tier.id, flowStreak);
                                const winPay = Math.max(1, Math.round(tierStake * tier.winMult));
                                const lossPay = Math.max(1, Math.round(tierStake * tier.lossMult));
                                return (
                                    <button
                                        key={tier.id}
                                        type="button"
                                        onClick={() => resolveGamble(true, tier.id)}
                                        aria-label={`${tier.name}, ${GutterbonesGamble.formatWinPercent(pWin)} win chance, plus ${winPay} or minus ${lossPay}`}
                                        className="py-3 px-2 min-h-[44px] border-2 border-[#ff007f]/70 bg-[#2a0017] text-[#ff9fcf] font-mono hover:bg-[#3b0120] text-left"
                                    >
                                        <div className="font-bold text-sm">{tier.name.toUpperCase()}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{tier.blurb}</div>
                                        <div className="text-[11px] mt-2 text-yellow-200">Stake ${tierStake}</div>
                                        <div className="text-[11px] text-emerald-300/90">{GutterbonesGamble.formatWinPercent(pWin)} → +${winPay}</div>
                                        <div className="text-[11px] text-red-300/90">Miss → −${lossPay}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {phase === 'SHOP' && (
                <div className="h-full flex items-center justify-center p-3 md:p-12 z-[300] relative overflow-y-auto overflow-x-hidden">
                    <div className="shop-counting-cash-backdrop" aria-hidden></div>
                    <div className="w-full max-w-6xl flex flex-col md:flex-row gap-4 md:gap-8 min-h-full py-8 md:py-0 relative z-10">
                        <div className="flex-1 bg-[#1a1a1a] border-4 border-gray-900 rounded-xl p-4 md:p-8 flex flex-col shadow-2xl">
                            <div className="flex justify-between items-end mb-6 border-b-2 border-gray-800 pb-4"><h2 className="text-4xl md:text-5xl font-marker italic text-[#c78b16] animate-[flicker_4s_infinite]">THE BACK ALLEY</h2><div className="text-right"><div className="text-xs uppercase opacity-50">Dirty Cash</div><div className={`text-3xl text-green-400 font-mono font-bold ${cashDropFlash ? 'hud-cash-drop' : ''}`}>${displayGold}</div></div></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">{shopItems.map(item => {
                                const isConsumable = item.type === 'consumable';
                                const isFace = !!item.type && !isConsumable;
                                const sold = soldItems.includes(item.id);
                                const primaryBuild = buildAnalysis.primaryBuild;
                                const fits = itemFitsCurrentBuild(item.id, primaryBuild);
                                const syn = synergyLabelForItem(item.id, primaryBuild);
                                return <div key={item.id} className={`bg-black/80 p-4 border-2 border-gray-700 rounded flex flex-col justify-between hover:border-[#ff007f] transition-all group relative ${rarityClass(item.rarity)} ${sold ? 'sold-collapse pointer-events-none' : ''} ${fits && !sold ? 'ring-1 ring-cyan-400/20 shadow-[0_0_14px_rgba(0,221,255,0.07)]' : ''}`}>
                                    <div className="price-tag">${item.cost}</div>
                                    {fits && !sold && <span className="absolute top-2 right-12 z-10 text-[8px] font-mono tracking-[0.2em] text-cyan-200/90 border border-cyan-500/35 px-1 py-0.5 rounded bg-black/60">GOOD FIT</span>}
                                    {sold && <div className="absolute inset-0 flex items-center justify-center"><span className="paid-stamp text-2xl border-[3px] px-2">SOLD</span></div>}
                                    <div className="flex items-start gap-4 mb-3">{isFace ? <div className={`w-12 h-12 flex items-center justify-center rounded border ${item.style} shrink-0`}><span className="text-2xl font-marker">{item.label.charAt(0)}</span></div> : isConsumable ? <div className="w-12 h-12 flex items-center justify-center rounded border border-emerald-500 bg-emerald-950/40 text-emerald-300 shrink-0"><span className="text-sm font-mono font-bold">{item.icon || 'USE'}</span></div> : <div className="w-12 h-12 flex items-center justify-center rounded border border-gray-500 bg-gray-800 text-gray-400 shrink-0"><span className="text-sm font-mono font-bold">MOD</span></div>}<div className="min-w-0"><div className="font-bold text-lg leading-tight text-white">{isFace ? item.label : item.name}</div><div className="text-[10px] opacity-70 mt-1 font-mono">{isFace ? `${item.type} CONTRABAND` : isConsumable ? `ONE-SHOT: ${item.desc}` : item.desc}</div><RiskBadges item={item} />{syn && <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-cyan-300/90 mt-1 leading-snug">{syn}</div>}</div></div>
                                    <button onClick={() => handlePurchase(item)} disabled={sold} className="w-full py-2 bg-[#c78b16] text-black font-bold rounded shadow-[0_4px_0_#5c4305] active:translate-y-1 active:shadow-none group-hover:bg-yellow-500 flex justify-between px-4 disabled:opacity-50"><span>{gold >= item.cost ? 'BUY' : 'LOAN'}</span><span className="font-mono">${item.cost}</span></button>
                                </div>;
                            })}</div>
                        </div>
                        <div className="w-full md:w-1/3 bg-[#1a1a1a] border-4 border-gray-900 p-5 rounded-xl shadow-2xl flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b border-red-900 pb-2"><h3 className="text-red-600 font-mono text-xl">NEXT JOB</h3><div className="font-mono text-sm opacity-50">ROUND {round}</div></div>
                            <div className="mb-3 text-[10px] font-mono text-gray-400 border border-gray-800 rounded px-2 py-1 bg-black/30">{fixerLine}</div>
                            <div className="mb-4 border border-gray-800 rounded p-3 bg-black/40">
                                <div className="font-mono text-xs tracking-wider text-[#0df] mb-2">SHOP OPTIONS</div>
                                <button onClick={refreshShop} disabled={gold < shopRefreshCost} className="w-full py-2 px-3 border border-[#0df] text-[#0df] font-mono text-xs flex justify-between items-center bg-black/30 hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <span>REFRESH STOCK</span>
                                    <span>${shopRefreshCost}</span>
                                </button>
                                <div className="mt-3 text-[10px] font-mono text-gray-500">Refreshes used this stop: {shopRefreshes}</div>
                                <div className="mt-3 border-t border-gray-800 pt-3">
                                    <div className="font-mono text-[10px] text-gray-400 mb-2">FENCE HARDWARE</div>
                                    {inventory.length === 0 ? (
                                        <div className="font-mono text-[10px] text-gray-600">No hardware to fence.</div>
                                    ) : (
                                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                            {inventory.map(item => (
                                                <div key={item.id} className="flex items-center justify-between gap-2 border border-gray-800 rounded px-2 py-1 bg-black/30">
                                                    <span className="font-mono text-[10px] text-gray-200 truncate">{item.name}</span>
                                                    <button onClick={() => sellInventoryItem(item)} className="shrink-0 border border-green-700 text-green-400 px-2 py-1 font-mono text-[10px] hover:bg-green-900/30">
                                                        SELL ${getHardwareSellValue(item)}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 border-t border-gray-800 pt-3">
                                    <div className="font-mono text-[10px] text-red-300 mb-2">DEBT CONTROL</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => payDebtFromCash(10)} disabled={debt <= 0 || gold <= 0} className="py-1 px-2 border border-red-700 text-red-300 font-mono text-[10px] hover:bg-red-900/25 disabled:opacity-40 disabled:cursor-not-allowed">
                                            PAY $10 (~-{Math.min(debt, Math.floor(10 * DEBT_PAYDOWN_TUNING.reliefMultiplier))})
                                        </button>
                                        <button onClick={() => payDebtFromCash(debtClearCashNeeded)} disabled={debt <= 0 || gold <= 0} className="py-1 px-2 border border-red-500 text-red-200 font-mono text-[10px] hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed">
                                            CLEAR ${debtClearCashNeeded}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {debt > 0 && <div className="bg-red-900/30 border border-red-600 p-2 text-xs text-red-400 mb-4 debt-pulse font-mono">WARNING: Unpaid debt (${debt}). Quota will spike.</div>}
                            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">{paths.map(p => <RouteChoiceCard key={p.id} path={p} projection={projectPath(p)} onPick={handleAdvance} />)}</div>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'CARVING' && (
                <div className="h-full flex items-center justify-center z-[400] relative overflow-y-auto overflow-x-hidden p-4 md:p-8">
                    <div className="carving-mod-backdrop" aria-hidden></div>
                    <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl relative z-10">
                        <div className="w-full md:w-1/3 bg-[#e8e6e1] text-gray-900 p-6 border-4 border-black shadow-2xl">
                            <h2 className="text-4xl font-marker border-b-4 border-black mb-6 pb-2">THE MOD</h2>
                            <div className="flex items-center gap-4">{selectedItem && <div className={`w-24 h-24 rounded-xl border-4 flex flex-col items-center justify-center shadow-2xl animate-[keptBob_6s_ease-in-out_infinite] ${selectedItem.style}`}><div className="text-5xl font-marker leading-none">{selectedItem.label.charAt(0)}</div><div className="text-[10px] uppercase mt-1 tracking-widest bg-black/50 px-2 rounded font-mono text-white">{selectedItem.type}</div></div>}<div><div className="text-3xl font-bold uppercase">{selectedItem?.label}</div><div className="text-sm font-mono opacity-80 mt-2">{carvingDie === null ? 'Select a bone on the block.' : 'Select a face to overwrite.'}</div></div></div>
                            {selectedItem?.id === 'GHOST_FACE' && <div className="text-red-600 font-mono text-xs mt-4 border border-red-600 bg-red-900/20 p-2 animate-pulse">WARNING: Ghost faces reduce available scoring bones.</div>}
                        </div>
                        <div className="flex-1 bg-[#2b1414] border-[12px] border-[#111] rounded-2xl p-6 md:p-12 flex flex-col items-center justify-center relative shadow-[inset_0_0_50px_black]">
                            <div className="grid grid-cols-3 gap-4 md:gap-8 bg-black/30 p-4 md:p-8 rounded-xl border border-black/50">
                                {carvingDie === null ? dice.map((d,i) => <button key={i} onClick={() => setCarvingDie(i)} className="w-20 h-20 md:w-32 md:h-32 rounded-lg bg-[#d4cfc5] border-2 border-[#8c8880] flex flex-col items-center justify-center text-5xl font-serif text-black shadow-2xl hover:scale-105 hover:ring-4 ring-[#0df] relative"><div>{d.value}</div><div className="absolute top-2 text-xs text-gray-500 font-mono">BONE {i+1}</div></button>) : dice[carvingDie].faces.map((f, faceIdx) => <button key={faceIdx} onClick={() => executeCarve(carvingDie, faceIdx)} className="w-20 h-20 md:w-32 md:h-32 rounded-lg bg-[#d4cfc5] border-2 border-[#8c8880] flex items-center justify-center text-5xl font-serif text-black shadow-2xl hover:scale-105 hover:ring-4 ring-[#0df] relative">{f.id && f.type !== 'standard' ? <div className={`absolute inset-1 rounded flex flex-col items-center justify-center border ${f.style}`}><div className="font-serif text-4xl leading-none">{f.label.charAt(0)}</div></div> : <div>{f.value}</div>}</button>)}
                            </div>
                            {carveSparks.map(s => <div key={s.id} className="carve-spark" style={{ left: s.x, top: s.y, '--sx': s.sx, '--sy': s.sy }}></div>)}
                            {carvingDie !== null && <button onClick={() => setCarvingDie(null)} className="absolute bottom-4 font-mono text-white underline text-sm">BACK TO BONES</button>}
                        </div>
                    </div>
                </div>
            )}

            {phase === 'RAP_SHEET' && (
                <div className="h-full flex items-center justify-center z-[500] relative overflow-y-auto overflow-x-hidden p-4">
                    <div className="rap-busted-backdrop" aria-hidden></div>
                    <div className="paper-card bg-[#E2D1B8] w-full max-w-2xl p-6 md:p-8 text-black shadow-[10px_20px_30px_black] border-l-[16px] border-[#c4b59d] relative z-20" style={{ animation: 'stampSlam .4s cubic-bezier(.25,1,.5,1) forwards', '--paper-rot': '-1deg' }}>
                        <div className="border-b-2 border-black pb-3 mb-6 flex justify-between items-end"><div className="font-serif font-bold text-xl uppercase tracking-widest">N.Y.P.D. Arrest Record</div><div className="font-mono text-red-600 border border-red-600 px-2 font-bold min-w-[120px] text-center">{typedCase}</div></div>
                        <div className="grid md:grid-cols-3 gap-6 mb-6"><div className="h-40 bg-gray-300 border-2 border-gray-400 p-2 shadow-inner flex items-center justify-center"><PersonaPortrait persona={persona} variant="rap" /></div><div className="md:col-span-2 font-mono text-lg flex flex-col gap-2"><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Apprehended:</span><b>Round {round}</b></div><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Arresting Unit:</span><b className="text-red-600">{runStats.finalBoss}</b></div><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Total Heat:</span><b>{runStats.totalHeat}</b></div><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Largest Hustle:</span><b>{runStats.biggestHustle}</b></div><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Dirty Cash:</span><b className="text-green-800">${gold}</b></div><div className="flex justify-between border-b border-gray-400 border-dashed"><span>Laundered:</span><b className="text-green-800">+${lastLaundered}</b></div></div></div>
                        <div className="border border-black p-4 bg-white/50 mb-4"><div className="font-mono text-xs opacity-70 mb-2">Hand History:</div><HistoryPanel history={history} /></div>
                        <RunBuildFootprint runBuild={{ ...DEFAULT_RUN_BUILD, ...(runStats.build || {}) }} />
                        {showIncarceratedStamp && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-[6px] border-[#d30000] text-[#d30000] font-marker p-4 text-6xl rotate-[-15deg] bg-white/80 shadow-md pointer-events-none animate-[stampSlam_.25s_cubic-bezier(.25,1,.5,1)_forwards]">INCARCERATED</div>}
                        <button onClick={() => { setBustActive(false); setPhase('LINEUP'); }} className="px-8 py-3 bg-white text-black font-bold font-mono border-2 border-black hover:bg-red-600 hover:text-white transition-colors w-full">PLAY AGAIN</button>
                    </div>
                </div>
            )}

            {phase === 'VICTORY' && (
                <div className="h-full flex items-center justify-center z-[500] relative overflow-hidden p-4">
                    <div className="victory-escape-backdrop" aria-hidden></div>
                    <CashRain count={30} reducedMotion={reducedMotion} />
                    <div className="paper-card bg-[#e8e6e1] p-4 pb-14 shadow-[10px_15px_25px_black] relative z-20 w-full max-w-md rotate-3" style={{ '--paper-rot': '3deg' }}>
                        <div className="bg-[#111] h-[300px] shadow-[inset_0_0_20px_black] overflow-hidden relative flex flex-col items-center"><div className="w-full h-full bg-gradient-to-b from-[#ff007f] to-[#0a001a] border-4 border-white flex flex-col items-center relative overflow-hidden"><div className="absolute top-8 w-24 h-24 bg-gradient-to-b from-yellow-300 to-orange-500 rounded-full shadow-[0_0_30px_orange] sunrise"></div><div className="absolute top-1/2 w-full text-center font-mono text-2xl bg-white text-black py-2 mt-4 -rotate-12 border-y-4 border-dashed border-gray-400 font-bold animate-[stampSlam_.3s_cubic-bezier(.25,1,.5,1)_forwards]">GREYHOUND - ONE WAY</div></div></div>
                        <div className="text-center mt-6"><div className="font-marker text-4xl text-black rotate-2">See ya, Lou.</div><svg viewBox="0 0 220 70" className="mx-auto mt-1 w-44"><path className="signature-path" d="M10 44 C40 8, 55 64, 88 32 C115 8, 120 58, 155 30 C170 18, 186 26, 208 18" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round"/></svg><div className="font-mono text-sm text-gray-500 mt-2 text-left px-4">Heat Evaded: {runStats.totalHeat}<br/>Run Cash: ${gold}<br/>Safehouse Cut: +${lastLaundered}</div></div>
                        <RunBuildFootprint runBuild={{ ...DEFAULT_RUN_BUILD, ...(runStats.build || {}) }} />
                        <button onClick={() => setPhase('LINEUP')} className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 bg-white text-black font-bold font-mono border-2 border-black hover:bg-green-600 hover:text-white transition-colors whitespace-nowrap">START NEW RUN</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
