# Authority lineage — can one admission create authority a later one legitimately consumes?
Frozen 2026-09-21, before the store was rebuilt.

## What is and is not already shown

**Shown:** given an already-populated store, a later derivation can use a relation witness only if it
resolves to genuine established authority for the exact relation instance.

**Not shown:** that a **real admission** creates that authority, and that an **independent later
admission** consumes it. Until that loop closes, `evidence_root` is test scaffolding.

    Certificate A -> adapter -> OBSERVE/DERIVE -> admission -> minted relation authority
                                                                       |
                                                        AUTHORITY STORE, opaque handle
                                                                       |
    Certificate B -> witness.evidence_root = handle -> resolve -> checks -> DERIVE -> admission B

## Two design commitments, frozen

**1. Handles, never tokens.** `store.admitToken(tok) -> ref`; `store.resolve(ref) -> live token or
refusal`. A certificate carries the **ref**. The producer names the handle it wants; it does not say
what the handle proves.

**2. The persistent artefact is an ADMISSION RECORD, not a serialized token.** `legaknow`'s brand is
a module-private WeakSet, so a JSON clone is deliberately not authority. Lean into it:

    persistent    claim, evidence refs, provenance, dependencies, procedure, contract + rule versions
    process-local the live AuthorityToken

**After a restart a saved record is not live authority.** Regaining it costs re-execution, which is
the asymmetry `justification.mjs` already enforces: invalidation propagates, revalidation never does.

## The arms

    S1  A admitted -> stored -> B references it                B derives
    S2  A fails admission                                      no ref exists; B refuses
    S3  A invalidated before B                                 B refuses the stale root
    S4  a serialized/cloned A                                  cannot become authority
    S5  A valid but from the wrong repository/context          B refuses
    S6  A was itself legitimately DERIVEd                      B accepts        <- anti-refusal
    S7  B depends on itself through stored lineage             the chain refuses
    S8  retain a direct alias to A, then revoke the store entry  ?

**S8 is the most informative and I do not know its answer.** `invalidate()` returns a **new**
invalid token and leaves the original frozen token valid and branded. So a holder of a direct alias
may still present valid-looking authority after revocation. If so, **revocation is only effective
for consumers forced through the store**, and that must be stated rather than assumed away. The
question is not whether to change the calculus — it is which world we are in.

## Dependency topology, not decorative provenance

When B consumes A, the store records `A -> B`. If A later becomes invalid, B becomes
UNESTABLISHED, and so does anything resting on B. **Repairing A does not restore B**; B must be
re-run. That is the justification-graph rule applied to runtime admissions.

## Predictions

    L-1  S1 and S6 succeed; S2, S3, S4, S5 and S7 refuse, each naming why
    L-2  invalidating A marks B UNESTABLISHED transitively, and re-validating A does NOT restore B
    L-3  S8: a retained direct alias REMAINS usable after the store entry is revoked. I predict the
         bypass EXISTS at the JS API level and is UNREACHABLE through the certificate seam, because
         a certificate can carry only a handle and a token cannot survive JSON.
         FALSIFIER either way: if the alias is refused, revocation is stronger than I think; if a
         certificate can carry a token, the seam is broken.
    L-4  legaknow remains byte-unchanged.

## Scope, stated exactly

This tests whether established authority can be **produced, stored, referenced, invalidated and
reused** under the three already-supported producer-authored rules. **It makes no claim about
general inference recognition.** Rule selection stays unattacked and the census stays at zero
correspondence; the fifteen pre-registry declarations remain spent.
