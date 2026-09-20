# PREREGISTRATION — H-LOSS. Semantic information erased at a boundary, then reconstructed downstream.

Frozen before the mechanism exists and **before any defect has been classified against it**. Nothing
else is in this commit. `TRANSFER_1_PREREG.md` and `BACKWARD_1_FROZEN.txt` are NOT touched by this
slice; the hub run remains frozen and unspent.

## The hypothesis, in the owner's words

> **H-LOSS:** a substantial fraction of historical Legasus apparatus/authority failures occur after a
> richer distinction was available upstream, discarded by a representation boundary, and subsequently
> reconstructed or defaulted downstream.

The suspicion underneath it: the recurring problem may not be representation *leakage* but lossy
*projection* - reality is compressed before anyone knows which distinctions later reasoning will
need, and the downstream reconstruction becomes an oracle.

## THE THREE CRITERIA. ALL THREE, INDEPENDENTLY, OR NOT_H_LOSS.

    1  UPSTREAM DISTINCTION      information demonstrably existed before boundary B
    2  LOSSY BOUNDARY            B maps at least two distinguishable upstream states onto the same
                                 downstream representation
    3  DOWNSTREAM RECONSTRUCTION an authority-bearing operation later infers, defaults, or
                                 substitutes the lost distinction

A defect qualifies only if all three are named separately and concretely. **If any one is not
demonstrable the entry is NOT_H_LOSS, with no interpretive rescue.** The classifier refuses an entry
that omits any of the three, exactly as H-DEFAULT's `classify` refuses a seventh role - so "the
criteria were not relaxed" is a measurement and not a promise.

## THE CORPUS, FIXED IN ADVANCE

The **31 entries of `benchmarks/h-default-corpus.json`, unchanged**, plus every defect named in
ledger Entries 31-32, enumerated before classification. The H-DEFAULT corpus was built for a
different hypothesis and is reused precisely because it was not selected for this one.

## PREDICTIONS

**L-1. A substantial fraction qualify on all three criteria.**
*Refuted if* the fraction is low, or if reaching it requires weakening any criterion.

**L-2 (THE TEST AGAINST A BIGGER WORD FOR THE SAME THING). H-LOSS and H-DEFAULT are not the same
set.** If every H-DEFAULT EXPLAINED entry is H-LOSS and nothing else is, H-LOSS is a relabelling.
The prediction is that H-LOSS covers defects H-DEFAULT called NOT_AN_OMISSION - the readable brand,
the name-keyed admission, the moved referent, the elided wrapper - **and** that at least one
H-DEFAULT EXPLAINED entry fails a criterion and is NOT_H_LOSS.
*Refuted if* the two sets coincide, or if H-LOSS is simply a superset containing everything.

**L-3 (THE PROSPECTIVE TEST, STATED BEFORE RUNNING IT). H-LOSS predicts an UNOBSERVED defect in my
own screening layer, at a boundary I have not examined for this.**

`intervene.mjs::coordinates()` projects an output's authority coordinates with `String(v)`. That is a
lossy boundary: two distinguishable upstream values become one downstream representation. The
downstream reconstruction is the delta comparison `a.coords[k] !== b.coords[k]`, which feeds the
support formula, which feeds a contract verdict.

So H-LOSS predicts: **a counterfactual that genuinely changes a coordinate from one non-primitive
value to a different non-primitive value is reported as NO CHANGE**, because both project to
`[object Object]`. Under SUPPORT that yields a false CONSTANT or a false ALL_OF, and the contract
resolution built on it is unsound.

*Honesty about its strength:* this is a prediction about **unobserved behaviour**, not about unseen
code - I wrote `coordinates()` and can read it. It is therefore worth less than a prediction on a
subject I cannot see, and more than a retrodiction. Rated accordingly and not upgraded later.
*Refuted if* the behaviour does not occur.

**L-4 (PREDICTION OF NO REPAIR). This slice changes no production code and no frozen mechanism.**
If L-3 fires, the repair is a separate slice with its own preregistration. `BACKWARD_1_FROZEN.txt`
must still verify at the end of this slice.

## WHAT THIS SLICE DOES NOT ESTABLISH

- **No event-graph architecture, no projection-with-loss-carried-forward mechanism.** The owner's
  proposal - that a projection should return VALUE + PRESERVED + DISCARDED + UNKNOWN_LOSS +
  PROVENANCE - is NOT built. Freezing the hypothesis comes first.
- No claim that all historical defects belong to this class. The corpus includes entries the
  hypothesis cannot touch, and they are reported.
- **TRANSFER-1 is unchanged and the hub is still unrun.** H-LOSS needs its own later experiment
  against the hub, not a reinterpretation of that one.
- Nothing about whether Law 1 is "really" this. That is a question about the architecture's
  foundations and is out of scope for a classification experiment.
