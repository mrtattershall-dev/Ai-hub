# H-ADMISSION — does tagging CONCENTRATE unjustified entitlement, or merely relocate it?
Frozen 2026-09-21, before any measurement. Thresholds below are frozen with it.

## The hypothesis

> A false entitlement originates when an unestablished result is admitted into the ordinary value
> domain **without preserving the evidence needed to distinguish it from an established result**.

The dangerous operation is not `ERROR -> neutral`, nor even `ERROR -> value`. It is

    UNESTABLISHED  ->  ordinary value  +  ordinary authority

`Err(APIError)` and `Unknown(False)` are also values, and are not the problem. `False` is.

## Status, stated before evidence

H-ADMISSION is a **narrowing of H-SUBST** (`H-INFO_OPERATIONAL.md`, standing NONE): the special
case where `P1` = *"v was produced"* and `P2` = *"v is established"*. H-SUBST was filed unadopted
because it had seven retrospective instances and no prospective prediction. **The apparatus-failure
topology (the no-op repair, the D4 control, X1, the richness run) is the same retrospective
evidence and is explicitly NOT counted here.** Narrowness is the only gain so far, because it buys
a prospective prediction. This experiment is that prediction.

## The tautology guard

"Introduce a provenance tag and provenance survives" is true by construction and measures nothing.
The open question is **architectural viability**:

> If every real failure-coercion site in a real program produced a tagged value instead of a bare
> one, **how many distinct sites would have to discharge that tag**, and do those sites concentrate?

If the answer is "few and concentrated", the site of unjustified entitlement becomes observable and
the architecture is viable. If it is "diffuse", tagging relocates the problem into a pile of
`assume_established` calls at every consumer, which is a rename and not a fix — the same objection
that killed *"take P from the docstring"* in P-IDENTITY.

**Tags propagate.** If `f` returns a tagged value and `g` returns `f`'s result, `g`'s consumers
inherit the obligation. The measurement is therefore **transitive**, not direct fan-out. Direct
fan-out would flatter the hypothesis.

## Selection, mechanical, no inspection

    COERCING   a function containing an exception handler whose body returns a constant that
               inhabits the ordinary result domain: True, False, 0, 0.0, "", [], (), {}
    CONTROL    a matched sample of functions with no such handler

The specimen shape this comes from is real and already in the record: MoneyPrinterTurbo's
`except Exception: ... return True`, and PyTorch's `local_image_exists` returning `False` on
`APIError`.

## Predictions, with thresholds frozen now

**A1 — CONCENTRATION.** Over coercing functions, transitive discharge fan-out has
**median <= 5** and **no more than 10% of cases exceed 20 sites**.
FALSIFIER: median > 5, or more than 10% exceed 20.

**A2 — SPECIFICITY, and the reason A1 alone proves nothing.** Most functions in any codebase have
few callers, so A1 could hold for *every* function and say nothing about admission. A1 therefore
scores **only** if coercing functions differ from the matched control. Frozen comparison: the two
fan-out distributions are compared directly, and H-ADMISSION requires coercing functions to be **at
least as concentrated** as controls.
FALSIFIER: coercing functions are materially *more* diffuse than controls, or the distributions are
indistinguishable and A1 is therefore a generic property of functions.

**A3 — the relocation check.** The fraction of the program reachable from a coercion through tag
propagation is **small**: fewer than 5% of indexed functions per coercion at the 90th percentile.
FALSIFIER: tags reach a large fraction of the program, i.e. relocation rather than concentration.

## Dispositions

    A1 and A2 and A3 hold        tagging concentrates; the architecture is viable on real code.
                                 Stage B standing (external target), NOT proof of H-ADMISSION -
                                 only that its proposed remedy is not self-defeating.
    A2 fails                     concentration is generic; A1 is non-discriminating and scores
                                 nothing, exactly the step-16 trap.
    A1 or A3 fails               tagging relocates rather than concentrates. H-ADMISSION's remedy
                                 is a rename. Record and do not install.

## What this experiment CANNOT do

It cannot establish that admission is the common root. It measures the **viability of the proposed
remedy**, not the truth of the diagnosis. A clean pass leaves H-ADMISSION exactly where H-SUBST is:
a retrospectively attractive account with one prospective result about its remedy.

## Rules

Targets read-only; nothing is modified in any target tree. Thresholds above are frozen and will not
be adjusted after seeing the distribution. The control sample is drawn by the same rule, from the
same tree, before results are examined. If the harness measures direct fan-out and reports it as
transitive, that is the eighth instance of the substitution pattern and is scored as an apparatus
failure.
