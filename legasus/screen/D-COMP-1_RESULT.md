# D-COMP-1 result — the seven-element decomposition is INCOMPLETE. Two counterexamples.
2026-09-21. Preregistration `D-COMP-1_PREREG.md` (1870c50), with both falsity criteria frozen
before construction. **Stage A** — adversarial cases by the model's own author. Raw:
`legasus/out/dcomp1/dcomp1.json`.

## X1 — discrimination real, but not via the proposition (attacks F1)

    P   "CJK font support was VERIFIED for this font"
    C   UNVERIFIABLE
    W   asserts supports(...) is True AND metrics_width(...) > 0
    I   a corrupt font file        - realises C, AND breaks the unrelated metrics helper
    I'  truetype patched to raise  - realises C, touches nothing else

    W under W0                PASS
    realizes(I, C)            True     (the subject's except branch was taken)
    W under I                 FAIL (OSError)   -> discriminates(W, P, C, I) = True
    realizes(I', C)           True
    W under I'                PASS             -> F1 satisfied

**Every relation the decomposition defines holds, and the entitlement is false.** `W` failed
under `I` because the corrupt font broke the metrics helper, not because it observed anything
about `P`. A second intervention realising the *same* contrast leaves `W` passing.

## X2 — contrast coverage (attacks F2)

    P    "CJK font support was VERIFIED"
    C    declared class {UNSUPPORTED, UNVERIFIABLE}
    W    assertTrue only - the shape of the real project test T1
    I2   a font genuinely lacking the glyphs (no patching at all)
    I3   truetype patched to raise

    W under W0                          PASS
    realizes(I2, UNSUPPORTED)           True
    W under I2                          FAIL   -> discriminates(W, P, UNSUPPORTED, I2) = True
    realizes(I3, UNVERIFIABLE)          True
    W under I3                          PASS   -> F2 satisfied

`W` discriminates `P` from one member of its declared contrast class and is blind to the other.
The decomposition, as written, is satisfied by naming the contrast class — it never requires the
witness to be tested against **every** member it names.

## Disposition, as frozen

> **Counterexample found → the seven-element decomposition is INCOMPLETE.** Characterise the
> missing relation; do not add it in this experiment.

The two gaps, characterised and **not** installed:

1. **Specificity.** `discriminates(W, P, C, I)` does not require that the discrimination be *via*
   `P`. X1 shows discrimination can be entirely collateral. Something of the shape
   `specific_to(W, P, C, I)` is missing — but its form is unknown, and X1 only shows that *some*
   such requirement is needed.
2. **Coverage.** Adequacy is relational in `C`, but entitlement to `P` is not. Discriminating one
   declared contrast entitles nothing about the others. A distinction between *contrast validity*
   and *contrast coverage* is missing.

**Neither is added to the model.** Adding a relation because a counterexample demanded it is how
the last three detectors acquired their hidden assumptions.

## An apparatus correction, recorded

X1's first evaluation **did not meet F1 as frozen**. F1 requires the *whole witness* to pass
under `I'`; I evaluated only its proposition clause, because the global `truetype` patch broke
the metrics helper too. Reported `F1_entitlement_false: True` on that basis, which was wrong.

Corrected by fixing the **construction**, never the criterion: `metrics_width` now binds the real
`truetype` at definition time, so `I'` reaches the subject and not the helper, and the whole
witness genuinely passes. The frozen F1 is unchanged and is now actually satisfied.

This is the third time in this branch that an apparatus was found grading itself against a
weakened version of its own frozen criterion. The pattern is worth noting and is not yet a
finding.

## What this does NOT establish

- **Not that the decomposition is wrong in general.** Stage A only: two constructed cases by the
  model's own author. Weak by design.
- **Not that specificity and coverage are the only gaps**, nor that they are the right names.
- **Not that any replacement is better.** No replacement exists.

## Where this leaves A3

Further from being built than before, and correctly so. A3 built on the seven elements would
have inherited both gaps: it would have accepted a witness that discriminates collaterally, and
a witness blind to half of its own declared contrast class — which is **exactly the real T1**,
the project-authored test that started this.

The next attack is Stage B: a counterexample whose failure mechanism is **not** one I designed
the model around, or one constructed by a different author. Stage A has now done what it can.
