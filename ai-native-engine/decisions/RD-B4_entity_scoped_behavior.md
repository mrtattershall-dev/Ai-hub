# RD-B4: Entity-Scoped Behavior (Closed)

**Question:** The RD-B3 live models repeatedly authored otherwise-correct
aggregate rules with pseudo-fields such as `where: { field: "id", ... }` to
target one zone. How can a rule safely select a single entity without treating
identity as mutable component data or weakening the behavior boundary?

## Decision

Add optional `match.uuid` to RULE-IR:

```json
{
  "name": "score-field",
  "match": { "type": "zone", "uuid": "u0" },
  "effects": [{ "set": "tally", "to": { "count": { "type": "crop" } } }]
}
```

It composes with optional `match.where`; both predicates must hold. The wire
resolves the UUID before registration and rejects a blank, missing, tombstoned,
or type-mismatched target with localized errors. Runtime scope is a pure UUID
equality check inside the existing deterministic ascending type scan.

## Why this shape

- **UUID, not a predicate field:** `id`/`uuid` is RD-004 identity, not component
  state. Admitting it as a regular `where.field` would blur that boundary and
  make identity look mutable/typed like gameplay data.
- **Validate at install time:** a rule cannot quietly install with a stale or
  deleted target. The error names `match.uuid` and its live/deleted/missing
  status, so an AI can repair it.
- **Keep `type` required:** validation proves the scoped target has the declared
  component type; the runtime scan remains type-local and field ownership/range
  proof stays unchanged.

## Evidence

`experiments/026_behavior_invariants/behavior_invariants.js` proves:

- a UUID-scoped zone rule installs and writes only its exact target;
- `match.uuid` composes with a normal `where` predicate;
- wrong-type, missing, and tombstoned UUIDs are rejected before registration;
- UUID-scoped rules are generated in the three-replica behavior fuzzer, covering
  registration-order independence, mid-run save/load, indexes, identity,
  bounded growth, undo, and redo.

The existing rule-vs-player conflict suite remains unchanged: scope only
determines which pre-tick entities emit ops; emitted ops still flow through the
same RD-005/RD-017 pipeline.

## Result

`node experiments/026_behavior_invariants/behavior_invariants.js` passes with
the new scoped-identity cases, and the full deterministic battery remains
green. The expanded 20,000-world behavior fuzz (60,002 generated rules) also
passes across registration-order permutations, mid-run save/load, undo, and
redo.

### Live remeasurement — the original failure fixed

Focused Modal H100 run, Qwen2.5-Coder-32B-Instruct, 4 trials/arm, `score` goal
only, 3 attempts/trial:

| grammar | CONTROL | FEEDBACK | unsafe |
|---|---:|---:|---:|
| RD-B3 (no entity scope) | 0/2 | 2/2 | 0 |
| RD-B4 (`match.uuid`) | **4/4** | **4/4** | **0** |

Every *logged rejected* proposal now used `match: {type:"zone", uuid:"u0"}`
rather than the earlier pseudo-fields (`id`, `name`, `root`). Five first
attempts had the independently known malformed-comparator typo (`"cmp">="`);
blind retry or localized feedback repaired it. The scope problem itself is
gone: accepted rules installed and the running simulation observed `tally === 2`.

This closes the top live-model grammar gap from RD-B3.

## Open

`count` is still the sole aggregation. Add `sum` or spatial/nearest queries only
through the same rival-and-negative-control method; do not escape to arbitrary
code for convenience.
