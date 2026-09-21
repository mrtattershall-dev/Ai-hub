# H-LEAK — did the answer leak backward into the machinery that justifies it?
Frozen 2026-09-21, before any coverage was measured.

## The hypothesis

> False confidence arises when information derived from the target proposition, expected verdict or
> downstream interpretation enters the **construction** of the evidence later used to justify that
> proposition.

This is different from H-REFUSAL and from H-INFO, and the difference is what makes it worth a test.
A machine could implement `SAME / DIFFERENT / UNRESOLVED` perfectly and still be contaminated, if
the **supported equivalence region itself** was designed using knowledge of the answer. Refusal
does not prevent leakage. Neither does preserving every distinction.

## What this experiment tests, and what it does not

It tests **one** leakage channel: whether a frozen detector's supported region was fitted to the
corpus its author had been exposed to. It does **not** test the deeper self-leakage claim — that one
intelligence authoring hypothesis, representation, detector, test and verdict leaks its expected
relationship through every stage. That claim has no test here and gains nothing from this result.

## The exposure gradient, established from git rather than memory

    d581e14  2026-09-20  SCREEN-1 run on Odysseus          <- author exposed to Odysseus source
    dc4d63e  2026-09-20  evidence contract frozen
    f364471  2026-09-20  SCREEN-2 target criteria frozen BEFORE any query
    8c8ab5a  2026-09-20  A2/B2 implemented, `resolve` written, detector bytes frozen

    corpus     exposure when `resolve` was designed
    odysseus   HIGH  - SCREEN-1 had been run against it and its source read
    mpt        NONE  - selected at metadata level only; source opened after the freeze
    pytorch    NONE  - not involved until Stage B, later

## The measurement

For every `return <expr>` in each corpus, does the frozen `resolve` return a value or `UNRESOLVED`?
Coverage is the resolved fraction.

**The control, and it is the whole point.** The same measurement with `ast.literal_eval`, an
independent implementation of very nearly the same supported region, written by CPython's authors
with **zero** exposure to any of these three corpora. Corpora differ in style regardless of
leakage, so a raw cross-corpus difference proves nothing. The control absorbs style.

## Prediction

**L-1.** `resolve`'s coverage gap between the exposed corpus and the unexposed ones is
**materially larger** than `literal_eval`'s gap across the same corpora.

    predicted:   cov_resolve(odysseus) - cov_resolve(pytorch)
               >  cov_literal(odysseus) - cov_literal(pytorch)     , by a clear margin

FALSIFIER: the two gaps are comparable, or `resolve`'s gap is smaller. Then `resolve`'s supported
region tracks Python idiom rather than author exposure, and **no fitting is detected**.

**L-2.** The mpt corpus, blinded at design time by an explicit procedural barrier, patterns with
pytorch rather than with odysseus.
FALSIFIER: mpt patterns with odysseus, which would mean the barrier did not work, or that exposure
is not what drives the difference.

## Dispositions

    L-1 holds                 evidence of fitting in a frozen detector's supported region. One
                              channel, one detector; not a general claim about the branch.
    L-1 fails                 no fitting detected in this channel. H-LEAK gains nothing here and
                              the freezing discipline is, on this evidence, working.
    L-1 holds, L-2 fails      the gradient is not exposure; look for the real confound before
                              claiming leakage.

## Rules

`resolve` is imported from the frozen `screen2.py` and **not modified**. Coverage is computed
identically for both resolvers over identical node sets. No corpus is added or dropped after
measurement. If the result is null, it is reported as null — a null here is evidence *for* the
procedural barriers this branch has been building, which is an outcome I would like, and that is
precisely why the control exists.
