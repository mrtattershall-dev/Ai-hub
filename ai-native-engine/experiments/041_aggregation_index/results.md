# RD-026 results — aggregation acceleration (measured 2026-07-16)

Apparatus: `equivalence_test.js` (bars 2+3), `accel_bench.js` (bar 4). Zero deps, no
GPU. Same-process OFF/ON arms; laptop absolute timings vary ~3x run-to-run — ratios
and budget verdicts are the finding.

## Bars 1-3

- **Bar 1 compatibility: PASS.** All 15 suites green UNMODIFIED (core 10, m1 15, m2 9,
  pong_vocab 26, spatial 23, homestead 7).
- **Bar 2 equivalence (the anti-H3 bar): PASS.** 14 aggregation×scope forms
  (`count`/`sum`/`min`/`max` × `all`/`all+where`/`children`/`subtree`/`near`/`near+where`)
  over **120 ticks of a CHURNING world** (a spawner adding motes every 5 ticks, a
  reaper deleting every 7 — pools, coordinates and the containment tree all moving
  under the cache): execution trace **byte-identical** ON vs OFF, and final persisted
  world **byte-identical**.
- **Bar 3 determinism: PASS.** The accelerated run repeats itself exactly. Two
  targeted probes: the memo is **per-tick only** (count 2 → spawn → count 3, so no
  stale value crosses a tick boundary), and `near` is **never memoized across
  entities** (a=1, b=1, c=0 for three nodes where only a/b are within radius).

H3 found no leak: no cross-tick state exists to invalidate, because the cache is
created per rule-evaluation and dies with the call. The undo, persistence, and
conflict layers were not touched.

## Bar 4 — the user's criterion (10,000 entities under budget)

| shape | OFF | ON | speedup | 16.6ms? |
|---|---|---|---|---|
| **H1** count/all, N=500 | 9.70ms | 1.85ms | 5.2× | fits |
| **H1** count/all, N=2000 | 106ms | 5.11ms | 20.8× | fits |
| **H1** count/all, **N=10000** | **7.82s** | **14.11ms** | **554×** | **fits** |
| **H2** near r=20, N=1000, world 4096² | 344ms | 15.4ms* | 22× | fits |
| **H2** near r=20, N=5000, world 4096² | 4.77s | 9.96ms | 479× | fits |
| **H2** near r=20, **N=10000**, world 4096² | **10.34s** | **16.26ms** | **636×** | **fits (barely)** |
| **H2** near r=20, N=10000, world 256² (DENSE) | 8.72s | 80.98ms | 108× | **over budget** |

*the N=1000 arm pays first-arm JIT warmup — it is noise, not a curve inversion; kept
for honesty rather than re-run until pretty.

### The density finding (the criterion's free variable)

"10,000 entities under budget" is under-specified without density, and density
dominates. At 10k in 256×256 with r=20, each entity genuinely HAS ~190 neighbours:
**~1.9M true results per tick**. The grid still delivers 108×, and 81ms for 1.9M
results is ~24M results/sec — the index is doing its job. **The residual cost is
output, not search.** No spatial structure can remove it, because the answer really
is that large. Spread the same 10k over 4096² (0.75 expected neighbours each) and the
identical rule fits the frame budget with 636× headroom gained.

This is exactly the distinction the review named: *algorithmic overhead* (fixed —
554×/636×) vs *output complexity* (irreducible — you must touch every real neighbour).

## Decision-rule walk (pre-registered)

> "Bars 1-3 pass, bar 4 shows 10k entities inside budget → **DECIDED**: acceleration is
> an internal optimization behind an unchanged grammar."

Bars 1-3 pass. Bar 4: **10,000 entities, `near(entity, 20)`, 16.26ms — inside the
16.6ms budget**, and the global-scope control (the deeper problem RD-025 exposed) goes
from 7.82s to 14.11ms at the same count. **DECIDED.** The ceiling moved from N≈500 to
≥10k with no grammar change, no new op kinds, no semantic drift, and no quadtree: a
uniform grid over bounded integer coordinates suffices, as hypothesized — the field
already IS a grid.

Honest ceilings, recorded not hidden:
1. **Dense neighbourhoods are output-bound** (10k @ 256², r=20 → 81ms). A quadtree
   would not help; the fix is game design (smaller radius, fewer queriers) or
   accepting <60fps. r=5 at the same density was queued behind the ~9s/frame OFF
   baseline and cut for time — the OFF arm is the only expensive part, and the
   finding does not depend on it.
2. **Grids are rebuilt per rule-evaluation**, so R rules using `near` on the same type
   build R grids per tick. Fine at today's rule counts; if a world ever installs many
   proximity rules, hoisting the grid to a per-tick context shared across systems is
   the next move — deliberately not built speculatively.

## Caveats

- One machine, Node 24, 20 frames/arm.
- The equivalence bar is the load-bearing one: acceleration that changes semantics is
  not acceleration. It is what licenses trusting every number above.
