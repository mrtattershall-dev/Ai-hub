# r4 — authority under composition, wave 3. RESULT (pre-repair).

Predictions were frozen in `7c49fae` (`benchmarks/COMPOSITION_PREREG_3.md`). Run against `2894308`
(waves 1 and 2 fully repaired), unmodified. Written before any wave-3 repair.

## Raw run

    ✔ W3-a-1 PREDICTED HOLDS  covers() is transitive over every 4-valued pair on two dimensions
                              4096 triples, 0 counterexamples, and triples with A covers B but not C exist
    ✔ W3-b-1 PREDICTED HOLDS  FALSIFIED@S0 then VERIFIED@S1 without reassessment is CONTESTED
    ✔ W3-b-2 PREDICTED HOLDS  reassessed against S1 first, the S0 falsification is STALE, S1 stands
    ✔ W3-b-3 PREDICTED HOLDS  neither world lends reliance to the other
    ✔ W3-c-1 ATTACK  delegation WIDENS the world a grant applies in        ({repository: S1} -> {})
    ✔ W3-c   CONTROL the same or a narrower context still delegates
    ✔ W3-d-1 ATTACK  narrow() moves an established dimension to another value  (S1 -> S2, still authority)
    ✔ W3-d   CONTROL narrowing an absent dimension, or to the same value, is a restriction
    ✔ W3-e-1 ATTACK  commit() consumes EPISTEMIC authority: evidence acts
    ✔ W3-e   CONTROL a rooted NORMATIVE token whose grant covers the action commits
    ✔ W3-f-1 ATTACK  derive() kind and grant depend on argument ORDER
    ✔ W3-f   CONTROL two epistemic premises derive an epistemic conclusion with no grant

    tests 12  pass 12  fail 0

## Reading

The two predictions of NO defect held, and the four predicted defects reproduced. Across three waves
the reading has now been right 21 times in the defect direction and 2 times in the no-defect
direction, and has not yet been falsified. Two no-defect probes are a small sample and both were on
mechanisms with simple structure; the honest statement is that the calibration is favourable and
thin, not that the reading is reliable.

Composition instances: W3-c (the world a grant applies in widens along a delegation chain - "does C
possess anything A never possessed?" yes, every other repository), W3-e (OBSERVE plus COMMIT is an
action nobody permitted - "individually authorized -> composition authorized"). Representational:
W3-d (a referent move under restriction's free pass), W3-f (authority that depends on argument
order).

## W3-g — retirement analysis, and what the first scanner missed

    node benchmarks/retirement-constraints.mjs   (first version)

    RETIRABLE  constraints.mjs constraints2.mjs constraints4.mjs constraints5.mjs opcontext2.mjs score-constraints.mjs
    R2  the conformance audit imports constraints6.mjs
    R6  constraints6 <- gate2-diagnostic, gate4-diagnose, conformance     LIVE
        opfacts     <- constraints2..5, opcontext, conformance            LIVE
    VERDICT: every candidate is RETIRABLE under R1-R4

THAT VERDICT WAS WRONG FOR TWO CANDIDATES, and it was wrong in the direction the control could not
see. score-constraints.mjs loads a deriver chosen by argv with './constraints.mjs' as the DEFAULT -
a dynamic path through a variable, invisible to a static import scan and to an `import(` scan. R4
("no fallback routes to it") is exactly the question, and the first scanner answered it with the
wrong instrument. Found by grepping the string by hand after noticing the scanner's R1 line
disagreed with an earlier grep; not found by the control, which only proved the STATIC scan works.

The string-level scan, run by hand:

    constraints.mjs        <- constraints2/3/4/5/6 (prose), score-constraints.mjs (argv default),
                              legalabs/substrate/tasks5.mjs, measurements/2026-09-13-setH-1p5b/README.md
    constraints2.mjs       <- legacore/LEGACORE_REV2.frozen
    constraints4.mjs       <- legacore/LEGACORE_REV4.frozen
    constraints5.mjs       <- legacore/LEGACORE_REV5.frozen
    opcontext2.mjs         <- legacore/LEGACORE_REV6.frozen
    score-constraints.mjs  <- nothing

Reading of that: constraints.mjs and score-constraints.mjs STAY - one is the other's runtime default
and both are named by a measurement README outside the sidecar's coverage. constraints2, 4, 5 and
opcontext2 are each named only by a FROZEN RECORD of the revision they belonged to; a frozen record
is history, not a dependency, and stays interpretable as text with the code retrievable at 7c49fae.
Those four are retired. The scanner gains the string scan before the deletion so the record shows
the instrument that justified it, not the one that would have deleted six.

Also recorded: while probing the scanner I ran a regex through `node -e` in a shell and its `\s`
collapsed to `s` in the probe's own output - hazard 1, in a diagnostic, while investigating a
scanner. The scanner file was written with the editor and was intact; the probe was not trusted and
the scanner's own control was.

## W3-h

Not run in this wave - it is a representation to build with controls, not an attack. Its limit was
stated in the preregistration and is repeated with the implementation.
