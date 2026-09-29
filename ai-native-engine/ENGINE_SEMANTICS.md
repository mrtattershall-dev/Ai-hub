# ENGINE_SEMANTICS — conventions an author must know before they're surprised

> Not invariants the engine ENFORCES (those are in the RDs + `MUTATION_PATHS.md`) — these are the load-bearing
> SEMANTIC conventions a rule author hits in practice. Each entry earns its place by having actually surprised
> someone. New entries go here the first time a convention bites, not the second.

## 1. A rule reads START-OF-TICK values, never mid-tick writes from the same pass (the double-buffer)

Every rule in a tick reads the SAME frozen pre-tick snapshot. A field another rule writes THIS tick is not
visible until NEXT tick. This is by construction (RD-B1's double-buffer — it's WHY read-after-write hazards
are unrepresentable and conflict resolution is tractable), but it has one author-facing consequence that has
now recurred **twice empirically**, so it's entry #1:

> **Anything derived from "did X *just* become true" trails the cause by one tick (one heartbeat).**

- Platformer (RD-036): the player's `on_ground` flag is computed from proximity this tick, but `land`
  (which reads it) arrests the fall next tick — a one-tick landing overshoot.
- Turn-based (RD-041): a bomb's `fuse` hits 0 on the resolve tick, but `bomb_boom` (reading pre-tick `fuse`)
  latches `boom=1` the following tick — detonation-flag delay.

Both are correct, not bugs — but if you need tight timing, budget the one-tick propagation, or collapse the
producer and consumer into a single rule/effect so there's no cross-rule handoff. A multi-stage state machine
(sense → flag → act) costs one tick per stage.

## 2. The gate REJECTS, it never clamps or repairs (RD-018)

An out-of-range value, an unprovable range, an unknown field, a corrupt save — all are REJECTED whole with a
localized reason, never silently clamped/wrapped/truncated. If you want a value bounded, YOU state the clamp
(`min`/`max`) in the rule; the engine will not guess your intent. This now holds across every ingress
(`MUTATION_PATHS.md`), including creation and load.

## 3. A rule writes only its MATCHED entity (RD-040)

There is no syntax to write another entity's field. "A affects B" is expressed by INVERSION: B checks a
relational condition about itself and self-applies (heal-lowest, hit-strongest, take-damage-near-tower). This
is what keeps the concurrency model tractable. What inversion can NOT express: distance-ranking ("nearest" —
needs L3a) and persistent per-PAIR state ("A is locked onto B", threat tables, one guard's separate memory of
many intruders — needs L3b). Predicates compare a field to a CONSTANT only (field-vs-field → `bad_value`)
until L1/L2 land (RD-040).

## 4. An unguarded write to a non-foldable field competes every tick (RD-035)

`set F to <expr reading F>` with no `where` writes F every tick — a "branchless conditional" whose no-op
branch (`F = F`) still enters arbitration and DEFERS against any other writer (a player command or another
rule). The gate flags this as a `warnings.unconditional_write` advisory (not a rejection). Guard the rule, or
declare a fold on F, unless the every-tick write is intended (e.g. physics owning a position).

## 5. `tick` is a heartbeat, not the game clock (RD-041)

The engine ticking continuously does NOT make a game real-time. Gate your rules on game-state (a `phase`
field, an `active` flag) read via a constant-filtered `count`, and the world only advances when that state
advances — turn-based, paused, and event-driven games all fall out of this. "Wait N turns" is a countdown
FIELD decremented on a resolve pulse, not `every 300 ticks`.
