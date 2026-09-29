# Magic Maze — Web Port Architectural Brief

**Project:** Port Kent Dahl's *Magic Maze* (1994 Turbo Pascal) to an HTML5 Canvas browser game.
**Target:** Pixel-perfect single-page game, vanilla JS, drops into any static host.
**Source of truth:** The original Pascal source `MMAZE.PAS` (~1380 lines).
**Reference port:** `https://github.com/kentdahl/magic_maze` (Ruby/SDL2). Same gameplay, useful for cross-checking module boundaries and edge cases.

---

## Decisions Locked

### 1. Code structure — 7 ES modules, no build step
```
mmaze/
├── index.html              # Entry point — loads main.js as a module
├── style.css               # Just the canvas container + basic page chrome
├── main.js                 # Bootstrap: load assets, wire up input, start game loop
├── engine.js               # Game state, update logic, monster AI, spell logic
├── render.js               # All canvas drawing — backing buffer, sprite blits, HUD
├── input.js                # Keyboard handler with `isPressed()` / `lastPress` API
├── audio.js                # Web Audio: load WAVs, play sounds, volume control
├── levels.js               # Load level JSON, parse tiles, monster extraction
├── assets.js               # Load sprite sheet + palette, expose by named index
└── assets/                 # Extracted from the 1996 game (see assets zip)
    ├── sprites.png         # 16×6 grid of 32×32 tiles (88 sprites)
    ├── sprites.json        # Palette + named indices (player, monsters, items)
    ├── title.png           # 320×200 — main menu background
    ├── back.png            # 320×200 — in-game UI panel chrome
    ├── end.png             # 320×200 — LuciPer end-sequence image
    ├── snd_argh.wav        # Death scream, 22222 Hz mono 8-bit
    ├── snd_zap.wav         # Spell cast, 22222 Hz
    ├── snd_punch.wav       # Monster hit, 22222 Hz
    ├── snd_bonus.wav       # Pickup chime, 8000 Hz
    └── fraktmod.ttf        # Fraktur Modern font (download separately, free)
└── levels/
    ├── index.json          # Ordered list of all levels
    └── level01.json … level10.json  # 128×128 tile grids + metadata
```

Each file should be < 300 lines. Use `import { foo } from './bar.js'` — modern browsers support this natively. **No npm, no Webpack, no Vite, no TypeScript.** If a build step ever becomes necessary, that's a separate decision later.

### 2. Rendering — pixel-perfect 320×200 with CSS scaling
- Create an internal `<canvas width="320" height="200">` as the *backing buffer*. All rendering happens at native resolution into this canvas, exactly mirroring the Pascal screen coordinates.
- Display the canvas at the largest integer multiple that fits the viewport (2x, 3x, 4x, 5x), centered, with letterboxing/pillarboxing.
- Use `ctx.imageSmoothingEnabled = false` and CSS `image-rendering: pixelated` to keep pixels crisp.
- On window resize, recompute the scale factor and update CSS dimensions only — never resize the backing buffer.
- Phone-friendly later: same code, just allow non-integer scaling on mobile.

### 3. Game loop — fixed timestep, separate update from render
The Pascal source uses `WaitFor(GameLoopDelay)` to enforce ~10 FPS (default delay 100ms). We should preserve that feel but use `requestAnimationFrame` for rendering and a fixed-timestep update accumulator for game logic. Default tick rate: 10 ticks/sec to match the original. Make this configurable via the existing speed-adjust UI on the help screen.

### 4. Input — abstracted from day one
`input.js` exposes:
- `isPressed(action)` — currently held keys (matches Pascal `Key[scXxx]` semantics)
- `lastPress` — most recent keydown event, cleared after each consume (matches `LastPress`)
- Action names map to keys: `'up' / 'down' / 'left' / 'right'`, `'cast'`, `'cycle_spell'`, `'heal'`, `'mana'`, `'map'`, `'look_ahead'`, `'restart'`, `'save'`, `'load'`, `'pause'`, `'quit'`, `'sound_toggle'`, `'vol_up'`, `'vol_down'`, `'confirm'`, `'cancel'`

This abstraction is cheap now and saves a refactor when touch is added.

### 5. Audio — Web Audio API, 4 buffers preloaded
Use `AudioContext.decodeAudioData()` on the WAV files at startup. Each SFX gets a `AudioBuffer`. To play, create a fresh `AudioBufferSourceNode` per call (they're single-use), connect through a `GainNode` for volume control. Multiple simultaneous sounds (matches the original GUS 4-voice setup) work naturally because each `BufferSourceNode` is independent. **Important:** browsers require a user gesture before audio starts — gate `AudioContext.resume()` on the first key press or click.

### 6. Standalone first, no framework integration
Build it as a self-contained folder that runs by opening `index.html` (or `python -m http.server` for the modules). Do NOT integrate with Eleventy/Astro/React yet. Once it works end-to-end, wrapping it in any framework is trivial — just an iframe or a static asset import.

### 7. Five milestones, ship in order

**M1 — Walking simulator.** Render level 1 to canvas, walk around with arrow keys, collide with walls. No monsters, no items, no UI panel. Player sprite faces the direction of movement. Camera centered on player, 5×5 tile view.

**M2 — Items + UI.** Doors, keys, potions (life/mana), chests, money bags, orbs, exit. UI panel on the right (180–319 px): current spell, key inventory, health bar, mana bar, score. Walking onto items picks them up; walking into a locked door uses a matching key.

**M3 — Combat.** Monsters spawn from level data (`b >= 40`). Monster AI: weighted-random movement biased toward player (port `TryToMoveMonster` directly — staggered across frames in 8 batches, exactly as Kent did it for performance). Three attack spells: Lightning, BigBall, CoolCube. ALT cycles current spell, CTRL casts. Spells move one tile per tick, hit walls or monsters, deal scaling damage. Monsters drain energy when adjacent. Death = game over.

**M4 — Polish.** Heal spell (H), Summon Mana (N), Magic Map (M), Look-Ahead (L). Save/load (`localStorage` instead of `MM_SAV.GAM`). Restart level (F9). Help screen (F1) with speed slider. Sound effects on all events. Volume control (PgUp/PgDn). Sound toggle (S).

**M5 — Full game flow.** Title screen with menu (New / Restore / Train / Quit). Level transitions with the original "Entering level N" fade. Training mode for individual levels. End sequence: LuciPer screen with palette animation, then the scrolling text credits exactly as in the Pascal source. Game-over screen.

---

## Pascal Gotchas — Things That Will Trip You Up

### Map data
- Each tile is **2 bytes**: `[A, B, blocked]` in our extracted JSON.
  - `A` = floor/wall sprite index (0-29).
  - `B` = object sprite index (0-57): items, doors, keys, monsters, exit.
  - `blocked` = bit 7 of the original A byte. True = impassable wall.
- **Monsters in `B`**: at level load, the loader walks the grid, creates a monster entity for every tile where `40 <= B < 60`, and **clears that B byte to 0**. Monsters live in a separate array after that — the map only stores their initial positions. Replicate this in `levels.js` during load.
- Tile coordinates use unsigned bytes (0-127). Off-map reads return `(default_wall, 0, true)`. The `default_wall` is in the level header; falls back to sprite index 10 if zero.
- The screen renders a 5×5 view centered on the player, but **the player isn't always centered on screen** — when near the map edge, the view stops scrolling and the player can walk to the visible edge.

### Sprites
- Sprite **index 0 in the foreground layer is transparent**. The extraction script handles this — palette index 0 in foreground sprites becomes alpha=0 in the PNG. Background sprites are always opaque.
- Foreground sprite indices in `sprites.json`:
  - `9` = blood splat (left when monster dies on empty tile)
  - `10-13` = spell projectiles (lightning/bigball/coolcube/map icon)
  - `14-16` = utility spell HUD icons (heal/mana/look-ahead)
  - `20-24` = chest, life potion, mana potion, money bag, orb
  - `30-32` = keys (yellow/blue/red)
  - `33-35` = doors (yellow/blue/red)
  - `39` = exit
  - `40-59` = monsters (20 types)
  - Player: faces 4 directions, sprite indices in `MovX/MovY` arrays — see `MMAZE.PAS` line 55.

### Input semantics — two different concepts
- `Key[scXxx]` = "is this key currently held down?" — used for movement, charging up heal/mana, etc.
- `LastPress` = "what was the most recent keydown event?" — used for menu selection, single-action spells. Cleared after each game loop iteration.
- Both are needed. The JS `input.js` should expose both via different methods.

### Movement and direction
- Player direction (PM) = 0 Up, 1 Right, 2 Down, 3 Left.
- `MovX = [0, 1, 0, -1]`, `MovY = [-1, 0, 1, 0]`.
- The player sprite **rotates** by direction (sprites 0, 1, 2, 3 are the four facings).
- Pressing a direction key: if already facing that way, attempt to move; otherwise just turn. This means the first keypress in a new direction turns, the second one moves. Important for feel.

### Monster AI (`TryToMoveMonster`)
- Random base score (175-209) per direction.
- +1000 to the direction toward player on each axis (X and Y separately) if applicable.
- -200 to the direction *away* from player if movement is needed on that axis.
- +15 to the monster's previous direction (preference for continuing same way).
- Set score to 0 if path blocked.
- Pick highest-scoring direction. If none > 0, don't move.
- **Performance trick**: monster updates are staggered across 8 frames. Each frame, only ~1/8th of monsters update. `MonWait` cycles 0 through `MonDelay` (= 7). Replicate this — it's not just optimization, it changes monster movement timing/feel.

### Spells
- Lightning: damage 4, mana 1, range 7 tiles
- BigBall: damage 9, mana 2, range 8 tiles
- CoolCube: damage 20, mana 4, range 10 tiles
- Spells advance one tile per game tick. They stop when hitting a wall or monster. Only one projectile in flight at a time (`SpellPow > 0` check).
- Heal: hold H — drains 2 mana, adds 1 energy per tick, up to 97 energy.
- Mana: hold N — drains 3 energy, adds 2 mana per tick, up to 97 mana.
- Magic Map: shows full level overview, costs 1 mana. Press M again to dismiss.
- Look-Ahead: free-roaming "magic eye" sprite, costs 1 mana per move.

### Other game-feel details
- Mana regenerates 1 point every 24 ticks (`GainManaDelay`).
- Energy decreases 1 point every 256 ticks (`LoseEnergyDelay`) — hunger system, runs out slowly even when safe.
- Adjacent monsters drain 1 energy/tick when player is on the same row OR column at distance 1.
- Maximum 3 keys per color. Picking up a 4th has no effect.
- Score: 10 per monster, 50 per chest, 250 per money bag.
- Cheat code in help screen (F1): hold K and D simultaneously → all keys, full mana/energy, score reset to 0. **Keep this.** It's part of the game's character.
- The level checksum check rejects "illegal" levels (custom maps without proper checksum) by setting energy=mana=1 and showing "Skipping ILLEGAL LEVEL". For our port, just trust the JSON files and skip this — they're all checksum-valid.

### End sequence
- After defeating level 10, fade to LuciPer image (`end.png`).
- Palette-cycling animation (a ring of palette entries 193-255 rotates) — can be skipped on web by using a CSS animation or just showing a static image with a brief flash. Faithful version: animate by cycling pixel colors in a copy of the palette.
- Then scrolling text credits (33 lines, defined in `PlayEndSequence` proc, line 908-945 of `MMAZE.PAS`). Just transcribe the lines.

### Things from the Pascal source that we DROP
- DOS/VGA mode 13h boilerplate (`GoVGA256`, `RestoreMode`, etc.) — irrelevant.
- GUS / SoundBlaster initialization branches in `audio.js` — Web Audio is the only "card."
- The "name of creator" obfuscated check at startup — dead anti-tampering code, skip.
- `FastVGA`, `FastTimer`, `FastKeys`, `FastFonts` units — replaced by browser APIs.
- The map editor (`MMMAPED.PAS`) — separate project, can be ported later if useful. The 10 shipped levels are enough for v1.

---

## Asset Pipeline

The extracted assets in `web/assets/` and `web/levels/` are the only things the engine should read. They're frozen — generated by `tools/extract_assets.py` from the original game files. If anything in the original looks wrong, fix the extraction script and regenerate, don't hand-edit the JSON.

The script handles:
- VGA 6-bit → 8-bit palette expansion (bit-spread, not just `<< 2`)
- Sprite header skip (6 bytes: width + height + flags)
- Foreground sprite transparency (palette index 0 = alpha 0)
- PCX RLE decoding with embedded palette
- Map header parsing (signature, checksum, start coords, name, default wall)
- Tile A-byte split: floor index + blocked flag
- Sound XOR-127 decode (the on-disk format) → unsigned 8-bit WAV

---

## Recommended Working Order for Claude Code

1. **First session**: Read `MMAZE.PAS` cover-to-cover. It's worth doing this even though you have this brief — Kent's comments are entertaining and his variable names are direct.
2. Set up the file skeleton + index.html that loads main.js as a module. Verify `console.log` from each module shows up.
3. Build M1 (walking + collision) and confirm playable before touching M2.
4. After each milestone, play through level 1 manually and screenshot. The faithful test is "does this *feel* right?"
5. When uncertain about a behavior, the Ruby port (`magicmaze/*.rb` in the GitHub repo) is a working reference. Cross-check against it before guessing.

Good luck. The hard interpretation work is done; from here it's translation.
