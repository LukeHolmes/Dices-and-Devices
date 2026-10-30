/**
 * Gutterbones procedural audio (Web Audio API). No external samples required.
 * Loaded before the React app; exposed as window.GutterbonesAudio.
 */
(function gutterbonesAudioModule(global) {
    const DEFAULT_VOLUME = 0.82;
    const MAX_VOICES = 16;
    const CATEGORY_GAIN = Object.freeze({
        master: 1,
        ui: 0.72,
        dice: 1,
        score: 0.88,
        hud: 0.75,
        ambient: 0.55,
    });

    let ctx = null;
    let master = null;
    let ambientNodes = null;
    let volume = DEFAULT_VOLUME;
    let muted = false;
    let activeVoices = 0;

    const ensureContext = () => {
        if (ctx && ctx.state !== "closed") return true;
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        applyMasterGain();
        return true;
    };

    const applyMasterGain = () => {
        if (!master) return;
        master.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
    };

    const resumeIfNeeded = () => {
        if (!ctx || ctx.state !== "suspended") return Promise.resolve();
        return ctx.resume().catch(() => {});
    };

    const jitterFreq = (freq) => freq * (1 + (Math.random() * 0.08 - 0.04));

    const withVoice = (fn) => {
        if (!ensureContext() || muted) return false;
        if (activeVoices >= MAX_VOICES) return false;
        activeVoices += 1;
        resumeIfNeeded();
        try {
            fn();
        } finally {
            global.setTimeout(() => {
                activeVoices = Math.max(0, activeVoices - 1);
            }, 120);
        }
        return true;
    };

    const catGain = (category) => (CATEGORY_GAIN[category] ?? 1) * (muted ? 0 : volume);

    const scheduleTone = (freq, type, duration, peakGain, when = 0, category = "ui") => {
        if (!ensureContext() || muted) return;
        const t = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(jitterFreq(freq), t);
        const amp = peakGain * catGain(category);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + duration + 0.03);
    };

    const noiseBurst = (duration, peakGain, when = 0, category = "dice") => {
        if (!ensureContext() || muted) return;
        const t = ctx.currentTime + when;
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i += 1) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 900 + Math.random() * 2200;
        filter.Q.value = 0.7;
        const g = ctx.createGain();
        const amp = peakGain * catGain(category);
        g.gain.setValueAtTime(amp, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t);
        src.stop(t + duration + 0.02);
    };

    const GutterbonesAudio = {
        init() {
            if (!ensureContext()) return;
            resumeIfNeeded();
        },

        setVolume(next) {
            if (typeof next !== "number" || Number.isNaN(next)) return;
            volume = Math.max(0, Math.min(1, next));
            applyMasterGain();
        },

        getVolume() {
            return volume;
        },

        setMuted(next) {
            muted = !!next;
            applyMasterGain();
            if (muted) GutterbonesAudio.stopAmbient();
        },

        isMuted() {
            return muted;
        },

        loadSettings(raw) {
            if (!raw || typeof raw !== "object") return;
            if (typeof raw.audioVolume === "number" && !Number.isNaN(raw.audioVolume)) {
                volume = Math.max(0, Math.min(1, raw.audioVolume));
            }
            if (typeof raw.audioMuted === "boolean") muted = raw.audioMuted;
            applyMasterGain();
        },

        getSettings() {
            return { audioVolume: volume, audioMuted: muted };
        },

        playTone(freq, type = "sine", duration = 0.1, peakGain = 0.09) {
            withVoice(() => scheduleTone(freq, type, duration, peakGain, 0, "ui"));
        },

        playNoiseBurst(duration = 0.1, peakGain = 0.07) {
            withVoice(() => noiseBurst(duration, peakGain, 0, "dice"));
        },

        uiClick() {
            withVoice(() => {
                scheduleTone(520, "sine", 0.045, 0.05, 0, "ui");
                scheduleTone(780, "triangle", 0.035, 0.028, 0.018, "ui");
            });
        },

        holdTick() {
            withVoice(() => scheduleTone(jitterFreq(920), "sine", 0.055, 0.06, 0, "ui"));
        },

        holdRelease() {
            withVoice(() => scheduleTone(jitterFreq(640), "sine", 0.04, 0.04, 0, "ui"));
        },

        clatter() {
            withVoice(() => {
                for (let i = 0; i < 6; i += 1) {
                    noiseBurst(0.035 + Math.random() * 0.04, 0.045 + Math.random() * 0.03, i * 0.028, "dice");
                    scheduleTone(120 + Math.random() * 80, "triangle", 0.05, 0.04, i * 0.028, "dice");
                }
            });
        },

        dieThud(landIndex = 0) {
            withVoice(() => {
                const pitch = 68 + landIndex * 14 + Math.random() * 8;
                noiseBurst(0.028, 0.055, 0, "dice");
                scheduleTone(pitch, "triangle", 0.07, 0.075, 0, "dice");
                scheduleTone(pitch * 1.6, "sine", 0.04, 0.032, 0.018, "dice");
            });
        },

        scoreTick(stepIndex = 0) {
            withVoice(() => {
                scheduleTone(280 + stepIndex * 55, "triangle", 0.05, 0.045, 0, "score");
            });
        },

        stampThunk() {
            withVoice(() => {
                noiseBurst(0.06, 0.08, 0, "score");
                scheduleTone(95, "square", 0.12, 0.09, 0, "score");
            });
        },

        hudDelta() {
            withVoice(() => scheduleTone(jitterFreq(440), "sine", 0.06, 0.05, 0, "hud"));
        },

        payout() {
            withVoice(() => {
                scheduleTone(660, "sine", 0.07, 0.06, 0, "score");
                scheduleTone(990, "sine", 0.09, 0.05, 0.05, "score");
            });
        },

        retrigger() {
            GutterbonesAudio.payout();
        },

        chainStep(index = 0, tag = "") {
            withVoice(() => {
                const bump = tag === "blood_ripple" ? 40 : tag === "ghost_echo" ? 20 : 0;
                scheduleTone(320 + index * 48 + bump, "triangle", 0.055, 0.045, index * 0.035, "score");
                scheduleTone(480 + index * 52 + bump, "square", 0.04, 0.032, index * 0.035 + 0.04, "score");
            });
        },

        categoryStinger(catId) {
            const seq = {
                Y: [
                    [392, "square", 0.07, 0.06],
                    [784, "sine", 0.12, 0.07],
                    [1175, "triangle", 0.16, 0.08],
                ],
                LS: [
                    [440, "triangle", 0.08, 0.055],
                    [880, "sine", 0.14, 0.075],
                ],
                FH: [
                    [370, "sawtooth", 0.06, 0.05],
                    [740, "square", 0.1, 0.065],
                    [988, "sine", 0.12, 0.07],
                ],
            }[catId];
            if (!seq) return;
            withVoice(() => {
                let offset = 0;
                seq.forEach(([freq, type, dur, gain]) => {
                    scheduleTone(freq, type, dur, gain, offset, "score");
                    offset += dur * 0.5;
                });
            });
        },

        stinger(tier) {
            const map = {
                small: [[520, "triangle", 0.07, 0.06]],
                mid: [
                    [392, "triangle", 0.06, 0.05],
                    [784, "square", 0.1, 0.07],
                ],
                big: [
                    [330, "sawtooth", 0.05, 0.05],
                    [660, "square", 0.08, 0.07],
                    [990, "sine", 0.14, 0.08],
                ],
                max: [
                    [220, "sawtooth", 0.05, 0.05],
                    [440, "square", 0.07, 0.06],
                    [880, "sine", 0.1, 0.08],
                    [1320, "triangle", 0.18, 0.09],
                ],
            };
            const seq = map[tier] || map.mid;
            withVoice(() => {
                let offset = 0;
                seq.forEach(([freq, type, dur, gain]) => {
                    scheduleTone(freq, type, dur, gain, offset, "score");
                    offset += dur * 0.55;
                });
                if (tier === "big" || tier === "max") noiseBurst(0.08, 0.04, offset * 0.5, "score");
            });
        },

        bossSting() {
            withVoice(() => {
                scheduleTone(92, "sawtooth", 0.35, 0.08, 0, "score");
                scheduleTone(46, "square", 0.45, 0.06, 0.08, "score");
                noiseBurst(0.12, 0.05, 0.04, "score");
            });
        },

        bust() {
            withVoice(() => {
                scheduleTone(140, "sawtooth", 0.45, 0.1, 0, "score");
                scheduleTone(70, "square", 0.55, 0.08, 0.06, "score");
                noiseBurst(0.2, 0.07, 0.1, "score");
            });
        },

        paper() {
            withVoice(() => {
                noiseBurst(0.05, 0.035, 0, "ui");
                scheduleTone(1800, "sine", 0.03, 0.025, 0.02, "ui");
            });
        },

        startAmbient() {
            if (!ensureContext() || muted) return;
            resumeIfNeeded();
            GutterbonesAudio.stopAmbient();
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.setValueAtTime(55, t);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.0001, t);
            oscGain.gain.linearRampToValueAtTime(0.012 * catGain("ambient"), t + 1.2);
            const noise = ctx.createBufferSource();
            const len = ctx.sampleRate * 2;
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const ch = buf.getChannelData(0);
            for (let i = 0; i < len; i += 1) ch[i] = Math.random() * 2 - 1;
            noise.buffer = buf;
            noise.loop = true;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = "lowpass";
            noiseFilter.frequency.value = 180;
            const noiseGain = ctx.createGain();
            noiseGain.gain.value = 0.004 * catGain("ambient");
            osc.connect(oscGain);
            oscGain.connect(master);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(master);
            osc.start(t);
            noise.start(t);
            ambientNodes = { osc, noise, oscGain, noiseGain };
        },

        stopAmbient() {
            if (!ambientNodes || !ctx) return;
            const t = ctx.currentTime;
            try {
                ambientNodes.oscGain.gain.cancelScheduledValues(t);
                ambientNodes.oscGain.gain.setValueAtTime(ambientNodes.oscGain.gain.value, t);
                ambientNodes.oscGain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
                ambientNodes.noiseGain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
                ambientNodes.osc.stop(t + 0.4);
                ambientNodes.noise.stop(t + 0.4);
            } catch (_) {
                /* already stopped */
            }
            ambientNodes = null;
        },
    };

    global.GutterbonesAudio = Object.freeze(GutterbonesAudio);
})(typeof window !== "undefined" ? window : globalThis);
