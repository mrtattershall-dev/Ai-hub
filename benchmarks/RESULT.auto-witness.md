# r4 — AUTO-WITNESS-1. RESULT: W-1 held. The recipe is recorded, not authored.

Predictions frozen in `c3cec92`. Substrate: `legasus/legascreen/{outcome,witness,witness-store,
witness-loader,witness-register}.mjs`. Run: `node benchmarks/run-auto-witness.mjs`.

## W-1 HELD — the decisive prediction

Two existing test files were run unmodified under a module loader hook. 18 of their tests passed
under instrumentation, so the shim is transparent to the subject. From that run, with no driver:

    calls recorded: 55    calculus.observe=29  calculus.derive=13  calculus.delegate=13

    op                  ROOT  UPSTREAM  REPLAYED
    calculus.observe      29         0        29
    calculus.derive       13        12        13
    calculus.delegate     13         7        13

    NO-DRIVER CHECK: 5 files on the capture path -> none supplies facts/construct/operate

A captured recipe, printed from the record rather than written by me:

    #5  calculus.observe({observation: {...}, procedure: "tracer", context: {repository: "S1", criterion: "K1"}})
    #6  calculus.observe({observation: {...}, procedure: "tracer", context: {repository: "S1", criterion: "K2"}})
    #7  calculus.derive({premises: [#5, #6], rule: {name: "modus ponens"}, claim: "C"})
        LEAF FACTS (the only mutable surface): 24
        FOREIGN authority inputs: 0

**24 leaf facts.** Slice 2's hand-written driver declared 4. I did not choose the other 20, and I did
not choose any of them.

UPSTREAM is 0 for `observe` because its inputs are raw facts - correct, and a property of the
transformation, not a failure of the mechanism. REPLAYED is measured over all root witnesses.

## The mechanism, and why it needed to be a loader

An ES module namespace is immutable from outside, so `C.derive = wrapped` does not exist as an option
and an already-written test cannot be intercepted by assignment. Substituting the MODULE is possible:
the loader returns a shim that re-exports the real module and wraps the named exports.

    existing test  --imports-->  [shim]  --delegates-->  real calculus.mjs

THE SHIM ADDS NO CAPABILITY. Every wrapper calls the real function and returns the real value.
Classification is by IDENTITY, never by name or shape:

    DERIVED   this object IS a recorded call's return value   -> replay that call
    FOREIGN   the SUBJECT'S OWN brand says it is authority, but no recorded call produced it
    OPAQUE    not plain data and not authority                -> held by reference
    LEAF      plain data                                      -> the only mutable surface

## W-3 HELD — and it was the prediction most likely to kill the slice

    witnesses whose ORIGINAL result was a minted token : 6 / 12
    of those, REPLAYED to a token the subject accepts  : 6 / 6

Asked of `calculus.isAuthority` itself. A recorder that deep-cloned anything it touched would score
zero here, because a clone is not in the module-private WeakSet - this is exactly how slice 1 died,
one layer down. **The other 6 replayed a refusal, which proves nothing about branding and is counted
separately rather than folded into a 12/12.**

## W-4 HELD, in both directions

    a REAL token no recorded call produced   -> FOREIGN, 0 leaves, replay refused (FOREIGN_INPUT)
    a token-SHAPED unbranded object          -> LEAF, its fields are mutable data

The recorder does not guess what authority is. It asks the subject's own predicate, the one
production asks. Shape is never a proxy for identity.

## W-6 HELD — edges by identity

Two `observe` calls with byte-identical arguments produce two distinct tokens, and the recipe records
`[#0, #1]`, not `[#0, #0]`. Under shape matching they would have collapsed, and replay would rebuild
a different world than the one observed.

## W-5 HELD — a judgment is now structurally unreachable without the experiment

`outcome.mjs` has 11 states and 3 verdicts. A verdict is not something a probe returns; it is
something a journey earns, over the path DISCOVERED -> BASELINE_REPLAYED -> PERTURBATION_APPLIED ->
OBSERVED. Run against a real witness that got as far as BASELINE_REPLAYED:

    VERDICT WITHOUT AN EXPERIMENT: INVARIANT_UNKNOWN  (missing PERTURBATION_APPLIED, OBSERVED)

**HELD is gated exactly as hard as VIOLATED**, because a pass asserted over an experiment that never
ran is the same error with a comfortable sign. Skipping a stage throws; a terminal outcome closes the
journey; an object literal that claims VIOLATED is not a verdict and `finding()` refuses it.

*The honest limit:* nobody can stop a probe from returning its own object. What is structural is that
such an object is not a verdict - the brand cannot be applied by a caller - so a consumer that checks
is never fooled. That is the same bound the calculus itself has, and it is stated rather than
papered over.

## W-2b, W-8, and the control that could not fire

W-2b fired once fixed: a non-deterministic subject yields `DIVERGED`, not a measurement.

**THE FIRST VERSION OF W-2b COULD NOT FIRE.** It varied a field `derive` does not read, so the output
was identical every time and the control passed while proving nothing. Vacuous control, written
inside the slice whose subject is vacuity, by me, again. Found by running it. Repaired by varying a
field the subject actually consumes.

W-8 (prediction of NO detection) held: this slice produced no finding about the repository, because
it contains no judgment.

## Not tuned to the files it was built on

Two test files never used during development:

    op                  ROOT  UPSTREAM  REPLAYED
    calculus.observe      13         0        13
    calculus.derive        5         5         5
    calculus.delegate     12         7        12

30/30 replayed, and a mixed two-constructor recipe appeared on its own:

    #14  calculus.derive({premises: [#12 delegate, #13 observe], rule: {...}, claim: "C"})

## NO COVERAGE FRACTION IS REPORTED

The authority surface has not been discovered. `1/251` was a fraction over a surface never
established, and replacing it with a better-looking fraction over the same unestablished surface
would be the same error. Counts only, until DISCOVER exists.

## NOT BUILT, and named

No perturbation, no counterfactual, no support formula. `declared` is still human testimony and is
not consulted here. No static discovery of the authority surface. Nothing about transformations that
do not execute during an existing test - and that population is unmeasured, not empty. The five
prototypes are NOT merged; the correct common abstraction is still unknown.

Focused 17/17. Suite 629/629.
