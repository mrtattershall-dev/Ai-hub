
# r4 — LegaScreen v3 slice 2: CONSTRUCTOR-MEDIATED COUNTERFACTUAL REPLAY. Frozen before any code.

Slice 1 ended with HEAD unmeasurable: `calculus.derive` reported `observed 0, unobservable 4`,
because the perturbation built a modified COPY of a token and the C3 repair makes a copy not a token.
The owner's reading, adopted:

> A secure authority object and a screenable authority object have conflicting requirements UNLESS
> COUNTERFACTUALS ARE GENERATED UPSTREAM OF AUTHORITY ISSUANCE.

So the screen stops mutating authority objects. It mutates the FACTS those objects are minted from,
and obtains a second, genuinely valid object from THE SAME PRODUCTION CONSTRUCTOR.

    BASELINE        facts -> construct() -> valid token -> operation -> output
    COUNTERFACTUAL  facts' -> construct() -> DIFFERENT valid token -> same operation -> output'

## THE HARD CONSTRAINT, stated first because it is the one worth breaking the slice over

**NO BACKDOOR.** The screen gets no `forgeTokenForTesting`, no exported mint, no privileged path. It
calls the same constructor production calls. If the only way to make this work were a test-only API,
the correct outcome is to abandon the slice, because that API would weaken the exact property being
screened. Asserted by a control, not by intention.

Security therefore becomes part of EXPERIMENTAL VALIDITY: the screen proves its counterfactual by
legitimately obtaining another token through the secure path. The screen is not exempt from Legasus's
authority laws; it is bound by them more tightly than anything else.

## What is built (the owner's list 1-5, and nothing beyond it)

    1  constructor-mediated counterfactual replay
    2  central non-vacuity: the ENGINE proves the intended intervention occurred; a probe cannot score
       otherwise. Hazard 3 leaves the probe author's memory and enters the substrate.
    3  TAGGED epistemic outcomes. No null/undefined/empty carrying epistemic meaning in control flow.
    4  observed support formula over a SMALL vocabulary - ALL_OF, ANY_OF, UNKNOWN - compared against
       a declared contract
    5  controls that attack the substrate itself

## Predictions

    CF-1  THE DECISIVE ONE. HEAD becomes MEASURABLE. `calculus.derive` at HEAD yields OBSERVED
          outcomes and aggregation ALL_OF, where slice 1 reported 4x unobservable and UNKNOWN.
          If this fails, constructor-mediated replay does not solve the C3 tension and the slice is
          recorded as not working.
    CF-2  b11e51f yields ANY_OF against a declared ALL_OF: the mismatch survives the new substrate.
    CF-3  BASELINE REPLAY IS A PRECONDITION. Reconstructing from unmutated facts must reproduce the
          recorded baseline; if it does not, the transform scores NOTHING and reports
          BASELINE_UNSTABLE. A construction path that cannot reproduce itself cannot support a
          counterfactual.
    CF-4  NO BACKDOOR, asserted mechanically: the counterfactual path calls only functions the target
          module exports for production use, and the substrate exports no mint/forge of its own.
    CF-5  EVERY NON-OBSERVED OUTCOME SCORES ZERO, and each is tagged with its own reason:
          NO_BASELINE / BASELINE_UNSTABLE / COORDINATE_ABSENT / NO_CHANGE / RECONSTRUCTION_FAILED /
          AUTHORITY_REFUSED / OUTPUT_UNOBSERVABLE. A mismatch may be reported only from OBSERVED.
    CF-6  ANTI-SELF-RATIFICATION AT THE CONTRACT LAYER, in its minimal form. A declared aggregation
          must name the AUTHORITY it came from; a declaration with no stated source is not comparable
          and reports UNKNOWN rather than agreement. The owner's full requirement - that the
          declaration also pin the state it is valid against, so implementation and criterion cannot
          move together - is NOT built, and is recorded as not built.

## Controls, from the owner's list

    baseline replay reproduces the original observation                    CF-3
    deliberately impossible reconstruction becomes UNSCREENED, not clean   CF-5
    a no-op mutation is rejected by the engine                             CF-5 (NO_CHANGE)
    legitimate ALL_OF and ANY_OF examples are BOTH admitted                or the engine only
                                                                          recognises one shape
    the historical tree produces declared ALL_OF / observed ANY_OF          CF-2
    HEAD becomes measurable through constructors rather than copies         CF-1

## Then stop

No AST discovery, no 143-transform surface, no path invariants, no repository-wide run, no severity
dimensions, no per-model rendering. After this slice the instrument is inspected, not expanded.

## Falsification

If CF-1 fails, the tension between unforgeability and screenability is NOT resolved by moving the
intervention upstream, and the next design must be something else. If CF-3 cannot be satisfied for
the two transforms here, the substrate cannot establish its own baseline and nothing built on it
would mean anything.
