# Registry adequacy — the three rules against pre-registry derivations. Frozen before classifying.
2026-09-21. **The registry is frozen at three rules for the duration of this experiment.** No rule is
added, and no requirement is edited, whatever the coverage turns out to be.

## Where the lie moved

The producer can no longer choose its own burden. **The runtime author still can, by defining the
registry.** That is a smaller and inspectable authority surface, not an absent one. The open question
is no longer *can the certificate lie* but:

> Does a registered rule demand every relation whose absence would make the derivation unjustified,
> and no relation that is unnecessary?

Two symmetric failure modes, and both matter, because measuring only the first converges on a
refusal machine:

    UNDER-SPECIFIED   a missing requirement lets an unjustified derivation mint
    OVER-SPECIFIED    an unnecessary requirement refuses a legitimate derivation

## The corpus, surveyed before the classification was written

Real derivations authored by earlier sessions, long before this registry existed and with no
knowledge of it. Counted, not yet classified:

    21  derive() call sites across 5 legaknow test files
    14  rule declarations, of which 8 state a `requires` list
     2  state a NON-EMPTY one - both the same rule:
        { name: 'causal transfer', requires: ['BEFORE', 'FLOWS_TO'] }
    23  justification-graph nodes carrying supports, over edges ANY_OF, REFUTES, SUPPORTS, IDENTIFIES

## Frozen classification

Correspondence is judged on **requirement sets**, never on rule names, because identical names are
not identical referents.

    KNOWN + ADEQUATE     a registry rule's requires == the derivation's declared requires
    KNOWN + UNDER        a registry rule's requires is a strict SUBSET   (registry demands less)
    KNOWN + OVER         a registry rule's requires is a strict SUPERSET (registry demands more)
    UNKNOWN RULE         no registry rule corresponds
    AMBIGUOUS            more than one registry rule corresponds
    UNMAPPABLE           the derivation's obligation has no counterpart in the registry's vocabulary

**UNKNOWN RULE is a legitimate result and is preserved.** A high unknown rate is information about
the registry's reach. Responding to it by inventing rules until everything maps would turn the
registry into an explanation machine, which is the outcome this preregistration exists to prevent.

## Predictions

**A-1 COVERAGE IS LOW.** Most pre-registry derivations classify UNKNOWN RULE. The registry was built
for one narrow family — quantifier-shaped claims about domains — and general inference is not that.
FALSIFIER: broad coverage, which would suggest the categories are too loose.

**A-2 THE EMPTY-REQUIREMENT RULE IS A FALSE FRIEND, and this is the one I most expect to sting.**
`claim-from-direct-observation` requires nothing, so under pure set matching it matches *every*
derivation that declares `requires: []` or declares none at all — 12 of 14 rule declarations. Those
matches are **mechanical, not semantic**, and I predict the classification will therefore report
spurious ADEQUATE unless requirement-set equality is recognised as too weak a criterion.
FALSIFIER: the empty rule matches nothing, or the matches turn out semantically real.

**A-3 THE CAUSAL RULE IS UNKNOWN, NOT UNDER-SPECIFIED.** `causal transfer` requires `BEFORE` and
`FLOWS_TO`. No registry rule mentions either relation. The honest verdict is that the registry has no
vocabulary for causal transfer, **not** that its existing rules are missing a requirement.
FALSIFIER: it maps onto a registry rule, which would mean the mapping is fabricating correspondence.

**A-4 NECESSITY HOLDS WHERE THE REGISTRY DOES APPLY.** For each registry rule with a non-empty
requirement, removing that witness from an otherwise-complete derivation must prevent minting.
FALSIFIER: any registry requirement is removable without effect, which is an unnecessary requirement
and therefore over-specification.

**A-5 SPECIFICITY IS WEAK, predicted as a defect of my own design.** Supplying the *right relation
name* with the *wrong relation content* satisfies the registry mechanically, because `derive()`
matches witnesses by `relation` string only. A `COVERAGE` witness asserting coverage of a different
domain than the claim's should still mint.
FALSIFIER: it refuses, which would mean the requirement carries more content than a name.

## What a pass and a failure each mean

A clean run does **not** establish that the registry recognises real inference obligations. It
establishes how far three rules reach and where they are mechanically satisfiable without being
semantically satisfied. A-2 and A-5 are predictions **against my own construction**, and I expect
both to hold.

## Rules

Registry frozen. No rule added, no requirement edited, no category invented after seeing results. If
coverage is low, that is the reported finding, not a prompt to expand.
