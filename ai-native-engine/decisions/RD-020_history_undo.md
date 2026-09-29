# RD-020: History / Undo (Closed) — spine decision #9

**Question:** How does the engine make committed edits reversible — linear vs branching vs event-sourced — and by what mechanism, given that identity (RD-004) and index consistency (RD-017) must survive undo?

**Substrate:** `Engine.log` records committed batches. RD-019 already established the division of labour: snapshot for persistence, the log for undo. This decides the undo *mechanism* and history model.

## Method
Two rival mechanisms, measured. `core/engine.js` (undo/redo + `enableHistory()`), `core/history_test.js` (26 assertions, ALL PASS).

- **RIVAL — snapshot-per-step:** deep-copy the whole world before each batch; undo = restore the copy. Correct but O(N) storage every step, regardless of change size.
- **WINNER — inverse-delta:** at commit, record only what changed and how to reverse it (before-image of each written field, prior parent, resurrect-token for a delete, remove-token for a create). Undo applies the inverse in reverse order; redo applies its opposite. O(change) per step.

## Proven (measured)
- **Exactness (H1/H2/H6):** single and multi-step undo return the *exact* prior signature at every waypoint — across field writes, deletes, and a multi-actor batch mixing an RD-005 fold with a rejected race. One undo reverses a whole batch.
- **Identity preserved — the RD-004 requirement (H3/H4):** undoing a **delete resurrects the SAME uuid** and reconnects the referrers that pointed at it (reverse-ref index restored) — because delete only tombstones, it never clears the row, so resurrection needs nothing but the id. Undoing a **create re-tombstones** its uuid and a later create mints a fresh id — **never recycled** (RD-004.6). Create/undo/redo is identity-symmetric.
- **Index consistency (H1/H2/H6/H7):** every undo/redo rebuilds the derived indexes from authoritative data (reusing the RD-019 stale-proof rebuild), so `indexesConsistent()` holds after every step.
- **Storage cost (H7):** 50 single-field edits on a 201-entity world cost **50 inverse entries** (O(change)); snapshot-per-step would cost **10,050 entity-copies** (O(K·N)) — >100× cheaper here, which is what makes deep undo affordable. Undo/redo stays exact at that scale.

## Decision
- **Inverse-delta undo/redo, linear history** (a new edit after an undo clears the redo stack — no dangling futures; H5). Branching history is a possible extension, not built.
- **Undo preserves identity by construction:** resurrect the same uuid on delete-undo (row data is never cleared, only tombstoned); re-tombstone on create-undo; ids are never recycled.
- **Undo/redo reuse the RD-019 index rebuild** rather than inverting index deltas separately — the rebuild is already proven stale-proof, and it keeps undo correct without a second, error-prone index-inversion path.
- **History is ephemeral runtime state** (H8): the undo/redo stacks are NOT serialized by `persistence.js`, same policy as claims. A reload starts with a clean timeline.

## Transferable principle
Reversibility is cheapest when you store the *difference*, not the *state* — but only if identity is stable enough that "put it back" means the same object, not a look-alike. The tombstone-not-clear delete (RD-004.6) is what makes delete-undo a one-line resurrection; an engine that truly frees deleted rows could not undo a delete without a full snapshot.

## What remains open
- **Branching history** (undo, edit, then recover the abandoned branch) — linear-with-cleared-redo is the v1; a history tree is unbuilt.
- **Cross-session undo** — would require persisting the log (or the inverse stacks) with the snapshot; RD-019 currently drops runtime state on save. Open.
- **History compaction** — the undo stack grows unbounded with edit count; coalescing adjacent same-field edits, or capping depth, is untested.
- **Interaction with claims/multi-actor concurrency** — undo is modelled as a single privileged operation; who is allowed to undo whose committed batch in a multiplayer session is a design question, not yet posed.
