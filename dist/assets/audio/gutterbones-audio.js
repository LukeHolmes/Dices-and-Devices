/**
 * Gutterbones procedural audio (Web Audio API). No external samples required.
 * Loaded before the React app; exposed as window.GutterbonesAudio.
 */
(function gutterbonesAudioModule(global) {
    const DEFAULT_VOLUME = 0.82;

    let ctx = null;
    let master = null;
    let ambientNodes = null;
    let volume = DEFAULT_VOLUME;
    let muted = false;

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

    const scheduleTone = (freq, type, duration, peakGain, when = 0) => {
        if (!ensureContext() || muted) return;
        resumeIfNeeded();
        const t = ctx.currentTime + when;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        const amp = peakGain * (muted ? 0 : volume);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + duration + 0.03);
    };

    const noiseBurst = (duration, peakGain, when = 0) => {
        if (!ensureContext() || muted) return;
        resumeIfNeeded();
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
        const amp = peakGain * (muted ? 0 : volume);
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
            scheduleTone(freq, type, duration, peakGain, 0);
        },

        playNoiseBurst(duration = 0.1, peakGain = 0.07) {
            noiseBurst(duration, peakGain, 0);
        },

        clatter() {
            if (!ensureContext() || muted) return;
            resumeIfNeeded();
            for (let i = 0; i < 6; i += 1) {
                noiseBurst(0.035 + Math.random() * 0.04, 0.045 + Math.random() * 0.03, i * 0.028);
                scheduleTone(120 + Math.random() * 80, "triangle", 0.05, 0.04, i * 0.028);
            }
        },

        payout() {
            scheduleTone(660, "sine", 0.07, 0.06);
            scheduleTone(990, "sine", 0.09, 0.05, 0.05);
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
            let offset = 0;
            seq.forEach(([freq, type, dur, gain]) => {
                scheduleTone(freq, type, dur, gain, offset);
                offset += dur * 0.55;
            });
            if (tier === "big" || tier === "max") noiseBurst(0.08, 0.04, offset * 0.5);
        },

        bossSting() {
            scheduleTone(92, "sawtooth", 0.35, 0.08);
            scheduleTone(46, "square", 0.45, 0.06, 0.08);
            noiseBurst(0.12, 0.05, 0.04);
        },

        bust() {
            scheduleTone(140, "sawtooth", 0.45, 0.1);
            scheduleTone(70, "square", 0.55, 0.08, 0.06);
            noiseBurst(0.2, 0.07, 0.1);
        },

        paper() {
            noiseBurst(0.05, 0.035);
            scheduleTone(1800, "sine", 0.03, 0.025, 0.02);
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
            oscGain.gain.linearRampToValueAtTime(0.012 * volume, t + 1.2);
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
            noiseGain.gain.value = 0.004 * volume;
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
