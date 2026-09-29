---
name: over-strict-checkers-invisible-to-known-bad
description: "over-strict checkers are INVISIBLE to known-bad tests - they reject bad input correctly for the wrong reason; only an independently verified known-GOOD subject finds acceptance bugs, and five were found that way in one session"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-14T11:56:28.126Z
---

**Over-strict checkers are invisible to known-bad tests.**

A verifier needs two kinds of evidence, and they are structurally orthogonal:

    known-bad fixtures              prove the checker CAN REJECT invalid work   (sensitivity)
    independently verified subjects prove the checker CAN ACCEPT valid work     (specificity)

A checker that rejects everything scores perfectly against any suite of bad inputs. That is why the
second kind cannot be skipped: an over-strict rule rejects the bad fixture *correctly, for the wrong
reason*, so no amount of negative testing can expose it.

**2026-09-14, five real defects in one session, cleanly split by which witness found them:**

    [].every() over an empty requirement list   passed everything       found by known-BAD
    unhandled file type returned {ok:true}      passed everything       found by known-BAD
    demanded s9-card be an id (it is a class)   rejected correct work   found by known-GOOD
    module.exports = <object> vs <class>        rejected correct work   found by known-GOOD
    html class check ignored the referenced js  rejected correct work   found by known-GOOD

The last three were found by a hand-written reference implementation that had been proven correct
independently - by execution and by puppeteer - BEFORE it was used to test the checker. The export
one is the sharpest: `module.exports = Library` passed when `Library` was a class and failed when it
was an object with identical semantics, purely because functions carry `.name` and objects do not.
Nothing about that is principled, and no negative fixture could ever have shown it.

**Why:** the costly direction of checker error is not "lets bad work through" - that gets noticed
when the artifact fails later. It is "rejects good work", because that silently becomes a claim
about the MODEL. Worse, when the same derivation feeds both the prompt and the checker, an
over-strict rule also changes what the model produces, and the apparatus ends up agreeing with
itself while disagreeing with the goal ([[contract-derivation-contaminated-treatment]]).

**How to apply:**
  * Every checker branch needs both witnesses before it scores anything. See
    [[checker-branch-that-cannot-fail]] for the rejection half.
  * Build one independently verified reference subject and keep it. It does double duty: predecessor
    state for the experiment, and the only instrument that can find acceptance bugs.
  * When a checker rejects something, first ask *is this actually wrong?* Several times in one
    session it was not.
  * A reference that is merely "written carefully" is not a witness. It has to be proven - executed,
    driven through a browser, asserted against the goal's own worked examples - or it can carry the
    same misunderstanding as the checker.

## 2026-09-14 refinement: the positive control must be broad enough to FIRE

Five vacuous-evaluator instances in one line of work, all of which reported success while demonstrating
nothing:

    `[].every()` true for an empty contract                              vacuous pass
    an unhandled artifact type returned ok:true                          vacuous pass
    MUTATE_SITE could not reach the STRICT branch (load check ran first) vacuous control
    an info audit scored 0/160 violations for files that never imported  vacuous audit
    a refusal gate's non-vacuity witness covered one goal of two         vacuous invariant

The last one is the sharpest. The gate passed known-good 8/8, known-bad 5/5, an adversarial near-miss,
AND its own non-vacuity invariant - then false-refused the only verified trajectory in the whole
experiment, because the single known-good plan it was tested against never exercised the offending rule.

So the rule is not "add a positive control". It is: **the positive control must be broad enough that the
rule under test actually fires on it**, and the suite must fail loudly when it does not. Related:
[[checker-branch-that-cannot-fail]], [[lenient-proof-easy-input]],
[[generation-interface-masks-capability]], [[fixture-blocked-by-another-guard]]
