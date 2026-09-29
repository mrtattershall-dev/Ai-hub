# RD-025 results — proximity as a bounded aggregation scope (measured 2026-07-16)

Apparatus: `spatial_test.js` (bars 2+3, oracle-checked), `near_bench.js` (bar 4).
`node <file>`, zero deps, no GPU. Laptop absolute timings vary ~3x run-to-run —
same-process ratios and crossovers are the finding; absolute ms are indicative.

## Bars 1-3

- **Bar 1 compatibility: PASS.** All 14 suites green UNMODIFIED (core 10: 39/29/14/
  20/26/18/18/6/14/24; m1 15; m2 9; pong_vocab 26).
- **Bar 2 capability: PASS (23/23, oracle-checked).** `of:{near:R}` installs through
  the RD-B6 gate on runtime-defined types; counts verified against a hand-placed
  fixture (b1 d=2, b2 d=4, b3 d=10, b4 d≈42 from a0): radius 5 → 2, radius 4 → 2
  (inclusive boundary), radius 3 → 1. Self is excluded from its own pool. Field
  aggregation works near-scoped (max power within r=5 = 7, not b3's 100). The
  **range proof still bites**: an unclamped near-scoped `sum` is refused
  `range_unprovable`; the clamped form installs. Spatial declarations travel in
  snapshots and the rule still computes correctly post-load.
- **Bar 3 rejection: PASS.** Localized refusals, world byte-identical after each:
  non-spatial matched type, non-spatial aggregated type, negative radius,
  non-integer radius, malformed scope object, plus two schema-level bad `spatial`
  declarations.

## Bar 4 — the numbers

Pathological shape (EVERY entity matches AND scans EVERY entity):

| N | no rule | global-scope count | near-scope count | near/global |
|---|---|---|---|---|
| 100 | 0.04ms | 1.10ms | 1.82ms | 1.7× |
| 500 | 0.01ms | 10.2ms | 25.1ms | 2.5× |
| 1000 | 0.01ms | 31.4ms | 109ms | 3.5× |
| 2000 | 0.00ms | 85.8ms | 385ms | 4.5× |

**The load-bearing observation: the global-scope CONTROL also blows the 16.6ms budget
from N≈500.** The quadratic is a pre-existing property of per-entity aggregation
(RD-B4/B7 — every matched entity scans the whole pool), not something proximity
introduced; `near` adds a ~2-4.5× constant (a `coordsOf` + integer compare per
candidate) on top of a cost that was already there and had never been measured.

Realistic genre shapes (M movers each scanning P props, radius 20):

| shape | mean | p95 | verdict |
|---|---|---|---|
| Pong (M=2, P=4) | 0.05ms | 0.21ms | fits (300× headroom) |
| **the card's bar: 20 racers / 200 projectiles** | **0.55ms** | 1.08ms | **fits (30× headroom)** |
| busy action scene (M=50, P=500) | 1.88ms | 3.44ms | fits (9× headroom) |
| bullet-hell (M=200, P=1000) | 18.1ms | 26.8ms | OVER budget |

Measured crossover: fits to M=50×P=500; breaches at M=200×P=1000 (~200k distance
checks/tick).

## Decision-rule walk (pre-registered, §"Decision rule")

> "Bars 1-3 pass and bar 4 shows headroom at realistic counts → **H1: proximity is a
> scope.**" / "Bars 1-3 pass but bar 4 blows the budget **below** realistic counts →
> H2."

Bars 1-3 pass. The card's own pre-registered realistic bar is 20 racers / 200
projectiles: **0.55ms, ~30× headroom.** The breach occurs at M=200×P=1000, which is
*above* that bar, not below it. So the rule fires **H1: proximity is a bounded
aggregation scope; coordinates stay ordinary fields; no engine-level space concept,
no index needed for the genres on this roadmap.** H3 found no leak — determinism
(integer squared distance), persistence (spatial travels in schemaDefs), and the wire
all carried space with no privileged treatment.

Honest ceiling, recorded rather than hidden: bullet-hell densities need an index. The
index card should target **aggregation generally, not proximity specifically** — the
control proves global-scope aggregation dies first. That is a new open card with a
measured crossover as its motivation, not a guess.

## Caveats

- One machine, Node 24, 60 frames/arm; ratios are the finding.
- The pathological arm is a worst case no real game writes; it exists to isolate the
  pre-existing aggregation cost from the proximity delta.
- Scope only: proximity as a *filter* inside `where` is deliberately out of scope
  (card §Out of scope), as are 3D, collision (RD-023), and the renderer.
