# CONTROL-1 result — FAILED on 4 of 6 criteria, and SCREEN-1's zero is now interpretable
2026-09-21 11:35. Preregistration `CONTROL-1_PREREG.md` (58d3d16), frozen against the current
unrevised detectors. Corpus scanned through the **production entrypoint** (`screen1.py`), same
parser, filter, dedup and reporting path used on Odysseus.

## Outcome

    files seen 3, parsed 2, unparseable 1
    raw candidates 10  ->  5 logical cases across 2 tree copies

| kind | case | invariant | raw hits | verdict |
|---|---|---|---|---|
| POSITIVE | `upload_ok` (A1) | INV-A | 0 | **MISSED** |
| POSITIVE | `sync_records` | INV-A | 0 | **MISSED** |
| POSITIVE | `sync_records_with_failure_path` | INV-A | 2 | FLAGGED |
| POSITIVE | `is_ready` (B1) | INV-B | 2 | FLAGGED |
| POSITIVE | `has_access` (B2) | INV-B | 2 | FLAGGED |
| NEGATIVE | `token_missing` (A-NEG) | INV-A | 2 | **FALSE POSITIVE** |
| NEGATIVE | `is_ready_host` (B-NEG) | INV-B | 2 | **FALSE POSITIVE** |
| CARDINALITY | duplicated tree → 2 raw per logical | — | — | **held** |
| OBSERVABILITY | unparseable file reported | — | — | **held** |

**CONTROL-1: FAILED, 4 criterion violations.** Demonstrated detection: **3 of 5** preregistered
positives. Negatives rejected: **0 of 2**.

## Predictions, scored — including the one I got wrong

    A1 will be MISSED                               CONFIRMED
    A-NEG will be falsely flagged                   CONFIRMED
    B-NEG will be falsely flagged                   CONFIRMED
    B1, B2 flagged                                  CONFIRMED
    A2 (`sync_records`) will be FLAGGED             WRONG - it was missed
    CARDINALITY (unknown)                           held
    OBSERVABILITY (unknown)                         held

**The wrong one is my error, not a detector surprise.** The prereg table described A2 as *"`except:
return 1`, `return False` elsewhere"*, but the `sync_records` I actually wrote has no literal
failure return — I put that in the separate `sync_records_with_failure_path`. So `sync_records`
is a second instance of the A1 shape and fails for the same reason. The corpus drifted from its
own preregistration, and the mismatch is recorded rather than tidied: **6 of 7 predictions held,
and the seventh failed because I mis-built the case, which is exactly the kind of thing a
control is supposed to surface about its author.**

## What this establishes about the detectors

**INV-A cannot see its own canonical case.** *The error path reports the success value* — with no
literal failure return anywhere — is the purest instance of the invariant, and the detector
requires precisely such a return to fire. Two of the three INV-A positives were invisible.

**Both invariants condemn legitimate code.** A fail-safe inverted predicate and an ordinary
computed boolean were both flagged, reproducing on demand what Odysseus exposed.

**The two unknowns held.** Cardinality did not inflate. And OBSERVABILITY — the criterion that
came directly from the hazard that twice looked like "zero findings" when pytest simply had not
run — is now demonstrated: an unparseable file surfaces as unparseable and cannot be absorbed
into a clean result.

## What this establishes about SCREEN-1's zero on Odysseus

Previously uninterpretable: *"Odysseus is clean of these classes"* versus *"the detector cannot
see them."* CONTROL-1 settles the direction:

> The detector demonstrably cannot see the canonical INV-A shape, and demonstrably condemns two
> classes of legitimate code. SCREEN-1's zero on Odysseus is therefore **at least partly a
> property of the detector**, and cannot be read as evidence that Odysseus lacks these defects.

That is a bounded, usable statement where before there was none. It is also the branch exit
condition being met the hard way: the prospective result was uninterpretable, and the control is
what made it interpretable rather than a rewrite of the screener.

## Terminology, per tatte

This establishes a **minimum demonstrated detection capability** — and the demonstration
*failed*. It says nothing about sensitivity, which would require a labelled corpus
representative of the relevant Python distribution.

## What was NOT done

No detector was changed before or during this control. No criterion was relaxed after seeing the
result. The corpus/prereg mismatch was recorded, not corrected into agreement.

## Next, in the order tatte specified

1. Formalise the Python evidence contract.
2. Build INV-A2 (polarity-aware, and able to see the no-failure-return shape) and INV-B2
   (computed-return-aware) as **new** detectors with their own frozen predictions.
3. Re-run CONTROL-1 against them — it is now the acceptance gate, and it must pass 6/6.
4. Freeze the detector bytes and the predictions.
5. Choose a **fresh** external Python target. Odysseus is a detector-development corpus now and
   cannot serve as a blind prospective test for detectors it helped shape.
6. SCREEN-2 there.
