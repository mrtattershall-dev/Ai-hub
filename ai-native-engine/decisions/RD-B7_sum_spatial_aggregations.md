# RD-B7: Sum + spatial (containment-scoped) aggregations (Closed)

**Question:** RD-B4 added `count` and flagged the next grammar gaps: `sum` and
spatial aggregation. Can the behavior grammar gain a bounded SUM and a *spatial*
(neighbourhood) aggregation the SAME way `count` was added — statically
checkable, capacity-aware range proof, no escape to general code — so an AI
author can express "total X in a region" without the boundary losing any
guarantee?

**Decision (MEASURED):** yes, two orthogonal extensions, both admitted with zero
new attack surface:

1. **`{sum:{field, type, where?, of?}}`** — bounded SUM of a numeric field over
   matching entities. The range proof is **capacity-aware**: a sum over ≤
   `capacity` entities, each field in `[min,max]`, has interval
   `[capacity·min(0,min), capacity·max]`. Since it can overflow a smaller target
   field, the author must STATE the clamp (min/max) exactly as for any expr —
   the RD-B1/A5 range-proof discipline, unchanged.
2. **`of: "all" | "children"`** on `count` AND `sum` — the containment graph's
   "spatial": `"children"` aggregates over the matched entity's DIRECT children
   (of the aggregated type) instead of globally. This world has no coordinates;
   its space IS the RD-001 containment tree, so "within this region" =
   "children of this container". Both scopes are bounded by `capacity`, so the
   range proof is identical either way. Scoped aggregation reads `self` (the
   matched uuid), threaded into `evalExpr`.

## Method / evidence

`experiments/035_behavior_aggregations/aggregations.js` (16 assertions, ALL
PASS), two-zone world so global and scoped queries provably differ:

- **T1 sum global**: both zones see total water 150 across all crops.
- **T2 sum scoped**: field A sums its own crops (60), field B its own (90) —
  and 60 ≠ the global 150, so **scope is load-bearing**, not cosmetic.
- **T3 count scoped**: ready-crop count is per-zone (A=1, B=2) vs global 3.
- **T4 the range proof extends to sum**: an unclamped `sum(water)` (reach up to
  `256·255 = 65280`) written into `growth [0,255]` is STATICALLY REJECTED
  (`range_unprovable`); the same sum clamped with `min` is accepted.
- **T5 negative controls** (each new surface has one): `field_not_owned`
  (summing `hp` on crops), `unknown_field` (summing non-numeric `name`),
  `unknown_type`, and `bad_scope` twice (`of:"cousins"`, `of:"subtree"` — an
  unsupported scope is rejected, not silently treated as global).
- **T6 safety + determinism**: a scoped-sum rule live for 15 ticks with a
  grow rule — zero unsafe events, identical tally trace across two runs.
- **T7 composition**: `sum` nests inside `add`/`min` like any expr (a compound
  scoped `own-water-sum + own-ready-count` evaluates correctly).

Full regression green (8 core + 026/027/029/030/034); the extension is
backward-compatible (no existing rule changed shape). `core/editor.js`'s rule
grammar now advertises `sum` + `of` so the editor surface exposes the new power.

## Why this stays inside RD-B1's safety envelope

The extension adds NO new capability class — it is still a total, terminating,
single-pass arithmetic over a bounded entity set. Loops, RNG, hidden state
remain unrepresentable. The only new failure mode (a sum overflowing its target)
is caught by the EXISTING range proof, now told the capacity-aware bound. A
scope is a static enum, not a query language, so it cannot smuggle unbounded
traversal (`children` is one level; `subtree` was deliberately NOT added here —
it would still be bounded, but one level is enough for "region" and keeps the
surface minimal; it is a clean future extension if a goal needs it).

## Files

- `core/behavior.js` — `checkScope`, `sum` in `checkExpr` (capacity-aware
  interval), `of` on count/sum, `aggPool` + `self`-threading in `evalExpr`,
  `self` passed from the rule fn; grammar doc updated.
- `core/editor.js` — rule grammar advertises `sum`/`of`.
- `experiments/035_behavior_aggregations/aggregations.js` — 16/16.

## Transferable principle

Grow a checkable grammar by adding *bounded* primitives whose worst case the
existing static proof can already state, not by adding an escape hatch. A new
aggregation is safe exactly when its range is a closed-form function of capacity;
a new scope is safe exactly when it is a finite static enum over the world's own
structure (here, the containment tree), never a traversal the author controls.

## RD-B7.1 follow-up (MEASURED) — subtree scope + min/max aggregations

Added on demand, same discipline, backward-compatible:
- **`of:"subtree"`** — transitive descendants (BFS over the containment tree,
  `seen`-guarded, bounded by capacity so the range proof is unchanged). Proven
  distinct from `children`: a 3-deep crop chain, `of:children` sees only the
  direct child (water 10), `of:subtree` sums all descendants (20+30=50).
- **`{min:{...}}` / `{max:{...}}` FIELD aggregations** — min/max of a field over
  matching entities, disambiguated from the binary min/max OPERATORS by
  OBJECT-arg vs ARRAY-arg (`{max:{field,type}}` vs `{max:[e,e]}`). Interval is
  the field's own `[min,max]` (empty pool → 0) — tighter than sum, no clamp
  needed. Proven to coexist: `min([aggMax=100, 50]) = 50` (object agg nested
  inside array operator). Negative control: a min/max aggregation of a
  non-owned field → `field_not_owned`.
Evidence: `experiments/035_behavior_aggregations/aggregations.js` now 22/22
(T8 min/max, T9 subtree). Full regression green.

## Open

- `avg` aggregation (sum/count) — trivial to add; deferred (no goal needs it).
- No spatial COORDINATES were introduced; if the world ever gains x/y fields,
  radius-based spatial predicates are a separate, larger decision.
