# RD-033 — The renderer consumes the schema (visible Pong + visible shooter)

**Status:** ✅ MOSTLY DECIDED (2026-07-16) — **H1 CONFIRMED, H3 BIT THREE TIMES (the
point of the card).** The read path is schema-driven; `node m1_server.js 4242 120
pong|shooter|farm` boots any of the three on the same server, page and renderer.
Bar 4 holds (m1_test 15/15 unmodified). **Bar 3 is PARTIALLY MET and that is the
honest gap: verified live over the wire, NOT yet with human eyes on pixels** — the
browser tool's safety classifier was unavailable during this session. Everything
below is measured through the real HTTP transport:

- **Pong** — vocabulary `paddle, ball`; `crops`/`zone` ABSENT (not empty-and-lying);
  ball moving and scoring; left paddle driven `y 128 → 116` by a gated `setfield` tx.
- **Shooter** — vocabulary `player, enemy2, bullet, spawner`; player driven
  `x 128 → 136` by a gated tx; **enemies closing on a MOVING target** (distances
  46→44, 86→84, 126→124 …) — chase AI tracking live human input through the pipeline.
- **`drawStage` CODE audited**: contains no game noun and no field name. Fully
  schema-driven (world extent comes from the coordinate fields' declared range).

## H3 bit three times — three assumptions removed

1. **`snapshot()` was farm-shaped** (`crops`, `zone`, `tally`, hardcoded
   `water`/`growth`): a Pong world sent `crops: []` and the editor could not see any
   game but the farm. Now every live entity travels with its declared fields; farm
   keys survive ONLY as an explicitly-guarded back-compat shim for the terminal
   client (bar 4 requires it) and are omitted entirely when the world has no crops.
2. **Every world was "the farm PLUS your types."** `new Engine()` boots
   DEFAULT_SCHEMA_DEFS and `defineType` APPENDS, so Pong shipped crop/fish/enemy/zone
   it never used. `new Engine(cap, {schemaDefs: []})` was **already supported and
   nobody had ever asked for it** — Pong and the shooter now contain exactly their
   own vocabulary. Both suites still pass (22/22, 18/18).
3. **The session record was farm-shaped one layer BELOW the view**: `stats.popMin =
   snap.crops.length` crashed the first Pong server the instant `crops` correctly
   stopped existing. Population is entities.

## And one I caught in my own work

The first `drawStage` sized entities by a field matching `/^(hp|life|growth)$/` —
hardcoded field names, i.e. genre knowledge smuggled into a "generic" renderer. It is
gone. The finding underneath is real and is the next schema card: **the schema
declares WHERE an entity is (`spatial:{x,y}`) but never WHAT A FIELD MEANS**, so
there is no principled way to know which field is health, size, or facing. Semantic
field ROLES (`role:'health'|'size'|'facing'`) are earned by this renderer rather than
guessed in advance.

## Explicitly NOT generalized (stated, not hidden)

`intent.js` (the NL command bar) is farm vocabulary by construction — "water the
driest crop" means nothing in Pong. It is scoped to the farm and says so; a
schema-driven NL layer is a separate card. The propose pane, the gate, the feed and
the inspector are all generic.
**Origin:** the reviewer's milestones 1+2 — *"a visible Pong / a visible shooter
running on the engine with no genre-specific runtime code"* — plus the project's
oldest outstanding user complaint (*"i was expecting more of a visual editor"*).

## The assumption to remove

Following the pattern the reviewer named (each genre removes an assumption rather
than adding gameplay), the last farm assumption on the **visible** surface is the
server's own `snapshot()`:

```js
const crops = v.allOfType('crop').map(u => ({ uuid: u, name: ..., water: ..., growth: ... }));
return { tick, zone, tally: v.field(zone,'tally'), crops, claims, ... }
```

`crops`. `zone`. `tally`. `water`. `growth`. A Pong world served through this sends
`crops: []` and nothing else — **the editor cannot see any game but the farm**, no
matter how general the engine underneath became. RD-024 generalized the engine,
RD-M2 the transport's *write* path; the *read* path is still farm-shaped.

## Hypotheses

- **H1 (the view generalizes):** `snapshot()` can emit entities + their declared
  fields straight from the schema, and ONE page can render farm, Pong and shooter
  with zero genre-specific code — spatial types (declaring `spatial:{x,y}`) draw at
  their coordinates, non-spatial types draw as cards, numeric fields render from
  their declared ranges.
- **H2 (the invariant holds):** the renderer stays read-only against the view and
  mutates only through `submit()` — pinned since M6, never yet tested against a
  real-time game where a client sends input every frame.
- **H3 (a hidden assumption bites):** something else in the read path is
  farm-shaped — prime suspects: the editor's petname/`isCodeName` heuristic, the
  water/growth progress bars, `zone` as a required root, or the NL layer
  (`intent.js` is explicitly crop-vocabulary and will NOT generalize — it is scoped
  to the farm by design and that must be stated, not hidden).

## Bars (pre-registered)

1. **No farm strings in the read path.** `snapshot()` derives from the schema; a
   grep for `crop|water|growth|tally` in the server's view code returns nothing.
2. **One page, three games.** The same `editor.html` renders the farm, Pong, and the
   shooter, chosen by a server flag, with no per-genre branches in the page.
3. **Visible and playable.** Verified in a real browser (the RD-024-era lesson: only
   pixels count): Pong's ball moves and bounces off a paddle the human drives with
   the arrow keys; the shooter's enemies chase and die.
4. **Existing clients keep working** — `m1_test.js` 15/15 and the terminal client;
   they read `crops`/`tally` today, so back-compat is a real constraint, not a
   nicety.
5. **The invariant, tested not asserted:** the page never writes engine state except
   via `POST /msg` → `submit()`; input at frame rate goes through the same gate as
   everything else.

## Decision rule

- Bars 1-5 pass → **DECIDED**: the read path is schema-driven; visible Pong and
  visible shooter exist; the reviewer's milestones 1+2 are evidenced.
- Bar 3 fails on game feel (input latency at 250ms ticks) → report it: that is a
  TICK-RATE question (RD-023 measured the headroom), not a renderer failure.
- H3 bites → name the assumption; it is the next card, and the pattern continues.

## Out of scope

Sprites/art (rectangles are fine — this tests generality, not aesthetics); cameras,
layers, culling (SPATIAL_ROADMAP items 6-7, and they consume this); animation, audio,
assets; making the games fun. `intent.js`'s farm vocabulary is explicitly NOT
generalized here — it is scoped to the farm and will be stated as such.
