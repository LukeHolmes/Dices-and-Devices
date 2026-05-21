# Gutterbones 1977 — Vibe & Animation Polish Plan

## 1. Diagnosis: what the game already does well

The current build has a real identity. It does not need to be redirected, just deepened. Things that are already working:

- **Color story**: felt red `#6e1d24`, manila `#e8e6e1`, dirty gold `#c78b16`, hot pink `#ff007f`, cyan `#00ddff`, bone `#d4cfc5`, ink `#121113`. This is a strong palette — a smoky bar lit by a buzzing neon sign over a dirty card table.
- **Type stack**: Impact for shout-y headlines, Courier for the bureaucratic / case-file layer, Georgia for the body. The contrast between "screaming neon" and "carbon-copy paperwork" is the whole vibe.
- **Anchor objects**: rap sheet, manila cards, bone dice, mugshot bust card, Greyhound ticket, "Lou the Snake" the fixer. Each is a tiny diorama. We should treat them as such.
- **Existing motion vocabulary**: `violentRoll`, `flicker`, `stampSlam`, `cashFall`, `flyScore`, `bossIntro`. Functional, but each one is doing the absolute minimum.

## 2. Diagnosis: where it feels thin

Concrete things that read as "unpolished" today:

1. **Static between beats.** Outside of a roll or a payout, nothing in the frame moves. The world doesn't breathe. Noir lives on subtle ambient motion (smoke, flicker, rain, hum).
2. **Hard cuts between phases.** LINEUP → PLAY → SHOP → CARVING → RAP_SHEET all snap. There's no transition language.
3. **The roll is one beat, not a sequence.** Bones currently just do one CSS keyframe and land. Real dice have anticipation, a throw, a tumble, a settle, and a verdict.
4. **Score feedback is one yellow number.** Triggers fire silently. A `+200` from a `Y` (Jackpot) should feel different from `+12` on Aces.
5. **Cash rain is plain green rectangles** with no rotation variance, no shadow, no parallax, no light catch.
6. **Bust = a red flash overlay.** A bust should feel like getting hauled out of an alley. It deserves a real cinematic moment.
7. **The bosses arrive politely.** `bossIntro` is a single scale+blur. These are supposed to be turf-war heavies. They should kick the door in.
8. **The Stash bar is a flat white fill.** It's the only meter on a screen full of meters and it has the least character.
9. **The Alleyway felt** (the central red playfield) is just a flat color. A felt should have wear: stains, scratches, a smoke halo around the action.
10. **Manila cards don't react.** They have a static `-rotate-2` and a hover that flips to `rotate-0`. They should breathe — a tiny idle sway, a paper-thump on selection, an ink stamp on commit.
11. **No texture layer.** Film grain, paper grain, halftone dots, light leaks, scratch streaks — all the cheap stuff that sells a "1977" feel — are absent.
12. **No particle ambience.** Smoke wisps, dust, ember sparks, neon bleed — none of it.
13. **Sound is correct in spirit but sparse.** Procedural Web Audio beeps work, but there's no ambient bed (room tone, rain, a distant siren) and no payoff stinger families.

## 3. Aesthetic pillars (the constitution)

Every animation/polish decision should pass these tests. If it fails one, cut it.

1. **Grimy, not glossy.** No clean Material-style ripples, no slick easing. Movement should feel slightly off-tempo, slightly damaged. Steps, jitters, frame holds, film judder.
2. **Hand-made, not generated.** Stamped, scratched, scrawled, torn, taped. When in doubt, prefer "someone made this with a Sharpie at 2am" over "this was rendered in After Effects."
3. **Saturated under sodium light.** The world is lit by a buzzing pink/cyan sign and a yellow bulb. Highlights bloom; shadows go warm-black, not blue-black.
4. **Paperwork is sacred.** The manila / rap-sheet layer is the diegetic "real world" of the game. Effects on paper should be physical (ink, stamp, fold, tear). Effects on the felt / alley / shop should be theatrical (flicker, smoke, neon).
5. **Every meaningful action has a beat.** Anticipation → impact → settle. Three frames are usually enough.
6. **Restraint above all.** This is a noir, not a slot machine. We add nothing that drowns out the dice.

## 4. The work, grouped by surface

Each item below is intended as a small, self-contained polish increment. Implementation is CSS-first, with React state nudges where required. No new dependencies — this stays a single static HTML file.

### 4a. Ambient world layer (the "always-on" stuff)

- **Film grain overlay.** A fixed, screen-blend SVG noise layer animated by stepping `background-position` every ~120ms (3-frame loop) so it feels like projected film, not digital noise.
- **Vignette + light leak.** A radial dark vignette with a slow-pulsing warm-orange light leak in one corner (3–4s ease), like a sodium bulb buzzing somewhere off-camera.
- **Neon sign hum.** Promote the existing `flicker` keyframe into a more controlled pattern: long stable phases broken by short authentic "neon stutter" (5–7 frames at varying opacity, with one frame of color shift toward cyan). Reuse on every title (`GUTTERBONES 1977`, `THE ALLEYWAY`, `THE BACK ALLEY`).
- **Rain on glass (subtle).** Optional `::before` on the root: a slow vertical translation of a low-opacity streak pattern, masked to the corners. Off by default behind a `prefers-reduced-motion` and a setting.
- **Smoke wisps on the felt.** 2–3 absolutely-positioned blurred radial gradients that drift very slowly across the alley playfield (40–60s loops, opacity 0.04–0.08). This is the single biggest "the room is alive" win.
- **Idle dice jitter.** When not rolling and not kept, a 0.5° rotation / 1px translation cycle at random offsets, ~6s loop. Reads as the table being faintly nudged. Disabled during `rolling` and on `kept`.

### 4b. The roll (the heart of the game)

The dice are the verb. This is where the biggest artistic upgrade lives.

- **Three-act roll.**
  1. *Anticipation* (~120ms): the bones squash, drop shadow lengthens, a `bones` shake originates from the felt (CSS shake on the alley container).
  2. *Throw* (~600ms): the existing `violentRoll` becomes the middle act. Add motion-blur via a layered ghost copy at lower opacity offset by `--tx1/--ty1`.
  3. *Settle* (~250ms): a small overshoot bounce on landing (`scale(1.08) → scale(1)`), plus a tiny dust/smoke puff (one short-lived radial gradient particle per non-kept bone).
- **Per-bone variance.** Today every bone uses the same 0.8s keyframe. Vary `animation-duration` per-bone between 0.7s–1.05s and stagger `animation-delay` 0–80ms so they don't land in lockstep. Reads as real physics.
- **Sound-shape match.** The existing `clatter()` already triggers two delayed thumps. Align the timeline so the second thump fires on settle, not arbitrary.
- **Verdict glow.** When a bone lands on a special face (Blood 6, Wild, Shiv, etc.), a one-shot colored bloom matching that face's accent color pulses for ~400ms. Echoes the rarity-glow CSS but as a transient.
- **Kept "lift".** Today kept bones get `-translate-y-2` and a pink shadow. Add: a subtle continuous bob (2px, 2.4s) and a thin ink underline appearing under the slot label, like the player marked the slot in pen.

### 4c. Score feedback

- **Flying score becomes a stack.** Instead of one `+N` floating up, produce: a chip burst (chips arc out of the rolled bones toward the score counter) → the `+N` impact stamp → triggers list cascading in (`+1x MULT`, `+$2 CASH`, etc.), each delayed 80ms with its own slam-stamp. Read order is the same as the trigger list in `calculateScore`.
- **Differentiated payoff tiers.**
  - `< 30`: a single soft chime, small stamp.
  - `30–99`: the current cash chime, brighter stamp, 6-bill confetti.
  - `100–249`: triple chime ladder (already exists as `payout()`), full `CashRain` (already exists), screen punch (1-frame `scale(1.005)` on root).
  - `250+`: add a fanfare — a held bass note plus a "POW!" comic-style ink burst centered on the score readout. This is the only "comic-book" moment in the game and it's earned.
- **The score counter pulses on increase.** Number tweens (count up over ~600ms with `requestAnimationFrame`) instead of snapping. Color shifts from yellow → red briefly when near quota.
- **Triggers in the score row light up sequentially.** The existing trigger badges in `ScoreRow` should pop-in on hover (currently they're always-on if valid). Adds anticipation when scanning hands.

### 4d. Boss intros & turf-war stinger

- **Door kick.** When `BossIntro` mounts: the whole root receives a 1-frame `translate(0,2px)` shake, the screen briefly desaturates, and red bars (venetian-blind style) sweep in from top and bottom for ~250ms before the boss panel resolves.
- **Boss nameplate type-in.** Replace the static name with a typewriter type-on (per-letter, ~40ms), then a hard stop, then the description fades in.
- **Boss-specific micro-effect** (one each, additive on top of the kick):
  - LOAN_SHARK: a stack of IOU papers slides in behind the panel.
  - JUNKIE: the title text occasionally swaps a `6` for a `1` mid-flicker.
  - CROOKED_COP: a faint red-and-blue police-light wash crosses the panel once.
  - INFORMANT: the stash bar visibly freezes (ice-crackle SVG mask).
  - BOUNCER: the quota number stamp-slams from large to small.
  - THE_RAID: full screen siren-light wash, longer hold, all four others combined.
- **Persistent boss banner.** The small top banner that shows the active boss currently just sits there. Give it a low-opacity scanning highlight that sweeps left→right every ~8s as a constant reminder of the rule-change.

### 4e. Phase transitions

We don't need full page wipes, but the cuts today are jarring. Two simple primitives cover everything:

- **Paper slide.** Manila-colored panel slides up from the bottom, holds 80ms, slides off. Used on PLAY → SHOP, PLAY → CARVING, SHOP → PLAY, and any return-to-LINEUP.
- **Iris close/open.** Black radial mask shrinks to a point and reopens. Used only for PLAY → RAP_SHEET (bust) and PLAY → VICTORY. Earned cinematic punctuation.

Both are pure-CSS overlays driven by a single `transitioning` state and a small `<Transition>` component.

### 4f. Cards, paper, and the manila layer

- **Idle sway.** The persona / rap-sheet / Greyhound ticket cards currently have static `rotate-2`. Add a 0.4° idle sway (8–12s loop, prefers-reduced-motion aware). Reads as paper sitting on a table near a vent.
- **Pickup on hover.** Lift (`translateY(-4px)`), slight scale (1.02), and a real CSS box-shadow change. Currently it's just a rotate.
- **Ink stamp commits.** Anywhere we "commit" something on a paper surface — selecting a persona, scoring a category, buying a Safehouse upgrade — we slam a small ink stamp (`stampSlam` is already perfect, just needs to be reused) with rotated text like "SELECTED", "PAID", "FILED". Cheap and absolutely on-brand.
- **Crease/fold lines.** Add a single SVG noise + a faint diagonal gradient to manila surfaces to suggest a folded letter. One-time, no animation.
- **Score-row "paid" treatment.** Currently scored categories just go opacity-30 line-through. Replace with a faint red-ink "PAID" stamp at -8° using the same animation.

### 4g. The Alleyway (felt playfield)

- **Felt texture.** Replace the flat `#6e1d24` with a layered radial: a slightly darker rim, brighter center, plus a low-opacity SVG fiber texture. Adds depth without changing the color story.
- **Smoke layer.** See 4a; the smoke wisps live here primarily.
- **Felt scuffs.** Faint diagonal scratch streaks (low-opacity SVG) clustered around the dice landing area. One-time, static.
- **Edge bloom on roll.** The whole felt briefly receives a soft pink inner glow on roll initiation, decaying over ~600ms. Sells the "this is the moment" feel.

### 4h. The Stash, meters, and HUD

- **Stash bar character.** Replace the plain white fill with a segmented "thermometer" effect: 10 short bars with the leading segment pulsing. Color responds to fullness (cyan → pink → white-hot at 100%). When INFORMANT freezes it, overlay an SVG ice-crackle.
- **Cash counter.** When cash changes, count up/down (~250ms tween) instead of snapping. Negative deltas flash red briefly.
- **Pills counter.** When a pill is popped, a tiny pill icon ejects from the counter toward the affected bone (single-shot translated CSS element, 350ms). Sells the verb.
- **Debt warning.** The red debt parenthesis currently just sits there. Give it a slow 2s pulse so the player can't ignore it.

### 4i. Cash rain (the existing `CashRain`)

- **Real bills.** Three SVG bill faces (different denominations / portraits) randomized per-instance instead of identical green rectangles.
- **Parallax depth.** Three layers: large-near (full opacity, ~1.5s fall), mid (0.7 opacity, 2.5s), far (0.4 opacity, 4s + slight blur). Adds depth on cheap.
- **Catchlight.** A single subtle highlight gradient on each bill that animates as the bill rotates (using `background-position` on the rotation phase).
- **Wind drift.** Already exists via `--tx`; widen the variance and add a sinusoidal sway via an inner element with its own keyframe.

### 4j. Bust (RAP_SHEET) sequence

This is the single biggest cinematic upgrade. The bust currently is: red overlay flash → 1.6s wait → rap sheet appears with `stampSlam`. Replace with:

1. **Iris close** to black (~400ms).
2. **Siren wash** — alternating red/blue overlays for ~600ms, with one camera-flash white frame.
3. **Rap sheet slams in** (existing `stampSlam`, kept).
4. **"INCARCERATED" stamp** is currently static. Make it a separate later beat — sheet lands first, *then* after a 300ms beat the INCARCERATED stamp slams onto it from above (`stampSlam` scaled larger, rotated more).
5. **Typewriter case number.** The "CASE #77-0492" types in character by character.

### 4k. Victory (Greyhound ticket) sequence

Currently: cash rain plus a static rotated ticket. Replace with:

1. **Iris open** revealing the bus-window scene.
2. **The sun rises** — the existing yellow-orange circle animates up from the bottom of the window over ~1.2s.
3. **The bus-route stamp** (`GREYHOUND - ONE WAY`) stamps onto the ticket with `stampSlam`.
4. **Cash rain continues** through and behind everything (already exists; just layer it correctly).
5. **"See ya, Lou." handwriting reveal.** SVG path-draw the signature over ~1s using `stroke-dasharray`.

### 4l. Shop ("The Back Alley") and Carving

- **Pricetag swing.** Each shop item gets a small paper pricetag tied with string in the corner — `translateY` + slight rotate idle animation, like it's hanging.
- **Buy = stamp.** Items currently just disappear from the grid. Add: slam a "SOLD" stamp on the card, hold 200ms, then collapse the card down with a paper-fold animation.
- **Carving = sparks.** During `executeCarve`, emit 4–6 short-lived spark particles (small cyan/orange dots with rapid scale-down + translate). 300ms total. Sells "carving into bone."
- **Selected mod orbit.** In the CARVING phase, the selected face icon ("THE MOD") currently sits static. Give it a slow 6s rotation + glow pulse so the player understands it's "in hand."

### 4m. Sound design pass

We won't add audio files (stays single-file), but the existing `AudioSystem` can be enriched:

- **Ambient bed.** A very low-volume sustained `sawtooth` ~40Hz + a filtered noise node would give the room some hum. Triggered on `AudioSystem.init`, sustained while phase ≠ LINEUP/SAFEHOUSE.
- **Roll family.** Today: 3 tones. Upgrade: a filtered noise burst at impact + the existing tones, panned subtly.
- **Stinger family.** New `AudioSystem.stinger(tier)` matching the score tiers in 4c. Just chains of `playTone` with deliberate intervals.
- **Boss sting.** A short descending minor third on `BossIntro` mount.
- **Stamp sound.** A short low-pass filtered noise burst (~80ms) reused for every paper stamp commit.

### 4n. Reduced motion & performance

- All ambient loops (grain, smoke, idle sway, rain, sign flicker) gated behind `@media (prefers-reduced-motion: reduce)` → fall back to static or slower variants.
- All particle effects (chip burst, sparks, cash bills) capped by count and tied to a hard timeout cleanup. No `setInterval` left dangling.
- Everything composited from `transform` + `opacity` + `filter` where possible. No layout-thrashing animations.
- SVG textures inlined as data URIs to preserve the single-file deployment.

## 5. Suggested order of work

Each step is independently shippable and visible:

1. **Foundation pass** — film grain, vignette, light leak, smoke wisps, improved `flicker`. (Sets the room.)
2. **Dice pass** — three-act roll, per-bone variance, idle jitter, kept bob, verdict glow, edge bloom on the felt. (The verb gets richer.)
3. **Score pass** — count-up counter, tiered stingers, trigger cascade, "POW" on big scores, paid stamps on score rows. (The reward feels real.)
4. **Boss pass** — door-kick stinger, typewriter nameplate, per-boss micro-effects, scanning banner. (The threats feel real.)
5. **Bust + Victory pass** — iris transitions, siren wash, typewriter case file, sunrise + signature reveal. (The endings land.)
6. **Cards & shop pass** — manila idle sway, hover lift, pricetags, SOLD stamps, carving sparks. (The paper feels real.)
7. **HUD pass** — segmented stash bar, count-up cash, pill ejection, debt pulse, parallax cash rain. (The meters feel real.)
8. **Audio pass** — ambient bed, stamp sound, stinger families, boss sting. (The room feels real.)
9. **Accessibility & perf sweep** — reduced-motion fallbacks, timeout audits, layer counts. (It ships.)

## 6. What we are explicitly NOT doing

To keep this disciplined:

- No new dependencies. No animation libraries. No icon libraries. CSS + small inline SVG + the existing React/Babel/Tailwind/Web Audio.
- No re-theme. Palette and fonts stay exactly as they are. Every new thing draws from the existing seven colors.
- No new gameplay systems. This is a vibe/animation pass, not a balance or feature pass.
- No emoji decoration. The current 💊 (pill button) is the one pre-existing emoji and stays only because it's already there; we don't add more.
- No glossy modern motion (no Material ripples, no spring-bouncy easings, no soft glassmorphism). All easings tend toward `steps()`, `cubic-bezier(0.25,1,0.5,1)`, or hand-rolled keyframes with frame holds.
- No file split. Everything continues to live in `index.html` (mirrored to `gutterbones1977.html`) so the README's "no build step" promise holds.

## 7. Risks and how we mitigate them

- **Overload risk** — too many ambient effects on screen at once. Mitigation: every ambient effect has a hard opacity ceiling (≤ 0.12) and the sum of always-on layers is capped at four (grain + vignette + light leak + smoke).
- **Perf risk on mobile** — many simultaneous `filter`/`blur` layers tank low-end devices. Mitigation: gate `filter: blur()` ambient layers behind a single media query (`min-width: 768px`) and skip on touch devices that report `prefers-reduced-motion`.
- **Audio annoyance risk** — an ambient bed can grate. Mitigation: it's gain-staged very low (≈ 0.02) and the existing `AudioSystem.volume` already supports muting; we'll wire a UI mute toggle.
- **Animation jank during rolls** — adding ghost copies and dust puffs on top of `violentRoll` could compound. Mitigation: ghost copies use the same single keyframe instance via `animation-name`, no JS-driven per-frame work; dust puffs are one DOM node per bone, removed on `animationend`.
- **Regression risk on saved runs** — none of this touches game state, scoring, persistence, or storage keys. The schema in `STORAGE_KEYS` is untouched.

## 8. Done definition

The polish pass is done when:

- Opening the game on LINEUP, the title flickers convincingly, the room hums, and nothing yet has happened but it already feels like a place.
- Rolling once produces three distinct sensations (anticipation, throw, settle) that sync with audio.
- A 250+ score genuinely makes you grin.
- A boss arrival makes you sit up.
- A bust feels like a movie ending.
- A victory feels earned.
- Every paper surface looks like it was handled by someone with nicotine on their fingers.
- Nothing on the screen, at any moment, is completely still.

---

*This document is the plan only. No code changes have been made to the game itself in this branch. Approve the plan (or amend it) and the work in §5 can begin, one numbered pass at a time, each as its own PR.*
