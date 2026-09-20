# r4 — LegaScreen v3 slice 2 (lawful counterfactual replay). RESULT: CF-1 held. HEAD is measurable.

Predictions frozen in `49cb644`. The substrate is `legasus/legascreen/counterfactual.mjs`; the driver
supplies facts and a `construct` that calls the target's own production exports.

## CF-1 HELD — the decisive prediction

    slice 1 (copy the token)          HEAD   observed 0   unobservable 4   aggregation UNKNOWN
    slice 2 (mint from mutated facts) HEAD   OBSERVED=4                    aggregation ALL_OF

        fact[0].repository -> context.repository   REMOVED
        fact[0].criterion  -> context.criterion    REMOVED
        fact[1].repository -> context.repository   REMOVED
        fact[1].criterion  -> context.criterion    REMOVED

**The C3 tension is resolved by moving the intervention upstream of authority issuance.** The screen
never fabricates or modifies a token; it mutates pre-authority FACTS and calls `observe()` - the same
constructor production calls - to obtain a second, genuinely valid token. Unforgeability stops being
an obstacle and becomes part of experimental validity: the counterfactual is legitimate because the
production path minted it.

## CF-2 HELD, and the conviction now carries its warrant

    b11e51f   context.repository   declared ALL_OF   observed ANY_OF   MISMATCH
              context.criterion    declared ALL_OF   observed ANY_OF   MISMATCH
              ...on the authority of "calculus.mjs, DERIVE: The output context is the INTERSECTION"

## CF-4 HELD — no backdoor, asserted mechanically

    substrate exports: AGGREGATION, OUTCOME, SCORES, counterfactual, mismatches

No mint, no forge, no test-only constructor, and a test pins the export list so one cannot be added
quietly. `SCORES` contains exactly `OBSERVED`.

## CF-3, CF-5, CF-6 held, and non-vacuity now lives in the substrate

Baseline replay is a precondition: a construction path that cannot reproduce its own observation
returns BASELINE_UNSTABLE and scores nothing. Eight tagged outcomes replace every epistemic use of
`null`/`undefined` in the control flow, and only OBSERVED may be scored - so the three slice-1
defects are not repaired, they are UNREPRESENTABLE:

    a refused input read as a dependency      -> AUTHORITY_REFUSED, never an edge
    "couldn't measure" vs "was removed"       -> distinct tagged outcomes
    a perturbation that did not perturb       -> NO_CHANGE, proven by the ENGINE

CF-6, minimal: a declared aggregation with no stated AUTHORITY returns UNCOMPARABLE rather than
agreement, so a criterion and an implementation cannot be moved together and pass silently. The
owner's fuller requirement - pinning the declaration to the state it is valid against - is NOT built.

## THE CONTROL FOUND A RESIDUAL NAME ASSUMPTION IN THE SUBSTRATE

CF-5's vacuity case failed on the first run: `UNKNOWN` where the answer is `UNSUPPORTED`. The
all-facts strip was deleting a fact key *named after the output coordinate* - the same-name
assumption that slice 1 existed to eliminate, surviving in the one place nobody had looked. With an
output named `context.fixed` and facts named `a`, it stripped nothing and reported UNKNOWN.

Repaired by emptying the facts rather than deleting a same-named key. **This is the fourth
consecutive slice in which a control written against the preregistration found a defect in the
instrument rather than in the subject.**

## Where this leaves the readiness gate

    A'  every scored counterfactual constructed through legitimate production paths   met, asserted
    B'  every scored perturbation proves it changed the intended coordinate            met, in the engine
    C   semantic dependency mapping                                                    met (slice 1)
    D   renamed relationships screenable                                               met (slice 1)
    E-J AST discovery, surface, path invariants, coverage report, fault injection of
        the screen, legitimate-neighbour controls at scale                             NOT STARTED

Two transforms, two trees. The instrument is now inspectable, which is what this slice was for. It is
not a repository screen and nothing here says it is.
