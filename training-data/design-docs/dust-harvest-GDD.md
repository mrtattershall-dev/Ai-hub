# DUST & HARVEST — GAME DESIGN DOCUMENT
### Version 13+ Roadmap
*"You came out here with a hoe and a debt. The railroad took everything else."*

---

## OVERVIEW

Dust & Harvest is a top-down desert survival farming RPG with a living economy, real-time combat, and an expanding open world built on a connected grid system. It started with 4 crops and a $10 weekly debt. It is becoming a continent.

**Core Loop:** Farm → Sell → Pay debt → Explore → Discover → Repeat  
**Emotional Arc:** Trapped by debt → Stabilized → Curious → Seeking truth → Free  
**Engine:** Single HTML file (ES6 migration in progress), Web Audio API, Canvas 2D

---

## CURRENT STATE — v12.1

### World Grid (existing)
```
[ Badlands  ] [ Main Farm  ]
[ Badlands  ] [ Town/Road  ]
              [ Wilderness ]
              [ Mine       ]
```

### What exists
- Free-form tillable dirt farm (not grid-locked)
- 19 crop types with real grow times
- Living market economy with events, volatility, seasonal bonuses
- Weekly escalating debt system ($500 week 1, +$200 per week)
- Day/night cycle with dynamic BGM (day/night/combat themes)
- Synthesized audio — banjo, bass, percussion, wind — all Web Audio API
- Fog of war — Uint8Array per zone, seeded LCG fog rendering
- 3-floor mine with hazards (cave-ins, gas pockets, rich veins)
- Mine NPC: Silas — branching dialogue, dark headlamp, hears singing
- Badlands zone with heat system, bounty board, Crane NPC
- Ranch system — 7 animal types, placeable pens, mood system
- Crafting, smelting, cooking systems
- Traveling merchant (leaves at dusk, returns every 3-5 days)
- Farmhand Jed — hireable for watering, tilling, harvesting, reviving
- Farm chest storage, workbench, campfire cooking, sprinklers
- Minimap with fog of war — switches between overworld/mine/badlands modes
- Save system with base64 encoded fog state
- Peaceful/Normal/Hard difficulty
- Debt-free ending screen with starfield animation

---

## THE CONNECTED GRID — v13+ TARGET

```
[ 2nd Farm  ] [ Hobo Camp  ]
[ Badlands  ] [ Main Farm  ]
[ Badlands  ] [ City       ]
              [ Ocean      ]
```

Every zone connects physically. Walk to the edge and transition. Already works — same system as mine and badlands entry.

---

## ZONE ROADMAP

---

### ZONE: OCEAN (East of Main Farm)

**Vibe:** Escape. Hope. The unknown. People trying to leave.

**Access:** Walk east from the main farm past the wilderness edge.

**Geography:**
- Dock area — weathered planks, gulls, salt smell implied by amber/blue palette
- Open water extending east — fog of war hides what's out there
- Ship moored at dock — upgradeable over time

**Core Mechanic — The Boat:**
Upgrade tree mirrors the tool upgrade system:
- Rowboat → Frontier Vessel → Reinforced Hull → Armed Schooner
- Each tier unlocks new ocean content and travel distance
- Built from planks, rope, iron fittings — all craftable from existing resources

**Dock Upgrade Tree:**
- Basic Dock — access to shallow water fishing, merchant visits
- Extended Pier — deeper water, better fish, rare catches
- Fortified Dock — withstands storm damage
- Lighthouse — attracts rare traders, reduces night pirate spawn

**Ocean NPC — The Dockmaster:**
- Name TBD — weathered, practical, not unfriendly
- Sells boat parts, fishing gear, ocean charts
- Dialogue hints at what's east — islands, ruins, other settlements
- Knows things about the railroad. Won't say them directly.

**Activities:**
- Deep sea fishing — new fish types, rare catches, different rod required
- Trade routes — sail to a distant point, buy low, sell high back at dock
- Island exploration — small procedural islands with loot, encounters, lore fragments
- Pirate battles at night — enemy ships attack the dock after dark
  - Defend the dock or lose ship upgrades
  - Pirates drop rare nautical loot — maps, compasses, foreign coin
  - Heat system mirrors badlands — more kills = harder attackers = better drops

**Narrative Hook:**
The people at the dock are trying to leave. Some are from the city. Some came through the hobo camp. One of them used to work the railroad that took Elias's old life. They're not going anywhere until they can afford passage. They need things. They know things.

---

### ZONE: CITY (South of Main Farm)

**Vibe:** Civilization. Complicated. The market has competition.

**Access:** Walk south from main farm past the road.

**Geography:**
- Larger than the town — proper streets, buildings, districts
- Market district, residential area, a sheriff's office, a saloon
- Visible from the main farm on the horizon early game — you know it's there

**Why it matters narratively:**
The city is where the railroad money went. The company that built the line that took everything from Elias — their office is here. Their name is on a building. This is personal.

**Economic Impact:**
- City market runs parallel to the frontier market
- Different prices, different demand — creates arbitrage opportunities
- City contracts pay more but require larger quantities and tighter deadlines
- Some goods are only valuable in the city (refined products, rare crops)
- Some goods are only available in the city (city-exclusive seeds, equipment)

**NPCs:**
- Railroad Company Representative — office on main street, dialogue about the land acquisition
- Sheriff — contracts, bounties, law enforcement flavor
- Saloon keeper — rumors, information broker, side quests
- Various townsfolk — lore delivery, flavor dialogue

**Narrative Hook:**
The railroad didn't just take Elias's old life randomly. There's a reason that specific land was acquired. The city holds records. Someone in that office knows what was really going on — and what's underground.

---

### ZONE: HOBO CAMP (North of Main Farm)

**Vibe:** People who fell through. Stories. Sadness without despair.

**Access:** Walk north past the wilderness edge.

**Geography:**
- Makeshift camp — lean-tos, fire pits, a shared well
- Between the main farm and the ocean — these people tried to go east and didn't make it
- Or came from the city and fell out
- The geography implies their story before they say a word

**NPCs — The Residents:**
Each character has a reason for being here and a connection to the wider world.

Suggested roster:
- **Former railroad worker** — knows what the company was really doing
- **Ex-city clerk** — has documents. Technically stolen. Very relevant.
- **Farmer who lost their land** — parallel to Elias. Further down the road.
- **Doctor** — fell out of city practice. Trades medical supplies for food.
- **Young person heading to the ocean** — just needs enough money for passage

**Economy:**
- They need food — crops from your farm
- They have information, skills, unique items
- Barter system rather than gold — trade crops for lore, recipes, rare seeds
- Some quests: bring them enough food to get someone to the dock

**Narrative Function:**
The hobo camp is the human cost of the Collapse that Crane described. The eastern rail died. Towns vanished. These are the survivors. They fill in the world between what Silas knows and what Crane knows and what the city records say.

---

### ZONE: SECOND FARM (West of Hobo Camp, North of Badlands)

**Vibe:** Harder. More isolated. Higher risk, higher reward.

**Access:** Through the hobo camp or through the badlands — both routes are dangerous.

**Why it exists:**
Late game content. You've paid off the debt. You've stabilized the first farm. You want more. The second farm is that more.

**Differences from first farm:**
- Soil is different — different crops grow here, some exclusive to this location
- No starting infrastructure — build everything from scratch
- Adjacent to badlands on the south — enemies pressure the farm at night
- Adjacent to hobo camp on the east — creates natural supply chain opportunity
- Harsher weather — cold winter hits harder here, dry summer is brutal

**Mechanics:**
- Second farmhand NPC — different personality from Jed
- Separate storage, separate upgrade track
- Portal/fast travel between farms once established
- Animals from first ranch can be moved here

**Narrative:**
This land also has history. Something happened here before Elias arrived. The soil has a color that shouldn't be natural. Silas knows something about the land north of the badlands. He won't say it directly.

---

## THE MINE — FLOORS 4 AND 5

**Current state:** 3 floors, stops at crystal. Silas sits outside. The singing is unexplained.

**The Lore (to be revealed through play):**

The mining company drilled past the survey limit. The foreman found something on what would be floor 4. He never said what. A week later the first dust devil appeared in the badlands. A month later he was gone. The company stopped publishing surveys after floor 3.

Silas lost two partners. He heard the singing. He decided some things weren't his business. His headlamp is off.

**Floor 4 — The Forbidden Level:**

Unlocked after:
- Paying off the debt (proves investment in the world)
- Completing Silas's full dialogue tree
- Finding a specific item — the foreman's survey notes — hidden somewhere in the world

**What's on Floor 4:**
- Different visual language — not mine brown/grey, something older
- The ore isn't ore. It's something else. It has value but the market doesn't know what to call it.
- Environmental storytelling — abandoned equipment, personal effects, a journal
- The foreman's last entry explains what he found and why he stopped writing
- The singing — not a monster. Not a ghost. Something geological. Something old. Something that responds to presence.
- No combat. Pure exploration and dread.

**Floor 5 — Optional, Endgame:**

The singing is louder. The foreman's equipment is here. There's a decision to make. The game doesn't tell you what the right choice is. There may not be one.

**Silas's arc:**
- Root dialogue: guarded, practical
- After asking about singing: reveals more than he meant to
- After you've been to floor 2: he knows. He can tell. He asks you to be careful.
- After floor 3: he's quieter. Watching.
- After floor 4: his headlamp is on. He doesn't explain why.
- After floor 5: one final conversation. Whatever you found down there, he already knew. He just needed someone else to know it too.

---

## CRANE'S ARC

Crane runs freight without paperwork in the badlands. He doesn't ask questions about underground. The dust devils appeared after the mine went too deep. He knows the connection. He won't name it.

**Extended dialogue to add:**
- More on the Collapse — which towns specifically, what happened to the people
- The railroad company name — same name on the city building
- What the foreman's name was — someone in the hobo camp knew him
- Why Crane specifically came to the badlands — not just economics. He's watching something.

**Crane's endgame dialogue:**
After floor 4. He knows you went. He's been watching the dust devils.
"They calmed down today. First time in three years." He doesn't look up.
"Whatever you did down there — don't undo it."

---

## NARRATIVE SPINE

The full arc of Dust & Harvest across all zones:

**Act 1 — Survival (existing)**
Elias arrives with a hoe and a debt. The railroad took his old life. He farms. He pays. He explores the immediate world.

**Act 2 — Discovery**
The debt is paid or nearly paid. The world opens. The mine goes deeper. The hobo camp has people who know things. The city has records. The ocean has people trying to leave. The pieces connect.

**Act 3 — Truth**
The railroad company acquired the land because of what's underground. The mine collapse wasn't an accident. The dust devils are a symptom. The foreman knew. Silas knew enough to stop. Crane is waiting to see what happens next.

**Ending options (soft — no hard gates):**
- Leave on a boat. Take someone from the hobo camp with you. Never find out what's on floor 5.
- Stay. Buy the second farm. Build something. Let the mystery stay underground.
- Go to floor 5. Make the decision the foreman couldn't. Whatever that means.
- Go to the city. Find the company office. Do something about it. The game doesn't specify what.

---

## AUDIO ROADMAP

Current: banjo, bass, percussion, synthesized wind — day/night/combat themes in D major and A minor.

**New themes needed:**
- Ocean theme — wider intervals, slower tempo, something that suggests horizon
- City theme — more structured, slightly dissonant, civilization feels different
- Hobo camp theme — sparse, minor key, guitar-adjacent, human and sad
- Floor 4 theme — not music. Ambient. The singing. A single sustained tone that shifts in pitch slowly. No rhythm. Just presence.
- Floor 5 — silence, then the tone again, closer.

---

## ECONOMY EXPANSION

**New market events to add:**
- SHIPWRECK — nautical goods spike, wood demand increases
- CITY ELECTION — political instability, certain goods fluctuate wildly
- RAILROAD ANNIVERSARY — bitter irony event, land prices discussed, Elias gets a message
- DEEP FROST — second farm crops take severe hit, city food demand spikes
- OCEAN STORM — dock damaged, boat upgrade required to maintain access

**New tradeable goods:**
- Nautical rope, sailcloth, compass, ship timber
- City-exclusive: fine cloth, imported spices, city grain
- Ocean catch: new deep water fish types
- Hobo camp barter: old documents, pre-Collapse goods, hand-made items

---

## TECHNICAL NOTES

**Zone transition system:** Already works. Walk to edge, transition. Apply to all new zones.

**Fog of war:** Uint8Array per zone. Already handles overworld, mine (3 floors), badlands. Add ocean, city, hobo camp, second farm as new arrays.

**Minimap:** Already switches between zone modes. Add new zone rendering.

**Save system:** Add new zone explored arrays to save data. Version bump to handle missing keys gracefully.

**BGM polling:** Already switches day/night/combat. Add zone-based music selection.

**ES6 migration:** Ongoing. Do it when it's too late. (It's almost too late.)

---

## DESIGN PRINCIPLES (don't lose these)

- **Every zone has a reason to exist geographically.** The hobo camp is between the farm and the ocean because those people tried to go east. That's not arbitrary — it's implied story.
- **NPCs are people first, mechanics second.** Silas is a retired miner who made a decision. Crane is a freight runner who watched something happen. Jed says "howdy."
- **The economy reacts to the world.** Drought spikes food. Mine collapse spikes ore. Shipwreck spikes wood. Events have causes.
- **Let the player be curious.** Don't explain the singing. Let Silas not explain it. Let Crane not name it. The truth is more valuable when the player finds it.
- **The junk boot is worth $50 in winter.** Supply and demand. Hard-coded. Silent. This is the design philosophy in miniature.

---

## WHAT STARTED THIS

4 crops. A $10 weekly debt. 9:23pm, May 20th, 2026.

36 hours of stolen time across 73 hours of life with 5 kids, 4 hours of sleep, ADHD, and insomnia.

Fifteen versions. An Electron build. A drift game on a dare. A rogue AI clicker. A roguelike engine. And this.

*The land is yours now, Elias. It always was.*

---

*GDD compiled May 23, 2026. Subject to change at 9:23pm when the kids go to sleep.*
