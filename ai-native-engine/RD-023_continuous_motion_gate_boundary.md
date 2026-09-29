# RD-023 — Where does the validate-gate sit for continuous-motion genres (racing/action)?

**Status:** OPEN — pre-registered, not yet run.
**Raised by:** external claim ("you'll have to redo all your work to support racing/action
because of the tick issue"). Treat as a hypothesis to falsify, not a verdict to accept.

---

## 1. The claim, stated precisely

Everything decided so far (RD-001 through RD-B8) assumes a **tick = a discrete,
validated batch of ops**: `Claim → Schedule → Validate → Contract-gate → Commit`,
run once per tick, with ticks coarse enough that per-tick validation cost is
negligible (crop grows every few seconds, claims TTL-capped at 64 ticks).

Racing/action genres want **continuous physics at 60+ fps**: every entity's
position/velocity integrated every frame, collision resolved sub-frame, input
latency is the whole game.

The claim under test: *if "tick" = "physics frame," the existing gate
architecture cannot keep up, and the safety spine must be rebuilt from
scratch for these genres.*

## 2. Why I doubt "redo everything" is the right conclusion

The gate's actual job is protecting **discrete, meaningful state
transitions** (an item is picked up, a lap completes, a checkpoint fires,
damage is applied) — not continuous float integration. No engine, tick-based
or not, normally runs continuous position integration through a full
validate/commit pipeline. The likely correct shape is a **layered
architecture**: a fast, ungated continuous-motion layer underneath, whose
only interface to the gated core is the same discrete events (spawn, destroy,
setfield, claim) that already exist.

If that's right, this isn't a rewrite — it's a **new decision about where
the boundary sits**, plus a thin adapter. If it's wrong (the gate genuinely
can't be bypassed for motion, or discrete-event granularity can't express
what action games need), that's the falsification, and then a heavier
redesign is actually justified.

## 3. Hypotheses (competing, both stated before running anything)

- **H1 (layering holds):** A continuous-motion system can run every frame,
  ungated, writing directly to position/velocity fields outside
  submit()/validate(), while all *meaningful* events (pickup, damage,
  checkpoint, race-end) still go through the existing
  Claim→Schedule→Validate→Commit pipeline at a much lower rate (e.g. once
  per discrete event, not once per frame). Safety guarantees (validate-before-
  commit, undo, grounded read path) hold for every event that matters to the
  game's rules; only raw motion is exempt, and raw motion was never where the
  corruption risk lived (D&H's Crop #142 bug was about concurrent writes to
  shared game state, not physics interpolation).

- **H2 (gate is load-bearing even for motion):** Some fraction of
  motion-adjacent bugs (desync in multiplayer, non-deterministic replay,
  undo breaking mid-collision) actually needs the same claim/validate
  machinery applied to position updates too — meaning the "just skip the
  gate for physics" shortcut reintroduces exactly the silent-corruption
  class this project exists to prevent, at 60fps instead of once-per-tick.

- **H3 (frame budget kills it either way):** Even a stripped-down, gated
  event path (not full physics) blows the frame budget once entity count
  rises, because per-event overhead (claim lookup, schedule, contract-gate)
  is too high for genres that generate many discrete events per second
  (collisions in a bullet-hell, checkpoints in a crowded race).

## 4. Apparatus (build once, reuse across arms)

New experiment folder: `experiments/038_continuous_motion/`

1. **`motion_system.js`** — a `registerSystem`-compatible continuous-motion
   system: N entities, each with `x,y,vx,vy`, Euler-integrated every tick,
   no collision (arm A) then simple AABB collision (arm B). Writes position
   directly to a typed array, bypassing `submit()`.
2. **`gated_events.js`** — the discrete layer: when `motion_system` detects a
   collision or checkpoint crossing, it emits a normal op batch (`setfield`,
   `spawn`, custom `checkpoint` effect) through the **existing**
   `Engine.submit()` — same claim/validate/commit path as every other RD
   decision.
3. **`frame_budget_bench.js`** — drives N ticks at a fixed frame budget
   (16.6ms for 60fps, 33ms for 30fps) and records, per tick: total time,
   gated-event count, gated-event time, ungated-motion time, whether the
   budget was blown.
4. Negative control: same benchmark with motion ALSO routed through
   `submit()` (i.e., today's architecture, unmodified) — to get an honest
   before/after, not just a claim that the new path is fast.

## 5. Falsifiable tests, one per hypothesis

- **H1 test:** At realistic entity counts for the genre (start: 20 racers /
  200 projectiles — get real numbers from a target game, don't guess),
  does the layered architecture (ungated motion + gated discrete events)
  stay under frame budget, AND do all existing invariants
  (determinism-under-permutation, index consistency, identity, undo
  round-trip — RD-021's P1-P5) still hold for the gated events specifically?
  If yes on both → H1 supported, no rewrite needed, just a new layering
  decision.

- **H2 test:** Deliberately construct the D&H-shaped bug at motion granularity
  (two actors write conflicting velocity/position to the same entity same
  frame) in the ungated path. Does it silently corrupt (last-write-wins,
  no error) the way pre-RD-005 LWW did for game state? If the ungated path
  reproduces a *real* silent-corruption bug class → H2 gets support, and the
  boundary needs to move (some subset of motion writes need gating, not all).
  If the "corruption" it produces is cosmetically wrong but harmless
  (visual jitter, not lost game state) → H2 is not supported at this layer.

- **H3 test:** Read directly off `frame_budget_bench.js` — sweep entity/event
  count until either arm blows budget. Record the crossover point. Compare
  gated-event overhead alone (not full motion) against the frame budget.

## 6. Decision rule (pre-registered, not fitted after the fact)

- H1 holds, H2 does not, H3 crossover is comfortably above realistic entity
  counts → **layering decision**: motion is ungated by design, discrete
  events keep the existing gate unchanged. Write it up as RD-023, no rewrite.
- H1 holds but H3 crossover is BELOW realistic counts → gate itself needs an
  optimization pass (batch multiple same-tick events, cheaper contract
  compilation) before this genre is viable — a performance card, not an
  architecture rewrite.
- H2 gets real support (ungated motion reproduces genuine silent corruption,
  not just visual noise) → the boundary moves: some class of "high-frequency
  but still meaningful" writes (e.g., last-hit-wins damage, not raw position)
  need a cheaper *partial* gate — likely a new, faster path parallel to
  submit(), not a full rewrite of the existing one.
- Only if the apparatus itself proves unbuildable — i.e., there's no way to
  express "ungated motion + gated events" without touching every existing
  decision — does "redo the work" become the honest conclusion. Nothing in
  the current evidence points that way yet; this experiment is what would
  actually show it.

## 7. What this explicitly does NOT test yet

- Real physics complexity (rotation, friction, resolved multi-body
  collision) — arm B is intentionally minimal (AABB only) to isolate the
  architecture question from a physics-engine-design question.
- Multiplayer/network sync of the continuous layer (separate from RD-022's
  claim/disconnect work, which stays about discrete claims).
- Rendering/input — genuinely out of scope per STATE.md, unaffected by this
  card either way.

## 8. Expected effort

Apparatus: half a day (mostly the frame-budget harness; motion_system is
~50 lines). Runs: minutes each, no GPU/model needed — this is a pure
engine-architecture question, no live-model authoring involved. Cheap
relative to the size of the decision it's gating.
