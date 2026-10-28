const GutterbonesStory = (() => {
    const DEFAULT_ARC_ID = 'witness';
    const HOLD_MS = Object.freeze({
        prologue: 2500,
        round: 1800,
        bust: 1200,
        victory: 2000,
        reducedMotion: 1000
    });

    const ARCS = Object.freeze({
        setup: Object.freeze({
            id: 'setup',
            title: 'The Setup',
            logline: 'Framed from above — clear the quota or take the fall.',
            captions: Object.freeze({
                prologue: '"Somebody filed your name."',
                r2: '"You\'re the only one left on the board."',
                r3: '"The tip came in at 2am."',
                r4: '"They\'ve been there since Tuesday."',
                r5: '"Evidence doesn\'t plant itself."',
                r6: '"Three copies. One for the judge."',
                r7: '"The verdict was written first."',
                r8: '"Whoever set this up left you a door."',
                bust: '"Frame complete. Case closed."',
                victory: '"The file doesn\'t exist. Neither do you."'
            })
        }),
        debt: Object.freeze({
            id: 'debt',
            title: 'Blood Debt',
            logline: 'Someone from your past is collecting — not in dollars.',
            captions: Object.freeze({
                prologue: '"They left this for you."',
                r2: '"Checked out early."',
                r3: '"Some debts don\'t have numbers."',
                r4: '"Same diner. Three nights running."',
                r5: '"They want you to know they\'re close."',
                r6: '"Wrong side of the door."',
                r7: '"End of the line."',
                r8: '"Somebody walks away. Somebody doesn\'t."',
                bust: '"Debt settled. Not in your favor."',
                victory: '"Walked away. Barely."'
            })
        }),
        inside: Object.freeze({
            id: 'inside',
            title: 'The Inside Job',
            logline: 'You\'re rigging the hustle while you run it.',
            captions: Object.freeze({
                prologue: '"Three months of planning. One night to pull it."',
                r2: '"First piece in place."',
                r3: '"Blind spots don\'t make themselves."',
                r4: '"Nobody knows the full picture. That\'s the point."',
                r5: '"He\'ll sleep through the interesting part."',
                r6: '"$40,000 just moved without a sound."',
                r7: '"When both sides pay, nobody got robbed."',
                r8: '"Last door. Last chance."',
                bust: '"The plan was perfect. You weren\'t."',
                victory: '"Nobody got hurt. Everybody got robbed."'
            })
        }),
        borough: Object.freeze({
            id: 'borough',
            title: 'Last Night in the Borough',
            logline: 'The city is burning — you\'re running for the exit.',
            captions: Object.freeze({
                prologue: '"Three fires by midnight. Nobody\'s coming to put them out."',
                r2: '"Everything\'s on sale tonight."',
                r3: '"Three blocks and it\'s someone else\'s problem."',
                r4: '"Even the cops left."',
                r5: '"The whole block is walking south."',
                r6: '"Two ways out. Both jammed."',
                r7: '"High ground doesn\'t last."',
                r8: '"The last train. Maybe."',
                bust: '"Didn\'t make it out."',
                victory: '"Crossed the river. Left the fire behind."'
            })
        }),
        witness: Object.freeze({
            id: 'witness',
            title: 'The Witness',
            logline: 'You saw a killing — now everyone wants you.',
            captions: Object.freeze({
                prologue: '"Wrong alley. Wrong minute."',
                r2: '"They don\'t know your face yet."',
                r3: '"The headline was a question, not a fact."',
                r4: '"Two people looking for you. Different reasons."',
                r5: '"Every car could be the one."',
                r6: '"Now you have a price."',
                r7: '"Talk and you\'re free. Talk and you\'re dead."',
                r8: '"New face. Same trouble."',
                bust: '"They found you first."',
                victory: '"Somebody else\'s problem now."'
            })
        })
    });

    const ARC_IDS = Object.freeze(Object.keys(ARCS));

    const panelFile = (arcId, key) => `assets/panels/${arcId}/${key === 'prologue' ? 'prologue' : key}.png`;

    const getArc = (arcId) => ARCS[arcId] || ARCS[DEFAULT_ARC_ID];

    const beat = (arcId, key, kind) => {
        const arc = getArc(arcId);
        const caption = arc.captions[key];
        if (!caption) return null;
        const holdKey = kind === 'prologue' ? 'prologue' : kind === 'bust' ? 'bust' : kind === 'victory' ? 'victory' : 'round';
        return {
            src: panelFile(arc.id, key),
            caption,
            holdMs: HOLD_MS[holdKey],
            arcId: arc.id,
            arcTitle: arc.title
        };
    };

    const pickRandomArcId = (random = Math.random()) => {
        const r = Math.max(0, Math.min(0.999999, Number(random) || 0));
        return ARC_IDS[Math.floor(r * ARC_IDS.length)] || DEFAULT_ARC_ID;
    };

    const getProloguePanel = (arcId = DEFAULT_ARC_ID) => beat(arcId, 'prologue', 'prologue');

    const getRoundTransitionPanel = (arcId, roundNumber) => {
        const r = Math.floor(Number(roundNumber) || 0);
        if (r < 2 || r > 8) return null;
        return beat(arcId, `r${r}`, 'round');
    };

    const getBustPanel = (arcId = DEFAULT_ARC_ID) => beat(arcId, 'bust', 'bust');

    const getVictoryPanel = (arcId = DEFAULT_ARC_ID) => beat(arcId, 'victory', 'victory');

    const getReducedMotionHold = () => HOLD_MS.reducedMotion;

    return Object.freeze({
        DEFAULT_ARC_ID,
        ARC_IDS,
        ARCS,
        HOLD_MS,
        getArc,
        pickRandomArcId,
        getProloguePanel,
        getRoundTransitionPanel,
        getBustPanel,
        getVictoryPanel,
        getReducedMotionHold,
        panelFile
    });
})();

export default GutterbonesStory;
export { GutterbonesStory };
