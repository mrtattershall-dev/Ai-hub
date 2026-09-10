# CURSEBOUND — Patch GDD
## Bug Tracking & Fix Specifications
*Compiled from live playtest — s11*

---

## PRIORITY 1 — CRITICAL (Game-Breaking)

---

### BUG-01 — BOSS zone is a stub: no map, no spawn, no floor
**Severity:** Critical — game crashes or renders black when boss door is triggered.

**Root cause:** `ZONE_ID.BOSS` is registered via `Object.values(ZONE_ID).forEach(id => registerZone(...))` but never given `mapData`, `spawnTX`, `spawnTY`, or `connects`. `transitionZone(ZONE_ID.BOSS)` calls `enterZone(BOSS)` → `initPlayer(BOSS)` → `renderZone` with a null `mapData`. The engine doesn't guard against a null `mapData` in the renderer.

**Symptoms:**
- Stepping on `DOOR_D` at Throne Room floor (cols 22–23, row 17) calls `transitionZone(ZONE_ID.BOSS)`.
- Render loop crashes or draws nothing.
- Player may fall out of world (`p.y > mapRows * TILE + 32` → instant death, respawn in Entry).

**Fix required:**
- Implement `ZONES[ZONE_ID.BOSS]` with a real `mapData` (arena map), `spawnTX`, `spawnTY`, and `connects: { up: ZONE_ID.THRONE }` for a retreat/death exit.
- OR: add a null-guard in `renderZone` and `initPlayer` to catch missing `mapData` gracefully and log a warning rather than crashing.
- Boss arena should be wide (64 cols), single-floor, no platforms — per GDD "player is fully exposed."
- Set `ZONES[ZONE_ID.BOSS].enemySpawns = []` (boss is spawned by script, not the spawn system).

---

### BUG-02 — The Hand spawns immediately on every respawn after first death
**Severity:** Critical — makes the game unplayable after first death; Hand appears instantly in Entry Hall with no warning.

**Root cause:** `onPlayerDeath()` sets `_diedThisSession = true`. On the dead screen, `G.currentZoneId = null` and `setState(STATE.PLAYING)`. In `onStateEnter(PLAYING)`: `enterZone(ENTRY)` runs, then `theHand.onZoneEnter(ENTRY)`. Inside `onZoneEnter`: `alwaysActive = (zoneId === THRONE)` = false, but `_diedThisSession` is still `true` → `_spawn()` is called immediately. The Hand appears at spawn with no room timer, no audio warning, no grace period.

**GDD intent (Section: THE HAND):** *"Player dies and respawns — The Hand remembers where it was."* This is intentional by spec, but the implementation spawns it at position (0, 0) / off-screen with no delay, which reads as a bug rather than a consequence.

**Fix required (two options — pick one):**

*Option A — Honour GDD intent, fix the feel:*
- Add a `respawnGracePeriod` (e.g. 180 frames = 3 seconds) to `onZoneEnter` when `_diedThisSession` is true. Hand is flagged active but invisible/invincible for that window. Gives player time to orient before the Hand closes in. Play the scratch audio cue at grace period end.

*Option B — Remove post-death persistence (easier):*
- In `onPlayerDeath()`, do NOT set `_diedThisSession`. Clear all Hand state. Hand resets to normal room-timer behavior on respawn. Simpler, loses the GDD's intended dread mechanic.

**Recommended:** Option A. The dread is correct by design; the instantaneous zero-warning spawn is the bug.

---

### BUG-03 — Crypt and Entry Hall exits are inverted / confusing
**Severity:** High — player cannot intuit the zone layout; Crypt appears west of Entry (correct per GDD) but the door back triggers as soon as the player reaches the left wall.

**Root cause (two sub-issues):**

**Sub-issue A — Expected layout vs. actual layout:**
The GDD states *"Zone 1 (Entry) connects to Zone 2 (Crypt) via left door."* This is implemented correctly: `ENTRY.connects.left = CRYPT` and `CRYPT.connects.left = ENTRY`. The Crypt IS west of Entry. This is not a code bug — it is a player orientation bug. The HUD zone name (`THE ENTRY HALL`, `THE CRYPT`) does display, but the player has no map and no in-world signage pointing west.

**Sub-issue B — DOOR_L triggers at floor level even though tile is at row 8:**
`DOOR_L` is placed at row 8 (tile y = 128px). Player stands on floor row 10 (feet at y = 160px, player height 24px → player top = y = 136px). `checkPlayerTiles` computes `ty0 = Math.floor(p.y / TILE) = Math.floor(136/16) = 8`. So the player's bounding box overlaps row 8 any time they are standing on the floor near the left wall. Walking into the left wall at floor level immediately fires the door transition — no visual doorway, no threshold feedback.

This affects: Entry Hall DOOR_L (→ Crypt), Crypt DOOR_L (→ Entry), Throne Room DOOR_L (→ Sanctum).

**Fix required:**
- Move all `DOOR_L` / `DOOR_R` wall tiles to **row 9** (one row lower, at y = 144px). Player top at floor = 136px → ty0 = 8, ty1 = 9. Row 9 is still within the bounding box. *However*, row 9 in Entry is currently the spike/air row, so just moving the tile is not enough.
- Better fix: Add a visual door arch at rows 7–9 on the left wall (2 solid tiles framing a 1-tile gap with the DOOR tile), giving the player a clear visual portal. This also makes the door feel like a deliberate entrance rather than an invisible wall warp.
- Alternatively: add a threshold check — only fire the door if `p.vx` is moving toward the door (i.e. `p.vx < 0` for DOOR_L, `p.vx > 0` for DOOR_R). Prevents accidental triggers from standing at the wall edge.

---

## PRIORITY 2 — MAJOR (Significantly Broken)

---

### BUG-04 — Throne Room: entering from Sanctum puts player adjacent to DOOR_D
**Severity:** Major — player walks left immediately into DOOR_D (boss door), skipping the entire climb.

**Root cause:** `THRONE.spawnTX = 3`. `DOOR_D` is at cols 22–23, row 17 (same floor row). Player spawns at col 3. The boss door is 19 cols to the right, which is fine — player won't accidentally walk into it. But if the player walks right immediately, they hit the boss door at col 22 with no buildup.

**Actually confirmed non-issue** upon map review: col 3 to col 22 requires deliberate rightward movement. Player entering from left (Sanctum) naturally walks right. This is intended — the door is the goal.

**Real issue:** Player enters Throne at col 3, row 17 (floor). `DOOR_L` is at col 0, row 15. As documented in BUG-03, the player's ty range at floor includes row 15, so walking left reaches DOOR_L at col 0, which correctly goes to Sanctum. **This is working as designed.** The user's description of "takes me to entryway" likely means they are identifying Sanctum as Entry due to no minimap / zone signage on entry.

**Fix required:**
- None for the door routing.
- Add zone name flash on zone entry (already exists via `G.objectiveFlash` and HUD, but verify it fires on `transitionZone`, not only on fresh game start from intro).

---

### BUG-05 — Crypt → Sanctum door (DOOR_D) likely unreachable
**Severity:** Major — `DOOR_D` at Crypt rows 10, cols 29–30 is patched in via `patchCryptMap()`. Row 10 is a solid sub-floor row. Player must fall through a gap to reach it.

**Root cause:** Row 9 is the main floor. Row 9 cols 10–11 and 18–19 are air gaps (pit openings). Row 10 cols 29–30 have `DOOR_D`. The gap in row 9 is at cols 10–11 and 18–19, but the door is at cols 29–30. Player falling through either gap at row 9 lands in a different column from the door — they'd have to slide horizontally on sub-floor row 10, which is otherwise solid. There is no gap in row 9 above cols 29–30.

**Fix required:**
- Add an air gap in Crypt row 9 at cols 29–30 (or 28–30) so the player can fall through to the `DOOR_D`.
- OR reposition `DOOR_D` to cols 10–11 (below an existing gap) and update `patchCryptMap()` accordingly.
- Verify `CRYPT.connects.down = SANCTUM` and `SANCTUM.connects.up = CRYPT` are paired correctly (they are — `SANCTUM` has `DOOR_UP` at row 0 cols 26–27 going up to Crypt).

---

### BUG-06 — Clocktower DOOR_UP connection direction mismatch
**Severity:** Major — `CLOCK.connects.up = THRONE` but the Throne Room has no `up` connection back to Clock, and Throne's entry is `DOOR_L` from Sanctum (horizontal), not `DOOR_UP` from Clock (vertical). The path `Entry → Clock → Throne` arrives in Throne the same way as `Sanctum → Throne`, using the same `spawnTX/TY`.

**Root cause:** Two different zones both connect to Throne Room — Clocktower (via `up`) and Sanctum (via `right`). Throne only has one spawn point. Arriving from Clock puts the player at `spawnTX=3, spawnTY=17` just like arriving from Sanctum. The `DOOR_L` in Throne goes back to Sanctum regardless of where the player came from — there is no `up` exit in Throne to get back to Clock.

**Fix required:**
- Either: give Throne a second spawn for Clock arrivals (complex — engine doesn't support direction-aware spawning).
- Or: remove the Clock→Throne direct connection. GDD describes the path as *"Zone 3 connects to Zone 1 (base), Zone 5 (belfry bridge)"*, meaning Clock→Throne is intentional. In that case, Throne needs an `up` exit (`DOOR_UP` in the ceiling) with `THRONE.connects.up = CLOCK`.
- Add `DOOR_UP` tiles to Throne Room row 0 (e.g. cols 22–23, above the boss door column) and add `up: ZONE_ID.CLOCK` to `THRONE.connects`.

---

## PRIORITY 3 — MINOR / POLISH

---

### BUG-07 — Zone name flash only fires from Intro, not on transitionZone
**Severity:** Minor — player gets no zone-name feedback when entering a new zone mid-game.

**Root cause:** `G.objectiveFlash = 300` is only set in `onStateEnter(PLAYING)` when `G.prevState === STATE.INTRO`. `transitionZone` does not set it.

**Fix:** Call a brief zone-name display (e.g. 120 frames) inside the `transitionZone` override or `onZoneEnter`.

---

### BUG-08 — Entry Hall DOOR_UP to Clocktower placed at ceiling row 0
**Severity:** Minor — `patchEntryHall()` places `DOOR_UP` at `row 0, col 38`. Row 0 is the ceiling (all solid). Player jumping into the ceiling will trigger it, but there's no visual passage — player appears to clip through solid ceiling to reach Clock. 

**Fix:** Clear tiles at `row 0, col 37–39` to AIR (already done for cols 37 and 39 in the patch) and ensure the platforming chain from floor to ceiling at col 38 is achievable (verify jump chain to row 0 from floor row 10 — 10 rows = 160px, well above the 64px apex; intermediate platforms required).

---

### BUG-09 — Entry DOOR_R at col 63 is patched to SOLID but row 9 col 63 is also patched
**Severity:** Minor — `patchEntryHall()` sets `md.data[9 * 64 + 63] = T.SOLID`. Row 9 col 63 in the original map was `9` (DOOR_R). After patching, both rows 8 and 9 at col 63 are solid. This is correct (no right exit in Entry), but the map comment still says `right exit: DOOR_R at col 63 → CLOCK`. Comment is stale — should be updated to say right wall is solid and Clocktower is via ceiling only.

---

### BUG-10 — Throne Room has no enemies and no Hand-arrival feedback
**Severity:** Minor / Design — `THRONE.enemySpawns = []` (correct per GDD). But `TheHand.alwaysActive = true` in Throne means the Hand spawns immediately on zone entry. `_spawn()` places the Hand off-screen and begins approach. There is no audio cue on entry, no visual flash — the Hand just silently begins closing in.

**Fix:** Trigger the Hand's scratch audio cue immediately on Throne zone entry (even before the Hand is on-screen) so the player has the same audio warning they'd get in other zones.

---

## Zone Connection Map (Current State)

```
TITLE → INTRO → ENTRY (spawn)
                  │
         DOOR_L ←─┤─→ DOOR_UP (ceiling col 38) ─→ CLOCK
         (col 0)  │                                   │
           │      │                          DOOR_UP (ceiling) ─→ THRONE
           ↓      │                                                  │
         CRYPT    │                                            DOOR_D (floor) ─→ BOSS [STUB]
           │      │                                                  │
    DOOR_D ┤      │                                             DOOR_L ─→ SANCTUM
    (r10)  │      │                                                        │
           ↓      │                                                  DOOR_UP ─→ CRYPT
        SANCTUM ──┘
           │
     DOOR_R (col 55) ─→ THRONE
```

**Known broken paths:**
- `THRONE → BOSS` crashes (BUG-01)
- `CRYPT → SANCTUM` via DOOR_D likely unreachable (BUG-05)
- `CLOCK → THRONE` arrives same as `SANCTUM → THRONE`, no return path to Clock (BUG-06)

---

## Fix Priority Order

| Order | Bug | Effort | Impact |
|-------|-----|--------|--------|
| 1 | BUG-01: Implement BOSS zone (or null-guard crash) | High | Critical |
| 2 | BUG-02: Hand grace period on respawn | Low | Critical |
| 3 | BUG-05: Crypt DOOR_D reachability (add gap at r9 cols 29-30) | Low | Major |
| 4 | BUG-03: Door threshold check (directional vx guard) | Low | High |
| 5 | BUG-06: Throne DOOR_UP exit back to Clock | Medium | Major |
| 6 | BUG-07: Zone name flash on transitionZone | Low | Minor |
| 7 | BUG-08: Entry ceiling passage visual | Medium | Minor |
| 8 | BUG-10: Throne Hand audio cue on entry | Low | Polish |
| 9 | BUG-04/09: Comment/signage cleanup | Low | Housekeeping |
