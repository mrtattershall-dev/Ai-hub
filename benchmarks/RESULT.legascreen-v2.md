# r4 — LegaScreen v2. RESULT: four predictions held, and THE REAL EXPERIMENT FAILED.

Predictions frozen in `9079e38`. The probes are in `legasus/legascreen/minting.mjs`; the driver is in
`benchmarks/run-legascreen-v2.mjs` and is the hand-authored part.

## The runs

    TREE       POSITIVES                                          COVERAGE
    HEAD       0                                                  7 witnessed / 16 perturbations
    b11e51f    2  I-WEAKENING calculus.derive repository=S1        7 witnessed / 14 perturbations
                  I-WEAKENING calculus.derive criterion=K
    58bb62aa   0                                                   7 witnessed / 16 perturbations
    77fd921    0                                                   7 witnessed / 16 perturbations

## V2-1 held, and it is the prediction of NO detection

**I-ANCESTRY did not flag C2**, exactly as preregistered. C2's `S1` was in the closure of its inputs
- premise two established it - so nothing was minted from nothing. Only I-WEAKENING flagged it. The
probe is not credited with a catch its universal invariant does not make, and the owner's
`Authority(output) ⊆ AuthorizedClosure(inputs)` formulation is confirmed as insufficient for this
defect. **Two invariants were needed, and the reason is now executed rather than argued.**

## V2-2, V2-3, V2-4 held

I-WEAKENING flags `calculus.derive` at b11e51f and is silent at HEAD. The positive control holds: at
HEAD the legitimate call, where both premises establish the same world, retains `repository` and is
NOT flagged - so the probe is not passing by hostility to every retained dimension.

**V2-4 is the architecture result.** On calculus.mjs:

    v1 P-ERASURE   7 positives over 8 functions, nearly all wrong-shape artifact
    v2 minting     0 positives at HEAD, 2 real ones at b11e51f

Requiring a WITNESSED call before concluding anything from an output removed the artifact class
entirely. LegaExercise's rule - no observation without execution - was the fix, and it had been in
this repository since r2 while the screening layer ignored it.

## V2-5 FAILED. The rescan found NOTHING NEW.

    findings meeting all four conditions for "new": 0

The two positives are C2, on two dimensions of the same function in the motivating module. A second
dimension of the same defect is not a new finding by the frozen conditions.

**The preregistration fixed the reading and it is taken:** v2 is a regression test wearing a screen's
clothes. The ANY moment did not repeat. No probe is added to chase a better result.

And the honest bound on that negative: the rescan surface was **7 transforms across 4 modules and 4
trees**. A null over 7 transforms is weak evidence about the repository and strong evidence about
the probe's REACH. It does not say the repository is clean of minting; it says this probe, aimed
here, found none.

## What the run did find, and it is about the screen rather than the repository

The first version of `minting.mjs` reported `adapt.adaptRecord` minting `criterion` and `history` at
HEAD. Both were false. The input identity is keyed `{producer, document, ordinal}`; the output scope
is keyed `{criterion, history}`. **Stripping `criterion` from an input that has no `criterion` key
changed nothing**, so the invariant "failed" without any perturbation having occurred.

That is hazard 3 from this project's own ledger - A CONTROL THAT COULD NOT FIRE - committed inside a
screen built to catch that class. Repaired: a perturbation is now checked to have actually changed an
input, and a vacuous one reports UNSCREENED with its reason. Three dimensions at HEAD are now
honestly unscreened for exactly this cause - they are DERIVED from differently-named inputs, which
this probe cannot perturb by name and does not pretend to.

## The coverage map, updated

    ERASURE                        yes, under compatible object shapes; specificity collapses off them
    ALIAS                          yes, for the scanned exported-name region
    COMPOSITION LAUNDERING         yes, over the generated 64-chain region; found null AND ANY
    SINGLE-TRANSFORMATION MINTING  I-ANCESTRY: no instance found in 7 transforms
                                   I-WEAKENING: yes, for operations that DECLARE conjunction
    DERIVED-BY-ANOTHER-NAME        UNSCREENED - named, and outside every probe's reach
