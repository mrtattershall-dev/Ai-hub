# SEQ-1 DEFINITION — two successive additions to one program, by the corrected frozen policy

Frozen 2026-09-27, **before either addition is attempted.** Local, **$0**. No verified spend
authorization; Modal stays off.

## The question

> **Can Legasus keep extending one program without losing what already works?**

TRANSFER-3 showed one addition on each of two unfamiliar pages. This asks the harder thing: **a second
addition on top of an accepted first**, where the second must preserve the original program's behaviour
**and** the first addition's.

## THE PAGE IS A FAMILIAR DEVELOPMENT PAGE, and that is stated up front

`legasus/bench/set3/s3-06-scores` is **no longer unfamiliar.** It was the subject of an accepted addition
in TRANSFER-3, I have read its source while diagnosing the renderer defect, and its facts were used to
verify the fix. **Nothing here is evidence of transfer.** It is the right subject for a retention test
precisely because it already has an accepted addition to preserve, and the wrong subject for any claim
about new code.

## What runs, and why from the original baseline

**Both additions are attempted by the CORRECTED policy, starting from the page as delivered.** Addition 1
is re-attempted rather than inherited, because TRANSFER-3's accepted artefact was produced by the policy
*before* the renderer and ranking fixes. Building on it would mix two policy versions in one sequence and
make the result uninterpretable. So:

    start        legasus/bench/set3/s3-06-scores/baseline-as-delivered.html, sha 54f8667e384ef85f
    addition 1   pressing `0` returns every piece of state to its load value
                 protected: the page as delivered
    addition 2   pressing `z` decreases the first numeric field of the state by one, and never below its
                 load value
                 protected: the page as delivered UNION addition 1's checks

**If addition 1 is not accepted, the sequence stops there and that is the result.** Addition 2 is not
attempted on an unaccepted base.

## The accumulation rule, which is the point of the experiment

**Addition 2's protected set is the union of every earlier accepted check.** A candidate that implements
`z` but breaks `0`, or breaks `a`/`b`, fails - it is not "partially good". This is the mechanism that has
to work for a builder that keeps building, and it is the same computed-union arrangement already used for
the farm pages.

Checks are generated mechanically from observation of the base at each step, by `server/emitTask.mjs` and
`server/emitTask2.mjs`, and each emitter **refuses to write a task unless the base's applicable checks all
pass AND the new addition is absent and fails for the right reason.**

## The policy: corrected, and frozen again

    server/codeFacts.mjs      CORRECTED at d297002 - renderCompact degrades from the bottom and reports
                              every shortening; handle-like bindings rank below the program's own state
    server/autoGuide.mjs      unchanged
    server/localEdit.mjs      unchanged
    the gate                  unchanged: judgeCandidate, evaluator, acceptance, playCheck
    context config            compact, 240-character budget, strategy included - UNCHANGED from
                              TRANSFER-3, so the fix is tested at the same budget that exposed it

Hashes in `SEQ-1_MANIFEST.txt` at freeze time; executed hashes recorded again after the run. **The policy
does not change between the two additions.**

## Budget, per addition

    addition attempts      12 model calls each, hard limit
    feedback rounds        at most 4; at most 3 seeds per round
    interventions by me    0 permitted; any rescue recorded as one and named in the result

Reported separately and never summed: attempt calls per addition, page-generation calls (0 - the page
already exists), browser probe runs, oracle calls.

## Pre-registered readings

- **Both additions accepted, second preserving the first.** Legasus extended one program twice while
  keeping everything it had built. On a familiar page, so this is retention, not transfer.
- **Addition 1 accepted, addition 2 not.** Retention untested at the second step; report which check
  failed and whether the first addition survived in the workspace.
- **Addition 2 accepted but a protected check fails.** The most interesting failure available: it would
  mean the accumulation mechanism let a regression through, and it would be preserved as a regression case.
- **Addition 1 not accepted.** The sequence stops. Note that TRANSFER-3 accepted this same addition on
  this page in one call with the previous policy, so a failure here would be evidence about the FIX and
  would need investigating before anything else.

**What no outcome here can establish:** anything about unfamiliar code, anything about a third addition,
or reproducible generation.
