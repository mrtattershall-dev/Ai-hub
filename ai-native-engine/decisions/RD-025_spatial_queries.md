# RD-025 — Spatial queries: proximity as a bounded aggregation scope

**Status:** ✅ DECIDED (2026-07-16, same day) — **H1: proximity is a bounded
aggregation scope.** H3 found no leak (integer squared distance keeps RD-003
determinism; `spatial` travels in schemaDefs; the wire needed nothing). H2 supported
only ABOVE the pre-registered genre bar. Full numbers + decision-rule walk:
`experiments/040_spatial/results.md`.
Bars: (1) compat — 14 suites UNMODIFIED; (2) capability — `spatial_test.js` 23/23,
oracle-checked against a hand-placed fixture, inclusive boundary, self-exclusion,
field aggregations, RANGE PROOF still refusing the unclamped near-scoped sum,
survives save/load; (3) rejection — 7 localized refusal classes, world byte-identical;
(4) perf — the card's own bar (20 racers / 200 projectiles) costs **0.55ms/tick, ~30×
headroom**; Pong 0.05ms; breach only at bullet-hell density (M=200×P=1000, 18.1ms).
**Finding that outranks the card's own question:** the global-scope CONTROL blows the
budget from N≈500 — the aggregation quadratic is PRE-EXISTING (RD-B4/B7), never before
measured; `near` only adds a 2-4.5× constant on top. The follow-up index card must
target aggregation generally, not proximity (see Open cards in STATE.md).

## The farm-specific assumption being replaced

Today "spatial" means the **containment tree**: RD-B7's aggregation scopes are
`all | children | subtree`. Neighbourhood is parenthood. There are no coordinates,
so proximity — the primitive every non-farm 2D genre needs (a ball near a paddle, an
enemy in aggro range, a tile adjacent to a match) — is **unexpressible**, not merely
awkward. RD-024 made x/y *storable* (any type can declare them); it did not make them
*meaningful* to the grammar.

## Hypothesis

Proximity can enter the rule grammar as a **bounded aggregation scope** —
`of: {near: R}` — reusing RD-B7's existing machinery, WITHOUT weakening any static
guarantee: a radius-scoped pool is a subset of the global pool, so the RD-B2/B4
range proof intervals are unchanged (`count` stays `[0, capacity]`; `sum/min/max`
keep the field's own interval). Coordinates stay ordinary schema'd fields; the
schema declares which fields ARE the coordinates (`spatial: {x, y}`), so the engine
gains no privileged notion of space.

- **H1 (scope suffices):** the above holds; no new proof machinery, no new op kinds,
  no engine-level coordinate concept.
- **H2 (index needed):** the O(n) scan per matched entity makes rules quadratic and
  blows the tick budget at game-scale entity counts, forcing a spatial index
  (uniform grid) into core before proximity is usable.
- **H3 (leak):** something needs coordinates to be first-class (determinism, fold
  semantics, persistence, or the wire) — i.e. space cannot be "just fields."

## Determinism constraint (pre-committed)

Distance is compared as **squared integer distance** (`dx*dx + dy*dy <= R*R`) —
never `sqrt`, never floats. RD-003 determinism and cross-machine replay depend on
integer math; a float metric would make tie-breaks machine-dependent.

## Bars (pre-registered)

1. **Compatibility:** all 12 existing suites pass UNMODIFIED (the pattern held by
   RD-024/RD-M2).
2. **Capability:** in `experiments/040_spatial/`, on runtime-defined types with
   declared coordinates: a rule using `of:{near:R}` installs through the RD-B6 gate,
   its range proof still refuses the unclamped variant, and it RUNS with correct
   proximity semantics (verified against a hand-computed oracle over a fixture).
   Both `count` and a field aggregation (`min`/`sum`) work near-scoped.
3. **Rejection:** localized refusals, world untouched, for: `near` on a type that
   declares no coordinates; `near` counting a type without coordinates; negative /
   non-integer radius; malformed scope object.
4. **Perf (decides H1 vs H2):** same-process bench of a near-scoped rule at
   N = 100/500/1000/2000 entities against the game-scale tick budget. Report the
   measured crossover. An index is built ONLY if this bar shows it is needed —
   speculative optimization is out of scope.

## Decision rule

- Bars 1-3 pass and bar 4 shows headroom at realistic counts → **H1: proximity is a
  scope.** RD-025 decided; space is a capability, coordinates remain plain fields.
- Bars 1-3 pass but bar 4 blows the budget below realistic counts → **H2:** the
  capability lands but carries a measured perf ceiling; a spatial-index card opens
  with the crossover number as its motivation (not a guess).
- Any bar-3 refusal requires machinery outside the existing gate, or determinism/
  persistence/wire needs coordinates to be privileged → **H3:** report the leak
  before generalizing further.

## Out of scope (deliberately)

Spatial predicates in `where` (proximity as a *filter* on the matched set rather
than an aggregation scope); 3D; continuous collision (RD-023 measured that boundary
separately); spatial indexes unless bar 4 demands one; the renderer.
