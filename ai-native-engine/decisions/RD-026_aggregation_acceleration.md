# RD-026 — Aggregation acceleration (the "RD-S1" card, reframed by measurement)

**Status:** ✅ DECIDED (2026-07-16, same day) — **H1 + H2 both confirmed; H3 found no
leak.** Acceleration is an internal optimization behind an UNCHANGED grammar.
Bars: (1) 15 suites UNMODIFIED; (2) equivalence — 14 aggregation×scope forms × 120
CHURNING ticks byte-identical ON vs OFF in trace AND final world; (3) determinism —
repeats exactly, memo proven per-tick-only, `near` proven never memoized across
entities; (4) perf — **the 10k criterion MET**: `near` at 10,000 entities = 16.26ms
(from 10.34s, 636×); global-scope `count` at 10,000 = 14.11ms (from 7.82s, 554×).
The engine's aggregation ceiling moved from N≈500 to ≥10k with no grammar change and
no quadtree — a uniform grid over bounded integer coords suffices (the field IS a
grid). Honest ceiling: dense neighbourhoods are OUTPUT-bound (10k @ 256², r=20 →
~1.9M true results → 81ms, still 108× faster; no index can remove real results).
Numbers + decision walk: `experiments/041_aggregation_index/results.md`.
**Origin:** user's RD-S1 ("a quadtree-backed query layer supporting declarative
predicates while preserving validation and deterministic execution"), corrected by
RD-025's control arm.

## Why the reframe

RD-S1 assumed the gap was proximity. The measurement says otherwise: the
**global-scope** `count` control — no proximity involved — blows the 60fps budget from
N≈500 (10ms), 31ms@1000, 86ms@2000. Every matched entity re-scans the whole pool, so
per-entity aggregation is O(M×P) *by construction* (RD-B4/B7). `near` adds only a
2-4.5× constant on top of a quadratic that was already there and had never been
measured. Indexing proximity alone would leave the dominant cost untouched.

Also already true, so NOT in scope: the rule syntax needs no change (RD-025 shipped
`of:{near:R}`), and the range proof is unaffected (a scoped pool is a subset).

## Hypotheses

- **H1 (memoize the scope-invariant):** a global-scope aggregation (`of:'all'`) does
  not depend on the matched entity — it is the SAME value for every match in a tick.
  Computing it once per (rule, expression, tick) and reusing it turns O(M×P) into
  O(P), with NO semantic change, because rules read a frozen pre-tick view (RD-B1:
  systems are pure functions of the pre-tick state).
- **H2 (index the proximity scope):** a uniform grid over declared coordinates,
  rebuilt once per tick, turns `near` from O(M×P) into O(M×k) for k = candidates in
  the covered cells. A grid (not a quadtree) is the hypothesis because coordinates
  are bounded integers with a declared range — the field IS a grid already; a
  quadtree's adaptivity buys nothing on a uniform integer domain and costs pointer
  chasing. If measurement contradicts this, the quadtree card opens with the number.
- **H3 (determinism/invariant leak):** caching or indexing changes what a rule sees
  mid-tick (staged writes, spawns/deletes within the batch), or changes result
  ORDER, breaking RD-003 determinism or RD-020 undo.

## Bars (pre-registered)

1. **Compatibility:** all 15 suites pass UNMODIFIED (core 10, m1, m2, pong_vocab,
   spatial, homestead).
2. **Equivalence (the anti-H3 bar):** for a fixture world, EVERY aggregation form
   (`count`/`sum`/`min`/`max` × scopes `all`/`children`/`subtree`/`near`) produces
   **byte-identical results and identical op ORDER** with acceleration ON vs OFF,
   across ≥100 ticks including spawns and deletes. Any divergence = H3, reported, not
   patched around.
3. **Determinism:** identical result ordering across runs; the accelerated path
   preserves `allOfType`'s entity-index order (RD-003).
4. **Perf (the user's criteria, adopted):** **10,000 entities**, a `near(entity,
   radius)` rule, under the 16.6ms budget; plus the global-scope control at the same
   count. Report both against the pre-acceleration baselines (0.55ms @ the genre bar;
   18ms @ M=200×P=1000; 86ms global @ N=2000).

## Decision rule

- Bars 1-3 pass, bar 4 shows 10k entities inside budget → **DECIDED**: acceleration is
  an internal optimization behind an unchanged grammar; the ceiling moves from ~N=500
  to ≥10k and the index card the review wanted is closed by a grid.
- Bars 1-3 pass, bar 4 improves but misses 10k → decided as a **measured partial**:
  record the new crossover; only then consider a quadtree/BVH, with the grid's number
  as its motivation.
- Bar 2 or 3 fails → **H3**: report the leak. Acceleration that changes semantics is
  not acceleration; the pre-tick-view contract (RD-B1) is the thing being tested.

## Out of scope

Rendering-side culling; BVH (moving-object structures) unless the grid misses;
transforms/rotation (RD-028/029); incremental (dirty-tracked) rebuilds unless the
per-tick rebuild is itself the bottleneck.
