# Independent audit of X1, and the resolver-boundary correction

    175 tests in this directory, all green. `node audit-x1.mjs` reproduces the audit below.

## The audit, and why it is a separate artefact

`audit-x1.mjs` is a standalone script, not a test. It imports only production modules, reads the
frozen preregistration from disk, and **prints its evidence** rather than asserting a conclusion, so
someone who has not read the suite can check it. It answers four questions.

### 1. What the frozen contract says

Quoted from `JOURNAL-LINEAGE_PREREG.md`, all present:

    "authorize a successor"
    "this new occurrence may continue that history"
    "content-based successor binding cannot by itself tell a copy from the original"
    "equality alone does not merge identities"

**The frozen contract is history-specific.** It authorizes a successor to continue *that* history,
and names content-vs-copy as a **limit**, not as the definition. A contract meaning *any record with
these exact contents* would be a different contract, and is not the one frozen — so X1 violates the
contract as frozen, rather than merely surprising it.

### 2. Every input the resolver receives

`resolveContinuity(merged, continuity)` is a pure function of exactly those two arguments. The
script dumps both, for the A-run and the B-run:

    origin      S                      (identical)
    ref         auth:2:a               (identical)
    occurrence  2e14906b…6326c4        (identical)
    contentOf   131a73d4…d4f8541       (identical)
    continuity  {predecessor:…}        (identical)
    the two merged sets are byte-identical: true

### 3. Is B independently a different object?

    A === B                                   false
    JSON.stringify(A) === JSON.stringify(B)   true
    contentOf(A) === contentOf(B)             true
    occurrenceOf('S',A) === occurrenceOf('S',B)  true

Two distinct objects, identical in every representation the runtime receives. The audit separates
them only by **reference identity**, which is never serialized and never reaches the resolver.

### 4. The resulting attachment

    resolver finding, A present : CONTINUED
    resolver finding, B present : CONTINUED
    run ok                      : true
    unresolvedGovernance        : []
    obligation.mode             : DESIGNATED
    obligation.governedBy       : GOVERNING_BY_AUTHORIZED_CONTINUITY
    the record admitted was B   : true

**Confirmed:** A's authorization attached to B, reported as authorized continuity, with nothing
flagged.

## What the audit does and does not establish

**Does:** the current implementation attaches A's governance to B without detecting the
substitution, under a contract that is history-specific, with inputs that represent A and B
identically.

**Does not:** that every possible history-specific transfer is unsafe. That is a containment choice,
not a theorem. What is established is narrower and firmer: **this contract cannot be enforced on
these inputs.** Another digest over the same inputs cannot help, because the inputs are the problem.

## One apparatus defect in the audit itself, preserved

The first run printed **MISSING** for *"content-based successor binding cannot by itself tell a copy
from the original"* — a phrase that **is** in the preregistration and merely **wraps across two
lines**. A substring check answering "absent" because of a line break is a false negative, and this
one was about the contract's own wording. The audit now normalises whitespace before searching.

## The resolver-boundary correction

The earlier fix — replacing `__specimenUncontainedContinuity` with a caller-supplied
`continuityResolver` option — **did not remove the bypass capability**. It removed the
defect-specific option and the import dependency, which is useful separation, but a caller who can
inject the function that *decides* continuity can still replace the check.

Corrected:

- **`replayMerged` is the production entry point and PINS the contained resolver.** A
  `continuityResolver` passed to it is ignored (**X6**).
- **Injection lives in `_test-entry.mjs`**, a separate testing entry point that *requires* an
  explicit resolver and throws without one (**X6**).
- `replayMergedWithResolver` is internal, exported only for that entry point.

**Stated limit, unchanged and not softened: in JavaScript a bypass that exists is callable by anyone
who imports it.** X4 reaches the specimen by importing it. This moves the capability behind a
boundary; it does not remove it.

## The decision this leaves to the governor, not to me

The next containment step is broader than what has been built, and it is a **choice**:

> **Until an independent binding exists, refuse transfers that claim to inherit governance from a
> particular history.**

Its cost is larger than C2's: it would refuse *all* history-specific transfers, including the many
that are unambiguous today. The alternative is to state plainly that the current mechanism does not
preserve historical identity, and to let callers choose the other contract explicitly —
*authorize whichever record matches this content* — which is a different contract and must be
**chosen**, never substituted for historical continuity.

**I have not made that change.** The audit was the agreed step; the containment decision belongs to
the governor.

## The decisive pair, frozen for whatever comes next

A legitimate **A** and its byte-identical replacement **B**, as constructed in `audit-x1.mjs` and
X1–X3. With today's runtime inputs the system **cannot** accept A and reject B on historical
grounds. **Any future mechanism must introduce an authorized distinction that the replacement does
not automatically inherit** — and the way to test it is this pair.
