# GENRE_READINESS — can the core carry action / racing / puzzle / simulator / RPG?

> **What this engine is, in one sentence** (reviewer's framing, 2026-07-16, adopted —
> it is more accurate than "AI makes games"): *a deterministic simulation engine where
> the game vocabulary, rules, and validation are themselves data, allowing AI and
> humans to author behavior against runtime-defined schemas instead of hardcoded
> engine types.*

**Method (2026-07-16):** readiness judged against code as it exists today; every cell
cites its source (file or RD). "MISSING(→X)" means not expressible without editing
core, and names the planned work that covers it. "Unmeasured" ≠ false — it means no
experiment has run. Owner's question this answers: *"we need to make sure the core can
handle what im trying to build in render (whether its action, racing, puzzle,
simulator, rpg, etc)."*

> **⚡ MAJOR UPDATE 2026-07-18 — the critical path below is largely DONE and the "VIABLE"
> verdicts are now PROVEN.** Since this was written: schema authoring landed (RD-024, vocabulary
> is data), space landed (RD-025 `of:{near:R}`), and the "input-reactive triggers" step was
> RESOLVED WITHOUT an `on:` clause (RD-027: input-as-state through the gated pipeline covers it —
> adding `on:` would have smuggled state-over-time into the one stateless layer whose safety proof
> depends on it). **SIX genres now run on ONE grammar with ZERO core edits: farm (PROVEN, played),
> Pong (RD-027), top-down shooter (RD-032), platformer (RD-036), racing (RD-037), action/adventure
> (RD-038).** The last four each proved a distinct novel mechanic — chase AI/firing, gravity +
> ground-contact-as-state, throttle + lap-counting, collectibles + inventory + conditional-unlock —
> and a live 32B one-shot-authored a rule into the platformer through the gate. Two honest grammar
> gaps remain, both known and worked-around, not blockers: **no trig** (integer determinism → axis
> steering, not free heading) and **no relational predicate** ("the X whose field == MY field" —
> RD-032; ordered multi-checkpoint circuits need it). The renderer contract is the main remaining
> build. Rows below are kept for the reasoning; the verdicts marked ✅ PROVEN supersede them.
>
> **UPDATE 2026-07-18b — TOWER DEFENSE (RD-039, 7th genre) run specifically to FORCE the relational gap.**
> It PLAYS (area towers by inversion + path-as-space, 11/11, zero core edits), but pinned the gap as two
> concrete GATE VERDICTS: a rule writing another type's field → `field_not_owned` (single-target targeting
> impossible), and a `where` comparing a field to another field → `bad_value` (field-vs-constant only).
> **The relational predicate is now THE highest-value grammar extension** — the single wall behind ordered
> circuits, per-enemy waypoint pathing, and single-target "nearest/strongest" AI.
>
> **UPDATE 2026-07-18c — TURN-BASED TACTICAL (RD-041, 8th genre) run to force the time-model assumption.**
> It PLAYS zero-core-edits (`experiments/052_turnbased/` 17/17): turns are a STATE MACHINE over ticks (a
> `game.phase` broadcast via constant-filter count, all rules gated on the resolve pulse), so **25 ticks
> between turns change nothing — the engine is NOT fundamentally real-time; the tick is a heartbeat.**
> End-turn = a tx; delayed effects are per-TURN countdown fields (poison N turns, bomb after N turns). The
> wall was the SAME RD-040 gap: auto-initiative ordering (field-vs-field) → `bad_value`. **So of the
> reviewer's three known-unknowns, the relational gap and the time-model are BOTH resolved — only STEALTH
> remains** (the no-trig / fixed-point-rotation decision). Eight genres on one grammar.

## 1. Capability inventory (what provably exists)

- Identity: UUID, never recycled, survives everything (RD-004, `core/engine.js`)
- Transactions: Claim→Schedule→Validate→Contract→atomic commit (`Engine.submit`, RD-002/003)
- Conflict policy: fold-by-field-semantics or DEFER, order-independent — re-verified this week at motion granularity (RD-005; `experiments/038_continuous_motion/h2_corruption_probe.js`)
- Claims + TTL + disconnect grace (RD-022, `releaseActor`)
- Validated AI rule authoring + repair loop, live-model proven (RD-B5/B8, `core/editor.js`; propose pane e2e with Qwen-32B 2026-07-16)
- Undo/redo: inverse-delta, identity-preserving (RD-020)
- Persistence: snapshot + rule sources reinstall on load (RD-019/B6, `core/persistence.js`)
- Tick systems + budgets; per-entity rule txs (RD-B2/M0.1, `stepTick`)
- Rule grammar (`core/behavior.js`, full list per the explainer's enumeration): match by type/uuid + where-cmp, `every N`, effects set/delete/spawn(cap)/reparent, exprs add/sub/min/max/field/count, RD-B7.1 field aggregations (object-form min/max), scopes all/children/subtree
- Multiplayer transport: TCP + HTTP/SSE, one submit(), 15/15 (RD-M1, `m1_server.js`)
- Human-language layer: NL→ops with word-role disambiguation (104/104), rule→English + error explainer (85/85), intent-confirmation UX (`experiments/037_ai_native_editor/`)
- **NEW (RD-023, measured):** layered continuous motion — ungated 60fps motion beside the gate; even all-gated motion holds 60fps to N≈2000; gated events ~0.3–0.4ms per 200/frame (`experiments/038_continuous_motion/results.md`)

## 2. Genre matrix

| Genre | vocabulary (types/fields) | space | input latency | behavior grammar | verdict |
|---|---|---|---|---|---|
| **Farming/idle** (baseline) | HAVE (farm-shaped by design) | n/a | HAVE (250ms ticks fine) | HAVE (HOMESTEAD proves it) | **PROVEN** — shipped, played by humans |
| **Simulator/tycoon** | PARTIAL — nouns re-skin onto crop/zone; new nouns need schema | not required | HAVE | PARTIAL — has folds/aggregations; lacks timers-beyond-`every`, per-player state | **NEAR** — buildable ugly today, clean after schema authoring |
| **Puzzle** (match/logic/turn) | MISSING(→schema) — boards/pieces aren't crops | grid = fields (→schema) | HAVE — turn-based is tick-shaped | PARTIAL — needs input-reactive triggers, win-condition checks (count exists) | **EARLY WIN** after schema: tick-friendly, no motion, no renderer pressure |
| **RPG turn-based/stat-driven** | MISSING(→schema) — stats/items/inventory | tile pos = fields (→schema) | HAVE | PARTIAL — combat math = exprs (have); inventories = containment tree (have, RD-B7); dialogue/quests unmeasured | **EARLY WIN** after schema; dialogue is content, not engine |
| **RPG real-time-ish** | MISSING(→schema) | needs real x/y + spatial queries (→space) | HAVE per RD-M0 (input 0.01–0.09ms full-pipeline) | MISSING — event triggers (on-hit, on-enter), not just `every N` | **VIABLE** — RD-023 branch 1; needs schema + space + event triggers |
| **Platformer** | HAVE (schema, RD-024) | HAVE (x/y + `near`, RD-025) | HAVE (input-as-state, RD-027) | HAVE — gravity=arithmetic, ground-contact=proximity-flag, jump=guarded impulse | **✅ PROVEN** — `experiments/046` 16/16, zero core edits; live 32B authored gravity |
| **Racing** | HAVE (schema) | HAVE (x/y + `near`) | HAVE | HAVE — throttle=arithmetic, laps=proximity+arm-flag | **✅ PROVEN** — `experiments/047` 11/11, zero core edits. Gap: no trig (axis steering only); ordered circuits need the relational predicate |
| **Action/arcade / adventure** | HAVE (schema) | HAVE (x/y + `near`) | HAVE | HAVE — collect=proximity-latch, inventory=count, unlock=count-vs-threshold, combat=proximity-damage | **✅ PROVEN** — `experiments/048` 12/12, zero core edits; combat composes with the shooter |

## 2b. Layer status (updated 2026-07-16 — capability vs decision, per the user's framing rule)

| layer | state | evidence |
|---|---|---|
| Runtime vocabulary | ✅ CAPABILITY (code in core) | RD-024, pong_vocab 26/26 |
| Behavior validation | ✅ generalized (consults runtime schema) | RD-024 (range proof over runtime-born fields) |
| Persistence | ✅ generalized (schema travels) | RD-024 |
| Transport | ✅ CAPABILITY | RD-M2, 9/9 + m1 15/15 |
| Spatial queries | ✅ CAPABILITY (`of:{near:R}`) | RD-025, 23/23 oracle-checked; 0.55ms at the genre bar |
| Continuous motion | ⚠️ **DECISION ONLY — no engine code** | RD-023 cleared the architecture (layering); the motion layer exists only as bench apparatus in `experiments/038`. Core still has no motion/coordinates-as-simulation. |
| Aggregation/spatial acceleration | 🔄 RD-026 in flight (memo + grid) | pre-acceleration ceiling: global count dies at N≈500 |
| Event/reactive triggers | ⏳ remaining (grammar has only `every N`) | — **the real "simulation → game" bridge**: no input response without it |
| Transform semantics (local→world) | ⏳ remaining — needs a card | derived-cached state is a NEW class vs RD-001's derived-indexes; see SPATIAL_ROADMAP.md |
| Rotation / scale | ⏳ blocked on a determinism policy | float trig breaks RD-003 replay; fixed-point vs float is a DECISION |
| Cameras / layers | ⏳ remaining (view concepts) | land with the renderer contract |
| Renderer/UI | ⏳ remaining (editor draws crop cards only) | RD-M2 §scope note |

Full ladder with per-rung measured status: `SPATIAL_ROADMAP.md`.

## 3. Critical path (fewest moves, most genres)

1. **Schema authoring** — types/fields/ranges/folds as validated, persisted,
   AI-authorable data instead of `engine.js:35`'s hardcoded table. Unblocks EVERY
   non-farm row above; nothing else on this list works cleanly without it. Bar
   (pre-registerable): define a non-farm type through the gate at runtime, spawn
   it, rule over it, save/load it — zero core edits. Risk if skipped: every new
   genre is another fork of the farm.
2. **Space** — x/y as ordinary schema'd fields + spatial queries in the grammar
   (the RD-B7 aggregation pattern over coordinates). Unblocks puzzle grids, RPG
   tiles, racing tracks. Bar: "count entities within R of P" as a gated rule.
3. **Input-reactive triggers** — rules that fire on events (collision, input,
   field-crossed-threshold), not only `every N ticks`. RD-023's gated_events.js
   is the mechanical prototype; the grammar needs the `on:` clause. Bar: Pong
   paddle responds to input through the full pipeline within one frame budget.
4. **Renderer contract** (parked post-M6, invariant pinned: read-only view,
   mutates only through submit) — after 1–3, because what it renders is schema'd
   entities in schema'd space.
5. **The generality test** — a second genre shipped with ZERO core edits
   (Pong or a match-3). Pre-registered bar for "general-purpose 2D," same
   discipline as every claim in this project.

RD-023 (was step-blocker for racing/action) is DONE — branch 1: layering, no rewrite.

## 4. The honest ceiling (never good at)

- Asset-heavy 3D, massive scenes, contact physics at scale — other engines' turf.
- Hand-tuned 120Hz game feel: the gate adds a tick boundary to every meaningful
  event; RD-023 shows the boundary is cheap, but "cheap" is not "zero," and juice
  tuned below one frame of latency is out of scope.
- The vocabulary wall is real until schema authoring lands: today, anything that
  isn't re-skinnable onto crop/fish/enemy/zone requires editing core — by design,
  and now with a named exit.
