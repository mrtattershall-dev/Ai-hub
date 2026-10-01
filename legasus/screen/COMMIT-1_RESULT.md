# COMMIT-1 — RESULT: the authority boundary, characterized unrepaired

Prereg `COMMIT-1_PREREG.md` @ claim 6b655812, frozen before the probe existed. **Nothing repaired.**
acceptance.js, batch.js, governance.js, evaluator.js run as shipped; cid1 is the probe's oracle only.

Two EH1 runs, both SEALED and both preserved — EH1 refused to overwrite the first:

    d7b07f38   T5g NOT_EVALUATED (probe passed `g` bare; concludeGoverned reads run.governed.checks)
    d8b33205   the full result below

## The must-fire fired

    T1 / K8   judge C0 -> PASS -> mutate live ws -> applyAcceptance
              disposition RETAIN, promotable true, cid1(ws) = C1 != C0 = verdict.subject
              FIRES: authorized(C0), retained(C1)

The verdict is correct, the receipt is correct (D-BIND), and the wrong bytes become authoritative
anyway. Nothing downstream looks inconsistent.

## Results by transition, against the frozen classification

    T1  evaluator -> applyAcceptance RETAIN     FIRES (injected)
    T2  RETAIN -> accepted baseline             FIRES_BY_COMPOSITION   batch.js:194 cpSyncs the LIVE ws
    T3  baseline -> next task start             FIRES_BY_INHERITANCE   startRef is a git commit of the copy
    T4  governed conclusion -> surviving state  FIRES_BY_COMPOSITION   governance.js:137-138, same applyAcceptance
    T5g RESTORE, governed path                  HOLDS                  restored cid1 == cid1(start), exactly
    T5b RESTORE, batch path                     UNMEASURABLE           no cid1 of START exists in that path
    T6a EVALUATION_ERROR -> HELD                HOLDS                  promotable false, nothing promoted
    T6b incomplete -> PRESERVE_INCOMPLETE       HOLDS                  kept, promotable false
    ABA mutate, restore to C0, commit           PERMITTED              trivially - nothing checks yet

## What "by composition" means, and why it is stated rather than claimed

`runBatch`'s `finalise` and `concludeGoverned` each call `evaluate()` then `applyAcceptance()`
back-to-back with no external injection point. The probe cannot mutate inside that window. T2, T3
and T4 are therefore shown to fire because they PERSIST WHATEVER applyAcceptance RETAINs, and T1
shows applyAcceptance retains C1 under C0's verdict. They are cited to their code sites and are
not reported as injected measurements. A repair that closes T1 closes T2 and T4 structurally and
T3 by inheritance — but the regression must still assert each transition independently, because
"structurally closed" is exactly the kind of inference the D-series exists to distrust.

## The two findings that constrain the repair

**T5g holds.** The governed RESTORE path already returns the previously authoritative identity:
`prepareGoverned` evaluates the start (cid1 since D-BIND, transported as
`startVerdict.candidateTree`), and `git reset --hard startRef` + `clean -fd` with autocrlf off
reproduces those bytes exactly. The rejection side of the property is already sound where a cid1
of START exists. The repair is to the ACCEPTING side only.

**T5b is unmeasurable, not passing.** batch.js's task start computes `startRef`/`startTree` by git
alone (batch.js:281-282); no cid1 of START is ever taken on that path. Its restore anchor is a
git commit of whatever T3 copied in — so T2 drift becomes the next restore anchor silently. This
is a GAP in the batch path's instrumentation, recorded here, not repaired here, and not to be
confused with T5g holding.

## What the repair must do, derived from the property, not from K8

At the point state becomes authoritative in `applyAcceptance` (the PROTECTED-PASSED block, before
RETAIN is assigned):

    S  = cid1(ws)                       the exact state about to become authoritative
    C0 = candidateVerdict.subject
    S.id === C0        -> RETAIN may proceed
    S.id !== C0        -> MUST NOT RETAIN under this verdict. Fail closed with a disposition that
                          says WHY (identity drift), not RESTORE_FAILED and not HELD, so the
                          journal distinguishes "the verdict's authority did not transfer" from
                          "the instrument failed".
    S unavailable      -> fail closed

And it must leave ABA PERMITTED: `S.id === C0` is an EQUALITY check at the transition, so a
workspace that wandered and came back is accepted. A repair that compares to the `after`
re-evaluation's subject, or that refuses any change since the verdict, has implemented
immutability where equality was required and will be rejected by the ABA row.

`after.subject` must not be the anchor. It is a re-verdict of the live state, which answers "does
C1 pass on its own" — a different question from "may C0's authority transfer to C1".

## Explicitly NOT claimed

- that T2, T3 or T4 were measured by injection. They were not; see above.
- that the batch-path RESTORE is sound. It is unmeasurable without a cid1 of START.
- anything about D-CONS's immutability guard, which is upstream of this boundary and untouched.
- that the repair is designed. The constraints above are derived from the property; the
  regression is written first, fails unrepaired on T1 (and asserts T2/T3/T4 via runBatch and
  concludeGoverned end to end), then the code changes.

## Apparatus, recorded

The first run's T5g returned `FAILED_TO_APPLY: Cannot read properties of undefined (reading
'requested')` because the probe passed `prepareGoverned`'s return as `run.governed` without the
`checks` field the `/start` route normally assembles. Probe error, not system behaviour. Fixed in
the probe; the first run is preserved sealed with T5g = NOT_EVALUATED rather than overwritten.
