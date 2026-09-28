# Closure fingerprints installed — I-1..I-5 hold. Identity moved; behaviour did not.
2026-09-21. Preregistration `INSTALL-FINGERPRINTS_PREREG.md`, frozen before `rules.mjs` changed.
100 tests across ten suites, all passing. `legaknow` byte-unchanged. Census still zero.

## The checkpoint, met

> **Identity tracking changed; inference behaviour did not.**

A behaviour snapshot was taken **before** the change and compared after the re-pin. Every fixture's
admission state, refusal stage, licensed relation, bound witnesses and selected rule are identical.

    F1  FRONTIER_OPEN  DERIVE   NONE        -         existential-from-established-member
    F2  FRONTIER_OPEN  DERIVE   NONE        -         -
    F3  OBSERVED       OBSERVE  NONE        -         -
    F3p OBSERVED       OBSERVE  NONE        -         -
    F4  ESTABLISHED    -        EQUIVALENT  COVERAGE  universal-from-exhaustive-coverage
    F5  OBSERVED       OBSERVE  NONE        -         -

## Scoring

    I-1  STALENESS              old pins refused at stage RULE, `moved: true`, no fallback
    I-2  BEHAVIOURAL IDENTITY   every verdict identical to the pre-installation baseline
    I-3  SEMANTIC CHANGE MOVES  mutating the callee moves the INSTALLED identity
    I-4  IRRELEVANT DOES NOT    a comment edit and an unused new export leave all three identical
    I-5  UNRESOLVED UNPINNABLE  `UNPINNABLE` is empty today, and the refusal path is exercised

## Which identities moved, and which did not

    existential-from-established-member   moved
    universal-from-exhaustive-coverage    moved
    claim-from-direct-observation         DID NOT MOVE

The third has no obligation, therefore no matcher, therefore no closure. **A rule with nothing to
satisfy has nothing that can drift**, and that is a property of the rule rather than an oversight.
It has now survived two consecutive re-pins unchanged.

## The re-pin was explicit, and is recorded twice over

The producer's fingerprints are updated by hand, in `certificate.py`, with both previous values kept
in the comment so the migration is legible: the source-only digests, then the post-resolver digests,
then these. Nothing re-pins automatically — an automatic re-pin would make `RULE_DEFINITION_MOVED`
unfalsifiable.

## A recorded defect closes, and its history is kept

`lineage.test.mjs`'s R-W4 test asserted the **defect**: that a change inside `resolveEvidenceRoot`
left every fingerprint byte-identical. It now fails, because the defect is fixed. Rewritten to
assert the repair, with a companion test that keeps the legacy digest computable and shows it is
still blind in exactly the recorded way. Same treatment S5 received when world identity closed.

## What is NOT claimed

That the closure is the right notion of dependency. F-4 stands: a helper that cannot affect a
decision is still inside the closure, so fingerprints churn on irrelevant changes. That remains
unsolved on purpose.

That the fingerprint's coverage is complete. Four kinds of unanalysable input yield
`FINGERPRINT_UNRESOLVED`, and a lexical scanner is not a parser.

## Open, unchanged in order

1. Natural relation production — the producer still has no path that emits a relation claim, so
   certificate A in the lineage test is retargeted rather than manufactured.
2. Replay: the store is process-local and nothing re-executes an admission record.
3. Rule selection stays at zero correspondence over fifteen spent declarations.
