# H-INFO result — discriminated from H-RICH; and the apparatus pattern fired again, immediately
2026-09-21. Preregistration `H-INFO_PREREG.md` (bd50cde). Real sealed subject, four states
produced by real interventions, all four intervention-realisation checks passed. Raw:
`legasus/out/hinfo/hinfo.json`.

## Result

    representation        distinct values   entitlement to P
    R_rich                       3               FAILS   (SUPPORTED ~ UNVERIFIABLE on "ok")
    R_poor                       2               HOLDS
    R_shipped (control)          2               FAILS   (SUPPORTED ~ UNVERIFIABLE on True)

    P = "glyph inspection completed"

**G1 confirmed** — the *richer* representation fails. **G2 confirmed** — the *poorer* one holds.
**G3 confirmed** — the control reproduces the real font case.

    => H-INFO DISCRIMINATED from H-RICH, in both directions.

H-RICH predicts the opposite of both G1 and G2. More distinct values bought *less* entitlement;
fewer values bought *more*. What decided it was not the size of the representation but whether
the distinction `P` depends on survived the map.

H-INFO now has **standing as the better of two stated accounts on this construction.** Not a law,
not a name, not a place in any architecture.

## The apparatus failure, which is the more interesting half

**The first run reported `H-INFO DISCRIMINATED` and had not earned it.** `R_rich` produced only
**2** distinct values — the same as `R_poor` — so the richness comparison the entire prediction
rests on **never occurred**. The cause is structural: with 3 states and one required collision,
the maximum distinct values is 2, so `R_rich` could not possibly have been richer.

The harness printed the verdict anyway, because I checked `holds` and never checked *richer*.

Fixed by changing the **construction**, not the criterion: a fourth state
(`UNSUPPORTED_PARTIAL`, some glyphs present and some absent) makes 3 distinct values reachable,
and `richer` is now **asserted** and reported rather than assumed.

### This is the fourth instance of a pattern named one message earlier

    frozen proposition F  ->  implementation of F  ->  actually checks F'  ->  F' weaker  ->  success reported

    1  the no-op replacement       said "repair succeeded"       without establishing modification
    2  the first D4 apparatus      said "suppression observed"   without establishing reachability
    3  X1 in D-COMP-1              said "F1 satisfied"           after checking one clause of F1
    4  this run                    said "DISCRIMINATED"          without establishing R_rich was richer

Four different implementations, one topology. The remedy was identical every time: **assert the
precondition instead of assuming it.**

This is *not* a blind prospective confirmation — the pattern had just been named, which is why I
looked. But it recurred within a single session, in a harness built to test a hypothesis *about*
lossy representation, and the loss was: the criterion "R_rich is richer AND fails" projected onto
"R_rich fails". **The apparatus instantiated the phenomenon it was measuring, for the second time
in this branch.**

## What H-INFO does and does not now explain

It is consistent with, and may subsume, four earlier sentences — but *consistency is not
evidence*, and that consistency is retrospective:

    UNOBSERVABLE is never an admission          "not observed" vs "observed absent" must not collapse
    non-exceptional execution != success        ordinary execution groups success with ordinary failure
    passing evidence != discriminating          PASS represents several epistemic states
    a witness cannot recover erased distinctions the information-theoretic statement

It may also reframe X1/X2's gaps — specificity asks whether the observed difference preserves the
causal distinction `P` needs; coverage asks whether the representation separates `P` from every
contrast that matters. Both are questions about equivalence classes being too coarse.

**None of that is established.** Under this branch's own standard, subsumption earns nothing
until it predicts a failure it was not built to explain, in a setting it was not constructed
around. One discriminating result on one construction is where it stands.

## Scope

One construction, four states, three representations, one subject. Same author as the
hypothesis. Stage A. A Stage B test — a different failure mechanism, or a naturally occurring
case not built around equivalence classes — has not been attempted.

## CORRECTION (appended; original wording left above)

**1. "R_rich" is a bad name and the result does not depend on richness.** The relevant object is
the **partition** a representation induces:

    s1 ~_R s2   iff   R(s1) = R(s2)

and the condition for `P` to be recoverable from `R` is that there exists some `g` with
`P = g ∘ R` — equivalently, `R(s1) = R(s2) ⇒ P(s1) = P(s2)`. Three observable values can preserve
the *wrong* distinctions while two preserve exactly the one `P` needs. The renaming matters
because "richer" invites the cardinality reading that this very run falsified. Read `R_rich` as
*the representation with a finer partition that is finer in the wrong place*.

**2. H-INFO is a NECESSARY condition, not a theory of entitlement.** The asymmetry:

    P differs inside one R-class    ->  R alone cannot entitle P
    P constant inside every R-class ->  R does not PREVENT entitlement; entitlement is NOT
                                        thereby established

The result above shows only the first arrow. `R_poor` "HOLDS" in the table means *no collision
blocks entitlement*, **not** that entitlement was established.

**3. The tautology risk, which must govern Stage B.** If "entitled to `P`" is defined as "`P` is
recoverable from `R`", H-INFO is true by construction and worthless. Stage B must keep the
entitlement criterion **independently defined** and ask whether H-INFO predicts failures of that
independent criterion. This run did not do that — its entitlement test *is* the recoverability
test — so its discrimination is against H-RICH only, and carries no weight against tautology.
