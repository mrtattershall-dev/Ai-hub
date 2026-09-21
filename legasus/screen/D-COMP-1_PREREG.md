# D-COMP-1 — attack the seven-element decomposition itself (frozen 2026-09-21, before construction)

Target of the attack: `EVIDENCE-RELATION.md` (6226af2). **Not its bookkeeping.** The goal is not
to leave a field blank; it is to make **every defined relation evaluate correctly** while the
resulting entitlement is nevertheless false.

## Stage, declared up front

**Stage A — adversarial constructed cases.** Cheap falsification attempts, designed by the same
author as the model. If they fail to break it, that is **weak** evidence and must not be reported
as survival. Stage B (different failure mechanisms or different authorship) and Stage C (frozen
decomposition against a fresh external target) are not attempted here.

## What counts as "entitlement demonstrably false" — frozen BEFORE construction

Two criteria, each mechanical, each decided in advance so neither becomes a movable judgement:

**F1 — the discrimination was not via the proposition.**

> The entitlement is demonstrably false if a second intervention `I'` exists with
> `realizes(I', C)` **true** and the witness **passes** under `I'`.

If `W` fails under `I` but passes under a different intervention realising the *same* contrast,
then `W` did not fail because of `C`. It failed because of something else `I` did.

**F2 — the contrast class was covered only in part.**

> The entitlement is demonstrably false if some `C2` in the **declared** contrast class has
> `realizes(I2, C2)` true and the witness **passes** under `I2`.

`W` may perfectly discriminate `P` from `C1` while being blind to `C2`, and `C2` was named in the
contrast class from the start.

## The two constructions

**X1 (attacks F1) — discrimination real but causally irrelevant.**
A corrupt font file realises UNVERIFIABLE *and* breaks an unrelated metrics helper. The witness
asserts both "supports == True" and "width > 0". It fails under the corrupt font — genuine
discrimination — but the clause that observes `P` returns `True` in both worlds. `I'` = patching
`truetype` to raise, which realises the same contrast without touching metrics.

**X2 (attacks F2) — contrast coverage.**
Contrast class declared as {UNVERIFIABLE, UNSUPPORTED}. The witness discriminates `P` from
UNSUPPORTED and is blind to UNVERIFIABLE — the exact shape of the real T1, reproduced under the
model's own rules with every element explicitly filled in.

## Predictions

**Y1.** X1 is constructible: all seven elements explicit, `realizes(I,C)` true,
`discriminates(W,P,C,I)` true, and F1 satisfied. FALSIFIER: no such `I'` exists, or `W` fails
under `I'` too.

**Y2.** X2 is constructible on the same terms, satisfying F2. FALSIFIER: `W` fails under `I2`.

**Y3.** Both survive the model's *own* checks — that is the point. If either can be rejected by a
relation already in the decomposition, it is not a counterexample and I will say so.

## Disposition, frozen

    counterexample found       the seven-element decomposition is INCOMPLETE. Characterise the
                               missing relation; DO NOT add it in this experiment.
    no counterexample found    the decomposition survived THIS Stage-A attack only. No
                               completeness claim, no generality claim, and explicitly not
                               "starts to earn its place" - Stage A cannot deliver that.

## What this experiment may not do

Add a relation, name a fix, modify `EVIDENCE-RELATION.md`, or treat two variants of one mental
model as two independent probes.
