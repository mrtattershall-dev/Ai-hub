# RD-021: Concurrency Fuzzing — Adversarial Verification of the Core

**Goal:** move the engine from "passes hand-written scenarios" to "survives adversarial property-based fuzzing" — as accurate as the method allows. Generate millions of random multi-actor batches and assert the invariants that define correctness on every one.

## Method
`experiments/024_concurrency_fuzz/fuzz.js` (+ `repro.js` for minimal repros). Seeded PRNG → reproducible. Each iteration: build a random world (8–20 entities, random types/parents/refs), generate a random batch (2–5 txs, **distinct actor each**, random ops: setfield/delete/reparent/move/createChild/claim), then check:

- **P1 DETERMINISM (RD-003, the crux):** committed state identical across 6 random permutations of the tx order (fresh clones via save/load).
- **P2 INDEX CONSISTENCY (RD-001/017):** live indexes == ground-truth rebuild after commit.
- **P3 IDENTITY (RD-004/004.6):** byUuid↔uuid coherent, no live handle to a destroyed slot.
- **P4 STRUCTURE (RD-005.2):** no parent cycles; order-keys finite.
- **P5 UNDO ROUND-TRIP (RD-020):** undo restores the pre-batch **observable** state; redo the post.

**Result: 1,500,000+ random batches across 6 seeds — ALL invariants hold.** (500k × 5 seeds + 1M × 1.)

## Bugs found and fixed (the payoff — five real engine bugs, none caught by hand-written tests)

1. **`spawn` parented everything to entity 0.** `w.parent[e] = props.parent` stored a UUID *string* into an `Int32Array`; `Number('u3')` → `NaN` → `0`. Every spawn silently parented to index 0 — invisible in every test because the parent was always the zone (entity 0). **Fix:** resolve the parent UUID to an index. *This is the one the whole fuzzer justified.*
2. **Divergent reparent not conflict-resolved.** Two txs reparenting the same node to different parents both "committed" (LWW on data) and both added index edges → the node listed under *two* parents. RD-005.2 decided this must defer, but it was never wired in. **Fix:** structural conflict-resolution — divergent same-node reparents defer.
3. **Index-delta commit ordering.** Commit applied *all* dels then *all* adds; a reparent-then-delete of the same node left a stale `childrenOf` entry (the del ran before the add it was meant to cancel). **Fix:** a single ordered `indexDeltas` list applied in staging order.
4. **Staged-delete invisibility.** reparent/createChild validated their parent against the *committed* world, not the batch scratch, so they attached a node to a parent being deleted in the same batch. **Fix:** `curDestroyed` checks on the parent (and reparent target).
5. **Rejected-tx scratch pollution.** A tx rejected by a *late* op had its *earlier* ops' scratch writes already seen by other txs' validation — e.g. a doomed reparent hid a real cycle from a later reparent (P4 violation). **Fix:** a **validation fixpoint** — re-run staging until the rejected set stabilises, so a rejected tx pollutes no one; UUID minting deferred to commit so re-runs are side-effect-free.

## Two fuzzer-methodology corrections (honest — these were test bugs, not engine bugs)
- **Cross-pool signature reads:** the fuzzer's world-signature read `enemy_hp[componentIndex]` for *every* entity; for a crop that reads an unrelated enemy's pool slot, producing phantom "undo mismatches" when a new enemy aliased a crop's row index. Fixed to read only type-owned fields.
- **Permuting same-actor txs:** an early generator reused actor ids and permuted them, but a single actor's txs carry a **causal** order (submission sequence). The determinism guarantee is over *cross-actor* arrival order only. Fixed: distinct actor per tx. (This clarified the guarantee: RD-003 is arrival-order-independence *across actors*; same-actor order is preserved via submission sequence, currently the input position.)

## Transferable principle
Hand-written tests encode the cases you *thought of*; a property-based fuzzer with a ground-truth oracle finds the ones you didn't — and for a concurrency engine the highest-value property is *arrival-order-independence checked by permutation*. Equally important: when the fuzzer fails, decide honestly whether the bug is in the engine or the oracle — three of the seven failures here were the oracle, and calling those "engine bugs" would have corrupted real behaviour to satisfy a wrong test.

## What remains open
- **Contract-gate scratch pollution:** the fixpoint handles *validation* rejections; a tx dropped by its RD-014 contract (after staging) can still have influenced others' scratch. The fuzzer doesn't exercise contracts, so this is unverified — flagged.
- **Multi-tick sequences:** the fuzzer tests single batches. Cross-tick claim expiry / disconnect-mid-action (the RD-002 open card) is still untested.
- **Larger scale / worlds:** 8–20 entities, 2–5 txs. Bigger worlds and deeper batches would broaden coverage; runnable on Modal for billions of cases if wanted.
