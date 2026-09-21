# Currently demonstrated entitlement gates
2026-09-21. `entitlement.py`, conformance `entitlement_conformance.py` (6 cases, PASSED).
Built because every component has a demonstrated failure class, not because the decomposition is
believed complete.

## What is claimed

    Entitled(C)  =>  O(C) AND D(C) AND M(C)

**The converse is not earned.** Passing all three is a *necessary* condition on this branch's
evidence. It is not sufficient, and the name is deliberately *currently demonstrated* gates rather
than *the three dimensions of entitlement*.

    O  OBLIGATION    does the evidence topology license this claim's form, scope and domain?
    D  DERIVATION    does at least one supporting derivation have settled, decidable premises?
    M  MEASUREMENT   has the decisive instrument demonstrated capability for this observation?

## Three design rules, each forced by a recorded failure

**1. The gates are peers.** None owns or reinterprets another's internals. Each reads its own
namespace of the evidence record and nothing else, which is what made the H-ORTHO matrix produce
zero cross-detection.

**2. The gate vector is never collapsed into a causal diagnosis.** `O=FAIL, D=PASS, M=FAIL` means
*this conclusion has two independently demonstrated reasons it cannot be admitted*. It does not name
a cause. A single real failure trips two gates in two recorded cases — SCREEN-1's counterfactual and
the richness run — so treating the failing gate as the cause would be a fresh instance of the
substitution pattern. **There is no `reason`, `cause`, `root_cause` or `primary` field anywhere in
the module, and conformance asserts their absence.**

**3. Refusal compiles downward.** A refused claim returns the strongest claim the evidence *does*
license, so the remaining obligation is visible rather than rediscovered:

    attempted   ABSENCE "defect" over REPOSITORY, instrument uncontrolled
    licensed    OBSERVATIONAL "SCREEN-1 detectors emitted this result" over THIS_RUN

    attempted   EXISTENTIAL "input breaking validate_cuda" over PROGRAM
    licensed    EXISTENTIAL "input breaking validate_cuda" over FUNCTION

    attempted   EXISTENTIAL over an undecidable premise
    licensed    nothing about the subject; the open premise is the frontier

An incapable instrument licenses a claim about **its own output**, never about the world. That is
the SCREEN-1 lesson compiled into one rule.

## Non-redundancy, demonstrated rather than asserted

Conformance ablates each gate against a case it alone refuses:

    remove O  ->  Stage B case 3 is ADMITTED     function evidence becomes a program claim
    remove D  ->  REACH-1 get_path is ADMITTED   a correct verdict rests on an undecidable premise
    remove M  ->  SCREEN-1 is ADMITTED           absence read through an instrument that cannot fire

Each removal admits a conclusion this branch **actually retracted or corrected**. That is the
necessity argument Legasus requires, and it is stronger than "this component seems useful". It is
not a completeness argument.

## The architecture carries its own falsifier

    known wrong conclusion  AND  O, D, M all PASS   ->   CANDIDATE MISSING GATE

`candidate_missing_gate()` implements it, and conformance checks it fires. New dimensions are to be
discovered this way, not invented. All five of this branch's recorded corrections map onto the
existing three, which given five self-authored cases is close to no evidence of completeness and is
recorded as such.

## Status — built, not installed

This is a standalone module with a passing conformance gate. **It is not wired into any detector.**
No screener currently consults it, `reach1.py` and `hadmission.py` are unchanged, and census sites
#7 and #10 remain unrepaired as specimens. Installing it into a screener is a separate decision with
its own evidence burden.

## What this does not establish

That entitlement has exactly three dimensions. That the gates are sufficient. That the O gate's
claim-form taxonomy is right — `H-OBLIGATION`'s keyword extractor was too crude and had to be
abandoned mid-experiment, and the taxonomy here is hand-written. One lineage, one author, six
conformance cases drawn from the corpus that produced the design.

Two extensions of standing project vocabulary are recorded as consequences of this work:

    ATTEMPT AUTHORITY   !=  COMMIT AUTHORITY      (pre-existing)
    EVIDENCE EXISTENCE  !=  ENTITLEMENT AUTHORITY (new here)
