# RD-032 — The second genre: does the rule system carry a shooter?

**Status:** ✅ DECIDED (2026-07-16, same day) — **H1 CONFIRMED: the rule system carries
a second, substantially different genre.** `experiments/044_shooter/` 18/18, every
assertion with a control: chase AI from both sides, firing, damage, death, kill-
scoring exactly once, contact damage, bounded spawning, unsafe=0 over 60 ticks of
churn, deterministic replay. 15 rules, all through the RD-B6 gate. Three genres now
run on one grammar: farm (idle/sim), Pong (real-time 2-player), shooter (spawn/chase/
die). H2 and H3 CONFIRMED AS PREDICTED — both gaps are real, both had workarounds:

**H2 (no relational predicate) — CONFIRMED, workaround found.** The grammar cannot say
"my x vs your x". The workaround: a field-aggregation FETCHES the other's value
(`{max:{field:'x',type:'player'}}`) and, for integers, **clamp(d,-1,1) IS sign(d)** —
so "walk toward the player" is `x + sign(player.x - my.x)`. Works, and it is the same
empty-pool-is-0 identity trick RD-027 found, one level up. Relational predicates would
make it direct; they are not required.

**H3 (static spawn props) — CONFIRMED, workaround found.** A bullet cannot be born at
the shooter's position, so bullets are a PRE-SPAWNED POOL that recycles: a spent
bullet tracks the player, and `life = fire * 40` arms it (0 leaves it dead). It works
and is arguably better engineering (no allocation churn) — but nobody would find it
without knowing the constraint, which is exactly the RD-028 authorability problem
recurring. Dynamic spawn props is now a measured card.

**THE REAL PRIZE — a core bug only a second genre could find.** `behavior.js` resolved
a `spawn` effect's type against the **module-level FARM table** (`TYPE['ENEMY2']` →
`undefined` → `spawn()` crashed on `schema.defs[undefined].fields`). The gate
VALIDATED the type against the world's schema and the RUNTIME then looked it up in
the farm's. It survived RD-024, RD-M2, and every suite because **every spawner ever
written until now spawned a `crop`** — the farm table happened to answer correctly.
Fixed to read `engine.w.schema.TYPE_NAME` (via `engine`, not a captured schema, since
`defineType` REPLACES the object). All 17 suites still green.

This is the argument for the reviewer's milestone 2 in one bug: a second genre is not
a demo, it is a test that nothing else runs.
**Origin:** the reviewer's milestone 2 — *"Building a second, substantially different
genre using the same rule system"* — the strongest generalization evidence available
without a renderer.

## Why a top-down shooter (and not another Pong)

Pong exercised: input-as-state, motion, proximity-as-collision, aggregation
inversion. A shooter stresses the things Pong never touched:

| mechanic | what it demands | Pong had it? |
|---|---|---|
| enemies CHASE the player | a relation between two entities' positions | no |
| bullets damage enemies | many-to-one interaction + accumulation | no |
| enemies DIE | conditional lifecycle (delete) | no |
| enemies SPAWN over time | bounded growth | no (farm's reseed did) |
| firing | creating an entity AT the shooter's position | no |
| score from kills | counting a transition, not a state | partially |

If the same grammar carries both, "general-purpose 2D" has evidence. If it does not,
the failing mechanic is a precise spec — which is the more useful outcome.

## Hypotheses

- **H1 (carries it):** a playable shooter is expressible with zero core edits, using
  RD-024 schema + RD-025 `near` + RD-028 signed/`mul` + aggregation inversion.
- **H2 (relational gap):** "chase the player" needs `self.x` compared to `other.x`.
  The grammar has NO relational predicate — a `where` on an aggregation's pool can
  only reference the AGGREGATED entity's own fields, and `near` is radial and
  self-centred. Predicted workaround: fetch the other's position with a
  `min`/`max` field-aggregation and clamp the difference (`clamp(target-x,-1,1)` IS
  integer `sign`). If that fails, relational predicates are the next grammar card.
- **H3 (spawn-props gap):** `spawn` takes STATIC props, so a bullet cannot be born at
  the shooter's position — a known gap (first seen when rule-spawned crops were all
  literally named `seed`). Predicted workaround: an object POOL (pre-spawned bullets
  recycled by rules). If the workaround is required, dynamic spawn props become a
  measured card, not a hunch.

## Bars (pre-registered)

1. **Zero core edits.** Any engine change fails H1 and is reported as such.
2. **Every rule through the RD-B6 gate**, range proofs intact.
3. **It plays**, asserted against hand-computed oracles with CONTROLS (the RD-029
   lesson — a weak oracle launders a wrong rule): an enemy must close distance on the
   player AND an enemy with no player nearby must not drift; a bullet must kill an
   enemy AND an enemy with no bullet near must survive; score must rise on a kill and
   not otherwise.
4. **Every workaround reported**, whether or not the game runs. The gap list is the
   deliverable.

## Decision rule

- Bars 1-3 pass with no workarounds → **H1: the grammar generalizes across genres.**
- Bars 1-3 pass but a mechanic needed a workaround → name it; each becomes a card
  (predicted: relational predicates, dynamic spawn props).
- A mechanic cannot be expressed at all → that is the honest generalization limit,
  reported with the rule that fails.

## Out of scope

Rendering; AI-authoring the shooter (RD-029 measured that aggregation is not yet
authorable — a shooter is aggregation-heavy, so that arm would be testing a known
failure); tuning it into a FUN game (playable ≠ good).
