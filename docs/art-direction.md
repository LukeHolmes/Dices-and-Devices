# Gutterbones 1977 — Character Art Direction

> A precise visual spec for generating grindhouse comic-style character portraits and between-round narrative panels.

---

## 1. Global Art Style Rules

Every image generated for this game must pass these tests. If it fails one, regenerate.

### Style DNA

**Reference universe:** 1970s exploitation film posters, underground comix (Crumb, Spain Rodriguez, S. Clay Wilson), giallo film credits, blaxploitation one-sheets, grindhouse double-feature interstitials, lurid true-crime pulp magazine covers.

**NOT this:** Clean Marvel/DC superhero illustration. No anime. No digital painting with soft gradients. No photorealism. No AI-slick "concept art" look. No clean vector art.

### Rendering Rules

| Parameter | Specification |
|-----------|--------------|
| **Line weight** | Heavy, variable-width black ink outlines. 3-5px equivalent at 1024px canvas. Lines should be slightly uneven — hand-inked, not vector-perfect. Occasional line breaks where ink ran dry. |
| **Shading** | Cross-hatching and parallel hatching only. No smooth gradient shading. Deep shadows rendered as dense ink pools or solid black fills. |
| **Halftone texture** | Visible Ben-Day dots or halftone grain on all mid-tone areas (especially skin, clothing, backgrounds). This is the #1 signifier of the style. Dot size: medium-large, clearly visible, not subtle. |
| **Color approach** | Limited palette, posterized. Maximum 5-6 flat colors per image plus black and white. Colors should look like cheap 4-color offset printing — slightly misregistered, slightly oversaturated. |
| **Paper/print quality** | Images should look printed on cheap newsprint. Slight yellowing. Ink bleeds at edges. Occasional "print defect" — a streak, a smudge, a paper crease. |
| **Composition** | Tight framing. Characters fill 70-85% of the frame. Strong angular compositions. Dutch angles welcome. Characters should feel like they're pressing against the borders. |
| **Borders** | Thick black panel borders (8-12px equivalent). Slightly rough/hand-drawn edges. Corners can be rounded or sharp — inconsistency is fine. |
| **Text integration** | Any in-image text uses hand-lettered style: uneven baselines, slight size variation, heavy strokes. Think 70s comic letterer, not font. |

### The Gutterbones Palette (color boundaries for all art)

All art must draw from this palette. Artists may use tints (halftone dots over white) and shades (halftone dots over black) of these, but no colors outside this family.

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#121113` | Ink Black | Outlines, deep shadow, backgrounds |
| ■ | `#e8e6e1` | Manila Paper | Skin highlight, paper surfaces, breath |
| ■ | `#d4cfc5` | Bone White | Lighter skin, bone, fabric highlight |
| ■ | `#c78b16` | Dirty Gold | Cash, warmth, tungsten light, brass |
| ■ | `#ff007f` | Neon Pink | Danger, sex, violence, neon glow |
| ■ | `#00ddff` | Electric Cyan | Tech, cold, intelligence, moonlight |
| ■ | `#6e1d24` | Felt Red | Blood, leather, old velvet, rage |
| ■ | `#d30000` | Pure Red | Fresh blood, stamps, urgent danger |
| ■ | `#2b0808` | Dried Blood | Deep shadow variant, old wounds |
| ■ | `#4a3520` | Tobacco Brown | Skin shadow, wood, grime, 70s earth |
| ■ | `#8c7a5c` | Nicotine Tan | Skin midtone, aged paper, dust |

**Skin tones:** Build from `#e8e6e1` (highlight), `#8c7a5c` (midtone), `#4a3520` (shadow), modulated via halftone density. All characters should look like they haven't seen the sun in weeks — sallow, sodium-lit.

### Mood & Expression

Every face in this game should look like it's been awake for 36 hours under bad fluorescent light. Expressions are **hard, guarded, or manic** — never soft, never heroic, never neutral. Eyes are the focus. Half-lidded, bloodshot, calculating, or wild.

---

## 2. Image Specifications

### Character Portraits (Personas & Bosses)

| Spec | Value |
|------|-------|
| Aspect ratio | **3:4** (portrait orientation) |
| Minimum resolution | **768 × 1024 px** |
| Preferred resolution | **900 × 1200 px** |
| File format | PNG with transparency OR solid `#121113` background |
| Framing | Head and shoulders. Chin at ~20% from bottom, top of head at ~90% from bottom. Room for "mugshot" feeling. |
| Background | Flat ink black (`#121113`) or simple suggestive elements (smoke, a line of neon light, prison measurement lines). Never complex/detailed backgrounds. |
| Border | Include a thick (10px) black panel border baked into the image. |

### Between-Round Panels (Scene Art)

| Spec | Value |
|------|-------|
| Aspect ratio | **16:9** (landscape/cinematic) |
| Minimum resolution | **1280 × 720 px** |
| Preferred resolution | **1600 × 900 px** |
| File format | PNG |
| Framing | Cinematic establishing shots, dramatic close-ups, or action beats. Think graphic novel splash pages. |
| Background | Full scene — these ARE environment art. Detailed but still in the halftone/crosshatch style. |
| Border | Thick black panel border, slightly uneven. |
| Text areas | Leave a 15-20% strip at the bottom or top clear for potential caption overlay (the game may render text on top). |

---

## 3. Persona Portraits — Detailed Character Specs

### 3A. THE STREET RAT

> *"Runs light, moves fast, and survives on instinct. Nothing fancy, but every scrap can become leverage."*

**Who they are:** A teenager or very young adult (17-20). The only one here who isn't a professional criminal — just a kid who grew up in the gutter and learned to survive. Scrappy, wiry, alert. A stray.

| Attribute | Detail |
|-----------|--------|
| **Build** | Thin, wiry, underfed. Visible collarbones. Narrow shoulders. |
| **Face** | Young but hard. Hollow cheeks. Large eyes (watchful, feral). A fresh scrape or bruise on one cheekbone. Unwashed. |
| **Hair** | Messy, unkempt. Dark brown or black. Falls in face. A rat-tail or just neglected growth. |
| **Expression** | Alert suspicion. Jaw slightly set. Eyes scanning. Not hostile — calculating if you're a threat. |
| **Clothing** | Oversized army surplus jacket (olive drab, fraying). Dirty white t-shirt underneath. Maybe a chain or cord necklace with something small (a die, a key). |
| **Hands** | If visible: dirty nails, a wrapped knuckle (athletic tape or rag). |
| **Props** | None prominent. Maybe a single bone die palmed in one hand, half-hidden. |
| **Dominant colors** | Gray (`bg-gray-600` is their game color), muted olive, dirty white, ink black. The least colorful persona — they haven't earned color yet. |
| **Lighting** | Flat, unflattering overhead (sodium street lamp). Harsh shadow under brow and nose. |
| **Mood keyword** | *Feral.* |

**Prompt seed:** *Grindhouse comic portrait, tight head-and-shoulders, wiry teenage street kid, hollow cheeks, oversized army surplus jacket, feral watchful eyes scanning sideways, harsh overhead sodium-lamp lighting, heavy ink outlines, visible halftone dots on skin, newsprint texture, 1970s exploitation comic style, Ben-Day dots, crosshatching in shadows, limited palette gray olive dirty-white black*

---

### 3B. THE HUSTLER

> *"Knows every back-room table in the borough. Starts rich, burns bright, and pays for it with slower stash momentum."*

**Who they are:** A smooth operator in their late 30s. A professional gambler who dresses a cut above everyone else in the room. Not muscle — *confidence*. The kind of person who's never been in a fight because they've never had to be.

| Attribute | Detail |
|-----------|--------|
| **Build** | Medium, lean-to-average. Not physically imposing. Confidence is in the posture — relaxed shoulders, chin slightly elevated. |
| **Face** | Sharp features. Clean-shaven or pencil mustache. Heavy-lidded eyes (not sleepy — *cool*). A knowing half-smirk. Gold tooth or gold cap on one canine. |
| **Hair** | Slicked back. Dark, oiled. Clean. A deliberate style in a world of chaos. |
| **Expression** | A half-smirk that says "I already know your hand." Eyes slightly narrowed. Cocky but not stupid. |
| **Clothing** | Open-collar shirt (dark mustard or cream). A leather or suede jacket. One visible gold chain. Shirt unbuttoned enough to show chest hair and the chain. |
| **Hands** | If visible: manicured (unusual in this world). A gold ring. Maybe fanning cash or holding a cigar between two fingers. |
| **Props** | A fat roll of bills in breast pocket (visible). Or a lit cigar/cigarette with a long ash. |
| **Dominant colors** | Dirty gold (`#c78b16`), deep brown, cream, black. The warmest persona. Everything is lit like tungsten. |
| **Lighting** | Warm, low — like a single bulb over a card table. Gold highlights on cheekbones and brow. Deep warm shadows. |
| **Mood keyword** | *Slick.* |

**Prompt seed:** *Grindhouse comic portrait, tight head-and-shoulders, smooth 1970s hustler, slicked-back hair, gold tooth, pencil mustache, half-smirk, open-collar cream shirt with gold chain, leather jacket, warm tungsten card-table lighting, heavy ink outlines, Ben-Day dots halftone texture, newsprint grain, dirty gold and brown and black limited palette, exploitation comic style, crosshatch shading*

---

### 3C. THE ENFORCER

> *"An ex-collector with cracked knuckles and no patience. Starts rough, no pills, and swings heavy from hand one."*

**Who they are:** A former debt collector / leg-breaker in their 40s. Massive, scarred, silent. They don't gamble for fun — they gamble because it's the only skill they have left after the organization cut them loose. Every movement is economical. Violence is boring to them.

| Attribute | Detail |
|-----------|--------|
| **Build** | Broad. Thick neck. Sloping shoulders. Not bodybuilder — working-muscle. A slab. |
| **Face** | Square jaw. Flat nose (broken at least twice). A scar through one eyebrow. Heavy brow ridge. Deep-set, dead-calm eyes. Five o'clock shadow that's closer to midnight. |
| **Hair** | Buzzcut or nearly bald. Dark stubble. Maybe a razor nick. |
| **Expression** | Empty. Not angry — *past* angry. A flat stare that says "I've seen worse than you." Mouth is a straight line. |
| **Clothing** | Dark red or black turtleneck (tight, showing the mass). Or a wife-beater showing arms with old scars and a faded tattoo (a crude number, a cross, prison ink). |
| **Hands** | MUST be partially visible. Cracked knuckles. Wrapped in dirty athletic tape. Large, meaty. One hand should be a fist, resting. |
| **Props** | None. The Enforcer doesn't need props. Their body IS the prop. Maybe brass knuckles visible in a breast pocket. |
| **Dominant colors** | Deep red (`#6e1d24`, `bg-red-900`), ink black, dried-blood brown. The darkest, most saturated persona. |
| **Lighting** | Low, from below (like a basement bulb). Red-cast. Deep black shadows eating half the face. |
| **Mood keyword** | *Blunt.* |

**Prompt seed:** *Grindhouse comic portrait, tight head-and-shoulders, hulking 1970s debt collector, buzzcut, broken nose, scar through eyebrow, dead flat stare, thick neck, dark red turtleneck or wife-beater showing prison tattoos, wrapped knuckles, low harsh lighting from below with red cast, heavy ink outlines, extreme crosshatching in shadows, visible halftone dots, Ben-Day dots, exploitation comic style, limited palette deep-red black dried-blood-brown*

---

### 3D. THE COUNTER

> *"Reads patterns, marks tells, and weaponizes math. Opens with The Black Book but draws bigger heat from the start."*

**Who they are:** A former accountant or academic who fell into the criminal underworld. Thin, bespectacled, precise. The most dangerous person at the table — not because of violence, but because they see the matrix. Think: an unhinged mathematician who realized probability is power.

| Attribute | Detail |
|-----------|--------|
| **Build** | Thin, angular. Sharp elbows. Narrow. Almost fragile-looking. |
| **Face** | Gaunt, angular. High cheekbones, sunken eyes. Wire-frame glasses (round or rectangular, slightly crooked). One lens might have a hairline crack. Pale — never goes outside. |
| **Hair** | Receding or thinning on top. What's left is uncombed and longer at the back/sides. Might be prematurely graying at temples. Dark roots. |
| **Expression** | Intense focus. Eyes too wide, pupils slightly dilated. Looking at YOU like you're a probability table. A very slight, wrong smile — like they just calculated something in their favor. |
| **Clothing** | Wrinkled dress shirt (once white, now gray-yellow). Tie loosened to the point of being decorative only. Sleeves rolled up. Maybe a pocket protector or pens in breast pocket (old habit). A dark vest or cardigan. |
| **Hands** | If visible: Long, spider-like fingers. Ink stains. Maybe holding a small black notebook (The Black Book) with tabs and marks. |
| **Props** | The Black Book — a small leather-bound notebook stuffed with papers, tabs, calculations. It should feel like a dangerous artifact. |
| **Dominant colors** | Dark blue/navy (`bg-blue-900`), cold gray, electric cyan (`#00ddff`) as accent (reflecting in glasses or from unseen monitor glow). |
| **Lighting** | Cold, blue-white — like a late-night desk lamp or a CRT monitor. Cyan highlights on glasses and paper edges. Cold shadows. |
| **Mood keyword** | *Unhinged precision.* |

**Prompt seed:** *Grindhouse comic portrait, tight head-and-shoulders, gaunt 1970s mathematician criminal, wire-frame glasses with cracked lens, thinning hair, too-wide intense staring eyes, wrong smile, loosened tie wrinkled gray shirt, holding small black leather notebook, cold blue-white desk-lamp lighting with cyan highlights on glasses, heavy ink outlines, Ben-Day dots halftone, newsprint texture, limited palette navy blue cold-gray electric-cyan black, exploitation comic style, crosshatching*

---

## 4. Boss Portraits — Detailed Character Specs

### 4A. THE BOUNCER

> *"Owns the club doors and skims every take. If you cannot clear his inflated quota, you are out on the curb."*

**Game effect:** Quota +50%

| Attribute | Detail |
|-----------|--------|
| **Build** | Enormous. Takes up the entire frame. Shoulders wider than the panel border. |
| **Face** | Small eyes in a big head. Cauliflower ear. Jaw like a cinderblock. Flat expression — not threatening, just *immovable*. |
| **Hair** | Short, tight. Military or prison cut. |
| **Expression** | Bored authority. "You don't meet the minimum." |
| **Clothing** | Black suit jacket, too tight across the shoulders. Black turtleneck underneath. Bouncer-earpiece optional but iconic. A velvet rope in one hand or behind him. |
| **Props** | A clipboard or a stamp (he controls the numbers). One hand raised in a "stop" gesture. |
| **Dominant colors** | Gray, black, cold white. Monochromatic — he's colorless, institutional, a wall. |
| **Lighting** | Flat, overhead. No drama — he doesn't need it. |
| **Mood keyword** | *Wall.* |

**Prompt seed:** *Grindhouse comic portrait, enormous bouncer filling the frame, cauliflower ear, cinderblock jaw, tiny eyes, black turtleneck and too-tight suit jacket, one hand raised in stop gesture, flat bored expression, cold overhead lighting, monochromatic gray-black-white limited palette, heavy ink outlines, Ben-Day dots halftone, 1970s exploitation comic style, crosshatching*

---

### 4B. THE LOAN SHARK

> *"Fronts cash with a smile and collects with interest. Every roll costs tribute, especially when you already owe."*

**Game effect:** -$2 per roll

| Attribute | Detail |
|-----------|--------|
| **Build** | Lean, medium. Not physically threatening — his power is financial. |
| **Face** | Thin, long. High forehead. A too-wide smile showing too many teeth. Eyes that don't match the smile — cold, calculating, fishlike. Pockmarked skin. |
| **Hair** | Slicked straight back with too much product. Black, receding at temples. |
| **Expression** | The smile is permanent and terrifying. It's not friendly. It's a trap that already closed. |
| **Clothing** | Expensive sharkskin suit (gray with subtle sheen). Open collar, no tie. Rings on multiple fingers — gold, gaudy. A watch that costs more than your car. |
| **Hands** | MUST be visible. Counting money, or one hand extended palm-up ("you owe me"). Rings catch the light. |
| **Props** | A stack of IOUs or a ledger book with names crossed out. Cash fanned between fingers. |
| **Dominant colors** | Red (`text-red-500`), gold, gray-shark, black. Red is his accent — the color of debt. |
| **Lighting** | From below and left, theatrical. Makes the smile more sinister. Sharp red accent light. |
| **Mood keyword** | *Trap.* |

**Prompt seed:** *Grindhouse comic portrait, thin loan shark with too-wide terrifying smile showing teeth, eyes cold and fishlike, slicked-back hair, expensive sharkskin suit, gold rings on multiple fingers, counting cash between fingers, red and gold accent lighting from below, heavy ink outlines, Ben-Day dots, newsprint halftone texture, limited palette red gold gray black, 1970s exploitation comic style, crosshatching*

---

### 4C. THE JUNKIE

> *"A chaos broker who salts the bones. Sixes twist into ones when he is around, shredding high-roll plans."*

**Game effect:** All 6s roll as 1s

| Attribute | Detail |
|-----------|--------|
| **Build** | Emaciated. Concave chest. Arms like cables. Everything angular and wrong. |
| **Face** | Sunken eyes with dark circles that go all the way to the bone. Cracked lips. A manic grin or wide-eyed stare. Sweat beads. Track marks could be implied on neck. Pupils are pinpoints. |
| **Hair** | Long, stringy, unwashed. Hanging in face. Could be any color — sweat-darkened to near-black. |
| **Expression** | Manic and unstable. Between laughing and screaming. The eyes are too bright. They see something you don't. |
| **Clothing** | Threadbare tank top or torn band t-shirt. A filthy denim jacket with patches. Visible collarbones and sternum. Safety pins where buttons should be. |
| **Hands** | If visible: skeletal, twitching. Maybe holding dice that are glowing/melting/wrong (ones where sixes should be). Needle optional — implied is stronger than explicit. |
| **Props** | Dice with scrambled faces (the mechanic made physical). Or a spoon. Or nothing — the Junkie IS the prop. |
| **Dominant colors** | Hot neon pink (`#ff007f`), sickly yellow-green, black. The most garish, most uncomfortable color combo. |
| **Lighting** | Neon pink and cyan flickering. Unstable. Like a broken motel sign. Half the face lit pink, half in black. |
| **Mood keyword** | *Chaos.* |

**Prompt seed:** *Grindhouse comic portrait, emaciated junkie with manic too-wide grin, sunken black-ringed eyes, stringy hair hanging in face, pinpoint pupils, sweat beading, threadbare torn clothes, safety pins, broken neon-pink and cyan lighting flickering, heavy ink outlines, Ben-Day dots halftone, limited palette neon-pink sickly-green black, 1970s underground comix style, intense crosshatching on gaunt features*

---

### 4D. CROOKED COP

> *"Badge on paper, extortionist in practice. Hardware goes dark while the cop watches your table."*

**Game effect:** Hardware disabled

| Attribute | Detail |
|-----------|--------|
| **Build** | Stocky, gone to seed. Beer gut straining a uniform shirt. Was once fit. |
| **Face** | Florid, jowly. A walrus mustache. Mirrored aviator sunglasses hiding the eyes (even indoors, at night). A smug, piggish half-smile. Broken capillaries on nose (drinker). |
| **Hair** | Short, regulation cut going gray. Under a tilted-back police cap or bare-headed with a hat-line. |
| **Expression** | Smug ownership. "This is MY table now." The glasses hide whether he's watching you or half-asleep. |
| **Clothing** | NYPD-style uniform shirt (1970s cut — wide collar, tight). Badge visible and prominent. The uniform is rumpled, stained — this is not a clean cop. Shoulder radio optional. |
| **Hands** | If visible: one hand on hip (near holster), one hand extended palm-out or pointing down ("your hardware, on the table"). |
| **Props** | The badge (tarnished). Mirrored aviators. A nightstick or the hand-on-holster pose. |
| **Dominant colors** | Police blue, badge-gold, black, with red-blue light wash accents. Blue is dominant (`text-blue-400`). |
| **Lighting** | Red and blue alternating wash (police lights) sweeping across. Like a squad car parked outside, lights rotating. Cold blue dominant. |
| **Mood keyword** | *Extortion.* |

**Prompt seed:** *Grindhouse comic portrait, stocky corrupt 1970s cop, mirrored aviator sunglasses indoors, walrus mustache, florid jowly face, rumpled NYPD uniform with prominent badge, smug piggish half-smile, red-and-blue police-light wash sweeping across, heavy ink outlines, Ben-Day dots halftone, newsprint grain, limited palette police-blue badge-gold black, exploitation comic style, crosshatch shading*

---

### 4E. THE INFORMANT

> *"Knows every stash route in the district. Locks your stash progress until you force your way through."*

**Game effect:** Stash frozen

| Attribute | Detail |
|-----------|--------|
| **Build** | Slight, non-descript. The kind of person you wouldn't notice in a room. That's the point. |
| **Face** | Unremarkable features made sinister by lighting. Deep-set eyes that see too much. A thin mouth pressed into a line. Could be anyone — that's what makes them dangerous. Permanent five o'clock shadow. |
| **Hair** | Nondescript medium length, neither styled nor neglected. A nothing haircut. Forgettable. |
| **Expression** | Dead neutral. Watching. Recording. A court reporter's face at a murder trial — absorbing everything, revealing nothing. |
| **Clothing** | Beige trench coat (collar up). Anonymous. Layered. Something to disappear into. A hat brim casting shadow over the eyes (fedora or flat cap). |
| **Hands** | If visible: one hand in coat pocket (what's in there? A wire? A notebook?). Or holding a telephone receiver (old rotary style). |
| **Props** | A rotary telephone. A shadowed doorway. A notebook with names. The trench coat itself is the prop — anonymity weaponized. |
| **Dominant colors** | Dirty yellow/gold (`text-yellow-400`), trench-coat beige, shadow black. Warm but paranoid. |
| **Lighting** | A single harsh shaft of light (like through a cracked door or venetian blinds). Most of the face in shadow. One eye catches the light. |
| **Mood keyword** | *Watching.* |

**Prompt seed:** *Grindhouse comic portrait, nondescript informant in beige trench coat with collar up, hat brim shadowing face, one eye catching shaft of light through venetian blinds, dead neutral expression, five o'clock shadow, heavy ink outlines, venetian-blind lighting stripes, Ben-Day dots halftone, limited palette dirty-yellow beige shadow-black, 1970s noir exploitation comic style, dense crosshatching in shadows*

---

### 4F. THE RAID

> *"Not a person but a citywide crackdown. Triple pressure, expensive pills, and no room for sloppy hands."*

**Game effect:** Final job. Quota 300%. Pills cost $2.

**NOTE:** The Raid is NOT a person. It's an event. The portrait should depict the *concept* of a raid — multiple hostile forces closing in simultaneously.

| Attribute | Detail |
|-----------|--------|
| **Subject** | Multiple overlapping silhouettes (riot cops, SWAT, plainclothes with guns drawn) converging from all sides. Or: a door being kicked in, wood splinters flying, flashlight beams cutting through smoke. |
| **Composition** | Chaotic. Multiple overlapping figures. Depth compressed. Claustrophobic. Everything closing in. |
| **Expression** | N/A (or: the one visible face is screaming an order, mouth wide, veins in neck). |
| **Clothing** | Riot helmets, tactical vests, badges, batons. 1970s-era tactical gear — not modern SWAT but the precursor. Trench coats and shotguns. |
| **Props** | A battering ram. Flashlight beams. Smoke/tear gas. A door mid-splinter. Warrant papers flying. The number "300%" stamped in red somewhere. |
| **Dominant colors** | Red (`text-red-600`), siren blue, harsh white (flashlights/flashes), black. Maximum contrast. Maximum violence. |
| **Lighting** | Strobing. Multiple flashlights cutting through smoke or dark. Red and blue washes colliding. White camera-flash frozen moments. |
| **Mood keyword** | *Convergence.* |

**Prompt seed:** *Grindhouse comic portrait panel, a 1970s police raid in progress, multiple riot cops and plainclothes figures converging through kicked-in door, wood splinters flying, flashlight beams cutting through tear gas smoke, strobing red and blue police lights, chaotic overlapping silhouettes, heavy ink outlines, extreme contrast, Ben-Day dots halftone, limited palette red siren-blue white black, exploitation comic style, aggressive crosshatching, newsprint texture*

---

## 5. Between-Round Panel Specs

These are cinematic narrative panels shown between gameplay rounds. They should feel like pages torn from a 1977 crime comic — each one a frozen moment that sets the mood.

### Panel Categories

#### 5A. TRANSITION PANELS (shown between rounds, ~2 seconds)

These set the scene for what comes next. Generic enough to reuse, specific enough to feel intentional.

| Panel ID | Subject | Composition | Colors | Caption tone |
|----------|---------|-------------|--------|--------------|
| `alley-walk` | Figure walking down a narrow alley at night, seen from behind. Trash, fire escape ladders, a distant neon sign. | Low angle, strong perspective lines converging. Figure small in frame. | Neon pink reflected in puddles, mostly black/dark. | *"Three blocks to the next table."* |
| `back-room-door` | A heavy door, slightly ajar. Smoke leaking out. A hand pushing it open. Light inside is gold/warm. | Close-up on the hand and door edge. Interior light spilling into dark hallway. | Gold light leak, black surroundings. | *"Same game. Bigger stakes."* |
| `stairwell-descent` | Concrete stairwell going down. Bare bulb overhead. Graffiti. Someone's shoes on the stairs (top-down view). | Overhead/bird's eye looking down the stairwell. Vertiginous. | Yellow sodium light, gray concrete, ink black. | *"Deeper."* |
| `phone-booth` | Exterior: figure in a phone booth at night, receiver to ear. Street empty. Condensation on glass. | Mid-wide shot. Phone booth lit from inside, everything else dark. Slight rain. | Cyan phone-booth light, rain streaks, black. | *"The Fixer says move."* |
| `dice-on-felt` | Extreme close-up of bone dice mid-tumble on red felt. Smoke wisps above. | Macro shot. Shallow implied depth. Dice fill frame. | Felt red, bone white, smoke gray, gold highlight. | *"One more hand."* |
| `counting-cash` | Hands counting dirty bills under a desk lamp. Deep shadows. Stacks. | Tight on hands and money. Face not visible. | Gold (bills), warm light cone, black surround. | *"$X in. $X owed."* |

#### 5B. BOSS APPROACH PANELS (shown before boss intro)

One per boss. Establishes their threat before the typewriter nameplate appears.

| Panel ID | Subject | Composition | Colors |
|----------|---------|-------------|--------|
| `boss-bouncer` | A mountain of a man blocking a doorway, arms crossed. "PRIVATE" sign above. Queue of people being turned away behind him. | Extreme low angle looking up. He fills the sky. | Gray, black, cold white. Imposing silhouette. |
| `boss-shark` | A hand sliding a stack of IOUs across a table. Rings glinting. A second hand (yours) visible at the edge, palm down — trapped. | Tabletop composition. Two sets of hands. Intimate and threatening. | Red felt table, gold rings, paper white IOUs. |
| `boss-junkie` | A pair of dice on a table, but the dots are *wrong* — sixes showing as ones, numbers scrambled. A twitching hand reaching toward them. | Close on the table. Dice are the focus. Hand entering from off-frame. | Pink neon glow, sickly green tint, black table. |
| `boss-cop` | View from inside a car. Rearview mirror showing red-and-blue lights approaching. Hands gripping steering wheel. | POV from driver's seat. Focus on mirror. | Blue-red lights dominating. Dashboard shadow. |
| `boss-informant` | A photograph pinned to a corkboard with string connecting it to other photos. Your photograph. Red string. | Flat composition, looking at the board. | Beige cork, white photos, red string, shadow. |
| `boss-raid` | An aerial view of a city block at night. Police cars converging from all directions, their lights creating a web of red-blue. | Bird's eye / helicopter shot. Geometric. | Red-blue lights on black streets. City grid pattern. |

#### 5C. BUST PANELS (shown during bust sequence)

A 2-panel sequence shown before the Rap Sheet.

| Panel # | Subject | Composition |
|---------|---------|-------------|
| `bust-1` | Hands slamming onto a table (or wall). Close on the impact. Dice scattering. | Extreme close-up. Dynamic angle. Motion lines. |
| `bust-2` | Hands behind back, wrist being cuffed. Close-up. The cuff clicking shut. Badge visible at edge of frame. | Tight crop. Sound effect implied ("CLICK"). |

#### 5D. VICTORY PANEL (shown before Greyhound ticket)

| Panel ID | Subject | Composition |
|----------|---------|-------------|
| `victory-escape` | A figure walking toward a Greyhound bus in early morning light. Shot from behind. Duffel bag over one shoulder. Empty parking lot. The city skyline receding. | Wide shot, figure small against the bus. Dawn light. Gold and pink sky. The only warm, hopeful image in the game. |

---

## 6. In-Game Integration Points

Where each art piece appears and at what size:

| Context | Art used | Display size | Treatment |
|---------|----------|-------------|-----------|
| **Lineup persona cards** | Persona portrait (cropped to face) | ~200×260px display | Inside the dark "mugshot" box. Slight CSS `filter: contrast(1.1) saturate(0.9)`. 2-3° rotation to match card tilt. |
| **Rap Sheet mugshot** | Persona portrait (full head+shoulders) | ~180×240px display | In the gray evidence box. Black & white or desaturated treatment with `filter: grayscale(0.6)`. |
| **Case Files lore panel** | Persona or Boss portrait | ~160×200px display | Beside the text bio. Standard color. |
| **Boss intro overlay** | Boss portrait | ~280×360px display | Behind or beside the typewriter text. Slight parallax drift. May be partially obscured by the venetian-blind sweep. |
| **Active boss banner** | Boss portrait (cropped to face only) | ~32×32px icon | Tiny circular crop in the banner bar. `border-radius: 50%`. |
| **Between-round panels** | Scene panel (16:9) | Full container width | Centered, with Ken Burns slow-zoom CSS. Caption text overlaid at bottom. 1.5-2s display. |
| **Boss approach panels** | Scene panel (16:9) | Full container width | Shown for ~1.5s before `BossIntro` component mounts. |
| **Bust panels** | Scene panels | Full container width | Shown in sequence (0.8s each) before Rap Sheet phase. |
| **Victory panel** | Scene panel | Full container width | Shown before Greyhound ticket resolves. |

---

## 7. File Naming Convention

```
art/
├── personas/
│   ├── street-rat.png
│   ├── hustler.png
│   ├── enforcer.png
│   └── counter.png
├── bosses/
│   ├── bouncer.png
│   ├── loan-shark.png
│   ├── junkie.png
│   ├── crooked-cop.png
│   ├── informant.png
│   └── the-raid.png
└── panels/
    ├── transition/
    │   ├── alley-walk.png
    │   ├── back-room-door.png
    │   ├── stairwell-descent.png
    │   ├── phone-booth.png
    │   ├── dice-on-felt.png
    │   └── counting-cash.png
    ├── boss-approach/
    │   ├── boss-bouncer.png
    │   ├── boss-shark.png
    │   ├── boss-junkie.png
    │   ├── boss-cop.png
    │   ├── boss-informant.png
    │   └── boss-raid.png
    ├── bust/
    │   ├── bust-hands-slam.png
    │   └── bust-cuffs.png
    └── victory/
        └── victory-escape.png
```

---

## 8. Style Consistency Checklist

Before accepting any generated image, verify:

- [ ] **Halftone dots visible** on at least 50% of the image area (Ben-Day dots / screen printing texture)
- [ ] **Heavy black outlines** present on all major forms (3-5px equivalent weight at 1024px)
- [ ] **Limited palette** — no more than 5-6 colors plus black/white, all from the approved swatch list
- [ ] **Crosshatch shading** in shadow areas (not smooth gradients)
- [ ] **Newsprint texture** — the image should feel printed, not digital. Slight grain, slight imperfection.
- [ ] **No smooth digital gradients** anywhere. Transitions are done via halftone density changes.
- [ ] **Character fills 70-85%** of the frame (for portraits)
- [ ] **Expression is hard/guarded/manic** — never soft, heroic, or neutral
- [ ] **Lighting is motivated** — you can identify the light source and it matches the character's spec
- [ ] **Fits the character's dominant palette** — Enforcer should be red-heavy, Counter should be blue-cold, etc.
- [ ] **Thick panel border** present and slightly rough/hand-drawn
- [ ] **No anachronisms** — no smartphones, no modern tactical gear, no contemporary fashion. Everything is 1977.

---

## 9. Generation Notes

When using AI image generation tools:

**Model guidance:** Use a model capable of illustrative styles (not photorealistic). Midjourney, DALL-E 3, or Stable Diffusion with an appropriate style LoRA (70s comic, exploitation poster, underground comix).

**Negative prompt elements to always include:** *photorealistic, smooth shading, soft gradients, clean lines, vector art, anime, modern, digital painting, 3D render, glossy, polished, superhero style, Marvel, DC, manga*

**Positive prompt elements to always include:** *1970s exploitation comic, grindhouse, heavy ink outlines, Ben-Day dots, halftone texture, newsprint print quality, crosshatching, limited color palette, visible print grain*

**Iteration strategy:**
1. Generate initial attempt with the character-specific prompt seed from Section 3/4
2. Check against the Style Consistency Checklist (Section 8)
3. If halftone texture is weak → emphasize "Ben-Day dots, visible halftone screen, comic book printing" in prompt
4. If too clean/digital → add "cheap newsprint paper, slight ink bleed, print registration error"
5. If palette is wrong → specify exact hex colors or use color-reference images
6. If expression is too soft → add "hard stare, guarded expression, unfriendly, weathered"

---

## 10. Art Priority Order

Generate in this order for maximum game impact per image:

**Priority 1 — Immediate character identity (generate first):**
1. The Street Rat (default persona, first thing every player sees)
2. The Hustler (second default unlocked persona)
3. The Enforcer (first unlock, high-value reward feeling)
4. The Counter (second unlock)

**Priority 2 — Boss threats (generate second):**
5. The Raid (final boss, climactic)
6. The Loan Shark (most encountered boss)
7. The Bouncer (most encountered boss)
8. Crooked Cop
9. The Junkie
10. The Informant

**Priority 3 — Between-round narrative (generate third):**
11. `alley-walk` (most-reused transition)
12. `bust-hands-slam` + `bust-cuffs` (bust sequence — high emotional impact)
13. `victory-escape` (victory payoff)
14. `dice-on-felt` (universal transition)
15. Boss approach panels (one per boss)
16. Remaining transition panels

---

*This document is the complete art direction reference. All image generation should follow these specs exactly to maintain visual coherence across the game.*
