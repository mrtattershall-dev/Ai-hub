# BIND-CJS step 7 result — C1 CONFIRMED: the scalar representation destroys authority-bearing information
2026-09-21 04:05. Preregistration `legasus/BIND-CJS_REEVAL.md` (b40168e), frozen before the
fixture existed. Classifier under test: the step-5 scalar rule, reproduced verbatim. Mechanism
`legasus/cjs-preload.mjs` @ e41c1e3, unchanged and not accused of anything.

## Bridge control

    constructed-uniform -> VALID_INTERVENTION
    real R-A            -> VALID_INTERVENTION      PASS

Construction does not change the verdict on an unchanged sequence, so the constructed arms are
readable.

## Results

| arm | provenance | identity sequence | scalar verdict |
|---|---|---|---|
| R-A | **real run** | M M M M M | VALID_INTERVENTION |
| R-B | constructed | M M **S** M M | **VALID_INTERVENTION** ← violates the frozen expectation |
| R-C | constructed | M M M M **S** | TRANSPORT_CONTRADICTION |
| R-D | constructed | **S** M M M M | **VALID_INTERVENTION** ← violates the frozen expectation |
| R-E | **real run** | S S S S S | SUBSTITUTION_UNOBSERVED |

**C1 CONFIRMED.** A contradictory execution in the middle of the sequence is erased. The
classifier certifies `VALID_INTERVENTION` over evidence that records an evaluation in which the
requested replacement did **not** execute.

**C2 CONFIRMED.** The same contradiction at the end is caught (`TRANSPORT_CONTRADICTION`).

**C3 CONFIRMED.** At the start it is erased, exactly as at position 3.

**Positional dependence ISOLATED.** One contradiction; four of five positions invisible, one
visible. The verdict is determined by *where* the dissenting observation sits, not by whether it
exists. Neither prediction alone would have shown this — C2 is what makes C1 a statement about
position rather than about detection.

## What this establishes

An intervention that failed on one of five evaluations is certified valid. That is not an
inelegant internal representation; it is an authority-bearing conclusion reached from evidence
that contradicts it, with the contradiction present and recorded in the same bundle. The raw
record carries `sequence`, `distinctIdentities` and `uniform` for every arm — **the information
exists and the classifier discards it.**

Step 6's 266/266 result is not weakened, but it is now correctly bounded: it held because every
one of the 266 observations agreed, and *agreement was never checked by the classifier* — only
by me, afterwards, from raw records. Had one of the 266 dissented anywhere but last, the same
verdict would have been printed.

## A third cardinality, found in passing

R-A's real bundle contains **10 served records for 5 evaluations** in **1 process**: each
iteration resolves the target twice (`require.resolve` and `require`). Served records are
resolutions, not evaluations, and not interventions. The audit's standing check applies
verbatim, three hours after the audit — recorded here rather than folded into the number.

## What is NOT done

No repair. No multiplicity-aware classifier, no `uniform` field consumed by any verdict, no new
state. The preregistration said the experiment stops if C1 fires, and it fires.

What a redesign would have to represent is now dictated by evidence rather than by design
taste — an execution **set** with a uniformity fact, because the scalar demonstrably lost
something, not because a set is a nicer model. That redesign is a separate preregistration which
must state in advance what it would be allowed to conclude.

## Consequence for the Intervention abstraction

It stays closed, and the reason has changed for the better. Before tonight it was closed because
two properties were unexercised. It is now closed because **the current evidence representation
has been demonstrated, by direct attack, to destroy information that determines the verdict.**
An interface extracted now would standardise that defect across every future transport.

## Scope

One fixture, one target, five evaluations, one classifier. Says nothing about process
composition (step 8), the foreign engine, or BIND's interpretation rules, which are untouched.
Two arms are real runs; three are constructed from a real bundle by editing only the identity
sequence, because the frozen mechanism is deterministic and cannot produce a mid-run
contradiction — a property of the mechanism, stated before the arms were built.
