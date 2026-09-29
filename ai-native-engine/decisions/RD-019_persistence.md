# RD-019: Persistence / Serialization-Storage (Closed) — spine decision #3

**Question:** What does the engine write to disk, and how does it reload, so a round-trip reproduces the world *without breaking the invariants the rest of the engine rests on* — UUID non-recycling (RD-004/004.6), tombstones, and index consistency (RD-001/017)?

**Relation to RD-007:** RD-007 already split the two serializations — AI-facing = legible columnar text of a retrieved slice; on-disk = byte-optimal, model never reads it. This closes the on-disk half: the *contract* of what to store, independent of JSON-vs-binary bytes.

## Method
Two rival save/load couplings, measured against the invariants (not reasoned). `core/persistence.js` (winner), `core/persistence_test.js` (18 assertions, ALL PASS).

- **WINNER — authoritative-only + rebuild:** store live entities (uuid, type, parent-by-uuid, name, refs, component fields), tombstones, the **uuid high-water counter**, and tick. Rebuild the derived indexes on load.
- **RIVAL — naive persist-derived + reset-counter:** additionally serialize the derived indexes, and reset the uuid counter to the live count on load.

## Proven (measured — the rival fails two invariants)
- **Round-trip fidelity (P1/P2/P6):** the winner reproduces live entities + tombstones + counter exactly; rebuilt indexes equal the ground-truth oracle; a reloaded engine drives protocol proposals normally; save→load→mutate→save→load is stable.
- **Identity safety — the RD-004/004.6 killer (P3):** the rival's reset-counter **recycles a tombstoned UUID** on the next spawn (`u4` reused), so a stale reference to the deleted object now silently resolves **live** — the freelist bug re-entering through the back door of save/load. The winner persists the high-water mark, so the next id is fresh and the tombstone still resolves `deleted`.
- **Stale-proof — the RD-017 failure at the storage layer (P4):** because the rival *stores* the index, the on-disk index can be stale or tampered and **loads as a silent lie** (index ≠ data; "who references X?" answers wrong). The winner stores no index — there is nothing to corrupt, and rebuild-on-load is consistent by construction.
- **Size (P5):** the naive blob is strictly larger — the derived index is redundant recomputable bytes.

## Decision
- **Persist authoritative state + the identity high-water mark; rebuild everything derived on load.** Never store a derived index (RD-001), never reset the uuid counter to a count (RD-004/004.6).
- **Snapshot is the persistence mechanism**, not transaction-log replay. A full faithful replay *would* reproduce identities (it re-runs every spawn), but its cost is O(all history) with an unbounded log; snapshot load is O(live + tombstones). The transaction log (`Engine.log`) is the substrate for **undo (#9)**, where locality matters — not for full reload.
- **Format is JSON for v1** (zero-dep, inspectable); RD-007 permits a packed binary on-disk form later. The contract — authoritative-only + rebuild + preserve counter — is bytes-independent.

## Transferable principle
Persist only what cannot be recomputed, plus the monotonic counters that make identity non-recyclable; regenerate everything derived on load so the stored form can never disagree with itself. A format that stores a derived view can load a lie; a counter reset on load resurrects the ghosts it was meant to bury.

## Open costs / what remains
- **Tombstone accumulation (honest cost of RD-004.6):** snapshot size is O(live + *all-time deletions*). 50 create-then-delete churns left one live entity but 50 persisted tombstones (~2 KB). Tombstone GC/compaction — safe to drop a tombstone only once no live reference can point at it — is unbuilt and is its own research card.
- **Binary on-disk form** (RD-007-permitted) unmeasured; JSON is v1.
- **Schema migration / versioning:** `v:1` is stamped and checked, but no migration path across versions yet.
- **Partial/streaming save** for very large worlds (the SoA capstone's 50k+ entities) untested; current save/load is whole-world.
- Claims and tick-scoped runtime state are intentionally NOT persisted (ephemeral coordination); a load starts with no active claims, which is safe.
