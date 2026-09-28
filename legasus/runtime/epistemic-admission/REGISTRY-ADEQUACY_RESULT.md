# Registry adequacy — the registry recognises ZERO inference obligations it did not author
2026-09-21. Preregistration `REGISTRY-ADEQUACY_PREREG.md`, frozen before classifying. 8/8 on node
v24, with two failed predictions recorded as failures rather than hidden. **The registry was not
expanded, and is still three rules.**

## The headline

    corrected classification over 15 pre-registry rule declarations:
        UNKNOWN_RULE   9
        UNDECLARED     6
        correspondence 0

The three rules recognise **nothing** in a corpus of derivations authored by earlier sessions with no
knowledge of them. That is the answer to the question the registry has to earn, and the answer is no.

## Scoring

    A-1  COVERAGE IS LOW        HOLDS, and understated. Under the frozen criterion 9/15 "matched";
                                under the corrected one, 0/15.
    A-2  EMPTY RULE IS A        FAILED - and reality is worse. Predicted it would match the one
         FALSE FRIEND           empty rule; it matches ALL THREE.
    A-3  CAUSAL IS UNKNOWN      FAILED - my own frozen classification fabricated the correspondence
                                its falsifier forbade.
    A-4  NECESSITY              HOLDS. Every non-empty registry requirement is load-bearing.
    A-5  SPECIFICITY IS WEAK    HOLDS, as predicted against my own design.

## A-3 is the result worth keeping, because the falsifier fired against me

I wrote: *"FALSIFIER: it maps onto a registry rule, which would mean the mapping is fabricating
correspondence."*

It mapped. `causal transfer` requires `BEFORE` and `FLOWS_TO`; the registry mentions neither. The
frozen classification nonetheless returned `KNOWN_UNDER`, because `claim-from-direct-observation`
requires `[]`, and **the empty set is a subset of every requirement set**. So a rule that demands
nothing appears to "demand less than" every inference in existence, and the classification reports
that the registry almost-covers causal transfer.

**The mapping fabricating the correspondence was mine, in the criterion I froze to prevent exactly
that.** Same shape as the bridge demotion and as every apparatus defect this session: a measure
whose structure admits a conclusion the thing measured does not support.

## The correction, recorded and deliberately NOT applied to the frozen run

> A rule requiring **nothing** is not evidence of correspondence, because an empty obligation is
> compatible with any inference whatsoever.

Excluding empty-requirement rules from matching, and requiring non-empty overlap, yields the
zero-correspondence tally above. It is reported as a labelled post-hoc analysis and did not replace
the frozen classification, whose failure is the primary finding.

## A-5 — a live defect, not a limitation

`derive()` matches witnesses by the `relation` **string**. Supplying `COVERAGE` satisfies the
requirement regardless of what the witness is about:

    relationWitnesses: [{ relation: 'COVERAGE', of: 'a completely different domain', evidence: null }]
        -> MINTS

and through the real adapter, on a real certificate:

    F4 with requested_claim.domain.name changed to 'A_DOMAIN_NEVER_COVERED'
        -> STILL MINTS

The `COVERAGE` witness is **not bound to the claim's domain**. The registry constrains the relation
NAME and not the relation CONTENT, so v1.2 moved the burden out of the producer's hands and into a
requirement that a correctly-named empty witness satisfies. **Recorded as an open defect and left
unrepaired**, alongside census sites #7 and #10; repairing it now would destroy the specimen before
the experiment that measures its consequences.

## What v1.2 did and did not achieve

**Did:** the producer can no longer choose its own burden of proof. R1–R5 hold, and Stage B's case 3
is now refused inside `derive()`.

**Did not:** make the registry an account of real inference. It is three rules, written by me, for
the family of claims my own producer emits, and it recognises no obligation it did not author. The
authority surface is smaller and inspectable, which is progress, and it is not yet earned.

## Limits

15 rule declarations from 5 test files, extracted by regex, so the corpus is what those tests happen
to declare rather than a survey of real inference. Six of the fifteen declare no requirements at all,
which the calculus reads as `[]` and which this experiment keeps separate as `UNDECLARED`, since
"declared none" and "declared empty" are different authorial acts.
