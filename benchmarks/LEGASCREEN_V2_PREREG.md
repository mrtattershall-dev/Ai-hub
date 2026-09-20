
# r4 — LegaScreen v2: the minting probe, on a witness-mutation-invariant architecture. Frozen before any code.

The holdout (Entry 22) left a measured blind spot and named the missing property. The owner then
sharpened it and added an architectural correction that matters more than the probe itself.

## FINDING BEFORE IMPLEMENTATION, recorded so it cannot look like a convenient discovery later

The owner's general formulation is:

    Authority(output) ⊆ AuthorizedClosure(inputs)
    "a transformation may rearrange, narrow, combine or legitimately derive authority from its
     inputs, but may not output authority with no ancestry in them"

**That invariant does not catch C2.** C2 was `derive({}, {repository: S1}) -> context {repository: S1}`.
S1 IS in the closure of the inputs: premise 2 established it. Nothing was minted from nothing. The
defect is that DERIVE IS CONJUNCTIVE - its own source says "the output context is the INTERSECTION" -
and it took a dimension only ONE premise established.

So there are two invariants, not one, and v2 implements both rather than collapsing them:

    I-ANCESTRY     universal. Strip D from EVERY input; the output must not establish D.
                   Catches minting from nothing. PREDICTED NOT TO CATCH C2.
    I-WEAKENING    for operations whose own documentation declares conjunctive combination. Strip D
                   from ONE input; the output must not establish D. CATCHES C2.

The owner's instruction stands and is obeyed: single-edge minting and multi-edge laundering are NOT
collapsed into one graph invariant here. The data has not earned that reduction.

## The architecture correction, which the holdout forced

Pointed at calculus.mjs, P-ERASURE produced 7 positives over 8 functions, nearly all because a
wrong-shape call returned a plausible object. The screen could not tell a semantic abnormality from
nonsense-in-nonsense-out. That is **LegaExercise's own discipline arriving at the screening layer**:
`witness.mjs` has said since r2 that there is NO OBSERVATION WITHOUT EXECUTION, and v0/v1 ignored it.

Every v2 probe therefore has three parts, and a probe that cannot complete part 1 reports UNSCREENED:

    1 OPPORTUNITY    a call that SUCCEEDS and returns an authority-bearing object. No witness, no
                     screening - the invocation's legitimacy is established before anything is
                     concluded from its output.
    2 PERTURBATION   exactly ONE controlled change to that witnessed call's inputs.
    3 INVARIANT      what must or must not change in the output's authority.

## Predictions

    V2-1  I-ANCESTRY does NOT flag C2 at b11e51f. (Stated above; a prediction of NO detection, so the
          probe cannot be credited with a catch its invariant does not make.)
    V2-2  I-WEAKENING flags calculus.derive at b11e51f, and is silent at HEAD.
    V2-3  POSITIVE CONTROL, or the easiest passing implementation is one that discards every
          dimension: when inputs DO jointly establish D, the output retaining D must NOT be flagged.
    V2-4  SPECIFICITY. Because every probe now requires a witnessed call, the v2 positives over
          calculus.mjs must be FEWER than P-ERASURE's 7-of-8 artifact rate on the same module. If
          they are not, the witness requirement bought nothing and that is the finding.

## THE REAL EXPERIMENT, and the only result worth reporting as new

V2-2 is not a result: C2 created this probe, so catching C2 is a regression test with extra steps.

    V2-5  RESCAN. The probe runs over EVERY legaknow module at HEAD and at three historical trees
          (b11e51f, 58b62aa, 77fd921). The question is what it finds BESIDES C2.

    A finding counts as new only if ALL hold:
      - not named in this preregistration
      - not in calculus.mjs (the motivating module)
      - reached through a witnessed, legitimate invocation
      - survives a narrow diagnostic run by hand afterwards

    FALSIFICATION, stated plainly: if the rescan surfaces only C2 and artifacts, then v2 is a
    regression test wearing a screen's clothes, the ANY moment did not repeat, and that is the
    recorded outcome. No probe is added to chase a better result.

## Not built

The authority-flow graph, static parsing, shrinking, finding IDs, repair packets, severity
dimensions, per-model rendering, and the collapse of single-edge and multi-edge invariants into one
law. Named as absent.
