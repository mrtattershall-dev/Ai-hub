# RD-B6.1 — Mid-session save/reload × multi-rule sessions (RD-B5 × RD-B6 composition)

**Status:** CLOSED (measured, 2026-07-15; adversarially reviewed + fuzzed same day;
post-review follow-up audit same day — findings #6, chained-P6 upgrade)
**Evidence:** `experiments/031_reload_composition/reload_composition.js` — 49/49 PASS;
`experiments/024_concurrency_fuzz/fuzz.js` P6 arm (2 CHAINED reload cycles/iter,
sig + save bytes) — 20k × 3 seeds PASS
**Fixes landed:** `core/engine.js` (spawn orderKey default; non-finite orderKey guard;
NO_ROW sentinel + hard throw on stub pool-field access),
`core/persistence.js` (capacity persisted; tombstone-stub dangling-parent chains)

## Question

RD-B5's calibration exercises every multi-rule phenomenon (fold arbitration,
delete-vs-write atomicity coupling, reap/reseed churn) and never saves.
RD-B6's fork-determinism test saves a 5-tick world where no crop ever reaches
the reap threshold — no delete, spawn, fold event, or coupling tick ever
crosses the round-trip. Both decisions individually closed; the seam never
crossed. Is a mid-session reload observationally invisible to a running
multi-rule session?

Bar: fork the world at (or immediately before) each RD-B5 phenomenon and
demand the reloaded branch is tick-for-tick identical to the branch that
never saved — instrumented traces AND authoritative bytes. Division of labor
(verified by reverting the fix): traces catch behavioral divergence; they are
BLIND to sibling order — the byte/orderedChildren checks carry that class.

## Method

031 T1–T5 (oracle loop forked mid-churn + NC-A bites-control; fork inside the
opposed-fold; fork one tick before the delete-vs-write coupling; rule-reaps-
rule's-target then reload → quarantine + roster-divergence accounting;
post-reload tick = one undo). Then two independent hostile passes:
an adversarial review agent (instructed to break fix and test), and a new
permanent fuzzer arm — **P6 RELOAD-FORK DETERMINISM** (`fuzz.js`): after a
random batch commits (tombstones → load compaction), fork via save/load,
drive both branches with a second random batch (spawns, moves, raw orderKey
writes incl. Infinity/NaN now generated), signatures must match. P6 exists
because 20k green P1–P5 iterations held WITH the first bug present — no prior
property ever compared a reloaded branch against the branch that never saved.

## Findings (each caught by this card's instruments, each fixed or pinned)

1. **orderKey index default (031 T1, first run).** `spawn` defaulted the
   RD-005.3 authoritative sibling key to the entity INDEX; load compacts
   indices → post-reload spawns interleaved among pre-fork siblings
   (`u2,ua,ub,uc…` vs `u2,uc,ua,ud,ub…`). Fix: default derives from the
   entity's own uuid seq — persisted (RD-019 high-water), and seq === index
   in a never-persisted engine so nothing else changed. Custom-uuid spawns
   (review #4) guarded: only a strictly minted-shape uuid parses as a seq
   (`/^u[0-9a-z]{1,10}$/`, parse < 2^53); anything else consumes a fresh seq —
   append-ordered, never parseInt garbage (`'x-7'` → −7 would sort FIRST).
2. **Non-finite orderKey (review #1).** The engine COMMITTED
   `setfield orderKey=Infinity/NaN` (Float64, no int range ⇒ range check
   skipped); JSON rewrites non-finite to `null`, load's `?? fallback` then
   silently replaced it — reload visibly reordered siblings, and the fuzzer's
   own P4 asserted finiteness with no generator behind it. Fix: validate-layer
   rejection (localized), fuzzer now generates non-finite orderKey writes.
3. **Capacity unpersisted (review #3).** The RD-B2 count-expr range proof
   validates against `[0, capacity]` and world-full is capacity — both
   depended on what the LOADER passed (same world+rule: installed at 200,
   quarantined at hint 512; 1024-world reloaded hintless got 64). Fix:
   capacity persists (additive, still schema v1); hint may only RAISE it
   (explicit caller choice). Revalidation verdicts reload-stable by
   construction.
4. **Dangling parent edges rooted on load (fuzz P6, first run).** RD-005.2
   keeps an orphan surfaced-not-cascaded in-session (child's parent points at
   the tombstone); load silently rooted it. Diverged: `parentOf` answers,
   sibling sets → move-key computation, RD-019.1 GC reachability (dangling
   parents keep tombstones alive), and cycle verdicts — cycle validation
   walks THROUGH dead rows (conservative-correct: undo can resurrect the
   link), so the dead row's own parent pointer is decision-bearing. Fix:
   save persists `tombstone.parent` for exactly the dangling-REACHABLE dead
   set (identical on both branches; unreachable rows can never influence a
   verdict — keeps re-saves byte-deterministic); load re-materializes
   tombstoned parents as stub destroyed rows, chains included (row present,
   destroyed=1, out of byUuid, componentIndex poisoned −1).
5. **Claims released on reload (review #2) — BOUNDARY, not bug.** Claims are
   session state, ephemeral by prior decision (RD-020: "history is ephemeral,
   not persisted, like claims"). A live claim at save time means the branches
   genuinely diverge on the next tick. Pinned explicitly (031 T6c; P6 clears
   claims at the fork), never silent. Expiry/disconnect semantics belong to
   the open claim-TTL card — a reload IS a disconnect of every actor.
6. **Stub "poison" sentinel never stored (follow-up audit, same day).** The
   stub fix (#4) documented `componentIndex = -1`, but componentIndex is
   Uint32 — the write wrapped to 0xFFFFFFFF, so no `< 0` / `=== -1` check
   could EVER fire; safety was luck (out-of-bounds typed-array reads return
   undefined, writes silently no-op — the exact silent shape of finding #2).
   Fix: explicit `NO_ROW = 0xFFFFFFFF` sentinel exported from engine.js;
   `_field`/`_writeField` THROW on pool-field access through it (per-entity
   fields name/orderKey/destroyed stay readable — a stub owns those rows).
   Caller audit: history inverses capture only entities live at commit, and
   stubs are absent from byUuid so no op can target one — the assert cannot
   hit a legitimate path. Pinned: 031 T6e.

## Follow-up audit (same day; two gaps probed, one closed, one confirmed clean)

- **Chained reload cycles.** The original orderKey bug was a SECOND-cycle
  divergence, but P6 forked exactly once per iteration — the fix was proven
  only for the observed symptom's depth. Probed: 600 random worlds × 4 chained
  save/load cycles, sig + save bytes vs the never-saved branch — clean; plus
  5-deep save→load→save byte idempotence over a persisted dead chain — clean.
  Made permanent: P6 now runs TWO chained reload cycles per iteration and
  compares save BYTES as well as signatures (traces are blind to sibling
  order; bytes carry that class).
  **Coverage scope (explicit decision, not an oversight): the chained-reload
  invariant is VALIDATED to depth 4–5 by a one-off probe (600 worlds × 4
  cycles; 5-deep byte idempotence) but CONTINUOUSLY FUZZED only to depth 2,
  for runtime cost.** Depth 2 is where the known bug class lives (every
  divergence found so far was cycle-2: first re-save after a post-reload
  mutation); nothing suggests a depth-3+-only mechanism, but "P6 green" means
  depth-2 green — do not read it as N-cycle coverage.
- **Signed-sentinel sweep (prompted by #6): componentIndex was the ONLY
  instance.** All nine World typed arrays audited: `parent` is the only other
  array holding a -1 sentinel and it is Int32 (signed — sound, including
  materialize()'s -1 flowing into it); the six unsigned arrays take only enum
  values, 0/1 flags, validate-clamped field values, or pool cursors (plain JS
  array, always ≥ 0). Zero dead `< 0` / `=== -1` checks against unsigned
  arrays anywhere in the repo. Adjacent observation filed under Open: load
  writes snapshot field values into unsigned pools unvalidated — tampered
  saves silently wrap; legitimate saves cannot (FIELD_RANGE fits every
  array's element type).
- **Stub GC lifecycle — non-issue, by symmetry, now pinned (031 T6f).** Once a
  stub's last live referrer dies, the existing RD-019.1 pass drops its
  tombstone (gcTombstones scans live entities only, so verdicts are identical
  to the never-reloaded branch — no special case), and the next save/load
  compacts the stub row away: save persists dead parents only for the
  dangling-REACHABLE set, and load materializes stubs only when a live
  entity's chain reaches them. Reloaded worlds cannot leak stub rows.

## Verdict

Mid-session reload is observationally invisible to multi-rule sessions **for
all persisted state** — traces, bytes, ordered views, arbitration winners,
coupling events, cycle verdicts, GC reachability, quarantine semantics, undo
granularity — with exactly ONE documented, pinned session-state boundary:
claims release at the seam (by design, pending claim-TTL). The absolute
version of the claim was falsified by review and fuzzing and repaired the
same day; the scoped version is enforced by 031 (49/49) and fuzz P6
(60k iterations × 2 chained reload cycles, 3 seeds, bytes + sigs). The
RD-B5 live run can save/reload mid-session without confounding its
measurements.

Fourth consecutive instance of composition-of-closed-decisions finding what
neither parent could (RD-B2 fuzzer identity gap, RD-B5 opposed-fold,
031's orderKey catch, P6's dangling-parent catch).

## Open

- Claim TTL / disconnect card now also owns: should a reload restore claims
  with remaining TTL instead of releasing? (Current: release, pinned.)
- Fractional orderKeys from long midpoint chains — Float64/JSON round-trip is
  exact (probed to 60 deep); precision exhaustion remains RD-005.3's
  rebalance/LexoRank wart, unchanged.
- Move-to-back key can collide with a future spawn's default (tie-break is
  uuid-lexicographic, `'u10' < 'u9'`) — fork-stable, pre-existing, cosmetic;
  belongs to the same RD-005.3 refinement card.
- Load-time range validation (from the sentinel sweep): `load()` trusts
  snapshot field values into unsigned pools (`ent.growth || 0` → Uint8), so a
  TAMPERED/hand-edited save silently wraps (growth: -5 → 251). Legitimate
  saves cannot trigger it (validate clamps FIELD_RANGE pre-commit and every
  range fits its array's element type). Same silent-wraparound shape as
  finding #6, one layer up — belongs to a future untrusted-save/load-input
  card (RD-017's trust argument covered derived indexes, not authoritative
  field values).
