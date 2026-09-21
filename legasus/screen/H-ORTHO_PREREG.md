# H-ORTHO — is entitlement three independent gates, or one thing projected onto three axes?
Frozen 2026-09-21, before the matrix was scored.

## The hypothesis

> Entitlement is not scalar. `E(C) = O(C) ∧ D(C) ∧ M(C)`, and a conclusion can fail any one
> independently.

    O  OBLIGATION    does the evidence topology license this claim's form, scope and domain?
    D  DERIVATION    is at least one load-bearing derivation valid with no unresolved premise?
    M  MEASUREMENT   has the instrument demonstrated it can observe the thing being interpreted?

This would explain why every candidate root in this branch leaked: a multidimensional condition was
being projected onto one axis.

## The gates take DIFFERENT inputs, which is what makes orthogonality testable

    O  reads  claim form, claimed scope, evidence domain and its coverage
    D  reads  the support derivations and the decidability of their premises
    M  reads  whether a positive control fired

If a gate detects a failure outside its family, its input was sufficient for someone else's job and
the separation is not real.

## The four families, drawn from REAL recorded cases rather than constructions

    F1  O fails, D and M hold    Stage B case 3, `validate_cuda("")`. The instrument evaluated the
                                 function fine and the local derivation was sound; the claim was
                                 promoted from function scope to program scope.
    F2  D fails, O and M hold    REACH-1 `get_path`, census site #7. Instrument fine, claim scope
                                 fine (existential about one parameter), but the only supporting
                                 derivation rests on a premise undecidable at the site.
    F3  M fails, O and D hold    SCREEN-1. The claim was explicitly narrowed - *"Nothing about
                                 Odysseus. Zero defects were found, and that is the result"* - but
                                 CONTROL-1 failed 4 of 6 and the detectors could not fire.
    F4  all hold                 REACH-1's R2, that the closure extends beyond the function body in
                                 59/60 cases. Domain stated, coverage stated, no undecidable
                                 premise, and calibration reproduced three known verdicts.

## Predictions

**T-1.** Each of F1, F2, F3 fails **exactly one** gate, and it is its own. F4 passes all three.
FALSIFIER: any case fails a gate outside its family, or F4 fails one.

**T-2 — cross-detection is zero.** No gate detects another family's failure.
FALSIFIER: any off-diagonal rejection.

**T-3 — the cell I expect to break, named in advance.** F3/O is the risky one. An instrument that
never fires produces zero observations, so coverage is zero, and an **absence** claim would fail O
as well as M. I predict O **passes** here only because SCREEN-1 narrowed its claim to the run. If
so, O and M are orthogonal **for this claim as stated** and would *not* be for the unnarrowed claim.
That is a conditional orthogonality and must be reported as one, not as a clean separation.
FALSIFIER of my reasoning: O fails F3 as stated.

## The real attack, run after the matrix

**T-4.** Find a **wrong** conclusion for which O, D and M all legitimately pass. If one exists,
there is a fourth dimension and the architecture is incomplete.
Reported either way. Not finding one in a small self-authored corpus is weak evidence and will be
labelled as such.

## Disposition

    T-1, T-2 hold                three independent gates, each preventing a distinct demonstrated
                                 failure class. Justifies building them as separate
                                 responsibilities - not that the set is sufficient.
    off-diagonal detection       the gates are not independent; one is doing another's job and the
                                 decomposition is decorative
    T-4 finds a case             a fourth dimension exists; the architecture is incomplete

## Rules

Gates are implemented as separate predicates over structured case records whose fields are quoted
from the result documents. A case's fields are fixed before any gate runs. Nothing installed. Sites
#7 and #10 remain unrepaired — #7 is F2 and is now load-bearing for four results.
