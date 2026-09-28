# r4 — SURFACE-1. RESULT: the denominator is discovered, and it is 15, not 251.

Predictions frozen in `2dafbf3`. Substrate: `legasus/legascreen/surface.mjs` (acorn).
Run: `node benchmarks/run-surface.mjs` — static discovery, then the whole existing test suite
(89 files) executed with the discovered set instrumented.

## The report, in the shape asked for

    STATIC AUTHORITY CANDIDATES        15
    DYNAMICALLY OBSERVED               13
    CONFIRMED AUTHORITY TRANSFORMS     11
    SCREENABLE                          5
    UNSCREENABLE                       10

    modules parsed 156    brand sites found BY SHAPE: legaknow/calculus.mjs, legascreen/outcome.mjs
    of the 15: 10 in the SUBJECT, 5 in LEGASCREEN ITSELF (the instrument does not count itself)
    by discovery level: L0=14  L1=1

## THE HEADLINE IS THE LEVEL COUNT, NOT THE SURFACE COUNT

**L1 = 1, and that one is LegaScreen's own code.** Propagating through the import and call graph from
the brand sites found exactly one function outside a brand module, `legascreen/intervene.mjs::
intervene`, which calls `journey`. **No production module under `legasus/` imports the authority
calculus at all.** The ledger has said "the calculus has no production consumer (measured)" since
Entry 15; it now falls out of a mechanical scan instead of being asserted.

So the surface is small because the architecture's unforgeable core is unconsumed. That is a fact
about the repository, discovered rather than assumed, and it is the real content of the number 15.

## Every candidate, and what happened to it

    transform                                     L  vis     calls  auth  status
    legaknow/calculus.mjs::commit                 0  export     11     8  no perturbation scored
    legaknow/calculus.mjs::delegate               0  export     25    32  SCREENABLE  cf OBSERVED 5
    legaknow/calculus.mjs::derive                 0  export     18    25  SCREENABLE  cf OBSERVED 15
    legaknow/calculus.mjs::invalidate             0  export      3     6  SCREENABLE  cf OBSERVED 3
    legaknow/calculus.mjs::isAuthority            0  export     34    21  no perturbation scored
    legaknow/calculus.mjs::narrow                 0  export      5     9  SCREENABLE  cf OBSERVED 10
    legaknow/calculus.mjs::observe                0  export     42    36  SCREENABLE  cf OBSERVED 14
    legaknow/calculus.mjs::restrictGrant          0  export      4     8  no perturbation scored
    legaknow/calculus.mjs::token                  0  PRIVATE     0     0  private
    legaknow/calculus.mjs::tracesToIndependentRoot 0 export      3     2  no perturbation scored
    legascreen/outcome.mjs::finding               0  export      2     2  not replayable
    legascreen/outcome.mjs::isVerdict             0  export      2     1  no perturbation scored
    legascreen/outcome.mjs::journey               0  export     20     0  no authority moved
    legascreen/outcome.mjs::seal                  0  PRIVATE     0     0  private
    legascreen/intervene.mjs::intervene           1  export      9     0  no authority moved

## A STRUCTURAL LIMIT OF THE METHOD, VISIBLE IN THE TABLE

`isAuthority`, `commit`, `restrictGrant` and `tracesToIndependentRoot` are all UNSCREENABLE for the
same reason: **the counterfactual method reads authority COORDINATES off an output, and a predicate
returns a boolean.** This screen can measure producers of authority. It cannot currently measure
consumers of it, and four of the calculus's ten exports are consumers.

That is not a gap in coverage to be closed by running more tests. It is a different invariant shape
that this method does not have.

`outcome.mjs::finding` is UNSCREENABLE as NOT_REPLAYABLE, and correctly: its argument is a verdict
sealed by a method rather than by a recorded call, so it is FOREIGN and no lawful rebuild exists.
That is W-4 firing on real code.

## DELEGATE'S K=0 WAS THE SAMPLE, NOT THE SUBJECT

AUTO-CF-1 reported `calculus.delegate` at K = 0 over 79 leaf facts, and I said I could not tell
whether that was the instrument or the transformation. Over the whole suite delegate has 25 witnesses
instead of 13, and 5 counterfactuals reach OBSERVED. **The answer is the sample.** A K of 0 from one
run is a statement about which tests were run, and I should not have needed a second run to know
that.

## Predictions

    S-1  no hand-authored list of authority names on the discovery path   HELD, asserted mechanically
    S-2  the seed is discovered BY SHAPE (new WeakSet + .add/.has)         HELD
    S-2b a fixture with the vocabulary and no brand yields ZERO           FIRED
    S-3  private authority functions discovered, reported UNSCREENABLE    HELD - token and seal
    S-3b a private brand-toucher IS discovered                            FIRED
    S-4  instrumentation transparent                                      HELD - 639/639 under it
    S-5  CONFIRMED requires authority to have actually moved              HELD - journey, intervene
    S-6  SCREENABLE means an experiment actually ran                      HELD
    S-7  prediction of NO detection                                       HELD

S-4 is worth stating precisely: the whole suite was run with every discovered export wrapped, and
**639 of 639 tests passed**, so the shims are transparent to the subject rather than merely
non-crashing.

## What the instrument cannot see, from its own tests

A consumer reached only through `await import(...)` does not appear on the surface at all - proven by
a fixture, not reasoned about. Combined with the brand-shape seed, that is the content of CAVEAT,
which is exported so a report cannot omit it by forgetting:

> Authority-bearing transformations outside this discovery mechanism may exist. The root set is the
> identity-brand SHAPE, so a transformation that never touches a branded value is invisible here.
> This is a bound on the instrument, not a claim about the repository.

Concretely: `justification.mjs`, `stopping.mjs`, `provenance.mjs` and `ledger.mjs` are
authority-bearing by any reading and are NOT on this surface, because they do not use an identity
brand. One seed is not a surface.

## SCREENABLE IS NOT SCREENED

Nothing here compares an observation to a declaration.

    sound transforms actually SCREENED          1   (hand-driven, slice 2)
    previously unknown repository defects        0

Focused 7/7. Suite 646/646.
