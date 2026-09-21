# H-INVERSE — the required property predicts the failure direction
Frozen 2026-09-21. Mappings, required properties and predicted directions below were all written
before any of M1–M6 was tested.

## The hypothesis

> The recurring failure is an **unearned inverse**: machinery computes a representation
> `f : S -> R`, then reasons backward from `R` to `S` without establishing that the inverse is
> licensed over the relevant domain.

`resolve` is then not primarily a sameness oracle. It is a **tiny safe inverse**, and `UNRESOLVED`
means *"the inverse relation is not established here"* — a stronger and more primitive refusal than
*"I don't know if these are equal"*.

## Why this is deeper than H-INFO, and how it could fail to be

Information loss is what happens when the forward map is many-to-one. That is **half** the
phenomenon. The false splits already recorded have no information-loss account at all: nothing was
erased, a difference was invented. H-INVERSE claims both halves come from one primitive failure.

    injectivity fails   two semantic states share a representation   -> FALSE MERGE
    coverage fails      a semantic state has no representation       -> FALSE SPLIT
    canonicality fails  one semantic state has several representations -> FALSE SPLIT
    definedness fails   the map is undefined on the case             -> UNLICENSED EITHER WAY

## The prospective prediction, which is about DIRECTION not existence

**V-1.** For every frozen mapping whose required property fails, the **observed failure direction
matches the direction predicted from that property alone**.
FALSIFIER: any mapping fails in the direction opposite to its property's prediction.

**V-2.** Both directions occur across the frozen set, from the same primitive.
FALSIFIER: only merges, or only splits, in which case H-INFO or a split-only account suffices and
H-INVERSE unifies nothing.

**V-3.** At least one mapping whose required property **holds** produces no failure.
FALSIFIER: mappings fail regardless of their properties, making the property classification
decorative. This is the non-discriminating trap: a rule that predicts failure everywhere predicts
nothing.

A shallower rival — *"some of these checks are simply buggy"* — predicts **no correlation** between
the property type and the failure direction. V-1 is the test that separates them.

## The frozen mappings

None of these was audited before this file was committed. Sites #7, #10 and #13 from
`IDENTITY-CENSUS.md` are already scored and are **excluded** from V-1 scoring; they appear only as
a consistency check.

    id   forward map f : S -> R                          required property   PREDICTED DIRECTION
    M1   callee identity -> callee NAME                  injectivity         FALSE MERGE
    M2   forwarding relation -> forwards() syntax rule   coverage            FALSE MERGE *
    M3   "the program" -> indexed *.py files             coverage            FALSE SPLIT
    M4   decisive state -> FALSY predicate               injectivity         FALSE MERGE
    M5   failure coercion -> coerces() syntax rule       coverage            FALSE SPLIT
    M6   program unit -> content SHA-256                 canonicality        FALSE SPLIT

`*` M2's coverage failure is predicted to produce a **merge**, not a split, because unrecognised
forwarding is not dropped — it is classified as discharge. Two semantic states collapse into one
outcome. **This is the row that can most easily falsify V-1**, since it is the one place where a
coverage failure is predicted to merge rather than split, and it is predicted from the direction of
the default rather than from the property's usual sign.

    already scored, consistency only
    #7   function -> attribute name                      injectivity         FALSE MERGE   observed merge
    #10  empty collection -> ast.Constant                coverage            FALSE SPLIT   observed split
    #13  value -> repr                                   injectivity         property HOLDS  no failure

## Method

Each mapping is tested for a **concrete witness** in a real target or in the harness's real input
domain. No witness, no finding — the property is then recorded as holding, which is what V-3 needs.
Predictions are not adjusted after any test.

## What a clean pass would and would not mean

It would mean the property classification carries information about failure direction on one frozen
set, in one lineage, authored by me. It would **not** establish that representation inversion is the
root of anything, and `S <-> R` bijection-assumption remains an account with no standing outside
this branch. Nothing is installed. Sites #7 and #10 stay unrepaired.
