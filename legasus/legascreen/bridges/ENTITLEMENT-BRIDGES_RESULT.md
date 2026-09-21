# Entitlement bridges — steps 3 and 4: four semantic bridges, first attack, one demotion
2026-09-21. `entitlement-bridges.test.mjs`, 10/10 on node v24. Production side is Python, read only
through the six certificate fixtures; the calculus is passed in by the test and imported by no bridge.
**Comparison instruments, not transport. No adapter, no consumer, no merge.**

## The matrix — RESTRICTED bridges, applied only inside their declared domains

    bridge \ cert          F1           F2           F3           F3p          F4           F5
    measurement-observe    UNMAPPABLE   UNMAPPABLE   UNMAPPABLE   UNMAPPABLE   UNMAPPABLE   UNMAPPABLE
    derivation-derive      AGREE        UNMAPPABLE   AGREE        AGREE        AGREE        AGREE
    obligation-covers      UNMAPPABLE   UNMAPPABLE   UNMAPPABLE   AGREE        AGREE        UNMAPPABLE
    licensed-narrowing     OUT_OF_DOM   OUT_OF_DOM   OUT_OF_DOM   OUT_OF_DOM   OUT_OF_DOM   OUT_OF_DOM

Every WIDE bridge is PARTIAL and returned UNMAPPABLE on all 24 cells, as the framework guarantees. A
moved digest on either endpoint returns UNKNOWN with the stale side named, for all four bridges.

## Earned EQUIVALENT domains — two of four, and both are real

**derivation-derive, 5 of 6.** On every certificate whose premises are decidable at their site, the
certificate's ANY-of-alternatives / ALL-of-premises structure and `justification.entitled()` over a graph
of `ANY_OF` and `REQUIRES` edges agree — including F5, where both **refuse** and for corresponding
reasons (`NO_CLOSED_ALTERNATIVE` ↔ `NO_SURVIVING_ALTERNATIVE`), which is the check that separates
agreement from coincidence. The AND/OR structure crosses the seam without flattening.

**obligation-covers, 2 of 6.** On the universal and absence claims, "coverage of the domain is
EXHAUSTIVE" and `covers(granted, required)` agree — F4 both permit; F3p both refuse for
`NOT_ESTABLISHED`. On those quantifiers the two questions genuinely coincide.

## Gaps found — three in the specification's vocabulary, one in the contract

These are located where they live and are **not** coerced to the nearest answer.

    where          gap                                              seen on     bridge
    CONTRACT       observation carries no `attribution`; observe()  all six     measurement-observe
                   requires it as a provenance field
    SPECIFICATION  validity has ESTABLISHED / UNESTABLISHED /       F2          derivation-derive
                   INVALID and no "undecidable at this site"
    SPECIFICATION  covers() has no quantifier; EXISTS and           F1 F2 F3 F5 obligation-covers
                   POINTWISE have no counterpart
    SPECIFICATION  the repository dimension compares for equality,  synthetic   licensed-narrowing
                   null or ANY; there is no domain containment

The first makes measurement-observe's RESTRICTED domain **empty on contract v1.0.0**. The second is the
H-DEFINED distinction being inexpressible on the calculus side. The third is H-EXTENT's anti-refusal
result — one member licenses a repository existential — reappearing as something `covers()` cannot say.

## The demotion, predicted before it was observed

licensed-narrowing's RESTRICTED domain was first declared as *LICENSES, same quantifier and predicate,
licensed domain contained in the requested one*. I predicted, in the test, that a certificate inside that
domain would produce a **disagreement**: the calculus's free restriction is a null conclusion dimension;
the repaired compiler's is a contained domain. It did:

    production   PERMITTED   RESTRICTED_TO_CONTAINED_DOMAIN
    calculus     REFUSED     "stated for THIS_RUN from a premise established at SAMPLE"

Per the exemplar's own precedent, a concept one side cannot express is UNMAPPABLE, never a finding
against production and never the nearest relation. Containment is now `unrepresentable`, the domain
predicate requires representability, and the RESTRICTED domain is **empty on the current calculus**.
The raw disagreement is reproduced in the test through the readers directly, so the record keeps why.

**Row not exercised:** no real certificate carries `LICENSES` after REPAIR-LATERAL. The demotion rests
on a synthetic certificate, labelled as such.

## What this licenses for step 5

The adapter may reconstruct `entitled()`-shaped derivation structure and `covers()`-shaped universal
obligations from certificates on their earned domains. It may **not** mint through `observe()` from a
v1.0.0 certificate, and must treat any `LICENSES` narrowing as UNMAPPABLE (no subject-level mint) until
the calculus can express containment.

**Proposal, not applied:** contract **v1.1** adds `measurement.observation.attribution` — how the
observation was bound to its subject — supplied by the producer and never by a bridge. The frozen
v1.0.0 is unchanged; a new version is a decision, not an edit.

## Honest discounting

The AGREE cells are on six certificates I emitted from cases I chose, read through readers and reason
correspondences I wrote. They are close to construction. The value of this step is in the UNMAPPABLE
cells and the demotion: four places where the seam would have fabricated agreement or a finding, found
before any runtime consumer existed, each located in the artifact that actually lacks the vocabulary.

`legaknow/` is untouched. `legascreen/bridge.mjs` is untouched. Branches remain separate.
