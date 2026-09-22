# Containing the positional misattachment — result. C1..C5 against `CONTAINMENT_PREREG.md`.

    5 arms, all green.  164 -> 169 tests in this directory.  4 mutants run, 4 caught
    (one after an arm was strengthened).

## CORRECTED after `SUBSTITUTION_RESULT.md` — the scope claim was too wide

The closing sentence of the first version of this document said continuity transfer is refused
**wherever** the inputs cannot distinguish the intended history. **That is withdrawn.** The rule
detects multiple claimants in the *current merged set*; it cannot detect an **absent** intended
history, and X1 demonstrates that a sole byte-identical replacement inherits.

> **Transfer is refused when multiple presented claimants carry the authorized content.
> Substitution by a sole byte-identical claimant is NOT prevented.**

Two consequences for how the arms below should be read:

- **C3 demonstrates retained transfer capability. It does not demonstrate correct historical
  attachment** — uniqueness among presented claimants does not establish that the sole claimant is
  the intended history.
- **L6's changed result is not evidence for the origin check.** The containment now refuses before
  execution reaches the origin comparison, so L6 cannot be cited for that mechanism. Its observation
  that a byte-identical copy inherits nothing still stands, by a *different* mechanism. The origin
  check's own evidence remains the lineage run's mutation record.

## What changed, and what deliberately did not

The live path now refuses a continuity transfer whenever **more than one claimant carries the
authorized content** — because then nothing but the merger-assigned origin selects between them, and
a merger that assigns by position hands the authorization to whichever history landed in that slot.

**This contains the failure. It does not solve it.** The missing input P5 named is still missing, and
no identifier was invented here.

## The cost, recorded rather than hidden

**C2 is the arm that matters most.** A transfer the governor genuinely intended — stable,
hand-chosen origin labels, two byte-identical histories, one authorized — is now **refused**. The
same arm runs the preserved specimen on the same inputs and shows it would have succeeded, so the
sacrifice is measured rather than asserted.

**C3 shows the capability survives**: where exactly one claimant carries the authorized content, the
transfer still works. Containment is not a disguised removal of the feature.

**C5 shows the refusal is consequential**: under the frozen `INVALIDATE` default the refused transfer
leaves the obligation unattached and the whole run refuses. It is not a diagnostic.

## The specimen is preserved — and has since MOVED OFF the production options surface

`resolveContinuityUNCONTAINED` keeps the failing body unchanged. It was originally reachable through
an option on `replayMerged` called `__specimenUncontainedContinuity`. **That was a callable bypass on
the production options surface**, and C4 established only that the *tested live path* avoids it —
not that ordinary callers could not select it.

It now lives in `_specimen-support.mjs`, which no production module imports, and `replayMerged`
takes an ordinary `continuityResolver` injection point instead of a flag naming a defect. X5 asserts
the old magic string has **no effect**. **Stated limit: in JavaScript a bypass that exists is
callable by anyone who imports it** — X4 reaches it by importing it. This reduces accidental
selection; it does not make selection impossible.

**P1..P5 still measure the demonstrated failure end to end**, by injecting the specimen.

## A prediction that failed: the rule is broader than I said

The preregistration predicted **no existing arm would move**. **L6 moved.** In L6 both the record and
its copy carry the continuity assertion and the same content, so the merger-assigned origin is the
only discriminator — exactly the containment's condition. L6 now reports `INDISTINGUISHABLE` and
**neither** claimant inherits.

L6's original required observation survives and is strengthened: *the copy inherits nothing by being
identical* — and now neither does the other claimant, because the inputs cannot say which was meant.
The change is disclosed in the test itself rather than tuned away, and the prediction is recorded as
wrong.

## Mutation table

| mutant | caught by |
|---|---|
| containment removed (live path calls the specimen) | C1, C2, C4, C5, L6 |
| containment fires only above two claimants | C1, C2, C4, C5, L6 |
| specimen silently repaired to the contained behaviour | every continuity arm |
| claimant list left in input order | **nothing**, until C1 was strengthened |

The fourth is the same lesson as M10, arriving again: **a refusal path can exist and never be reached
by the arms meant to cover it.** Both of C1's original runs listed the same origins in the same
sequence, so only a permuted *source* order exercises the sort. An arm was added, disclosed as added
after the mutant survived, and the mutant now dies.

## Arm by arm

| arm | outcome |
|---|---|
| **C1** two claimants refused, both orders alike | **held**, and now also under a permuted source order |
| **C2** the accepted cost | **held** — the legitimate transfer is refused, with the specimen showing what was given up |
| **C3** capability survives | **held** |
| **C4** specimen intact, live path clean | **held** |
| **C5** refusal consequential | **held** — `ok: false`, no admissions, obligation unattached |

## Three facts, none cancelling the others

1. **The suite passes** — 169 tests, all green.
2. **The experiment demonstrates a safety failure** — P2 stands, preserved and still exercised end
   to end through the specimen.
3. **Applicability remains 0/15** — the registry recognises 3 authored rules and none of the fifteen
   sampled historical inference obligations.

## The research question this leaves open, unattempted

> What **governor-controlled** information binds an authorization to the intended journal **before
> the merger assigns positions**?

It must survive reordering, distinguish separate byte-identical histories, and **a claimant copying
its serialized label must not thereby acquire the binding**. This stays inside the carelessness
threat model; signatures are not automatically required. Until such an input exists, continuity
transfer is refused where **multiple presented claimants** carry the authorized content — including
when they genuinely could not have been confused, which is the cost C2 measures — and is **not**
prevented where the intended history is simply absent.
