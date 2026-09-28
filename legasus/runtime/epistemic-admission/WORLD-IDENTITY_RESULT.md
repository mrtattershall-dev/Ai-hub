# World identity — measured, then repaired. S5 closes; R-W4 fails and finds a drift gap.
2026-09-21. Preregistration `WORLD-IDENTITY_PREREG.md` (measurement) plus its frozen repair section.
83 tests across eight suites, all passing. `legaknow` byte-unchanged. Census still zero.

## The measurement, and it was a search rather than a choice

Every subset of `{repository, claim_domain, evidence_extent, procedure}` was evaluated against five
arms. Two subsets qualify; exactly one is minimal.

    (none)                                        fails D1
    repository                                    fails D2  (a changed claim domain still transfers)
    claim_domain                                  fails D1  (a changed repository still transfers)
    repository + claim_domain                     QUALIFIES   <- minimal, and unique
    repository + claim_domain + evidence_extent   fails D3a (refuses a legitimate narrowing)
    repository + claim_domain + procedure          qualifies, not minimal
    ... every other subset fails D1 or D2

    M-1  no single coordinate qualifies                          HOLDS
    M-2  {repository, claim_domain} is the unique minimal set    HOLDS
    M-3  extent as EQUALITY fails D3a specifically               HOLDS
    M-4  procedure is not necessary for transfer                 HOLDS

> **Identity is `{repository, claim_domain}`. Extent is ORDERED, not equal. Procedure is
> provenance.** A detector may run in repository R, examine only sample S, and establish something
> about function F; the measurement says two of those are identity and one is not.

## The repair, and S5 closes

    contract v1.4   measurement.observation.context.repository, required
    adapter         the token context is built as {repository, claim_domain, examined,
                    domain_size, procedure} - identity first, provenance alongside
    store           both identity coordinates compared for equality; extent compared by order

    R-W1  S5 now REFUSES, on BOTH coordinates independently      HOLDS
    R-W2  S1 still succeeds; legitimate lineage is not broken    HOLDS
    R-W3  examined 90 of 60 transfers; 30 of 60 does not         HOLDS
    R-W4  the rule digests move, forcing a re-pin                **FAILS**

## R-W4 FAILED, and it is a live drift-coverage gap

The satisfaction semantics changed materially — one undefined-tolerant comparison became two
equality checks and an ordering — and **the rule fingerprints are byte-identical**.

`digestOf` hashes `satisfiedBy.toString()`. That source contains the **call**
`resolveEvidenceRoot(w, ctx)` and not that function's body. So:

> **`RULE_DEFINITION_MOVED` protects only what is written INSIDE a matcher.** Behaviour reached
> through a called function can change underneath a certificate that still validates.

**Recorded, not repaired.** Closing it means digesting a transitive dependency, which is a different
claim and needs its own frozen prediction. It is the same species as every other finding in this
sequence: a guard that is real where it looks and absent one step away.

## The three collapses this avoided

Adding `repository` to the context is the obvious repair and would have been wrong on its own.
Without the search I would not have known that:

    evidence_extent must NOT be identity      it would refuse legitimate narrowing
    procedure must NOT be identity            it would refuse a second procedure proving the same thing
    claim_domain must BE identity             repository alone lets a claim about another population
                                              transfer inside the same repository

## Open

1. **R-W4's drift gap.** Next frozen experiment.
2. Certificate A is still retargeted in the test; the producer has no relation-establishing path.
3. The store is process-local; nothing re-executes a record to regain authority.
4. Rule selection stays frozen at zero correspondence over fifteen spent declarations.
