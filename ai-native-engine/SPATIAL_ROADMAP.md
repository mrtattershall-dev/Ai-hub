# Spatial roadmap — the ladder, with MEASURED status

Frame adopted from the user's spatial-ladder review (2026-07-16): tier 1 transform
math → tier 2 world organization → tier 3 acceleration structures → tier 4 query
language. Planning notes, root-level (same status as `RD-UI_roadmap`): nothing here
is decided until it has a card, bars, and a measured write-up.

**Status honesty rule** (per [capability vs proof artifact]): 🟢 = code in core with a
passing bar; 🟡 = expressible today via schema but no engine semantics; 🔴 = absent.
A DECISION card (architecture cleared) is NOT a capability.

## Corrected status (2026-07-16, against the code — not the vibe)

| rung | claimed in review | MEASURED | why |
|---|---|---|---|
| 1. Entity transforms | 🟢 Strong | 🟡 **schema-only** | `defineType({fields:{x,y}, spatial:{x,y}})` works (RD-024/025) and `near` reads them. But core has NO transform concept: no default position, no velocity, no integration. The farm schema has no coordinates at all. |
| 1b. Continuous motion | "you likely already have" | 🔴 **NOT IN CORE** | RD-023 was a **decision card**: it cleared the layered architecture and measured the boundary. Its motion code is bench apparatus in `experiments/038`, never engine code. |
| 2. Parent/child transforms | 🟡 Likely close | 🟡 **tree yes, transforms no** | The containment tree (RD-001) + `childrenOf`/`subtree` scopes exist and are load-bearing. What's missing is the *math*: local→world composition. See the architectural tension below — this is NOT a 10% gap. |
| 3. Rotation | 🟡 Easy next step | 🔴 absent | Expressible as a schema field today; nothing consumes it. Needs trig → **float determinism problem** (see below). |
| 4. Scale | 🟡 Easy next step | 🔴 absent | Same. Also multiplies into bounds, which nothing computes yet. |
| 5. Cameras | 🟡 "basic likely exists" | 🔴 **absent entirely** | There is no camera, no viewport, no renderer. The editor draws crop cards from a JSON view. |
| 6. Layers | 🟡 Medium effort | 🔴 absent | No rendering order, no collision filtering (no collision), no visibility groups. |
| 7. Quadtree / BVH | 🔴 gap | 🔴 gap — **now with numbers** | RD-026 opened with a measured crossover: `near` fits to M=50×P=500 (1.9ms), breaches at M=200×P=1000 (18ms). |
| 8. Spatial queries | 🔴 "major capability gap" | 🟢 **`near` SHIPPED** | RD-025 DECIDED same day: `of:{near:R}` in the rule grammar, integer-deterministic, range proof intact, 23/23 oracle-checked. `inside`/`visible`/`intersects`/`raycast`/`nearest` remain 🔴. |

**Net:** the ladder is inverted from the review's guess. Tier 4 is *partially built*
(the rung called the "real prize" has its first predicate shipped and gated); tier 1
is *thinner* than assumed (no transform semantics at all); tier 3 is the gap, and it
now has a number instead of a fear.

## Two architectural tensions the ladder hides

1. **Derived world transforms vs. authoritative state.** RD-001 decided:
   authoritative tree + DERIVED indexes, rebuilt on load, never persisted. A world
   transform (`parent.world ∘ local`) is *derived, cached, and invalidated on
   ancestor writes* — a new class this engine has never carried. Naive per-read
   recomputation walks the ancestor chain on every field read (the aggregation
   quadratic, one level down); naive caching adds an invalidation channel the
   conflict/undo/persistence layers have never had to reason about. This needs its
   own card, not a field.
2. **Rotation/scale break integer determinism.** RD-003 determinism and cross-machine
   replay hold because every field is an integer in a typed pool and RD-025's
   distance compare is `dx*dx+dy*dy` (deliberately never `sqrt`). `velocity =
   (cos θ, sin θ) * speed` introduces floats, and float trig is not bit-identical
   across platforms/JS engines. Options: fixed-point angles + a lookup table
   (deterministic, cheap, ugly), or accept float drift and lose replay. **That is a
   decision, not an implementation detail** — and it should be made before rotation,
   not after.

## Sequence — UPDATED 2026-07-16 (two rungs fell the same day)

- ~~1. RD-026 aggregation + spatial acceleration~~ ✅ **DECIDED**: memo + uniform grid
  behind an unchanged grammar; 10k entities at 16.26ms (636×); equivalence bar
  byte-identical ON/OFF across 120 churning ticks. Dense neighbourhoods are
  output-bound, not search-bound (the review's own distinction, confirmed).
- ~~2. RD-027 event/reactive triggers~~ ✅ **DECIDED — and the answer was NO CARD
  NEEDED.** The reflex ("add `on:`") was wrong: `on:` smuggles state-over-time into
  the layer whose statelessness carries RD-B1's safety proof. Falsified instead —
  **Pong plays on today's grammar, zero core edits** (input-as-state + `near` +
  aggregation inversion + the empty-pool-is-0 conditional). The ladder's rung 1 was
  already climbed; nobody had checked.

3. **RD-028 signed fields + authoring sugar** ← *NEXT, and it replaces the `on:` slot.*
   RD-027's H2 evidence is the spec: unsigned ranges force offset-encoded velocity;
   aggregations take a field not an expression, forcing materialized deltas + a
   2-tick lag + a load-bearing direction gate. A human found those; **an AI author
   plausibly would not** — and AI-authoring is the thesis, so this is a capability
   gap, not a nicety.
4. **RD-029 transform semantics** (local→world; the derived-cached-state tension).
5. **RD-030 determinism policy for rotation/scale** (fixed-point vs float replay).
   Gate for rotation, scale, and any thrust-vector genre.
6. **Visibility / culling** — inserted per the review, and it belongs BEFORE the
   renderer, not inside it: `World → transforms → spatial index → visibility →
   renderer`. It is a spatial-QUERY card (the `inside`/`visible` predicate family
   joining `near`), riding RD-026's grid — not renderer code. Its consumers are
   plural by design: AI perception, editor selection, minimaps, debug overlays. The
   RD-UI "read path must be GROUNDED" principle applies directly: a visibility answer
   is a retrieved fact about engine state, not an inference.
7. **Renderer contract** — layers/cameras land here (view concepts); invariant
   already pinned (read-only against the view, mutates only through submit).
8. **Pong as ARTIFACT** — the rules already exist and pass (`experiments/042_pong/`);
   it becomes the shippable integration artifact when 7 lands. Capability ≠ artifact.

## What the review got exactly right

- The ladder framing (each rung unlocks a genre class) is the correct decomposition.
- "Declarative rules + spatial predicates is the special thing" — agreed, and it's
  why RD-025 put proximity in the *grammar* rather than in a system: `enemy near
  player within 5` is a gated, explainable, AI-authorable rule today.
- Deterministic query ordering as a success criterion — adopted verbatim into RD-026.
- Layers-as-filtering (not just rendering) — genuinely useful; folded into the
  renderer card's scope note so it isn't rediscovered later.
