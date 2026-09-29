# Decision Record: Mutation Model & Conflict Resolution
**Project:** AI-native engine editor (early research phase)
**Test case used throughout:** Crop #142 — Player A harvests, Player B waters, same simulation tick (drawn from Dust & Harvest's live P2P conflict)

---

## Status summary

| ID | Question | Status | Evidence |
|----|----------|--------|----------|
| RD-002 | What is the mutation protocol? | **Decided** | Prototypes A–D (below) |
| RD-003 | What is the scheduling/ordering model? | **Decided** | Prototypes C–D |
| — | How should conflicts *feel* to players? | **Decided (design intent, not computed)** | Reasoning below |

RD-001 (world representation: scene tree, chosen provisionally) is unaffected by this record — it was found to be *neutral* with respect to this conflict, which was itself a useful negative result.

---

## What was tested

Four working prototypes, run for real (not reasoned about on paper), in `/experiments/002_transaction_pipeline/`:

### A — Immediate mutation (no validation)
`prototype_a_immediate.js`
Actions mutate state directly, no checks.
**Measured result:** both possible arrival orders (harvest→water, water→harvest) silently converge to the same corrupted state — `state: "harvested", water: 100` — a crop that is simultaneously destroyed and freshly watered. No error, no rejection. **Silent state corruption.**

### B — Transaction + validation
`prototype_b_transaction.js`
Every intent is checked against current state before committing; invalid intents are rejected with a reason.
**Measured result:** corruption is eliminated — watering a harvested crop is now rejected (`"cannot water a harvested crop"`). But the two arrival orders produce *different* final states and different rejection reasons. **Corruption solved. Determinism not solved.** This was the key finding that split RD-002 (mutation validity) from RD-003 (ordering) — they were originally assumed to be one problem.

### C — Scheduling + validation
`prototype_c_scheduled.js`, `commutation_matrix.js`
Intents are sorted into a fixed priority order *before* validation runs, regardless of arrival order.
**Measured result:** both arrival orders now converge to an identical final state. Determinism achieved. However, the follow-up commutation matrix showed this result is partly tautological — a total-order sort is deterministic by construction, so "all pairs commute" wasn't evidence of good design, just evidence the sort ran. This surfaced a distinct, non-computational question: **is the resulting outcome fair to the player who "loses," even though it's consistent?** That question can't be answered by more code — it's a design call, not an architecture call.

### D — Claim layer + duration-aware expiry
`prototype_d_claims.js` (initial, flawed — see below), `prototype_d2_claims_with_duration.js` (corrected)
Before an action starts, the acting player must hold a time-boxed claim on the target object. A second player attempting to act on a claimed object is rejected immediately, with a clear reason, before validation or commit ever runs. The transaction layer (B) still exists underneath as the correctness backstop for any race the claim layer doesn't catch.
**First attempt was invalid:** harvest resolved instantly in that version, so the claim was already gone by the time Player B acted — the claim layer was never actually exercised. This was caught and the test rebuilt with a real multi-tick action duration.
**Corrected measured result:** Player B's water attempt at tick 1 is rejected at the **claim** stage with `"already claimed by A until tick 4"` — before validation, before any confusing "target does not exist" message. After A's harvest completes and the claim releases (tick 3), B can act again.

---

## Decision

**Layered architecture, each layer owning exactly one problem:**

```
Player Intent
     │
     ▼
Claim System        → prevents most conflicts before they happen (player experience)
     │
     ▼
Scheduler            → deterministic ordering for conflicts that do occur (simulation consistency)
     │
     ▼
Validator            → rejects invalid state transitions (engine correctness)
     │
     ▼
Transaction/Commit    → atomic commit or reject (data integrity)
```

This generalizes beyond multiplayer to the same architecture serving: AI-proposed edits, undo, plugin-driven mutation, and editor tool conflicts — all speaking the same protocol.

## Design intent (not computed — a game-design call, recorded here for consistency)

Dust & Harvest is cooperative/simulation-first, not competitive/precision-based. Conflicts should be **prevented** (via visible claims — "Grace is harvesting Wheat") rather than **resolved after the fact** via priority or timestamp. A claim is soft: it can expire, be cancelled, or be interrupted — it is not a hard lock. Networking should stay invisible to the player; the player should experience *communication* ("someone's already doing that"), not *arbitration* ("your action lost").

## What remains open

- RD-001 (world representation) is still **provisional**, not measured — only reasoned about.
- The claim system's expiry/TTL tuning, and what happens if a claiming player disconnects mid-action, haven't been tested.
- No integration with actual Godot/P2P code yet — this is pure logic, no networking, no rendering.

---

# RD-004: Object Identity (Closed)

**Question:** What makes an object the same object over time, and does the chosen model survive rename, move, duplication, deletion/recreation, references, and branching?

**Candidates tested:** UUID, content-hash, path-derived (`/experiments/004_object_identity/`)

## Proven (measured, not reasoned)
- UUID identity is stable under rename, move, duplicate, and delete-then-recreate.
- Path-derived identity **fails** rename and move (the id *is* the path, so changing the path changes the id by construction) and fails delete-recreate (path gets silently reused).
- Content-hash identity **fails** "duplicate creates new identity" and "delete-then-recreate" (two objects with identical fields hash identically, so duplication and resurrection are indistinguishable from the original).
- One test artifact was caught and corrected: an initial content-hash rename test showed a false PASS due to string truncation in the test's hash function, not a real property of content-hashing. Corrected with a full SHA-256 hash — the invariant correctly fails as expected. Kept as a reminder to distrust a clean result until the test itself is checked.
- UUID references (e.g. a quest holding an object's id) survive rename, move, and duplication without losing track of which object was meant, and without a duplicate hijacking a reference intended for the original.
- Two branches modifying **disjoint** fields of the same UUID-identified object merge cleanly, with both changes applied and the identity preserved throughout.
- Two branches modifying the **same** field to different values are correctly detected as a conflict — surfaced explicitly (object id, field name, both competing values) rather than silently resolved by picking one.

## Not proven / explicitly out of scope
- **Conflict resolution policy.** Identity answered "are these edits to the same thing?" — it correctly does *not* answer "which edit should win?" That is a separate, still-open question (candidates: user/editor choice, AI-proposed resolution, domain-specific rules, last-write-wins, three-way merge) and deserves its own research card rather than folding into identity.
- Object lifetime / dangling-reference behavior when a save or reference from another session points at a UUID that has since been deleted — flagged as an important case (explicit absence or a migration layer are acceptable, silent reassignment is not) but not yet built or tested.
- No integration with the actual claim/schedule/validate/transaction pipeline from RD-002/003 — this was tested as an isolated identity model.

## Decision
Use **UUID as the canonical object identity**, assigned once at creation, never recomputed from content or position. Treat this as the current best-evidenced choice, not a final or provable-optimal one — it is the only one of three candidates that survived every invariant tested.

## Transferable principle
An identity system's only job is to answer "is this the same thing?" — consistently, under rename, move, duplication, deletion, and concurrent branching. It should detect conflicts, not resolve them; resolution is a separate policy layer.

---

# RD-004.6: Dangling-Reference Lifetime (Closed)

**Question:** When a saved reference (a quest holding a sword's UUID) points at an object that was since deleted — and a new object was later created — what does resolving that reference do?

**Method:** Three candidate stores as competing designs, run against the properties. `experiments/004_object_identity/dangling_reference.js`, zero deps.

**Candidates:** HardDelete (UUID-keyed map, key removed), Tombstone (delete leaves a marker with type + last-known name), Freelist (recycles deleted UUIDs onto a free list).

## Proven (measured)
- **Freelist is INADMISSIBLE — it fails all four properties.** Recycling a deleted UUID makes the old reference silently resolve to a *different, new* object (the exact silent-reassignment bug RD-004 warned against), and the dangling-reference scan can't even detect it because the id is "live" again. This is the concrete disproof of id recycling.
- **HardDelete is ADMISSIBLE** — the deleted ref resolves to explicit absence, the new object gets a fresh id, dangling refs are enumerable. But it can only report `missing`; it cannot distinguish "deleted" from "never existed".
- **Tombstone is ADMISSIBLE and strictly more informative** — resolving reports `deleted` (vs `missing`) and retains type + last-known name, which a UI or migration pass can use to explain or repair.

## Decision
- **UUIDs are never recycled** — reinforces RD-004 ("assigned once, never recomputed") with "and never reused". A freelist of ids is forbidden.
- **Tombstone-on-delete is the default** over hard delete: resolution must return an explicit, detectable absence (never an ambiguous undefined that reads like a value), and should carry enough metadata (type, last-known name) for a migration/repair layer. Hard delete remains acceptable where tombstone metadata isn't worth the storage.
- The store must expose a **dangling-reference enumeration** hook so a save-load or migration pass can find and surface broken references rather than letting them fail silently at use.

## Transferable principle
A reference to a deleted object must fail *loudly and locally* — explicit absence the caller can branch on — never resolve to whatever now occupies that slot. Identity that can be reused isn't identity.
