# ROUGE-ENGINE
## Game Design Document v1.0
### TattershallStudios — Confidential

---

# TABLE OF CONTENTS

1. Vision Statement
2. Genre & Platform
3. Core Philosophy
4. The Three Pillars
5. Core Game Loop
6. Player Character — The Pilot & The Mech
7. The Rouge System (Fuel & Economy)
8. The Rouge-Shift System (Environmental Transformation)
9. The Rouge-Graft System (Organ Assimilation & Decay)
10. The Rouge-Drain System (Fuel as Timer)
11. Enemy Design & Bestiary
12. Organ Registry (Full Graft Catalog)
13. Level Architecture & Procedural Generation
14. Floor Progression & Run Structure
15. Boss Design
16. UI & HUD Design
17. Audio Design Direction
18. Visual & Art Direction
19. Technical Architecture
20. Milestone Roadmap
21. Balance Philosophy
22. Future Scope (Post-Launch)

---

# 1. VISION STATEMENT

Rouge-Engine is a top-down Gothic Sci-Fi Bio-Mecha action game where the player pilots a living, dying biological machine through procedurally generated floors of escalating horror. Every second, your mech bleeds out. Every kill refuels you. Every drop of spilled Rouge reshapes the world around you. Every organ you rip from a fallen enemy and jam into your chassis makes you more powerful — and accelerates your death.

The game's central promise: **you cannot play it safe. Aggression is survival. Hesitation is death.**

Rouge-Engine is not a roguelike. It is a Rouge game — a genre defined by three interlocking mechanical pillars that did not exist before this document.

---

# 2. GENRE & PLATFORM

**Genre:** Rouge (new genre — see Section 3), Top-Down Action, Gothic Sci-Fi Bio-Mecha

**Platform:** Web Browser (HTML5 Canvas, Vanilla JS ES6 Modules), with Electron desktop packaging

**Target Audience:** Players who enjoy high-pressure action games, body horror aesthetics, emergent strategy, and systems that punish passivity

**Tone:** Visceral, oppressive, beautiful in its brutality. The world is dying. Your mech is dying. Everything you touch bleeds. Keep moving.

**Session Length:** 20-45 minutes per run (target). Designed for replayability through procedural generation and organ build variance.

---

# 3. CORE PHILOSOPHY

Rouge-Engine defines a new genre — the **Rouge Game** — distinct from the Roguelike in three fundamental ways:

| Property | Roguelike | Rouge Game |
|---|---|---|
| Map Generation | Random per run | Dynamically altered by player action |
| Health System | Passive meter | Active fuel — drains constantly |
| Equipment | Found in chests | Ripped from enemy bodies, decays in real time |
| Pacing | Cautious, methodical | Forced aggression — stillness = death |
| Build Permanence | Lasts the run | Rotting away every few minutes |

The word "Rouge" is intentional and carries dual meaning — the French word for red, and the red organic fluid that is simultaneously your health, your ammunition economy, your map paint, and your countdown to death.

---

# 4. THE THREE PILLARS

Every system in Rouge-Engine connects back to three foundational pillars. If a feature does not touch at least one pillar, it does not belong in the game.

**Pillar 1 — Rouge-Drain:** Your biological mech is constantly dying. Rouge fluid depletes every second. The only way to survive is to kill.

**Pillar 2 — Rouge-Shift:** Spilled Rouge permanently transforms the environment. The map you end with is never the map you started with. You are the level designer.

**Pillar 3 — Rouge-Graft:** Organs ripped from fallen enemies grant immense power but accelerate your drain and rot away in minutes. Your build is always temporary. Adaptation is mandatory.

These three pillars create a single unified loop: **Kill to survive. Kill to reshape. Kill to become. But becoming costs you time you don't have.**

---

# 5. CORE GAME LOOP

```
[ ENTER FLOOR ]
       │
       ▼
[ ROUGE DRAINS — Clock is always running ]
       │
       ▼
[ ENGAGE ENEMIES — Forced by drain pressure ]
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
[ SPILL ROUGE ON ENVIRONMENT ]         [ KILL ENEMY — Drops Organ ]
       │                                          │
       ▼                                          ▼
[ TILES TRANSFORM ]                    [ GRAFT ORGAN ONTO MECH ]
  Walls dissolve                         Power spikes dramatically
  Chasms bridge                          Drain rate multiplies
  Doors open                             Decay timer begins
  Speed lanes form                               │
       │                                          ▼
       └──────────────────────────────────────────┤
                                                  │
                                         [ ORGAN ROTS AWAY ]
                                         Find next kill fast
                                                  │
                                                  ▼
                                       [ REACH FLOOR EXIT ]
                                       Next floor — harder
                                                  │
                                                  ▼
                                          [ BOSS FLOOR ]
                                       Kill boss — run complete
```

The loop has no safe state. Every decision feeds back into every other system.

---

# 6. PLAYER CHARACTER — THE PILOT & THE MECH

## The Pilot — Elias-7

The pilot is a human consciousness uploaded into a bio-mechanical chassis designated Elias-7. The mech is not a vehicle — it is a living organism that Elias-7 inhabits. The mech hungers. It bleeds. It adapts to whatever organs are grafted into it.

**Lore Fragment:** *"The Corps said the chassis would feel like a second skin. They were right. It also gets infected. It also rots. They forgot to mention that part."*

## Base Mech Stats

| Stat | Base Value | Notes |
|---|---|---|
| Rouge Capacity | 100 units | Maximum fuel |
| Base Drain Rate | 5 units/sec | Increases with grafts |
| Base Move Speed | 4 px/tick | Modified by terrain and grafts |
| Base Attack Damage | 15 | Modified by active graft |
| Attack Range | 80px radius | Melee/ranged varies by graft |
| Siphon Radius | 32px | Range to vacuum Rouge from corpse |
| Siphon Rate | +20 Rouge | Per corpse contact |

## Mech Visual States

The mech's appearance changes dynamically based on game state:

- **Healthy (>60% Rouge):** Clean white chassis, red trim, steady pulse glow
- **Wounded (30-60% Rouge):** Chassis cracks visible, pulse flickers
- **Critical (<30% Rouge):** Chassis fracturing, red warning glow, audio heartbeat
- **Grafted:** Visible bio-mechanical extensions attached to chassis, color reflects organ type
- **Grafted + Decaying:** Extensions darken, flicker, visually rot and shrink as timer depletes

---

# 7. THE ROUGE SYSTEM (FUEL & ECONOMY)

Rouge is the game's singular resource. It is everything simultaneously.

## What Rouge Is

- **Health:** If it hits zero, the mech dies
- **Ammunition cost:** Every attack expends Rouge
- **Map paint:** Spilled Rouge from enemies transforms tiles
- **Fuel:** The constant drain that forces aggression
- **Currency of power:** Organs consume it faster in exchange for strength

## Rouge Sources

| Source | Amount Gained | Condition |
|---|---|---|
| Enemy corpse siphon | +20 Rouge | Walk over dead enemy |
| Elite enemy corpse | +35 Rouge | Walk over elite corpse |
| Boss kill | +60 Rouge | Boss death |
| Blood pool tile | +2 Rouge/sec | Standing on saturated tile (passive) |
| Ventricle-Pump graft | Reduces drain | Passive while equipped |

## Rouge Costs

| Action | Cost |
|---|---|
| Passive drain (no graft) | 5/sec |
| Attack (default pulse) | 3 per shot |
| Movement (sprinting) | +1/sec additional |
| Graft drain multiplier | Varies (see Organ Registry) |

## Rouge Floor Saturation

When blood particles land on tiles they increase that tile's Rouge Saturation (0-100). Saturation is permanent within a run and drives all Rouge-Shift transformations.

---

# 8. THE ROUGE-SHIFT SYSTEM (ENVIRONMENTAL TRANSFORMATION)

The Rouge-Shift system is the map engine. The environment is not static — it is a canvas that players paint with enemy blood, permanently altering traversal, hazards, and opportunities.

## Tile Types

| Tile ID | Name | Base State | Transformed State | Trigger |
|---|---|---|---|---|
| 0 | Floor | Grey metal plate | Blood-slicked speed lane | Saturation > 20 |
| 1 | Wall | Iron barrier | Dissolved gap | Saturation > 80 OR Acidic-Kidney graft active |
| 2 | Chasm | Impassable void | Blood bridge (walkable) | Saturation > 80 |
| 3 | Bio-Door | Sealed gate | Open passage | Saturation > 60 on adjacent tiles |
| 4 | Bio-Generator | Dormant machine | Active hazard or power source | Saturation > 40 |
| 5 | Corpse Pit | Empty depression | Rouge pool (passive healing) | Saturation > 90 |
| 6 | Spore Vent | Sealed vent | Releases toxic cloud | Saturation > 50 |

## Saturation Mechanics

- Blood particles are emitted from enemies when hit (15 particles per hit, more on kill)
- Each particle travels with physics (velocity, friction) before settling on a tile
- On settling, the tile's saturation increases by 1 per particle
- Saturation is **permanent** within a run — it never decreases
- Visual: tiles shift from grey to deep crimson as saturation increases, with fluid pooling effects

## Strategic Implications

Players must think about **where** they fight:

- Execute enemies near chasms to bridge them
- Flood walls near secret rooms to dissolve access
- Saturate floor tiles on retreat paths to gain speed advantage
- Lure enemies into rooms you want transformed before killing them

The Acidic-Kidney graft triples corrosion speed on walls, enabling rapid environmental editing.

## Rouge-Shift Events (Special Tile Interactions)

| Event | Trigger | Effect |
|---|---|---|
| Blood Bridge Formed | Chasm reaches 80 sat. | Passage opens, players can cross |
| Wall Dissolution | Wall HP reaches 0 | Permanent gap created |
| Bio-Door Unlock | Adjacent tiles avg. >60 sat. | Gate opens permanently |
| Speed Lane Activation | Floor tile >20 sat. | Player speed ×1.75 on that tile |
| Generator Awakening | Generator >40 sat. | Deals 10 damage/sec to enemies in range |
| Corpse Pit Healing | Pit >90 sat. | Passive +2 Rouge/sec to player standing in it |

---

# 9. THE ROUGE-GRAFT SYSTEM (ORGAN ASSIMILATION & DECAY)

The Rouge-Graft system is the build system. There are no inventory screens, no equipment menus, no chests. Progression happens mid-combat, violently, with immediate consequences.

## Graft Acquisition Flow

1. Enemy dies — drops their signature organ as a glowing corpse marker
2. Player clicks near corpse within 3 seconds (organ degrades after 3 seconds unclaimed)
3. Organ is violently grafted onto mech chassis — visible as bio-mechanical extension
4. Organ's drain multiplier immediately activates
5. Organ's decay timer begins counting down
6. At decay end — organ calcifies, fractures, falls off mech
7. Player is back to default pulse until next graft

## Decay Visual Stages

| Life Remaining | Visual State | Audio |
|---|---|---|
| 100% - 60% | Healthy red-pink, pulsing | Wet organic heartbeat |
| 60% - 35% | Darkening, surface cracking | Irregular pulse |
| 35% - 15% | Flickering, necrotic brown | Arrhythmic, distorted |
| 15% - 0% | Violent flicker, near-black | Rapid flatline warning |
| 0% | Explosion of black particles, falls off | Crack + silence |

## Graft Stacking (Advanced Rule)

Players may carry **one primary graft** and **one secondary graft** simultaneously. Secondary grafts provide passive bonuses only (no active ability). Both drain simultaneously. This creates complex risk/reward decisions — a Myoblast-Jaw primary with a Tumor-Chassis secondary gives massive offense and defense but drains Rouge at catastrophic rates.

---

# 10. THE ROUGE-DRAIN SYSTEM (FUEL AS TIMER)

The Rouge-Drain is the invisible hand that forces every decision. It cannot be turned off. It cannot be fully negated. It can only be managed.

## Drain Rate Formula

```
Total Drain = Base Drain (5/sec)
            × Primary Graft Multiplier
            × Secondary Graft Multiplier (if equipped)
            + Sprint Cost (1/sec if sprinting)
            + Attack Cost (3 per shot)
```

## Drain Rate Examples

| Configuration | Drain Rate |
|---|---|
| No graft, walking | 5/sec |
| No graft, sprinting | 6/sec |
| Gatling-Lung equipped | 12.5/sec |
| Myoblast-Jaw + Tumor-Chassis | 35/sec |
| Ventricle-Pump equipped | 4/sec |

## Psychological Design Intent

The drain system is designed to create a specific emotional state: **controlled panic.** The player is never comfortable. They are always calculating. Every moment of stillness feels like bleeding out. Every kill feels like a gasp of air. The game should feel like drowning and swimming simultaneously.

At 30% Rouge remaining, the HUD pulses red. At 15%, the screen vignette deepens. At 5%, the audio becomes a single sustained heartbeat. These are not just visual flourishes — they are escalating stress responses designed to push players toward desperate, creative decisions.

---

# 11. ENEMY DESIGN & BESTIARY

All enemies carry a signature organ that drops on death. Enemy design is driven by three principles: **readable silhouette**, **predictable behavior pattern**, **valuable organ drop**.

## Standard Enemies

### The Husk
- **HP:** 40 base (scales +10 per floor)
- **Behavior:** Direct chase. No special abilities. Pure pressure enemy.
- **Organ Drop:** Blade-Scapula (melee damage)
- **Rouge Value:** +20 on siphon
- **Design Note:** The Husk is the tutorial enemy. Players learn siphoning from Husks.

### The Spitter
- **HP:** 30 base
- **Behavior:** Maintains distance, fires acidic projectiles that leave saturation on tiles
- **Organ Drop:** Acidic-Kidney (wall corrosion)
- **Rouge Value:** +20 on siphon
- **Design Note:** The Spitter inadvertently assists the player by painting tiles, even when it's still alive. Players learn that not all enemy actions are purely negative.

### The Charger
- **HP:** 60 base
- **Behavior:** Stationary until player enters range, then lunges in straight line
- **Organ Drop:** Ventricle-Pump (drain reduction)
- **Rouge Value:** +25 on siphon
- **Design Note:** The lunge leaves a trail of Rouge on tiles it passes through, creating instant speed lanes.

### The Crawler
- **HP:** 25 base
- **Behavior:** Fast, erratic movement, swarms in groups of 3-4
- **Organ Drop:** Capillary-Eye (crit chance)
- **Rouge Value:** +15 on siphon (low value, high volume)
- **Design Note:** Crawlers reward area attacks. Killing a group simultaneously floods a large tile area with saturation.

### The Brute
- **HP:** 120 base
- **Behavior:** Slow, heavily armored, deals massive melee damage on contact
- **Organ Drop:** Tumor-Chassis (armor/defense)
- **Rouge Value:** +35 on siphon
- **Design Note:** The Brute forces players to kite carefully, painting wide areas with saturation before finishing it.

### The Leech
- **HP:** 45 base
- **Behavior:** Attempts to latch onto player and drain Rouge directly
- **Organ Drop:** Tendril-Aorta (pulls enemies)
- **Rouge Value:** +30 on siphon
- **Design Note:** Leeches must be killed quickly — they are the most threatening standard enemy in terms of rouge economy.

## Elite Enemies (Rare spawns, 1 per floor minimum)

Elite enemies have 2.5× base HP, deal 1.5× damage, drop higher-tier organs, and yield +35 Rouge on siphon.

### The Revenant
- **Behavior:** Teleports to player location after 2 second wind-up
- **Organ Drop:** Myoblast-Jaw (life steal on bite)
- **Special:** Leaves Rouge explosion on teleport origin — guaranteed tile saturation

### The Architect
- **Behavior:** Constructs temporary walls mid-combat to alter player pathing
- **Organ Drop:** Gatling-Lung (rapid fire ranged)
- **Special:** Walls it builds can be destroyed with rouge saturation — killing the Architect floods its constructed walls

---

# 12. ORGAN REGISTRY (FULL GRAFT CATALOG)

| Organ ID | Name | Type | Drain Mult | Decay (sec) | Primary Effect | Secondary Effect |
|---|---|---|---|---|---|---|
| ORG-01 | Gatling-Lung | Ranged | ×2.5 | 6 | Rapid-fire projectiles (8 dmg, 0.1s cooldown) | +15% projectile spread |
| ORG-02 | Blade-Scapula | Melee | ×1.5 | 8 | Heavy melee swing (25 dmg, 0.5s cooldown) | Knock-back on hit |
| ORG-03 | Ventricle-Pump | Utility | ×0.8 | 5 | Reduces base drain by 20% | Passive +1 Rouge/sec |
| ORG-04 | Acidic-Kidney | Hazard | ×1.8 | 7 | Projectiles corrode walls (×3 saturation rate) | Leaves acid trail on movement |
| ORG-05 | Tendril-Aorta | Ranged | ×2.0 | 6 | Fires tendril that pulls enemies toward player | Pulled enemies take +25% damage |
| ORG-06 | Myoblast-Jaw | Melee | ×3.0 | 4 | Bite attack heals 15 Rouge per hit | Heals double on killing blow |
| ORG-07 | Capillary-Eye | Utility | ×1.2 | 10 | 40% critical hit chance on all attacks | Crits produce 2× blood particles |
| ORG-08 | Tumor-Chassis | Defense | ×4.0 | 5 | Absorbs 10 damage per hit (armor) | Reflects 5 damage to attacker |
| ORG-09 | Neuron-Spine | Utility | ×1.6 | 9 | Reveals all enemies on floor minimap | +10% movement speed |
| ORG-10 | Hemorrhage-Fist | Melee | ×2.2 | 7 | Single massive punch (50 dmg, 1.2s cooldown) | Creates large rouge explosion on kill |

## Organ Synergy System

Certain organ combinations create emergent synergies:

| Primary | Secondary | Synergy Effect |
|---|---|---|
| Capillary-Eye | Gatling-Lung | Crits fire triple shot burst |
| Myoblast-Jaw | Ventricle-Pump | Healing bites restore 25 Rouge instead of 15 |
| Acidic-Kidney | Hemorrhage-Fist | Punches leave permanent acid pools |
| Tendril-Aorta | Blade-Scapula | Pulled enemies are auto-struck on arrival |
| Tumor-Chassis | Myoblast-Jaw | Armor reflection also heals player |

---

# 13. LEVEL ARCHITECTURE & PROCEDURAL GENERATION

## Grid System

- Tile size: 40×40px
- Standard floor: 30 columns × 20 rows (1200×800px canvas)
- Each tile stores: type, rougeSaturation (0-100), hp (for destructible tiles)

## Floor Generation Algorithm

Floors are generated using a **seeded room-corridor system** with guaranteed traversability:

1. **Seed rooms:** Place 4-6 rectangular rooms of varying size across the grid
2. **Connect corridors:** L-shaped corridors connect each room to at least one other
3. **Place features:** Bio-Doors, Chasms, and Generators placed at strategic chokepoints
4. **Scatter walls:** Internal walls placed randomly (density scales with floor number)
5. **Guarantee exit:** Floor exit always placed bottom-right quadrant
6. **Enemy placement:** Enemies spawn in rooms away from player start position
7. **Validate traversability:** Pathfinding check ensures exit is reachable from start

## Floor Themes (Visual Variants)

| Floor Range | Theme | Visual Palette | Special Tile Rules |
|---|---|---|---|
| 1-3 | Sterile Laboratory | Grey-white, clean lines | More walls, fewer chasms |
| 4-6 | Organic Corridors | Dark red, bio-material surfaces | More bio-doors, living walls |
| 7-9 | Deep Core | Black, glowing red veins | More chasms, fewer walls |
| 10 | The Singularity Chamber | Pure black, white grid | Boss arena — custom layout |

## Secret Rooms

Each floor has a 30% chance to contain a hidden room:
- Accessible only by dissolving a specific wall with rouge saturation
- Contains a guaranteed elite organ drop
- Contains a rouge pool tile for passive healing
- No enemies — pure reward for environmental mastery

---

# 14. FLOOR PROGRESSION & RUN STRUCTURE

## Run Structure

A standard run consists of 10 floors:

| Floor | Type | Enemy Count | Notable Feature |
|---|---|---|---|
| 1 | Tutorial | 4 Husks | Gentle introduction, wall to dissolve for secret |
| 2 | Standard | 6 mixed | First chasm appears |
| 3 | Standard | 8 mixed | First elite enemy |
| 4 | Pressure | 10 mixed | Higher drain rate +10% |
| 5 | Mini-Boss | 8 + 1 mini-boss | Mini-boss drops unique organ |
| 6 | Standard | 12 mixed | Bio-door puzzles |
| 7 | Swarm | 20 Crawlers | Volume pressure test |
| 8 | Pressure | 14 mixed | Higher drain rate +25% |
| 9 | Elite Gauntlet | 6 elite enemies | Organ economy challenge |
| 10 | Boss | Custom layout | Final boss — run conclusion |

## Floor Drain Scaling

Each floor increases base drain rate slightly:
- Floors 1-3: Base ×1.0
- Floors 4-6: Base ×1.1
- Floors 7-9: Base ×1.25
- Floor 10: Base ×1.0 (boss fight — pure skill test)

## Run Failure States

- **Core Flatline:** Rouge hits zero — instant death, run ends
- **Organ Cascade:** Three organs decay simultaneously while at <20% Rouge — near-instant death scenario
- **Siphon Drought:** No corpses available and fuel critical — environmental skill check

## Run Success

- Defeat the Floor 10 boss
- Post-run: Statistics screen showing floors cleared, organs grafted, tiles transformed, total rouge spent
- No persistent progression — each run is self-contained (by design)

---

# 15. BOSS DESIGN

## Floor 5 Mini-Boss — The Amalgam

The Amalgam is a failed grafting experiment — a mass of mismatched organs fused together into a single thrashing creature.

**HP:** 400
**Phase 1 (100%-50% HP):** Uses Tendril-Aorta attacks to pull player. Leaves massive rouge trails.
**Phase 2 (50%-0% HP):** Begins shedding organs as projectiles. Each shed organ lands as a graftable pickup but decays in 2 seconds.
**Organ Drop:** Random elite organ
**Design Note:** The Amalgam teaches players that bosses transform the environment heavily — the arena will be heavily saturated by the time it dies.

## Floor 10 Final Boss — The Sovereign Core

The Sovereign Core is the original bio-mech — the first chassis ever built, now fully corrupted and running on pure Rouge with no pilot. It remembers what it was. It hates what it became.

**HP:** 1200
**Phase 1 (100%-70% HP):** Summons Husks continuously. Forces players to siphon mid-boss fight.
**Phase 2 (70%-40% HP):** Begins using Rouge-Shift — it actively saturates tiles to create hazards (lava tiles, speed lanes for itself).
**Phase 3 (40%-0% HP):** Attaches stolen organs to itself visibly. Each active organ gives it abilities. Player must graft counter-organs to negate them.
**Death:** Massive rouge explosion saturates every tile in the arena. The screen floods red. Elias-7 stands in the center of a completely transformed world.

**Lore Fragment:** *"The Sovereign didn't malfunction. It evolved. It just forgot that evolution requires something worth becoming."*

---

# 16. UI & HUD DESIGN

## HUD Elements

All HUD elements are diegetic where possible — they feel like part of the mech's interface, not floating game UI.

**Rouge Meter (Primary HUD)**
- Large vertical bar on left side of screen
- Filled with animated liquid red fluid that sloshes when player moves
- Pulses at <30%, flashes at <15%
- Drain rate displayed as small number below bar

**Graft Display (Right Side)**
- Shows current primary and secondary graft as organic silhouettes
- Decay shown as the silhouette darkening from bottom to top
- Flickers when <35% life remaining
- Empty socket shown as hollow outline when no graft equipped

**Floor Indicator (Top Center)**
- Current floor number
- Minimal — one line of monospace text

**Minimap (Top Right)**
- Small grid representation of current floor
- Shows player position, explored tiles, enemy positions (if Neuron-Spine equipped)
- Rouge saturation shown as red tinting on minimap tiles

## Death Screen

Full screen red flood. Text appears slowly:
*"CORE FLATLINE"*
*"Floor [X] — [Y] organs grafted — [Z] tiles transformed"*
*"[ RESTART ]"*

---

# 17. AUDIO DESIGN DIRECTION

All audio generated via Web Audio API — zero external files required.

## Soundscape Pillars

**The Heartbeat:** A constant low pulse plays throughout every run. Its tempo matches the player's Rouge level — faster at low fuel, slower at high fuel. It is the game's musical backbone.

**The Graft Sound:** Each organ type has a distinct sound signature on equip. Mechanical organs (Gatling-Lung) sound industrial. Biological organs (Myoblast-Jaw) sound wet and organic. Utility organs (Capillary-Eye) sound electronic.

**The Decay Sound:** As organs rot, their sound signature degrades — distortion increases, pitch drops, glitching artifacts appear. The audio tells you the organ is dying before the visual does.

**The Shift Sound:** When a tile transforms, it emits a specific sound. Wall dissolution sounds like tearing metal. Chasm bridging sounds like flesh hardening. Bio-door opening sounds like a valve releasing pressure.

## Key Audio Moments

| Moment | Sound Design |
|---|---|
| Game Start | Mech powering up — hydraulics, wet organic sounds |
| Low Rouge (<30%) | Heartbeat tempo doubles, bass drone begins |
| Critical Rouge (<15%) | Single sustained flatline undertone |
| Graft equipped | Wet tearing sound, then organ-specific signature |
| Organ decaying | Increasing distortion on organ signature |
| Organ falls off | Crack, silence, one beat of nothing |
| Enemy killed | Pressurized burst — wet explosive release |
| Tile transformed | Environmental specific (see above) |
| Boss encounter | All ambient audio strips away, single bass pulse begins |
| Run complete | Full silence, then slow ascending chord |

---

# 18. VISUAL & ART DIRECTION

## Aesthetic: Gothic Sci-Fi Bio-Mecha

The visual language sits at the intersection of three influences:
- **Industrial Gothic:** Dark iron, corroded metal, oppressive geometry
- **Biopunk:** Living machines, organic technology, wet surfaces
- **Neon Decay:** Deep blacks with saturated red as the sole accent color

Rouge (red) is the only warm color in the game. Everything else is cold — grey metal, black void, deep blue shadow. This makes every drop of rouge visually explosive against the environment.

## Rendering Approach (Canvas 2D)

- All rendering is Canvas 2D — no WebGL required
- Tile-based environment with overlay saturation rendering
- Player and enemies rendered as geometric shapes with bio-mechanical extensions
- Particle system for blood spray (physics-based, settles to tile saturation)
- Post-processing effects via canvas compositing (glow, vignette, flicker)

## Color Palette

| Color | Hex | Usage |
|---|---|---|
| Void Black | #0d0d10 | Background, deep shadow |
| Iron Grey | #4a4e69 | Walls, structural elements |
| Floor Plate | #22252c | Default floor tiles |
| Rouge Red | #ba041c | Blood, saturation overlay, HUD |
| Bright Rouge | #ff3333 | Blood particles, critical alerts |
| Necrotic Brown | #4f121a | Decaying organs, late-stage graft |
| Bio-Gold | #ffb703 | Bio-doors, interactive elements |
| Pilot White | #f8f9fa | Player mech base color |
| Void Deep | #0d0e15 | Chasm, impassable tiles |

---

# 19. TECHNICAL ARCHITECTURE

## Module Structure (ES6)

```
rouge-engine/
├── index.html
├── main.js              (Entry point, game loop, event bus)
├── modules/
│   ├── MapEngine.js     (Grid, tile types, saturation, generation)
│   ├── FluidEngine.js   (Blood particle physics, settling logic)
│   ├── GraftRegistry.js (Organ definitions, graft logic, decay)
│   ├── EnemySystem.js   (Enemy types, AI, spawning, death)
│   ├── PlayerSystem.js  (Mech stats, movement, drain calculation)
│   ├── CombatSystem.js  (Attack resolution, damage, siphon)
│   ├── RenderEngine.js  (All canvas drawing, visual effects)
│   ├── AudioEngine.js   (Web Audio API, heartbeat, sound design)
│   ├── UISystem.js      (HUD, death screen, statistics)
│   └── EventBus.js      (Decoupled inter-module communication)
├── data/
│   ├── organs.js        (ORGAN_REGISTRY data)
│   ├── enemies.js       (ENEMY_REGISTRY data)
│   └── floors.js        (FLOOR_CONFIG data)
└── utils/
    ├── math.js          (Vector math, collision helpers)
    └── rng.js           (Seeded random, procedural tools)
```

## EventBus Architecture

All modules communicate through the EventBus — no module imports another module directly. This prevents spaghetti dependencies.

```javascript
// Example: Enemy death triggers multiple systems
EventBus.emit('enemy:death', { x, y, organId, rougeValue });

// MapEngine listens — spawns blood particles
EventBus.on('enemy:death', ({ x, y }) => FluidEngine.spawnBurst(x, y, 15));

// PlayerSystem listens — player gains siphon opportunity
EventBus.on('enemy:death', ({ rougeValue }) => PlayerSystem.markSiphon(rougeValue));

// GraftRegistry listens — organ becomes available
EventBus.on('enemy:death', ({ organId, x, y }) => GraftRegistry.dropOrgan(organId, x, y));
```

## Performance Targets

- 60fps stable on modern browsers
- Maximum 500 active blood particles simultaneously (pool management)
- Maximum 20 active enemies simultaneously
- Tile saturation rendering via pre-computed overlay cache (dirty flag pattern)

## Save System

Rouge-Engine uses no persistent save — by design. Each run is self-contained. The only data persisted is:
- Best floor reached (localStorage)
- Total lifetime organs grafted (localStorage)
- Total lifetime tiles transformed (localStorage)

These feed a metagame statistics screen accessible from the main menu.

---

# 20. MILESTONE ROADMAP

## Phase 1 — Foundation (Days 1-2)
Target: Playable mechanical slice with all three pillars functional

- [ ] Grid map rendering (tiles, walls, chasms)
- [ ] Player movement with collision
- [ ] Rouge drain system (base rate, death on zero)
- [ ] Basic enemy (Husk) — spawn, chase, death
- [ ] Siphon mechanic on corpse contact
- [ ] Blood particle physics (spawn, travel, settle)
- [ ] Tile saturation tracking and visual overlay
- [ ] Wall dissolution via saturation
- [ ] Single graft (Blade-Scapula) — equip, drain mult, decay timer
- [ ] Decay visual (darkening, flicker)
- [ ] Basic HUD (rouge bar, graft display)

**Phase 1 Success Criterion:** A player can enter a room, fight enemies, paint the walls with blood, dissolve a wall to access a new area, graft an organ, watch it rot, and die when rouge hits zero.

## Phase 2 — Fluid Mechanics (Day 2-3)
Target: Full Rouge-Shift system and all tile types

- [ ] Chasm bridging via saturation
- [ ] Bio-door unlocking via adjacent saturation
- [ ] Speed lane activation on saturated floor tiles
- [ ] Bio-Generator awakening
- [ ] Corpse pit healing pool
- [ ] Spore vent activation
- [ ] Acidic-Kidney graft (wall corrosion bonus)
- [ ] Blood particle pool management (500 cap)
- [ ] Minimap with saturation display

## Phase 3 — Organ System (Day 3)
Target: Full graft catalog and enemy bestiary

- [ ] All 10 organs implemented
- [ ] Secondary graft slot
- [ ] Organ synergy system
- [ ] All 6 standard enemy types
- [ ] Both elite enemy types
- [ ] Enemy organ drop system with 3-second claim window
- [ ] Organ pickup visual (glowing corpse marker)

## Phase 4 — Procedural Generation & Run Structure
Target: Full 10-floor run with boss

- [ ] Procedural floor generation algorithm
- [ ] Floor themes (4 visual variants)
- [ ] Secret room system
- [ ] Floor transition (exit tile)
- [ ] Drain rate scaling per floor
- [ ] Floor 5 mini-boss (The Amalgam)
- [ ] Floor 10 boss (The Sovereign Core, all 3 phases)
- [ ] Death screen with statistics
- [ ] Run complete screen
- [ ] Main menu
- [ ] Persistent best-run statistics

---

# 21. BALANCE PHILOSOPHY

## The Funnel Principle

Every balance decision funnels toward one outcome: **the player must kill more than they rest.**

A run where the player kills efficiently and grafts aggressively should always feel faster, more powerful, and more survivable than a cautious run — even if the cautious player takes less damage. The game rewards aggression mathematically.

## Drain Rate Calibration

Base drain (5/sec) with a full tank (100) gives 20 seconds of life with no kills. This is intentional — 20 seconds is enough time to engage one enemy group and siphon. Players who kill efficiently will maintain high rouge levels throughout. Players who hesitate will die on their first encounter.

## Organ Risk/Reward Curve

The most powerful organs (Tumor-Chassis, Myoblast-Jaw) have the highest drain multipliers. A player who grafts Tumor-Chassis (×4.0 drain) needs to kill roughly 4× faster than baseline to maintain the same rouge level. This is achievable — but only with skill.

## Floor Difficulty Scaling

Enemy HP scales linearly (+10 per floor). Enemy count scales gradually (4 on floor 1, 14 on floor 8). Drain rate scales at floor thresholds rather than continuously — this creates clear difficulty steps that players can adapt to rather than smooth but invisible escalation.

---

# 22. FUTURE SCOPE (POST-LAUNCH)

The following features are out of scope for the initial build but represent the natural evolution of the Rouge-Engine genre:

**Pilot Customization:** Elias-7's base stats can be altered at run start. Choose a high-drain chassis (more power, faster death) or a low-drain chassis (longer life, less damage).

**Organ Mutation System:** Organs that are equipped for a second time in a single run mutate into upgraded versions with additional effects.

**The Archive:** A lore system that unlocks narrative fragments based on specific in-run achievements — dissolve 50 walls in one run, encounter specific organ combinations, reach floor 10 without any graft.

**Multiplayer Concept (Long-term):** Two pilots in the same floor. One player's rouge contributions to tile saturation benefit both. Organ drops split between players. Shared drain pool.

**The Sovereign's Memory (Endless Mode):** After completing a standard run, an endless mode unlocks where floor generation continues indefinitely and drain rate increases permanently every 3 floors.

---

*Rouge-Engine Game Design Document v1.0*
*TattershallStudios — All concepts, mechanics, and design elements are original intellectual property*
*Document authored in collaboration with Anthropic Claude — May 2026*

---

**"The Corps said the chassis would feel like a second skin. They were right. It also gets infected. It also rots. They forgot to mention that part."**

*— Elias-7, Pilot Log Entry 1*
