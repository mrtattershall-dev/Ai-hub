# `history` as a scope dimension, and the complete accounting of the doctest residual

## H1 / H2, preregistered

    disagreeing (example, mutation) pairs: 13

                            prefix > 0    prefix == 0    prefix UNKNOWN
      MINE_SEQ resolves            9             0               0
      MINE_SEQ does not            0             0               4

    H1  everything the execution model fixes has a NON-EMPTY prefix   HELD   (9/9, zero leakage)
    H2  some residual has a KNOWN-EMPTY prefix                        FAILED

**H1 held cleanly.** Every case doctest's shared-globals execution resolves has a non-empty execution
prefix, and no case with an empty or unknown prefix was resolved by it. `history` predicts exactly which
disagreements are subject mismatches rather than verdict mismatches.

**H2 is not falsified — it is untestable on this corpus.** There is no residual case whose prefix is
*known* to be empty. The four remaining all have UNKNOWN prefix, and an unknown prefix is an absence of
evidence about the subject, not evidence that the subject is identical.

### The scoring bug that nearly reported H2 as HELD

The first version of this script scored `(prefixOf.get(k) || 0) > 0`, collapsing **UNKNOWN into ZERO** —
and then counted those cases as evidence for H2, which reported HELD. That is

> **LOSS OF PROVENANCE MUST NEVER INCREASE ENTITLEMENT**

violated inside the script written to test that very law. UNKNOWN is now a third column.

## Cause E — the residual four, fully explained

The four UNKNOWN cases are examples doctest reports and my miner never saw. That contradicted the earlier
discovery probe (159 = 159, zero difference on the pristine corpus), and the contradiction was the clue.

**Five of the 56 frozen candidates mutate a doctest example, not implementation code.** Their anchors
begin with `>>> `:

    specifiers.py/contains          >>> Specifier(">=1.2.3").contains("1.2.3")
                            ->      >>> Specifier(">= 2.2.3").contains("1.2.3")

So under those mutations:

* **doctest** re-reads the mutated docstring and evaluates the NEW example, which fails against unchanged code;
* **my classifier** replays the PRISTINE examples frozen in `sweep.json` and never sees it.

Neither verifier is wrong. **My evidence set was stale** — established against repository state S0 and
used against S1. This is precisely the lifecycle problem the witness bank exists to solve
(DISCOVERED → VALID → STALE → REVALIDATED/INVALID), reappearing inside the comparison harness that was
supposed to be testing the architecture.

## Complete accounting of the 8 residual disagreements

    4   Cause C   incompatible execution model    confirmed by MINE_SEQ; predicted by `history` (H1)
    4   Cause E   stale evidence under a
                  SPECIFICATION mutation          the corpus's documentation moved; my mined set did not
    0   unexplained

Together with the earlier corrections:

    Cause A   incompatible semantics (empty expected output is an assertion)     corrected
    Cause B   misattribution of a preceding example's failure                    corrected
    Cause C   incompatible execution model                                       explained, not "fixed"
    Cause D   discovery                                                          RULED OUT (159 = 159)
    Cause E   stale evidence vs specification mutation                           explained

**The entitlement algebra is implicated in none of them.** Every disagreement lived in the
evidence-production layer. Where the algebra's reason topology was tested, agreement was 25/25.

## A defect in the frozen benchmark, recorded not repaired

5 of 56 candidates (9%) are **specification mutations**, not behavioural ones. The candidate generator
admitted docstring lines as mutation sites. The manifest stays frozen — it was preregistered — but any
future use of it must classify those five separately, because a mutation that edits the specification
tests something entirely different from one that edits the implementation.
