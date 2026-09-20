# r4 — H-LOSS. RESULT: L-3 fired prospectively, L-2 was HALF REFUTED, and 83% is a warning.

Predictions frozen in `17ef98f`, before any defect was classified. Criteria enforced in
`legasus/legascreen/loss.mjs`. Corpus `benchmarks/h-loss-corpus.json`.
Run: `node benchmarks/run-h-loss.mjs`.

## L-3 FIRED — the only prospective test, and it found a live unsoundness

`intervene.mjs::coordinates()` projects authority coordinates with `String(v)`. Predicted before
running: a counterfactual that genuinely changes a coordinate from one non-primitive value to a
different one is reported as NO CHANGE.

    baseline world   : {"tag":"A"}
    removing the fact really makes it {"tag":"B"}

    outcome          : OBSERVED
    delta            : []
    why              : the input changed and the observed reading did not
    support formula  : CONSTANT

**A false CONSTANT** - "it does not come from the facts at all" - for a coordinate entirely
determined by the facts. `CONSTANT` is in `SPEC_VOCABULARY`, so a contract resolution built on it
would be SCREENED rather than UNMAPPABLE: a false conviction or a false acquittal, depending on
which way the contract points.

**Blast radius on published results:** every context dimension in the witnessed calculus runs holds a
primitive, so the SEMANTIC-1 P-5 result is not contaminated. Checked rather than assumed. The defect
is real, latent, and **not repaired in this slice** - L-4 forbade it.

## L-1 held at 83%, AND THAT IS THE WARNING

    H_LOSS        30   83%
    NOT_H_LOSS     6   upstream=2, boundary=4
    disputable among the qualifying: 3 (C5, C9-b, W3-d)

Thirty of thirty-six qualify on all three criteria. **A frame that explains almost everything
retrospectively is not thereby true.** The discriminating set is six, and those six are the only
thing standing between this hypothesis and unfalsifiability.

They earn their place by failing a criterion for a stated reason:

    C9-a      UPSTREAM   the relevance of a pending item was never established anywhere, so no
                         boundary discarded it. Never acquired is not lost.
    SLICE2-a  UPSTREAM   which fact supports which coordinate was never captured - that relation is
                         exactly what lineage existed to discover.
    W3-e      BOUNDARY   the token's KIND was present, carried and readable throughout. commit()
                         did not consult a distinction that had SURVIVED.
    W3-f      BOUNDARY   both premises' kinds were distinguishable; argument order decided. An
                         incidental property choosing semantics is leakage, not loss.
    BACK-c    BOUNDARY   the aggregate-of-privates structure was in the AST the whole time; the rule
                         consulted a different feature. Wrong evidence is not destroyed evidence.
    BACK-e    BOUNDARY   every enclosing function was in the index; the rule asked only the
                         innermost. A wrong query is not a lossy boundary.

## L-2 WAS HALF REFUTED

    H-DEFAULT explained, also H-LOSS      13
    H-LOSS only (H-DEFAULT said NOT)      17     C3, C4, C5, C7, C8-a, C9-b, W2-a, W2-b, ...
    H-DEFAULT only (H-LOSS says NOT)       0
    the two sets coincide: false

The prediction had two halves. The first held: the sets do not coincide, and H-LOSS reaches
seventeen defects H-DEFAULT called NOT_AN_OMISSION - the readable Symbol brand, the name-keyed
admission, the moved referent, the collapsed provenance ledger.

**The second half failed.** I predicted at least one H-DEFAULT EXPLAINED entry would fail a
criterion. **Zero did.** H-LOSS is a strict superset of H-DEFAULT on this corpus, which means
H-DEFAULT is a proper special case rather than an independent finding - and "strict superset" is
uncomfortably close to the "bigger word for the same thing" the prediction was written to detect.

## L-4 held

No production code changed. `BACKWARD_1_FROZEN.txt` **still verifies**, so the hub run remains
unspent and the mechanism is still the frozen one.

## Honest verdict

The classification is weak evidence. 83% retrospective coverage with a six-entry discriminating set
is the profile of a frame that is hard to falsify, not of one that has been tested. **The load is
carried entirely by L-3**, which was stated before it was run, named the boundary and the downstream
consumer in advance, and found an unsoundness that was really there.

One thing the classification did establish mechanically: the criteria were not relaxed. `classify()`
refuses an entry that cannot name all three, and refuses a NOT_H_LOSS that will not say which
criterion fails.

Suite 686/686.
