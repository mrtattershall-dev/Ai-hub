# PREREGISTRATION — BRIDGE-1. Production behaviour against the calculus as a specification, with the correspondence itself as evidence.

Frozen before the mechanism exists. Nothing else is in this commit. Builds on `45f94d7`.

## Why this is a separate slice

The differential architecture arrived while SEMANTIC-1 was mid-flight. Folding it into a frozen
preregistration would be reinterpreting a prediction after seeing a result, so SEMANTIC-1 was
finished as written and this is preregistered on its own.

## The triangle, and the rule that it must not collapse

    WHAT SOFTWARE DOES        production behaviour, observed
    WHAT IT SHOULD BE ALLOWED calculus, as an executable specification
    WHY THOSE ARE THE SAME    bridge evidence

Three objects. **If any edge is missing, the answer is UNKNOWN or UNMAPPABLE, never a verdict.**

**The calculus is NOT imported into production and production need not know it exists.** A scanner
that requires its subject to adopt its ontology is a scanner for cooperative software only; the
whole value of the harder version is that it might later be pointed at a repository that has never
heard of Legasus.

## PREDICTIONS

**B-1. Four comparison states, and REASON_DISAGREEMENT is not folded into AGREE.**

    AGREE                  same permission/result, for the same justified reason
    RESULT_DISAGREEMENT    production and specification differ on the result
    REASON_DISAGREEMENT    same answer, different justification
    UNMAPPABLE             production behaviour not faithfully expressible in calculus vocabulary

*Control B-1b (must fire):* a fixture where production and specification return the SAME answer for
DIFFERENT reasons must come out REASON_DISAGREEMENT, not AGREE. A path can refuse safely today for a
reason that becomes dangerous downstream, and `prod === spec` cannot see that.

**B-2. UNMAPPABLE is never coerced.** A production concept with no counterpart in the specification
is UNMAPPABLE - not "probably UNKNOWN", not "closest thing is REFUSED". It is a capability gap in the
SPECIFICATION and is not evidence against production.
*Control B-2b (must fire):* a production state word absent from the calculus yields UNMAPPABLE.

**B-3. The bridge is an evidence object with its own provenance and validity**, carrying
`production_subject`, `production_observation`, `specification_subject`,
`specification_proposition`, `relation` (EQUIVALENT / NARROWER / BROADER / PARTIAL / UNKNOWN),
`evidence`, `provenance`, `valid_against`. A bridge without provenance is refused at construction,
exactly as a contract is.

**B-4 (THE ONE THAT WILL BITE). Bridge mutation is caught.** Three independent attack modes, all
preregistered:

    IMPLEMENTATION MUTATION   calculus fixed, production behaviour changed -> divergence detected
    SPECIFICATION MUTATION    production fixed, calculus semantics changed -> comparison changes
    BRIDGE MUTATION           both fixed, the CORRESPONDENCE corrupted     -> a control notices

*Control B-4b (must fire):* with production correct and specification correct, a corrupted bridge
must not produce silent AGREEMENT. **False agreement is the dangerous failure here, not false
discrepancy**, and the control must test that direction specifically.

**B-5. A bridge whose subject has moved is STALE** and can neither convict nor absolve, on the same
digest rule contracts use - applied to BOTH endpoints, production and specification.

**B-6 (PREDICTION OF NO DETECTION).** I predict BRIDGE-1 finds no RESULT_DISAGREEMENT on this
repository, because production does not consume the calculus and the comparison will mostly be
UNMAPPABLE. **A large UNMAPPABLE count is the expected, honest result** and must not be treated as a
failure of the slice or quietly narrowed into agreement.

## WHAT THIS SLICE DOES NOT ESTABLISH

- No backward/sink discovery; the surface stays one-directional and CAVEAT stands.
- **The calculus is not wired into production**, and no production module is edited to make the
  comparison easier.
- No merging of the five prototypes.
- The bridge is human testimony carrying provenance. That is the same standing a contract has, and
  it is stated rather than implied.
