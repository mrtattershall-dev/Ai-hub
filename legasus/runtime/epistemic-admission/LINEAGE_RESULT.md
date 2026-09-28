# Authority lineage — the loop closes. S5 fails and names a live defect. S8 answered.
2026-09-21. Preregistration `LINEAGE_PREREG.md`, frozen before the store was rebuilt.
74 tests across seven suites, all passing. `legaknow` byte-unchanged.

## The milestone

> **One real admission now creates authority that a later, independent admission legitimately
> consumes.** `evidence_root` has stopped being test scaffolding.

Certificate A is admitted on its own merits. The authority its admission produced is filed under an
opaque handle. Certificate B references the handle, the store resolves it, the rule's matcher checks
the relation instance, and `derive()` mints for B. B's authority traces to a certificate that was
itself admitted — recorded in the store as `fromCertificate: A`.

## Scoring

    S1  A admitted -> stored -> B derives from it            PASSES
    S2  A fails admission: no reference exists               B refuses, "resolves to nothing"
    S3  A revoked before B                                   B refuses the stale root
    S4  a serialized clone of A                              cannot become authority
    S5  A valid but from the wrong world                     **PREDICTION FAILED** - see below
    S6  A's authority was itself DERIVED                     B accepts        <- anti-refusal
    S7  the chain depends on itself                          refuses as circular
    S8  retained alias vs store revocation                   answered, see below
    L-2 invalidation propagates; revalidation does not       PASSES
    L-4 legaknow byte-unchanged                              PASSES

## S5 FAILED, and the failure is the most useful thing here

I predicted that authority established in another repository would be refused. It is **accepted**.

The world check reads `token.context.repository`. `observe()` is given
`cert.measurement.observation.context`, which the producer fills with
`{evidence_scope, examined, domain_size}`. **There is no repository in it.** So `held` is `undefined`,
the comparison never fires, and E4 passed earlier only because those tokens were *constructed* with an
explicit `{repository}` context.

> **On the path a real admission actually takes, the world check does nothing.**

That is exactly what the lineage experiment existed to expose: a check that works on constructed
inputs and is inert on the real one. **Recorded, not repaired** — fixing it after seeing the result
is the retroactive repair this branch forbids, and carrying the claim's domain into the observation
context changes what every token means, so it needs its own frozen prediction.

## S8 answered: the bypass exists, and the seam is closed

    (a) through the store    revocation HOLDS. resolve() refuses; B refuses.
    (b) a retained alias     REMAINS a valid, branded token. invalidate() returns a NEW token and
                             leaves the original frozen one untouched, so revocation is effective
                             only for consumers forced through the store.
    (c) through a certificate UNREACHABLE. A certificate can carry only a handle: putting a token in
                             the evidence_root slot resolves to nothing, and the brand does not
                             survive JSON - the clone looks valid and `isAuthority` says no.

Predicted in L-3 and confirmed in both halves. **Revocation is a property of the store, not of the
token**, and that is now stated rather than assumed.

## Handles and records

The store issues opaque refs; a certificate never holds a token. The persistent artefact is an
**admission record** — claim, constructor, context, ancestry, provenance — and deliberately **not** a
serialized token. After a restart a saved record is not live authority, so regaining it costs
re-execution. That is `justification.mjs`'s asymmetry applied to runtime admissions, and L-2
demonstrates the other half: revoking A marks B `UNESTABLISHED`, and re-establishing A leaves B
`UNESTABLISHED` until B is re-run.

## Scope, stated exactly

This tests whether established authority can be produced, stored, referenced, invalidated and reused
**under the three already-supported producer-authored rules**. It makes **no claim about general
inference recognition**. Rule selection remains unattacked, the census remains at zero correspondence
over fifteen declarations, and those fifteen remain spent as held-out material.

## Open, and named

1. **The world check is inert on the real path** (S5). The next frozen experiment.
2. Certificate A is built by retargeting F4's shape in the test rather than emitted by the Python
   producer for a relation claim. The producer has no path that emits a relation-establishing
   certificate yet.
3. The store is process-local. Nothing yet re-executes an admission record to regain authority.
