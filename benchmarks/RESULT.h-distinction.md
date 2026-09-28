# r4 — H-DISTINCTION. RESULT: DX-1 fired, DX-2 survived by ONE entry, and the ladder has a measurable problem.

Predictions frozen in `fff897b`, with the locating rule fixed before any defect was looked at.
Run: `node benchmarks/run-h-distinction.mjs`.

## DX-1 FIRED — the minimality direction, which nothing had tested

    two structurally identical Maps project to:   <obj#1>   and   <obj#2>

    a PERFECTLY DETERMINISTIC subject
      output contains a freshly allocated Map  ->  replay ok: false   reason: DIVERGED
      same subject, plain output only          ->  replay ok: true

`semantic()` assigns a fresh identity to every non-plain object, and `replay()` compares projections
to decide baseline stability. So a subject that is deterministic in every respect anyone could care
about is declared **BASELINE_UNSTABLE** and refused.

**The instrument's limitation is reported as a property of the subject.** Any subject whose outputs
carry a Map, a Set, a Buffer, a stream or a class instance is unscreenable by this path and is told
it is non-deterministic. That is the opposite error from L-3: an over-fine projection producing a
**false refusal** where `String(v)` produced a **false agreement**.

Not repaired - DX-4 forbade it. `run-backward.mjs` does not use `replay()`, so the frozen hub
transfer is unaffected; `run-surface` and `run-semantic` do.

## DX-2 SURVIVED BY A SINGLE ENTRY

    COLLAPSE     33     a required distinction merged by a projection
    SEPARATION    2     an irrelevant distinction invented by a projection
    NEITHER       1

The one entry the frame does not cover is **W3-e**: the token's KIND was carried, distinct and
readable at every step. No projection merged EPISTEMIC with NORMATIVE and none separated
equivalents. `commit()` had the distinction in hand and did not branch on it. Under the locating
rule - fixed in advance precisely so this could not be argued away - a consumer failing to consult
is not a collapse.

**Without the locating rule this would have been 36 of 36.**

## DX-3 held

    SEPARATION  W3-f      premises array -> premises[0]
    SEPARATION  BRIDGE-b  context comparison -> strict inequality over references

Two, not zero, so "distinction" is not merely H-LOSS relabelled - it names an error direction H-LOSS
could not express. Two out of thirty-six is thin.

## THE MEASURABLE PROBLEM WITH THE DESCENT

Three hypotheses, one corpus, and the trend is the finding:

    hypothesis        covers          discriminating set
    H-DEFAULT         13 / 31  42%    15  (+3 value confusions it could not express)
    H-LOSS            30 / 36  83%     6
    H-DISTINCTION     35 / 36  97%     1

**Each level down explains more and refutes less.** That is the signature of a frame becoming
unfalsifiable, not of one becoming true. Going deeper has been buying coverage and paying in
refutability, and by that measure the next level down would explain everything and rule out nothing.

The descent is not thereby worthless - but **its value is not in the coverage numbers**, and reading
those numbers as confirmation would be the error every one of these hypotheses was written to
detect.

## WHAT ACTUALLY PAID: THE PROSPECTIVE RECORD IS 3 / 3

Each level was required to predict something before it was checked. Each did, and each found a real
live defect that nobody had reported:

    D-3   H-DEFAULT       delegate: an omitted argument INHERITS, `{}` REFUSES, decided by `||`
    L-3   H-LOSS          coordinates(): String(v) turns a real change into a false CONSTANT
    DX-1  H-DISTINCTION   semantic(): a deterministic subject declared BASELINE_UNSTABLE

**Three hypotheses, three prospective hits, zero defects found by classification.** The
classifications produced coverage percentages; the predictions produced defects. That asymmetry is
the most useful thing in this sequence, and it suggests the way to run the ladder is to demand a
prospective prediction per level and ignore the retrospective fit entirely.

## DX-4 held

No production code changed. `BACKWARD_1_FROZEN.txt` still verifies. L-3's `String(v)` and DX-1's
`semantic()` both remain unrepaired, each needing its own preregistration. The hub is still unrun.

Suite 686/686.
