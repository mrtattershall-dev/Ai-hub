# RD-005: Conflict-Resolution Policy (Closed)

**Question:** When identity (RD-004) detects that two branches changed the *same field* of the *same object*, and we must produce a value — who wins?

**Method:** Same shape as RD-004's identity suite. Four candidate policies as pure functions, run against a battery of concrete conflicts with real field semantics, scored against properties a resolution can preserve or violate. Not "pick the best policy" — map which policy is *admissible* for which kind of field. `experiments/005_conflict_policy/resolution_policies.js`, zero deps.

## Candidates
- **LWW** — last-write-wins by *logical* clock (not wall-clock).
- **Defer** — never invents a value; emits an explicit unresolved marker holding both sides. (RD-004's "detect, don't resolve" as a policy.)
- **Domain** — resolves only where field semantics admit an order-independent fold (additive→sum, max→max, set→union); otherwise falls back to Defer.
- **AIProposed** — stand-in for an LLM proposal. Crucially does NOT commit: it proposes and marks `needsReview`; the proposal re-enters as unresolved-pending-validation.

## Safety properties (measured)
1. **deterministic** (semantic) — swapping A↔B doesn't change the *meaning* of the result. Convergence across replicas.
2. **foldWhenResolved** — if a policy autonomously settles a foldable field, the value must equal the fold (both intents present).
3. **noBlindArbitration** — for fields with no principled fold (labels), a policy must not autonomously pick one author's value into live state. "Communication, not arbitration" made testable.
4. **noSilentLoss** — anything discarded must be recoverable (residue) or held in a marker.
- **autonomous** — settles without a human. A throughput *bonus*, explicitly NOT a safety requirement.

## Test-integrity note (the RD-004 lesson, recurring)
The FIRST run declared LWW "admissible everywhere" and flagged Defer/Domain as non-deterministic — a clean-looking but wrong result caused by two bugs in the *test*, not the policies: (a) `deterministic` compared JSON strings, so a set-union `[a,b,c]` vs `[a,c,b]` and a symmetric defer-marker looked "different"; (b) the properties never penalized LWW for dropping a real contribution. Fixed with semantic canonicalization + a fold-when-resolved property. Kept as a reminder: distrust a clean result until the test itself is checked.

## Proven (measured, corrected suite)
- **LWW is INADMISSIBLE.** Violates `noBlindArbitration` on labels (silently picks one name) and `foldWhenResolved` on additive/max/set (picks one side, discarding the other's real contribution — water=30 when both waterings should sum to 70). This is the Dust & Harvest last-write-wins bug, generalized. It settles 4/4 — and settles them wrong.
- **Domain is ADMISSIBLE and settles 3/4 autonomously** — correctly and losslessly folds additive/max/set, defers the label.
- **Defer and AIProposed are ADMISSIBLE, 0/4 autonomous** — always safe, never commit a value nobody chose. AIProposed never commits directly.

## Decision
**Resolution policy is selected by FIELD SEMANTICS, not globally:**
- Field declares a commutative fold (additive / max / min / set-union / …) → **auto-fold** (Domain). Deterministic, lossless, no human needed.
- Field has no principled fold (labels, opaque, structural) → **Defer**: surface an explicit conflict, both values preserved, resolved by the author.
- **AI may propose** a resolution for deferred fields, but a proposal is never a commit — it re-enters the pipeline as *unresolved-pending-validation* and must pass the RD-002 Validator like any other intent.
- **LWW is rejected** as a default. (Still admissible as an explicit per-field opt-in for truly disposable "who cares" fields, but never the fallback.)

This slots directly under the RD-002/003 pipeline: the Validator/merge layer consults per-field semantics; commit only proceeds for auto-folded or human/AI-then-validated values.

## Transferable principle
Conflict *resolution* is only legitimate where field semantics guarantee no arbitration (a fold exists). Everywhere else the honest move is to defer to a human, optionally accelerated by an AI proposal that still has to be validated. Autonomy is a throughput bonus you earn from semantics — never a license to pick a winner.

## Open / out of scope
- Where do per-field fold semantics live (schema? component metadata? RD-003 relates)? Not yet decided.
- Structural conflicts (both branches reparent an object, or edit a list's order) — only the flat-field and set cases were tested.
- No integration yet with the reconstructed pipeline code (this was an isolated policy suite, like RD-004 was).
