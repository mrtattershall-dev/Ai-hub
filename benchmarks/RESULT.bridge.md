# r4 — BRIDGE-1. RESULT: B-6 held, but only after the bridge manufactured 965 findings, and B-4b FAILED.

Predictions frozen in `865363b`. Substrate: `legasus/legascreen/bridge.mjs` and
`bridges/covers-delegate.mjs`. Run: `node benchmarks/run-bridge.mjs` over the whole test suite.

## The experiment

    PRODUCTION      justification.covers(granted, required)
                    "is this granted scope broad enough to license what is asked for?"
    SPECIFICATION   calculus.delegate({from, grant, to, context})
                    "may authority held over one world move to another?"

Production does not import the calculus and does not know it exists. **12,301 production calls were
witnessed from existing tests** and each was put to the specification through the specification's own
constructors.

    endpoints pinned at   production f110f76dbf951e1f   specification 8988942c5701be7b

## Result

    WIDE BRIDGE        relation PARTIAL
        UNMAPPABLE                12301      a PARTIAL relation licenses no verdict at all

    RESTRICTED BRIDGE  relation EQUIVALENT, domain: the requirement names exactly the
                       dimensions the grant pins
        in domain                  4760 / 12301   (7541 outside the domain, not compared)
        AGREE                       770
        UNMAPPABLE                 3990
        RESULT_DISAGREEMENT           0
        REASON_DISAGREEMENT           0

**B-6 held: no RESULT_DISAGREEMENT.** The large UNMAPPABLE count is the honest expected result and is
not a failure of the slice.

## THE BRIDGE MANUFACTURED 965 FINDINGS AGAINST PRODUCTION, TWICE

**First run: 965 RESULT_DISAGREEMENTs.** Every one was the same shape. `covers` treats `ANY` as
"licenses anything"; **the calculus context has no wildcard at all** - `delegate` compares contexts
with `!==`. Production holds a concept the specification cannot represent, and the bridge silently
coerced it into 965 accusations.

**Second run: 4 left.** Two of those four had `granted` and `required` **identical** and the
specification still refused, because the scopes carried an `UNADMITTED` object and `!==` over a
nested object decides on **reference identity**, not on worlds. `covers` ignores `UNADMITTED` by
design. Another concept with no counterpart.

The repair is general rather than a patch per case: a scope value that is not a primitive has no
faithful counterpart, because strict equality over it answers a question about references. **The
alternative - stripping `UNADMITTED` before translating - was rejected**, because that would be the
bridge claiming the drop is meaning-preserving, which is the fabrication this slice exists to avoid.

    965 -> 4 -> 0

Both defects were in the BRIDGE. Production was right both times, the specification was right both
times, and a mistaken correspondence produced accusations against working code.

## B-4b FAILED, AND THE FAILURE IS RECORDED AS A FAILURE

The preregistration said: *with production correct and specification correct, a corrupted bridge must
not produce silent AGREEMENT.* **It does.**

    production REFUSED because STALE_EVIDENCE
    specification REFUSED because CONTEXT_WIDENED        <- genuinely different reasons

    honest bridge      -> REASON_DISAGREEMENT
    ONE EDITED LINE    -> reason_correspondence: { STALE_EVIDENCE: 'CONTEXT_WIDENED' }
                       -> AGREE

Nothing in the comparison can tell. **The bridge is the oracle for its own correctness**, and
provenance plus endpoint pinning give attributability and staleness - not detection. A test asserts
this failure so it cannot quietly become behaviour.

The two mutation modes that DO work are asserted alongside it: implementation mutation (specification
fixed, production changed) and specification mutation (production fixed, specification changed) are
both caught. **Bridge mutation is not.**

What would be needed is not more provenance: it is a second, independently derived correspondence to
disagree with the first, or a bridge whose reason classes are themselves derived from counterfactual
behaviour rather than declared. Neither is built, and neither should be claimed.

## What held

    B-1   four states, REASON_DISAGREEMENT kept out of AGREE            HELD
    B-1b  same answer / different reason -> REASON_DISAGREEMENT         FIRED
    B-2   UNMAPPABLE never coerced                                      HELD
    B-2b  a concept with no counterpart -> UNMAPPABLE                   FIRED
    B-3   a bridge without provenance is refused at construction        HELD
    B-4   implementation and specification mutation caught              HELD
    B-4b  bridge mutation caught                                        FAILED
    B-5   either endpoint moving blocks conviction AND absolution       FIRED
    B-6   no RESULT_DISAGREEMENT on this repository                     HELD (after two repairs)

## The independence that makes this worth doing

    calculus    = executable specification
    production  = independent implementation

A defect in one does not automatically exist in the other, which is what makes agreement
informative. **The calculus is still not wired into production**, and nothing here nudges it that
way - wiring them would let both sides share one implementation defect and agreement would stop
being evidence.

    transforms SCREENED (mechanically, no driver)   1
    previously unknown repository defects           0
    production/specification RESULT_DISAGREEMENTs   0

Focused 11/11. Suite 672/672.
