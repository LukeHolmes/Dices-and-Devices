# GUTTERBONES 1977 — Art Regeneration Brief

For ChatGPT / Midjourney / image models. Regenerate the assets below in the game's locked 1970s crime-noir style. Every prompt is self-contained; the "style lock" at the top is already baked into each one where it matters.

---

## 0. STYLE LOCK (the whole game's look)

**Universe:** 1970s exploitation film posters · underground comix (Crumb, Spain Rodriguez) · giallo credits · blaxploitation one-sheets · true-crime pulp covers. Gritty New York alley, 1977.

**How to render (non-negotiable):**
- Heavy variable-width black ink outlines (hand-inked, slightly uneven, occasional dry-ink breaks).
- Shading by **cross-hatching / parallel hatching only** — NO smooth gradients.
- **Visible Ben-Day dots / halftone grain** on all mid-tones (the #1 signifier).
- Limited flat posterized palette (below), like cheap misregistered 4-color offset print.
- **Newsprint feel:** slight yellowing, ink bleed at edges, occasional print defect (streak/smudge/crease).
- Flat, lurid, sodium-lit. Characters look sleep-deprived under bad light.

**Palette (only these, plus tints/shades via halftone):**
`#121113` ink black · `#e8e6e1` manila · `#d4cfc5` bone · `#c78b16` dirty gold · `#ff007f` neon pink · `#00ddff` electric cyan · `#6e1d24` felt red · `#d30000` pure red · `#2b0808` dried blood · `#4a3520` tobacco · `#8c7a5c` nicotine tan.

**Always append as NEGATIVE:** photorealistic, smooth shading, soft gradients, clean vector art, anime, modern, digital painting, 3D render, glossy, polished, superhero, Marvel, DC, manga.

---

## 1. STORY PANELS — "THE WITNESS" ARC (HIGHEST PRIORITY)

**Why change:** all 10 files (`assets/panels/witness/*.png`) are currently **the same placeholder image** (identical 900×600 file). The whole narrative arc shows one picture. Need 10 distinct panels.

**Logline:** *You saw a killing — now everyone wants you.* Noir paranoia; the protagonist is an ordinary person turned hunted.

**Spec for all 10:** 16:9, 1600×900 PNG, full-scene establishing/beat shots in the halftone/ink style, thick rough black panel border, bottom 15–20% kept dark/clear for the caption text.

### 1.1 `prologue.png` — "Wrong alley. Wrong minute."
Low wide shot down a rain-slick alley at night. In the foreground, a silhouette seen from behind has just turned a corner and frozen; further down, under a single sodium lamp, a body slumped against a dumpster and a wet trash trail. Neon pink from a sign reflects in puddles. Heavy blacks, one cold light source. Dread, not gore.

### 1.2 `r2.png` — "They don't know your face yet."
The protagonist in a diner window at night, face half-turned away / reflected in fogged glass so it's unreadable. Outside, two men in trench coats pass under a streetlamp, backs to the window. Warm diner light vs cold street. Paranoia: they haven't noticed — yet.

### 1.3 `r3.png` — "The headline was a question, not a fact."
Close-up of a rumpled newspaper on a counter, headline hand-lettered ("ALLEY KILLING: WHO WAS THERE?"). A coffee cup, cigarette smoke curling, a thumb pinning the page. Type replaced with hand-lettered 70s style. Newsprint halftone is the texture itself.

### 1.4 `r4.png` — "Two people looking for you. Different reasons."
Split mood, not split screen: one frame, two figures. Left, a plainclothes cop reading a notepad under a streetlamp; right, a second figure half in shadow with a phone receiver. Both angled toward the viewer but not at each other. Cold blue on the cop, dirty gold on the shadowed one.

### 1.5 `r5.png` — "Every car could be the one."
Wide shot: the protagonist walking fast along a curb at night, head down, collar up. A long 70s sedan crawls alongside, headlights cutting the dark, interior unreadable. Perspective lines converge down the block. Felt-red taillight glow and cyan moonlight. Tense, claustrophobic.

### 1.6 `r6.png` — "Now you have a price."
A "WANTED"-style poster pinned to a brick wall, the face deliberately smudged/obscured by shadow or a torn corner. A hand (in frame) has just hung it. Below the face, a dollar amount stamped in pure red. Corkboard/brick texture, halftone, ink. The number is the threat.

### 1.7 `r7.png` — "Talk and you're free. Talk and you're dead."
Tight shot of a rotary phone on a nightstand, receiver half off the hook, coiled cord. A hand hesitates above it. Venetian-blind stripes slash across the wall behind. Cyan moonlight, one hard shadow. The phone feels like a loaded gun.

### 1.8 `r8.png` — "New face. Same trouble."
The protagonist at a mirror, a different hat and coat, a razor and a bus ticket on the sink. Reflection is a stranger — hollow-eyed, stubble, changed but recognizable to us. Single bare bulb, sodium yellow. Weariness, not relief.

### 1.9 `bust.png` — "They found you first."
Dynamic wide shot: a door kicked in, splinters mid-air, flashlight beams cutting through haze. Silhouettes of two cops with drawn guns framing the doorway, red-blue light washing in from a window. The protagonist's raised hands just entering frame bottom. Motion lines, high contrast.

### 1.10 `victory.png` — "Somebody else's problem now."
The only warm, hopeful image: dawn. A lone figure with a duffel bag walks toward a waiting Greyhound-style bus in an empty lot, city skyline receding behind. Gold-and-pink sky, long shadow. Seen from behind, small in frame. Relief.

---

## 2. DICE (actively used — regenerate)

**Why change:** `assets/dice/die-1..6.png`, `die-blank.png`, `die-held.png` are the only dice art and are small (226×252) with a dated look. The art plan calls for **"dirty ivory" bone dice** — hand-made, grimy, not glossy plastic.

**Spec:** square-ish PNG, ~512×512, transparent background. Bone die, rounded corners, hand-painted **black** pips (not drilled dots), slightly uneven/imperfect. Ivory surface: `#d4cfc5`/`#e8e6e1` with nicotine-tan grime in the crevices, faint ink outline, subtle halftone shading. No modern plastic sheen.

- `die-1` … `die-6` — one through six pips, classic opposing-face layout, pips slightly off-center/hand-stamped.
- `die-blank` — no pips (carve slot), same bone.
- `die-held` — same die with a faint red `#d30000` "HELD" stamp or corner bracket inked on it.

---

## 3. CHARACTER PORTRAITS — legacy fallbacks (regenerate to match)

**Why change:** `assets/personas/*.png` and `assets/bosses/*.png` are **720×480 landscape** (spec is 3:4 portrait) and several are **duplicated placeholders** (hustler=card-counter, enforcer=bouncer, crooked-cop=informant share bytes). The new WebP portraits (600×800) are the real art and override these at runtime — but these PNGs remain as fallback and must not show a wrong/duplicate face.

**Spec:** 3:4 portrait, 900×1200 PNG, head-and-shoulders filling 70–85% of frame, flat ink-black `#121113` background (or one suggestive element), thick rough 10px panel border, halftone + ink + crosshatch, character's dominant palette, hard/guarded/manic expression.

Personas: **Street Rat** (gray/olive, feral), **Hustler** (dirty gold, slick half-smirk), **Enforcer** (deep red, dead flat stare), **Counter** (navy/cyan, unhinged precision), **Grinder** (orange/brown, worn workhorse — do NOT reuse the Hustler face).
Bosses: **Bouncer** (gray monolith), **Loan Shark** (red/gold, too-wide smile), **Junkie** (neon pink, manic), **Crooked Cop** (blue, mirrored aviators), **Informant** (dirty yellow, trench coat + shadowed hat), **The Raid** (NOT a person — converging cops / kicked door / "300%" stamped red).

*(Full per-character prose specs + prompt seeds already exist in `docs/art-direction.md` §3–§4 — copy those seeds and paste the Style Lock from §0.)*

---

## 4. REVIEW-ONLY CANDIDATES (flagged as not-good — redo)

**Why change:** the Batch 5.2 handoff marks these "not production-approved" / "review-only". Redo them cleanly.

- **Brass Knuckles** (`assets/art/batch-5-2/hardware/brass-knuckles.webp`, 128×128 + @2x): flat icon, brass `#c78b16`, recognizable silhouette at 40/64/80px, heavy ink outline, transparent margin, no transparent-edge artefacts. Not glossy metal — worn, stamped brass.
- **Ashtray** (`assets/art/batch-5-2/ambient/cigarette-ashtray.webp`): a 70s glass/ceramic ashtray, lower-left tabletop prop, ONE smoke plume (either painted static OR live sprite — never two), transparent background, halftone shading.
- **HUD edge pieces** (9 files under `assets/art/batch-5-2/hud/` + `atlas/`): redo as cleanly-clipped RGBA pieces matching the paper/brass/ink wireframe — do not stretch rivets, slots, circular holes, or ink borders (no nine-slice stretching of painted details).

---

## 5. FAVICON / OG CARD (misc)

**Why change:** `favicon.ico` and `gutterbones-card.png` are **the same image** (identical 480×615, odd aspect). They serve different jobs and should differ.

- `favicon.ico`: a 32×32 legible mark — a single bone die (pips visible) or a "G1977" monogram, ink black + dirty gold on manila, no fine detail that dies at 16px.
- `gutterbones-card.png` (og:image): 1200×630 wide crop — dice on red felt, smoke, the "GUTTERBONES 1977" wordmark in hand-lettered marker style, in the locked palette.

---

## 6. HOW TO RUN IT

1. Paste each asset's subject paragraph **plus the Style Lock** (and the negative list) into the generator.
2. Check against the style checklist (halftone visible on 50%+ of area, heavy ink outlines, ≤6 colors from the palette, no smooth gradients, expression hard not soft, no anachronisms).
3. Weak halftone → add "Ben-Day dots, visible halftone screen, comic-book printing".
4. Too clean/digital → add "cheap newsprint paper, slight ink bleed, print registration error".
5. Save over the exact same filename (case-sensitive) so the game picks it up with no code change.
