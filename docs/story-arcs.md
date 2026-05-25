# Gutterbones 1977 — Story Arc System

> An interchangeable narrative layer that runs through each game, told through ~50 grindhouse comic panels shown at key moments. A different arc is selected each run, keeping replays fresh.

---

## 1. How It Works

### The core idea

Each run through Gutterbones is 1-10 rounds. Right now, the only narrative thread is mechanical: roll bones, clear quota, fight bosses, survive or bust. The story arc system adds a **visual crime-comic subplot** running underneath the gameplay — a second story told in panels, advancing each round.

### Per-run selection

When the player starts a new run ("OFFER CONTRACT"), the system randomly selects one of **5 story arcs**. The arc determines which comic panels appear at transition points throughout the run. The player doesn't choose the arc — it's dealt to them, like the rest of the game's randomness.

### Display moments

Panels appear at these natural pause points in the game loop:

| Trigger | When | Duration | Panel type |
|---------|------|----------|------------|
| **Run open** | After "OFFER CONTRACT", before Round 1 PLAY | 2.5s | Arc prologue (sets up the story) |
| **Round transition** | After path selection in SHOP, before next PLAY | 1.8s | Arc progression (advances the story) |
| **Boss approach** | After selecting a boss path, before BossIntro | 1.5s | Arc + boss intersection |
| **Bust** | After quota fail, before RAP_SHEET | 1.2s × 2 panels | Arc-specific bust ending |
| **Victory** | After Round 10 clear, before VICTORY | 2.0s | Arc-specific escape ending |

### Timing & interaction

- Panels are **non-interactive** — no buttons, no choices. They're mood-setters.
- Each panel has a **Ken Burns drift** (slow CSS zoom 1.0→1.05 or slow pan) and a **caption** rendered by the game (not baked into the image).
- Panels **fade in** (0.3s) and **fade out** (0.3s) with the hold time between.
- A **tap/click anywhere** or **spacebar** skips the panel immediately (respects impatient players).
- `prefers-reduced-motion`: panels show as static images with shorter hold (1.0s), no drift.

### Replay value math

5 arcs × ~10 panels each = ~50 panels total. Each run sees 8-12 panels from its arc. Since the arc is random, the player would need ~5 runs to see all storylines, and the arcs interact differently with the random boss encounters, creating combinatorial variety.

---

## 2. The Five Story Arcs

Each arc has a **theme**, a **through-line**, and a **tone shift** from beginning to end. They share the same grindhouse comic art style (see `art-direction.md`) but each arc has its own sub-palette emphasis and narrative flavor.

---

### ARC A: "THE SETUP"

**Logline:** You're being framed. Someone above you is building a case, and you're the fall guy. Every round, the trap tightens. Win to turn the tables. Bust to take the fall.

**Tone shift:** Paranoia → realization → desperate flight / righteous reversal

**Sub-palette emphasis:** Sickly yellows, document manila, bureaucratic cold blue. The color of paperwork and conspiracy.

| # | Panel ID | Round trigger | Subject | Caption |
|---|----------|--------------|---------|---------|
| 1 | `setup-prologue` | Run start | A manila folder being slid across a desk. "CONFIDENTIAL" stamped in red. A hand (not yours) opens it. Inside: a blurry mugshot of the player's persona. | *"Somebody filed your name."* |
| 2 | `setup-r2` | Round 2 transition | A corkboard with photographs connected by red string. Your photo is at the center. Other faces are crossed out. | *"You're the only one left on the board."* |
| 3 | `setup-r3` | Round 3 transition | A payphone receiver dangling off the hook in an empty hallway. Rotary dial. The cord is swinging. Someone just hung up. | *"The tip came in at 2am."* |
| 4 | `setup-r4` | Round 4 transition | A car parked across the street from a tenement. Two silhouettes in the front seat. One is holding binoculars. A cigarette ember glows. | *"They've been there since Tuesday."* |
| 5 | `setup-r5` | Round 5 transition | Close-up of hands wearing latex gloves, planting a bag of money inside a wall vent. The wall has your address number painted on it. | *"Evidence doesn't plant itself."* |
| 6 | `setup-r6` | Round 6 transition | A typewriter hammering out a warrant. Close on the paper. Your name is being typed letter by letter. The typist's face is out of frame. | *"Three copies. One for the judge."* |
| 7 | `setup-r7` | Round 7 transition | A courtroom sketch — but drawn in advance. The defendant's face is yours, drawn weeks before the trial. Predestined. | *"The verdict was written first."* |
| 8 | `setup-r8` | Round 8 transition | A wall safe, open. Inside: stacks of cash, a passport with your photo but a different name, and a revolver. Someone prepared an exit. | *"Whoever set this up left you a door."* |
| 9 | `setup-bust` | Bust | Split panel: top half — the folder slamming shut, "CASE CLOSED" stamped. Bottom half — your persona's hands on a booking desk, fingers being inked. | *"Frame complete. Case closed."* |
| 10 | `setup-victory` | Victory | The manila folder, now burning in a trash can in an alley. The red string from the corkboard blowing in the wind. Your mugshot curling in the flames. | *"The file doesn't exist. Neither do you."* |

---

### ARC B: "BLOOD DEBT"

**Logline:** Someone from your past is coming to collect. Not money — something older. They're getting closer every round. You hear about them before you see them.

**Tone shift:** Unease → dread → confrontation / flight

**Sub-palette emphasis:** Deep reds, dried blood brown, amber whiskey tones. The palette of old violence catching up.

| # | Panel ID | Round trigger | Subject | Caption |
|---|----------|--------------|---------|---------|
| 1 | `debt-prologue` | Run start | A hand placing a single bullet on a bar counter. The bar is empty. A glass of whiskey, half-drunk, sits beside it. The bartender is looking away deliberately. | *"They left this for you."* |
| 2 | `debt-r2` | Round 2 transition | A motel room door with a note slipped under it. Close on the note, handwritten: "I KNOW WHERE YOU SLEEP." The handwriting is shaky, angry. | *"Checked out early."* |
| 3 | `debt-r3` | Round 3 transition | An old Polaroid photograph crumpled then smoothed out. Two people — younger versions. One is the player's persona. The other's face is scratched out with a knife. | *"Some debts don't have numbers."* |
| 4 | `debt-r4` | Round 4 transition | A diner counter. The player's half-eaten plate. But reflected in the chrome napkin dispenser: a figure in the booth behind, watching. Face in shadow. | *"Same diner. Three nights running."* |
| 5 | `debt-r5` | Round 5 transition | A car with a smashed window, parked under a street light. On the driver's seat: another Polaroid — this one is of the player's persona taken TODAY, from across the street. Telephoto. Recent. | *"They want you to know they're close."* |
| 6 | `debt-r6` | Round 6 transition | A closed door with light leaking under it. Shadows of two feet on the other side, standing still. A hand reaching for the knob. | *"Wrong side of the door."* |
| 7 | `debt-r7` | Round 7 transition | A rain-soaked intersection at night. Two figures on opposite ends of a crosswalk, facing each other. Neither moves. Cars are stopped, lights red. | *"End of the line."* |
| 8 | `debt-r8` | Round 8 transition | Extreme close-up of two hands gripping each other's wrists — a struggle. One hand has old scars. One has a tattoo. Veins popping. Neither is letting go. | *"Somebody walks away. Somebody doesn't."* |
| 9 | `debt-bust` | Bust | A hospital corridor. Fluorescent lights. A gurney being wheeled, shot from ground level. One dangling hand. A watch on the wrist — stopped. | *"Debt settled. Not in your favor."* |
| 10 | `debt-victory` | Victory | Dawn. The player's persona sitting on the back bumper of a parked car, alone, holding the crumpled Polaroid from panel 3. The other figure is gone. A dropped knife on the ground. No blood — but close. | *"Walked away. Barely."* |

---

### ARC C: "THE INSIDE JOB"

**Logline:** You're not just playing the game — you're rigging it. You're running a con inside the con. Every round reveals another piece of your scheme coming together.

**Tone shift:** Scheming confidence → escalating complexity → house of cards holds / collapses

**Sub-palette emphasis:** Dirty golds, slick blacks, neon pink flashes. The palette of ambition and deceit.

| # | Panel ID | Round trigger | Subject | Caption |
|---|----------|--------------|---------|---------|
| 1 | `inside-prologue` | Run start | A blueprint spread across a table. Not a building — a flow chart. Arrows connecting names, dollar amounts, and times. A red circle drawn around one node labeled "YOU." A pen in hand, making corrections. | *"Three months of planning. One night to pull it."* |
| 2 | `inside-r2` | Round 2 transition | A hand slipping an envelope under a door marked "RECORDS." No return address. The hallway is empty, one bulb flickering. | *"First piece in place."* |
| 3 | `inside-r3` | Round 3 transition | A fuse box in a basement. One hand holding a flashlight, the other pulling a specific wire. The label reads "ALARM — FLOOR 3." | *"Blind spots don't make themselves."* |
| 4 | `inside-r4` | Round 4 transition | Three pay phones in a row. Three calls happening simultaneously. Three conversations you're managing. Split-panel: three mouths talking, none of them know about the others. | *"Nobody knows the full picture. That's the point."* |
| 5 | `inside-r5` | Round 5 transition | A security guard asleep at his desk. Behind him, a monitor bank shows a hallway — and a figure moving through it. On the desk: an open sandwich, a thermos of coffee. The coffee was doctored. | *"He'll sleep through the interesting part."* |
| 6 | `inside-r6` | Round 6 transition | A hand swapping a ledger page in a filing cabinet. The original page goes into a coat pocket. The replacement is nearly identical — one number changed. | *"$40,000 just moved without a sound."* |
| 7 | `inside-r7` | Round 7 transition | A rooftop view. Below, two groups meeting in an alley — both set up by you. Neither knows you exist. Money is about to change hands. You're watching from five stories up. | *"When both sides pay, nobody got robbed."* |
| 8 | `inside-r8` | Round 8 transition | Close on a hand holding a key. Not a house key — something industrial. A vault, a cage, a lock-up. Behind the hand: a loading dock. A van with its engine running. | *"Last door. Last chance."* |
| 9 | `inside-bust` | Bust | The blueprint from panel 1, crumpled in a fist. Seen through prison bars. The flow chart's arrows now point nowhere. | *"The plan was perfect. You weren't."* |
| 10 | `inside-victory` | Victory | An airport departures board, shot from below. A hand holding a passport — the name inside is new. A briefcase in the other hand. Flight to Buenos Aires. Boarding now. | *"Nobody got hurt. Everybody got robbed."* |

---

### ARC D: "LAST NIGHT IN THE BOROUGH"

**Logline:** The neighborhood is burning. Gangs, cops, and fires are swallowing every block. You're not running a hustle — you're running for the exit. Every round, the city closes in.

**Tone shift:** Tension → urban chaos → desperation / escape

**Sub-palette emphasis:** Fire oranges, emergency red, smoke blacks, siren blue. The palette of a city eating itself.

| # | Panel ID | Round trigger | Subject | Caption |
|---|----------|--------------|---------|---------|
| 1 | `borough-prologue` | Run start | A window view of the city skyline. Three separate columns of smoke rising from different neighborhoods. Distant sirens, visible as tiny red-blue specks. The glass has a crack in it. | *"Three fires by midnight. Nobody's coming to put them out."* |
| 2 | `borough-r2` | Round 2 transition | A bodega with its security gate half-pulled down. Inside, shelves are being cleared by hands reaching through the gap. A "CLOSED" sign knocked sideways. Orange glow from off-screen. | *"Everything's on sale tonight."* |
| 3 | `borough-r3` | Round 3 transition | A fire hydrant blasting open, water flooding the street. In the spray: a kid running past. Behind the kid: overturned cars. Further back: fire. | *"Three blocks and it's someone else's problem."* |
| 4 | `borough-r4` | Round 4 transition | An abandoned police barricade. Sawhorses knocked over. A police car, empty, doors open, radio crackling static. Flashers still spinning but nobody's inside. | *"Even the cops left."* |
| 5 | `borough-r5` | Round 5 transition | A crowd moving through a narrow street, lit from behind by a structure fire. Faces lit orange. Some are carrying bags, boxes, whatever they grabbed. Nobody's looking back. | *"The whole block is walking south."* |
| 6 | `borough-r6` | Round 6 transition | A bridge. One lane is gridlocked — headlights as far as you can see. The sidewalk is full of people on foot. The river below reflects fire from both banks. | *"Two ways out. Both jammed."* |
| 7 | `borough-r7` | Round 7 transition | A rooftop. The player's persona silhouetted against a sky that's the wrong color — orange where it should be dark. Looking down at the street. Calculating. | *"High ground doesn't last."* |
| 8 | `borough-r8` | Round 8 transition | A subway entrance. The stairs going down are pitch black — the power is out. But you can hear a train idling below. A single flashlight beam bounces off the tile. | *"The last train. Maybe."* |
| 9 | `borough-bust` | Bust | A building facade, mid-collapse. Brick dust cloud. Through the dust, a figure on their knees. Red and blue lights pushing through from behind. The borough won. | *"Didn't make it out."* |
| 10 | `borough-victory` | Victory | Dawn. The player's persona on a train platform in a different borough — clean, quiet, untouched. Looking back at a sky still hazy with smoke. A train arriving. Different air. | *"Crossed the river. Left the fire behind."* |

---

### ARC E: "THE WITNESS"

**Logline:** You saw a killing. Now everyone wants you — the killer to silence you, the cops to get your testimony, the mob to own you. The net tightens every round.

**Tone shift:** Shock → paranoid flight → cornered / free

**Sub-palette emphasis:** Cold cyan, harsh white (flashlight/interrogation), black. The palette of exposure and pursuit.

| # | Panel ID | Round trigger | Subject | Caption |
|---|----------|--------------|---------|---------|
| 1 | `witness-prologue` | Run start | A rain-soaked alley. A body on the ground (seen only from the shoes up to the waist — face off-panel). Standing over it: a figure in a long coat, back to you, holstering something. The figure hasn't turned around yet. But you stepped on broken glass. | *"Wrong alley. Wrong minute."* |
| 2 | `witness-r2` | Round 2 transition | Your persona's eye, extreme close-up, reflected in a car's side mirror. In the reflection behind the eye: two men getting out of a black sedan. | *"They don't know your face yet."* |
| 3 | `witness-r3` | Round 3 transition | A newspaper being read on a subway. The headline: "BODY FOUND IN EAST SIDE ALLEY — NO WITNESSES." But the person reading the paper has circled "NO WITNESSES" in red pen. They're looking for one. | *"The headline was a question, not a fact."* |
| 4 | `witness-r4` | Round 4 transition | A detective's desk. Your description on a notepad — height, build, "seen leaving vicinity." A coffee ring stains the pad. A phone receiver is being picked up. | *"Two people looking for you. Different reasons."* |
| 5 | `witness-r5` | Round 5 transition | A laundromat at night. The player's persona sitting among the machines, alone. Through the window: a slow-moving car. Are they looking? Or just driving? The dryer is the only sound. | *"Every car could be the one."* |
| 6 | `witness-r6` | Round 6 transition | A figure pinning a sketch to a telephone pole. The sketch is you — rough composite, almost right. A $5,000 number underneath. Not a police reward — private. | *"Now you have a price."* |
| 7 | `witness-r7` | Round 7 transition | An interrogation room. Empty chair, single bulb, two-way mirror. The door is open. Is this an invitation or a threat? On the table: a tape recorder, already running. | *"Talk and you're free. Talk and you're dead."* |
| 8 | `witness-r8` | Round 8 transition | A bus station bathroom. The player's persona at the mirror, holding scissors — halfway through cutting their own hair. A cheap pair of non-prescription glasses on the sink counter. A duffel bag. | *"New face. Same trouble."* |
| 9 | `witness-bust` | Bust | Split panel: top — a courtroom witness stand, empty, with a placard "WITNESS FAILED TO APPEAR." Bottom — your persona's hands in cuffs, not in the courtroom but in a car trunk. | *"They found you first."* |
| 10 | `witness-victory` | Victory | A motel room. New city, new name. The player's persona sitting on the bed watching TV news. The anchor is saying something about "case closed, insufficient evidence." A one-way bus ticket on the nightstand. The face in the mirror is different. | *"Somebody else's problem now."* |

---

## 3. Panel Display Slots — Full Map

This maps exactly when panels show during a run, for any arc:

```
LINEUP → [OFFER CONTRACT]
  ↓
  PANEL: arc-prologue (2.5s)          ← "The setup"
  ↓
  PLAY Round 1
  ↓
  GAMBLE / SHOP
  ↓
  [select path → advance]
  ↓
  PANEL: arc-r2 (1.8s)               ← Story beat
  ↓                                     (if boss path: boss-approach panel before BossIntro)
  PLAY Round 2
  ↓
  ...repeats for rounds 3-8...
  ↓
  PANEL: arc-r8 (1.8s)
  ↓
  PLAY Round 9 (The Raid)
  ↓
  OUTCOME:
    BUST  → PANEL: arc-bust (1.2s × 1 panel)  → RAP_SHEET
    WIN   → PANEL: arc-victory (2.0s)          → VICTORY
```

### Panel display per round

| Round | Panel slot | Panel shown |
|-------|-----------|-------------|
| Pre-Round 1 | Prologue | `{arc}-prologue` |
| Entering Round 2 | Transition | `{arc}-r2` |
| Entering Round 3 | Transition | `{arc}-r3` |
| Entering Round 4 | Transition | `{arc}-r4` |
| Entering Round 5 | Transition | `{arc}-r5` |
| Entering Round 6 | Transition | `{arc}-r6` |
| Entering Round 7 | Transition | `{arc}-r7` |
| Entering Round 8 | Transition | `{arc}-r8` |
| Entering Round 9 | *No arc panel* | The Raid's boss approach replaces the arc slot |
| Bust (any round) | Bust ending | `{arc}-bust` |
| Victory (Round 10) | Victory ending | `{arc}-victory` |

A typical run sees: 1 prologue + up to 7 transitions + 1 ending = **9 panels per run**.

Short runs (bust on Round 3): 1 prologue + 1-2 transitions + 1 bust = **3-4 panels**.

---

## 4. Full Panel Inventory (50 panels)

### Count by arc

| Arc | Unique panels | Shared | Total |
|-----|--------------|--------|-------|
| A: The Setup | 10 | — | 10 |
| B: Blood Debt | 10 | — | 10 |
| C: The Inside Job | 10 | — | 10 |
| D: Last Night in the Borough | 10 | — | 10 |
| E: The Witness | 10 | — | 10 |
| **Total** | **50** | — | **50** |

### Master panel list (generation queue)

| # | File path | Arc | Trigger | Subject summary |
|---|-----------|-----|---------|----------------|
| 1 | `panels/setup/prologue.png` | A | Run start | Manila folder, "CONFIDENTIAL" stamp, blurry mugshot |
| 2 | `panels/setup/r2.png` | A | Round 2 | Corkboard, red string, photos, player at center |
| 3 | `panels/setup/r3.png` | A | Round 3 | Payphone dangling, empty hallway |
| 4 | `panels/setup/r4.png` | A | Round 4 | Surveillance car, binoculars, cigarette ember |
| 5 | `panels/setup/r5.png` | A | Round 5 | Gloved hands planting money in wall vent |
| 6 | `panels/setup/r6.png` | A | Round 6 | Typewriter hammering out warrant with your name |
| 7 | `panels/setup/r7.png` | A | Round 7 | Pre-drawn courtroom sketch of you |
| 8 | `panels/setup/r8.png` | A | Round 8 | Open wall safe: cash, fake passport, revolver |
| 9 | `panels/setup/bust.png` | A | Bust | Folder slamming shut "CASE CLOSED", ink-stained fingers |
| 10 | `panels/setup/victory.png` | A | Victory | Folder burning in trash can, mugshot curling in flames |
| 11 | `panels/blood-debt/prologue.png` | B | Run start | Bullet on bar counter, half-drunk whiskey |
| 12 | `panels/blood-debt/r2.png` | B | Round 2 | Note under motel door: "I KNOW WHERE YOU SLEEP" |
| 13 | `panels/blood-debt/r3.png` | B | Round 3 | Crumpled Polaroid, face scratched out with knife |
| 14 | `panels/blood-debt/r4.png` | B | Round 4 | Diner reflection in chrome napkin dispenser |
| 15 | `panels/blood-debt/r5.png` | B | Round 5 | Smashed car window, telephoto Polaroid on seat |
| 16 | `panels/blood-debt/r6.png` | B | Round 6 | Closed door, light underneath, shadow of feet |
| 17 | `panels/blood-debt/r7.png` | B | Round 7 | Rain-soaked crosswalk, two figures facing off |
| 18 | `panels/blood-debt/r8.png` | B | Round 8 | Two hands gripping each other's wrists, struggling |
| 19 | `panels/blood-debt/bust.png` | B | Bust | Hospital corridor, gurney, dangling hand, stopped watch |
| 20 | `panels/blood-debt/victory.png` | B | Victory | Dawn, sitting on car bumper, Polaroid, dropped knife |
| 21 | `panels/inside-job/prologue.png` | C | Run start | Blueprint/flowchart on table, "YOU" circled in red |
| 22 | `panels/inside-job/r2.png` | C | Round 2 | Envelope slipped under RECORDS door |
| 23 | `panels/inside-job/r3.png` | C | Round 3 | Fuse box, hand pulling alarm wire |
| 24 | `panels/inside-job/r4.png` | C | Round 4 | Three payphones, split-panel, three simultaneous calls |
| 25 | `panels/inside-job/r5.png` | C | Round 5 | Sleeping guard, monitor showing figure in hallway |
| 26 | `panels/inside-job/r6.png` | C | Round 6 | Hand swapping ledger page in filing cabinet |
| 27 | `panels/inside-job/r7.png` | C | Round 7 | Rooftop view, two groups meeting below, money changing hands |
| 28 | `panels/inside-job/r8.png` | C | Round 8 | Hand holding industrial key, van with engine running |
| 29 | `panels/inside-job/bust.png` | C | Bust | Crumpled blueprint through prison bars |
| 30 | `panels/inside-job/victory.png` | C | Victory | Airport departures board, new passport, Buenos Aires flight |
| 31 | `panels/borough/prologue.png` | D | Run start | Window view: three smoke columns, distant sirens, cracked glass |
| 32 | `panels/borough/r2.png` | D | Round 2 | Bodega, half-closed gate, hands reaching in, orange glow |
| 33 | `panels/borough/r3.png` | D | Round 3 | Open hydrant flooding street, kid running, fire behind |
| 34 | `panels/borough/r4.png` | D | Round 4 | Abandoned police barricade, empty cruiser, doors open |
| 35 | `panels/borough/r5.png` | D | Round 5 | Crowd fleeing through street, fire behind, orange-lit faces |
| 36 | `panels/borough/r6.png` | D | Round 6 | Gridlocked bridge, pedestrians, river reflecting fire |
| 37 | `panels/borough/r7.png` | D | Round 7 | Rooftop silhouette against wrong-colored sky |
| 38 | `panels/borough/r8.png` | D | Round 8 | Dark subway entrance, flashlight beam, train idling below |
| 39 | `panels/borough/bust.png` | D | Bust | Building mid-collapse, dust cloud, figure on knees |
| 40 | `panels/borough/victory.png` | D | Victory | Clean train platform, looking back at smoky skyline, train arriving |
| 41 | `panels/witness/prologue.png` | E | Run start | Rain-soaked alley, body on ground, figure holstering, broken glass |
| 42 | `panels/witness/r2.png` | E | Round 2 | Eye reflected in car mirror, two men exiting black sedan |
| 43 | `panels/witness/r3.png` | E | Round 3 | Subway newspaper: "NO WITNESSES" circled in red |
| 44 | `panels/witness/r4.png` | E | Round 4 | Detective's desk, description notepad, phone being picked up |
| 45 | `panels/witness/r5.png` | E | Round 5 | Laundromat at night, slow-moving car through window |
| 46 | `panels/witness/r6.png` | E | Round 6 | Sketch pinned to telephone pole, $5,000 private bounty |
| 47 | `panels/witness/r7.png` | E | Round 7 | Empty interrogation room, open door, tape recorder running |
| 48 | `panels/witness/r8.png` | E | Round 8 | Bus station bathroom, scissors, cutting hair, cheap glasses |
| 49 | `panels/witness/bust.png` | E | Bust | Split: empty witness stand / hands in cuffs in car trunk |
| 50 | `panels/witness/victory.png` | E | Victory | Motel room, TV news "case closed", new face in mirror |

---

## 5. Panel Art Direction Per Arc

All panels follow the global art style in `art-direction.md`. These are the arc-specific overrides.

### Arc A: The Setup

| Property | Spec |
|----------|------|
| Dominant palette | Manila `#e8e6e1`, bureaucratic blue, red stamp ink `#d30000`, shadow black |
| Texture emphasis | Paper grain heavy. These panels should feel like evidence photos and case documents. |
| Composition style | Flat, clinical. Overhead angles (looking down at desks, files). Tight crops on hands and documents. The camera is a surveillance feed. |
| Halftone density | Low-medium. Clean-ish printing — this is official paperwork, not street art. |
| Caption font feel | Typewriter. Courier. Stamped. Bureaucratic. |

### Arc B: Blood Debt

| Property | Spec |
|----------|------|
| Dominant palette | Dried blood `#2b0808`, amber gold `#c78b16`, harsh white highlights, ink black |
| Texture emphasis | Film grain heavy. Rain streaks. These feel like frames from a 70s thriller shot on 16mm. |
| Composition style | Intimate, claustrophobic. Close-ups on hands, eyes, reflections. Voyeuristic angles — the camera is hiding behind something. Shallow depth implied. |
| Halftone density | High. Heavy grain. Degraded. Like an old photograph or surveillance still. |
| Caption font feel | Handwritten. Shaky. Like someone writing in the dark. |

### Arc C: The Inside Job

| Property | Spec |
|----------|------|
| Dominant palette | Dirty gold `#c78b16`, slick black, neon pink `#ff007f` accents, blueprint blue |
| Texture emphasis | Crisp linework mixed with schematic/blueprint elements. Diagrams, arrows, flow charts in the background or margins. |
| Composition style | Geometric, planned. Overhead shots. Split panels. Multiple simultaneous events. The camera is the planner's bird's-eye view. |
| Halftone density | Medium. Controlled. The cleanest arc — because this is the meticulous character. |
| Caption font feel | Measured. Mono. Like notes in the margin of a plan. Confident. |

### Arc D: Last Night in the Borough

| Property | Spec |
|----------|------|
| Dominant palette | Fire orange, emergency red `#d30000`, siren blue `#00ddff`, smoke black, ash gray |
| Texture emphasis | Maximum grain, maximum noise. Smoke texture layered over everything. These panels should feel HOT. |
| Composition style | Wide establishing shots shrinking to desperate close-ups as the arc progresses. Epic → trapped. The camera is a news helicopter at first, then it's running with the crowd. |
| Halftone density | Very high. Degraded almost to abstraction in the fire panels. Ink is bleeding. |
| Caption font feel | Urgent. Bold. Almost shouting. Short clipped sentences. |

### Arc E: The Witness

| Property | Spec |
|----------|------|
| Dominant palette | Cold cyan `#00ddff`, harsh white interrogation light, wet black, nighttime blue |
| Texture emphasis | Rain. Wet surfaces reflecting everything. Glare and lens flare. The world is a hall of mirrors. |
| Composition style | Noir framing. Through windows, in mirrors, over shoulders. The player is never in the center of the frame — they're caught at the edge, about to leave. The camera is paranoid. |
| Halftone density | Medium-high. Cold and precise. Like crime scene photography. |
| Caption font feel | Tense. Clipped. Internal monologue. Present tense. |

---

## 6. File Structure

```
art/
├── personas/           (character portraits — see art-direction.md)
├── bosses/             (boss portraits — see art-direction.md)
└── panels/
    ├── setup/
    │   ├── prologue.png
    │   ├── r2.png
    │   ├── r3.png
    │   ├── r4.png
    │   ├── r5.png
    │   ├── r6.png
    │   ├── r7.png
    │   ├── r8.png
    │   ├── bust.png
    │   └── victory.png
    ├── blood-debt/
    │   ├── prologue.png
    │   ├── r2.png ... victory.png
    ├── inside-job/
    │   ├── prologue.png
    │   ├── r2.png ... victory.png
    ├── borough/
    │   ├── prologue.png
    │   ├── r2.png ... victory.png
    └── witness/
        ├── prologue.png
        ├── r2.png ... victory.png
```

---

## 7. Technical Implementation Notes

### Arc selection

```
On startRun():
  1. Pick random arc from ['setup', 'blood-debt', 'inside-job', 'borough', 'witness']
  2. Store arcId in run state (persisted to localStorage with the rest of the run)
  3. Arc determines which panel file paths to use at each trigger point
```

### Panel display component

A `<StoryPanel>` component handles:
- Fade-in / Ken Burns drift / caption overlay / fade-out
- Click/tap/spacebar to skip
- `prefers-reduced-motion` static fallback
- `onDone` callback that advances to the next phase
- Graceful fallback: if the image file doesn't load (404), skip the panel silently

### Caption rendering

Captions are NOT baked into images. They're rendered by the game as a text overlay:
- Position: bottom 15% of panel, centered
- Background: semi-transparent black bar (`bg-black/70`)
- Font: `font-mono`, `text-sm`, italic
- Color: `#e8e6e1` (manila paper)
- Typewriter reveal: characters appear one at a time (~30ms each)

### Persistence

The `arcId` is added to the serialized run state:
```
serializeRun() → { ...existing fields, arcId: 'blood-debt' }
```

On `resumeRun()`, the arcId is restored so the story continues from the correct point. The current round number determines which panel to show next — no additional tracking needed.

---

## 8. Generation Priority

Generate arcs in this order (most broadly appealing first):

1. **Arc E: The Witness** — most universally compelling (Hitchcockian wrong-place-wrong-time)
2. **Arc B: Blood Debt** — strong emotional hook (personal stakes)
3. **Arc D: Last Night in the Borough** — the most visually dramatic (fire, chaos)
4. **Arc A: The Setup** — the most cerebral (paranoia, conspiracy)
5. **Arc C: The Inside Job** — the most complex (requires understanding of the scheme)

Within each arc, generate in this order:
1. Prologue (first thing the player sees)
2. Bust ending (most players bust early — they'll see this often)
3. Victory ending (the payoff)
4. Rounds 2-8 in order

---

*This document defines the full story arc system. See `art-direction.md` for global art style rules, character portraits, and image generation specs. All panels follow those same rendering rules (halftone, crosshatch, limited palette, heavy outlines, newsprint texture) with the arc-specific overrides listed in Section 5.*
