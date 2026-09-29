# Integrated Core (v1)

The first non-isolated artifact in this project. Every prior RD was a standalone
prototype; this wires the **decided** ones into ONE module behind ONE protocol
(`Engine.submit(batch)`), and proves them *in composition* on the anchoring
Crop #142 bug.

- `engine.js` — the core. `submit(batch)` runs the full pipeline:
  **Claim → Schedule → Conflict-resolve → Validate → Contract-gate → Staged atomic commit.**
  Also hosts RD-020 history (`enableHistory()`/`undo()`/`redo()`), the phase-0
  simulation loop (`registerSystem(name, fn)` / `stepTick(extraBatch)` — systems
  read the committed pre-tick state and emit ops as one tx each, through the
  UNMODIFIED submit), and the RD-B2 engine invariants: **range** (a resolved/
  folded value outside its field's typed-array range is rejected, never
  truncated), **op budget** (oversized tx rejected whole), **capacity** (no
  ghost rows past the world's row budget), **system identity** (duplicate
  system names rejected — a name is an actor id).
- `protocol.js` — RD-018 AI↔engine wire: `parseProposal(engine, json)` validates an
  untrusted model's structured-IR output into a safe batch or localized errors;
  IR `asserts` compile into the RD-014 contract gate.
- `behavior.js` — RD-B1/B2 behavior wire: `parseRule(engine, json)` /
  `installRule(engine, json)` validate an untrusted model's RULE-IR (declarative
  condition→effect behavior) into a registered system or localized errors —
  BEFORE it ever runs. Static checks: field ownership, interval-arithmetic
  range proof (the author must state its clamp), required spawn caps, bounded
  `count` aggregation, and exact `match.uuid` entity scope (live UUID + declared
  type verified before registration). Loops/RNG/hidden state are unrepresentable in the
  grammar (RD-B1: the only shape with zero admitted attacks).
- `persistence.js` — RD-019 save/reload: authoritative-only snapshot + rebuild
  derived indexes + preserve the uuid counter. `save`/`load`/`saveText`/`loadText`.
- `editor.js` — **the AI-native EDITOR (the project's stated goal), assembled.**
  A human directs; the AI proposes DATA edits (`protocol.js`) or BEHAVIOR rules
  (`behavior.js`); the validator gates EVERY proposal before it can touch the
  world, repairing weak-model near-misses from localized errors (RD-018.1). One
  command surface (`Editor.command(line)` → structured result): `spawn / show /
  edit / rule / tick / undo / redo / rules / uninstall / save / load`. The thesis
  it makes visible and enforces: a rejected proposal changes NOTHING (validate
  before execute). REPL `node core/editor.js --mock`; scripted `--demo`; real
  model via `OLLAMA_MODEL` / `OPENROUTER_*`. `editor_test.js` (24) proves the
  surface AND that an un-repairable proposal leaves the world byte-identical.
- Ordered children (RD-005.3): `orderKey` field + `orderedChildren(uuid)` + a `move{target,after}`
  op (normalized to an orderKey write, so it inherits merge/defer/stage/undo/persist/protocol).
- Tombstone GC (RD-019.1): `gcTombstones()` drops a tombstone iff no live entity references its
  uuid (refs[]/dangling parent) — bounds the RD-019 storage cost, safe because ids never recycle.
- Tests (all `node core/<file>`, all PASS): `integration_test.js` (39), `protocol_test.js` (14),
  `persistence_test.js` (18), `history_test.js` (26), `ordered_test.js` (20), `tombstone_gc_test.js` (18),
  `tick_test.js` (29 — the tick loop inherits the pipeline: system-vs-player
  Crop #142, one-tick-one-undo, registration-order independence), `editor_test.js` (24 — the
  editor surface + the validate-before-execute thesis end-to-end).
- `integration_test.js` — 39 assertions, `node core/integration_test.js` → ALL PASS.
- Behavior evidence: `experiments/025_behavior_representation/` (RD-B1 scorecard),
  `experiments/026_behavior_invariants/` (RD-B2/B4 invariants + 20k behavior fuzz),
  `experiments/027_behavior_live/` (RD-B3 conflict + live-model authoring).

## What each layer implements

| Layer | Decision | Behaviour |
|---|---|---|
| Claim | RD-002 | ops on an object another actor holds are rejected with a reason ("held by A until tick N") — communication, not arbitration |
| Schedule | RD-003 | deterministic total order (destructive/structural before field writes) independent of arrival order |
| Conflict-resolve | RD-005/.1/.2 | same-tick writes to one `type.field`: **fold** if foldable (additive/max/min/set-union, lossless), else **defer** — written by NEITHER side, conflict surfaced |
| Validate | RD-002/004.6 | invalid transitions + explicit absence (live/deleted/missing) rejected; acyclicity enforced |
| Contract gate | RD-014 | a goal-derived predicate over the previewed post-state; op-valid-but-goal-violating tx refused |
| Commit | RD-017 | data + index deltas applied atomically, tagged per-tx; a rejected/dropped tx applies NOTHING |

Substrate: RD-006/008 SoA typed arrays; RD-004 UUID identity (minted once, never
recycled) + tombstones; RD-001 derived indexes (byType/childrenOf/referrersOf)
kept consistent with a rebuild oracle. AI context: RD-007 legible columnar slice
of a retrieved neighborhood, not a world dump.

## RD-B4 behavior scope

`match.uuid` scopes a rule to one exact live entity. The gate verifies that the
UUID resolves live and has the declared `match.type` before registration; it
composes with `match.where`. This closes the entity-scope gap found in RD-B3's
live-model runs. Aggregation remains intentionally narrow: `count` only;
`sum` and spatial queries remain open cards.

## Honest limitations (v1 — measured, not hidden)
- **Fold × contract interaction:** a folded field-group is tagged to a single
  contributing tx; if THAT tx is later dropped by its contract, the whole folded
  write is skipped even if other contributors were fine. Correct-but-conservative;
  a finer model would re-fold the survivors.
- **Cross-tx preview:** the contract gate's `preview` can reflect a staged write
  from a sibling tx that ends up rejected. Contracts about a tx's *own* effects
  are accurate; contracts reading *other* txs' pending writes may see a value
  that won't commit.
- **Single-batch commit:** the staged commit assumes one `submit()` at a time
  (matches RD-017's single-writer proof). Genuinely concurrent `submit()` calls
  are not yet modelled.
- **Indexes rebuilt-checked, not typed-array-backed:** indexes are still `Map`/`Set`
  — measured and DECIDED in RD-001.1 (Map/Set wins at engine scale; CSR only as a
  read-cache at ≥1M entities).
- **Behavior grammar gaps (measured live, RD-B3):** no entity-scoped `match`
  (models instinctively try `where name=="field"` to target one entity — a
  `match.uuid` card), and `count` is the only aggregation.
