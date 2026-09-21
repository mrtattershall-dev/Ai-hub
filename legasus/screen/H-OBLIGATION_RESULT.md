# H-OBLIGATION result — O-1 FAILS. Claim form explains 3 of 5 corrections, not 5.
2026-09-21. Preregistration `H-OBLIGATION_PREREG.md` (30b74c1). Corpus: the 17 result documents of
this branch and their independently recorded correction history.

## Apparatus failure, recorded rather than hidden

The frozen keyword extraction rule is **too crude to classify claim form from headlines**. It fires
on `zero` inside *"SCREEN-1's zero is now interpretable"*, which is a reference to a claim, not a
claim. I therefore scored against each correction's **documented reason**, quoted from the record,
instead of the frozen extractor. That is a substitution of method mid-experiment. It is recorded
here as one, and it means O-1's score is weaker than a clean mechanical run would have been.

## The corrections, classified by their own documented reason

    #  conclusion corrected          documented reason                         claim-form promotion?
    1  Stage B case 3                "What I demonstrated was 'this function    YES - function
                                     can be wrong for an input', not 'this      scope promoted to
                                     decision can be wrong in this program'"    program scope
    2  H-INFO operational form       condition must quantify over S_reachable   YES - domain binding
    3  H-ADMISSION bias claim        corpus was a sparse *.py checkout, so a     YES - universal
                                     universal over "all biases" was bound to   claim over a
                                     the wrong domain                           mis-bound domain
    4  REACH-1 get_path justification the premise "this receiver has dictionary  NO - undecidable
                                     semantics" is undecidable at the site      premise
    5  SCREEN-1's detectors          CONTROL-1 failed 4 of 6; the instrument     NO - instrument
                                     could not fire                             capability

**O-1 FAILS.** Claim-form promotion accounts for **3 of 5**. Two corrections have causes no
obligation compiler keyed on claim form would catch.

## The survivor that matters most

SCREEN-1's headline was *"ZERO FINDINGS. Precision 0/3"*, and the document states:

> **Nothing about Odysseus.** Zero defects were found, and that is the result.

It **explicitly refused** the promotion from *no findings* to *no defects*. That conclusion was
never corrected on claim-form grounds; it was corrected on instrument grounds. So the branch has
one recorded case of the refusal working, and it is evidence that the discipline is implementable
by hand — and evidence that doing it by hand does not protect against the other two causes.

## O-2 and O-3

**O-2** is not falsified: the classification marks most conclusions entitled and does not flag
SCREEN-1's carefully scoped zero, so it is not a refusal machine.

**O-3 FAILS in an unexpected direction.** I predicted a shallower single feature might explain the
correction set equally well. None does — but neither does claim form. The five corrections have
**three distinct causes**, and no single account covers them:

    claim-form / domain promotion   3
    undecidable premise             1
    instrument capability           1

## The useful synthesis, which is more than the hypothesis earned

Three causes, and this branch has already built a distinct remedy for each:

    claim-form / domain promotion  ->  obligation topology per claim form   (proposed, unbuilt)
    undecidable premise            ->  CLOSED/OPEN proof frontier           (REACH-1, measured)
    instrument capability          ->  positive control that must fire      (CONTROL-1, in use)

A substrate enforcing only claim-form obligations would have prevented three of the five, and would
have been silent on the other two. **That is an argument for building it and against expecting it
to be sufficient.**

## Standing

Retrospective, self-authored corpus, with a method substituted mid-run. This is **not** evidence
for H-OBLIGATION; it is a census of why this branch's conclusions actually failed. The claim that
claim form determines required proof topology remains a design proposal, and the substrate that
would make illegal promotion unrepresentable remains unbuilt and untested.

Nothing installed. Sites #7 and #10 remain unrepaired.
