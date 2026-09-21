# H-REFUSAL — unsupported identity decisions should refuse rather than guess
Frozen 2026-09-21, before sites #10 and #13 were examined. Site #7 is already scored.

## The hypothesis, deliberately narrow

> When a sameness decision cannot be established from the equivalence rules actually available,
> forcing `SAME` or `DIFFERENT` creates false-identity risk that an explicit `UNRESOLVED` state
> prevents.

This is **not** the claim that identity is the atom, and it is not the layering
`entitlement / proposition / distinction / identity / equivalence / reference`. Those keep standing
NONE. H-REFUSAL is the narrow, attackable residue.

## Justified discrimination — SAME and DIFFERENT are symmetric obligations

`resolve` is not merely an equivalence relation. It is a **partial decision procedure** for one:

    proof of equivalence available   -> SAME
    proof of distinction available   -> DIFFERENT
    neither proof available          -> UNRESOLVED

Evidence is required in **both** directions. The duplicate-tree failure proves the second
obligation is real: nothing was erased there, a difference was *invented*. The two forbidden habits
are symmetric and both appear in the census:

    could not prove same      -> call it DIFFERENT     (false split)
    looked similar enough     -> call it SAME          (false merge)

H-INFO only penalises the merge direction and has no account of the split.

## The measure — four outcomes, and the verdict is NOT the endpoint

For each site, three questions only:

    1. what equivalence or distinction is being asserted?
    2. is that relation established by the rule actually used, over the site's REAL input domain?
    3. if not, would a refusal state have prevented the unjustified justification?

    JUSTIFIED_SAME          the rule entails the asserted identity
    JUSTIFIED_DIFFERENT     the rule entails the asserted distinction
    UNJUSTIFIED_SAME        false merge; a partial comparator returns UNRESOLVED
    UNJUSTIFIED_DIFFERENT   false split; a partial comparator returns UNRESOLVED

**Whether the final verdict is wrong is explicitly not the endpoint.** Site #7 is precisely why:
its verdict is correct and its justification is void, so any final-answer check would pass it
forever. An unjustified decision is scored as unjustified even when the answer it produced is right.

A site is scored `UNJUSTIFIED` **only with an exhibited witness** — a concrete input in the site's
actual domain where the projection agrees while the semantics differ, or the reverse. No witness,
no finding.

## The frozen set

From `IDENTITY-CENSUS.md` (6ac7820), the three no-refusal sites that had not yet failed:

    #7   attribute name standing for function identity     SCORED: UNJUSTIFIED_SAME
         `TRUSTED_TAILS = {"get"}` matched `ContextVar.get`; witness exhibited; verdict correct,
         justification void
    #10  in-domain constant class                          not yet examined
    #13  repr standing for value                           not yet examined

## Prediction

**R-1.** Each remaining site (#10, #13) contains at least one unjustified identity decision with an
exhibitable witness, and a partial comparator returning `UNRESOLVED` would have refused there.
FALSIFIER: a site's asserted relation is entailed by the rule actually used across its real input
domain, with no witness available.

**R-2.** The unjustified decisions are **not** all false merges. At least one is a false split.
FALSIFIER: every unjustified decision collapses distinctions, in which case H-INFO already covers
the phenomenon and H-REFUSAL adds nothing.

## Dispositions

    both sites unjustified, both directions present   H-REFUSAL has prospective standing on a
                                                      frozen set. Still one lineage, one author.
    a site is justified                               the pattern is weaker than the census
                                                      suggested; record the count honestly
    all unjustified decisions are merges              R-2 fails; H-INFO suffices; H-REFUSAL adds
                                                      nothing beyond vocabulary

## Rules

**Site #7 is not repaired.** Repairing it would destroy the only prospective result the census
produced. No site is added to the frozen set, and none is dropped for being inconvenient. If a site
turns out justified, that is recorded as a justified site, not worked around. Targets read-only.
