# H-REFUSAL result — R-1 fails, R-2 holds. Partial prospective standing.
2026-09-21. Preregistration `H-REFUSAL_PREREG.md` (26c0f00), frozen before sites #10 and #13 were
examined. Sites from `IDENTITY-CENSUS.md` (6ac7820). Raw: `legasus/out/hadmission/refusal_audit.json`.

## The frozen set, scored

    #7   attribute name -> function identity   UNJUSTIFIED_SAME        false merge   witness
    #10  in-domain constant class              UNJUSTIFIED_DIFFERENT   false split   5 witnesses
    #13  repr -> value identity                JUSTIFIED               none          0 witnesses

## Site #7 — false merge (previously scored)

`TRUSTED_TAILS = {"get"}` asserted `name(x) = "get" ⟹ semantics(x) = dict.get`. Witness:
`self._hash_cache_var.get()` is a `ContextVar`. Verdict correct, justification void.

## Site #10 — false split, and it is structural rather than an oversight

`is_in_domain_const` asserts *"this returned constant inhabits the ordinary result domain"* and
implements it as `ast.Constant` with an exact type-and-value match, plus empty `List`/`Tuple`/`Dict`
literals. Five exception handlers across both targets return an ordinary-domain empty collection
that the rule classifies as **not** in-domain:

    pt         torch\profiler\_cuspy\pm_sampling.py:95    frozenset()
    pt         torch\profiler\_cuspy\pm_sampling.py:110   frozenset()
    pt         .github\scripts\trymerge.py:1814           frozenset()
    odysseus   routes\model_routes.py:136                 set()
    odysseus   src\endpoint_resolver.py:85                set()

**Python has no empty-set literal.** An empty set can only be written as a call. A rule keyed on
`ast.Constant` can therefore *never* admit one, for any program. This is not a missing case; the
rule's projection cannot express the value at all, so it is guaranteed to split a class it claims
to classify.

Note what the already-frozen `resolve` does by comparison: it folds `bool(<const>)` and handles
empty `Dict` explicitly. The site with the refusal state also has the better coverage.

**Magnitude, stated honestly:** 5 witnesses against 494 handlers the rule did count, about 1%. Five
functions were wrongly excluded from the coercing population, 3 in PyTorch and 2 in Odysseus.
Against sample sizes of 219 and 168 with medians of 1 and 3, **no H-ADMISSION conclusion changes.**
The decision is unjustified; its consequences here were small.

## Site #13 — JUSTIFIED, no witness available

`hneutral` compares stage outputs by `repr`. Over the values the harness actually handles, an
exhaustive pairwise search within each pipeline found **zero** false merges and **zero** false
splits. `repr` is faithful for the ints, bools, strings, lists and tuples in play, and values from
different pipelines never meet.

> **My first probe for this site reported six false splits. They were artifacts of the probe**,
> which compared `True` against `True` and fired because `True == 1`. Corrected to require genuinely
> different types, it reports zero. The spurious finding is recorded rather than quietly dropped,
> and it would have manufactured support for the hypothesis.

## Scoring

    R-1  FAILS   predicted every remaining site would contain an unjustified decision with a
                 witness. #13 does not. 1 of the 2 newly examined sites is justified.
    R-2  HOLDS   the unjustified decisions are not all false merges. #7 is a merge, #10 is a
                 split. Both directions are present, so H-INFO does not cover the phenomenon.

## Standing

H-REFUSAL gains **partial prospective standing**: on a set frozen before examination, 2 of 3 sites
carried an unjustified identity decision with an exhibited witness, and both failure directions
occurred. That is weaker than the census suggested — the census's 9-sites-6-failures split implied
a stronger pattern than the frozen set delivered.

It remains one research lineage, one author, and fifteen non-independent operations. The claim that
identity is the atom, and the layering from entitlement down to canonical reference, keep standing
NONE. Nothing was installed.

**Site #7 remains unrepaired**, as the preregistration required. Site #10 is recorded and not
repaired either, for the same reason: both are now specimens.

## The observation that prompted this line, restated with its evidence

`resolve` was written into `screen2.py` long before any of this, carrying a refusal state and the
docstring *"the contract's SUPPORTED EQUIVALENCE RELATION, deliberately narrow"*. Every later
harness re-implemented sameness ad hoc and none inherited the refusal. Of the three frozen sites,
the two that lack it carry unjustified decisions and the one that does not is also the one whose
projection happens to be faithful. **That is consistent with the primitive having been found once
and not generalized**, and it is not yet evidence for it.
