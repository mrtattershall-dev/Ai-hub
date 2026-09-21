# H-ORTHO result — T-1 and T-2 hold, but the gates are NOT a partition of failures
2026-09-21. Preregistration `H-ORTHO_PREREG.md`, frozen before the matrix was scored.
Raw: `legasus/out/hadmission/ortho_audit.json`.

## The matrix

    case                              family   O      D      M      entitled
    F1  Stage B case 3                O        FAIL   PASS   PASS   no
    F2  REACH-1 get_path (site #7)    D        PASS   FAIL   PASS   no
    F3  SCREEN-1 zero findings        M        PASS   PASS   FAIL   no
    F4  REACH-1 R2 (59/60)            none     PASS   PASS   PASS   yes

    T-1  each case fails exactly its own gate, F4 passes all three   HOLDS
    T-2  cross-detection                                             0

Each gate reads different fields, so none had the input to do another's job. The obligation gate
cannot see premise decidability; the derivation gate cannot see the positive control; the
measurement gate sees neither scope nor premises.

## T-3 confirmed exactly as predicted, and it qualifies everything above

I named F3/O as the cell that would break, and why. Re-scoring SCREEN-1 with the claim it **did not
make** — *"Odysseus has no defects"* instead of *"zero findings ... nothing about Odysseus"*:

    O  FAIL   claimed scope REPOSITORY exceeds evidence scope THIS_RUN
    D  PASS
    M  FAIL   instrument capability not demonstrated

**Two gates fire on one failure.** So the clean diagonal in the matrix is a property of the claim
*as stated*, not of the failure. SCREEN-1 narrowing its own claim is what moved that case from a
two-gate failure to a one-gate failure.

## A second case that trips two gates, added post-freeze and labelled

The first H-INFO run printed `DISCRIMINATED` while the richness comparison was never instantiated:

    O  PASS   D  FAIL   M  FAIL

## What this actually establishes

**The three gates are independent** — each can fail while the other two hold, demonstrated on four
real recorded cases, with zero cross-detection.

**They are not a classifier.** A single real failure can trip two of them, so "which gate failed"
does not diagnose the cause uniquely. What the conjunction supplies is a **necessary condition**,
not a decomposition of blame. Reporting the failing gate as *the* cause would be a new instance of
the substitution pattern.

## T-4 — no fourth dimension found, and that is weak evidence

All five of the branch's recorded corrections map onto the three gates: obligation 3, derivation 1,
measurement 1. None passed all three while being wrong. But this is five cases, self-authored, with
the mapping assigned by me, on a corpus that generated the gates. **Not finding a fourth dimension
here is close to no evidence at all**, and is recorded as such rather than as support.

## The honest weakness

The case records are my encoding of the documents. The encodings are defensible — F1's scopes are
quoted verbatim, F2's premise undecidability was *proven* by H-DEFINED's indistinguishable pairs,
F3's control failure and F4's calibration are recorded numbers — but the **gate definitions are
mine**, and each reads exactly the fields that distinguish its family. n = 1 per cell.

## Architectural consequence, which is what the experiment was for

Each gate prevents a **distinct demonstrated** failure class, and two of the three already exist in
this branch:

    O  obligation topology per claim form   proposed, UNBUILT
    D  CLOSED/OPEN proof frontier           measured in REACH-1
    M  positive control that must fire      in use since CONTROL-1

That justifies building them as separate responsibilities. It does **not** establish that the set is
sufficient, and T-3 shows the separation is conditional on how claims are phrased — which means the
obligation gate is doing work that partly determines whether the other gates look independent.

Nothing installed. Sites #7 and #10 remain unrepaired; #7 is F2 and is now load-bearing for four
separate results.
