# W0/W1/W2 result — V1, V2, V3 all confirmed; a passing witness is not a discriminating one
2026-09-21. Preregistration `W-DISCRIMINATION_PREREG.md`. Sealed target
`harry0703/MoneyPrinterTurbo @ 919170b05831`, the project's real functions and its own fonts.
Raw: `legasus/out/wexp/w_experiment.json`.

|  | W0 unmodified | W1 inspection impossible | W2 glyph absent |
|---|---|---|---|
| **T1** `assertTrue` only | PASS | **PASS** | FAIL |
| **T2** `assertFalse` + `assertTrue` | PASS | **FAIL** | FAIL |

    T1   verified vs unverifiable   CANNOT DISTINGUISH
         verified vs unsupported    DISCRIMINATES
    T2   verified vs unverifiable   DISCRIMINATES
         verified vs unsupported    DISCRIMINATES

**V1, V2, V3 all confirmed.**

## What each witness actually witnesses

**T1 does not witness "font support was verified."** It passes identically whether support was
verified or verification was impossible. What it witnesses is the weaker proposition:

> **not established-unsupported**

**T2 witnesses the stronger one**, because it contains an assertion that a universally-`True`
world breaks. Its `assertFalse` is what gives it purchase on the non-establishment state.

## The rule, now with evidence behind it

> A witness is not evidence for a proposition merely because it passes when that proposition is
> true. It must **discriminate** that proposition from the relevant ways it can be false or
> unestablished. **A witness that cannot distinguish success from non-establishment cannot
> entitle success.**

T1 is a real, project-authored, currently-passing test. It would have been promoted to "success
witness" by any rule that accepts *a test asserts this function returns True*. It does not
support that proposition, and only running W1 showed it.

## The architectural consequence for A3 — and it is not the one I expected

The preregistration guessed the discriminating property would be **"asserts in both
directions"**, and that is a mechanically checkable property of source. The result shows it is
only a **proxy**, and the thing that actually matters is:

> the witness **fails in the non-establishment world**

T2 satisfies this *because* its `assertFalse` breaks when everything returns `True` — but that
is a contingent fact about this pair of assertions and this intervention, not a guarantee. A
test could assert in both directions and still survive a particular non-establishment state.

So **A3 cannot determine witness adequacy by reading tests.** It has to *run* the witness under
an intervention that produces the non-establishment state, and observe whether the witness
notices. Witness adequacy is a dynamic property, not a static one.

That is a materially different architecture from "find a success witness, then compare the
exception outcome". It means A3's evidence chain needs:

    proposition
        -> candidate witness
        -> intervention producing the NON-ESTABLISHMENT state
        -> does the witness fail?
        -> only then may the witness entitle success

## The state space the API compresses

    SUPPORTED      -> True
    UNSUPPORTED    -> False
    UNVERIFIABLE   -> True        <- collapsed onto SUPPORTED

Three epistemic states, two return values. D4 showed the collapse reaches the user: the warning
that fires for UNSUPPORTED is silent for UNVERIFIABLE. **Epistemic state collapse:
`VERIFIED_SUPPORTED` and `UNVERIFIABLE` are observationally identical to the downstream
consumer.** Still a demonstrated architectural behaviour, still not a demonstrated defect.

## The two sentences this branch has earned, side by side

> **Non-exceptional execution is not evidence of successful execution.** *(SCREEN-2)*
>
> **Passing evidence is not necessarily discriminating evidence.** *(here)*

## Scope

Two witnesses, one function, one target, three constructed worlds. No claim about tests in
general, and no witness was promoted to entitling anything. The interventions patched
`PIL.ImageFont` in the loaded module's namespace; the project's test code was not edited, and
its assertions were transcribed verbatim.

## CORRECTION (appended; original wording left above)

**1. "Witness adequacy is dynamic, not static" is stronger than the evidence.** What was
demonstrated is narrower:

> A3 cannot establish witness adequacy **merely from the surface form of tests**. Actual
> discrimination under the relevant non-establishment state cannot be inferred from ordinary
> assertion structure.

Sufficiently strong static proof could in principle establish discrimination. Nothing here rules
that out; what is ruled out is inferring it from assertion shape.

**2. Adequacy is a RELATION, not a property of a witness.** The result above says T2
discriminated SUPPORTED from UNVERIFIABLE *under this intervention*. It does not say T2
discriminates SUPPORTED from every way support can be unestablished. The correct form is:

    discriminates(W, P, C, I)      witness, proposition, contrast class, intervention

and every claim of adequacy must name all four. `adequate(W)` is not a well-formed claim.

**3. A third sentence, earned by T1.** T1 inherits the information loss of the API it observes:
the producer maps UNVERIFIABLE onto the same `True` as SUPPORTED, so no assertion over that
return value can separate them.

> **A witness cannot recover distinctions already erased by its observation boundary.**
