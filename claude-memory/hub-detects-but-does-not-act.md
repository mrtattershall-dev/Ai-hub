---
name: hub-detects-but-does-not-act
description: "The 2026-09-12 ten-agent audit found one pattern behind nearly every hub defect: the detection exists and fires, and nothing is wired to it - the repeat warning fired 219 times and was ignored 164"
metadata:
  type: project
---

Nearly every defect the full-codebase audit found has the same shape: **the hub already knows, and does nothing with
what it knows.** Not missing detection - missing *connection*.

    repeat-call warning       fired 219 times, model repeated on the very next call 164 (75%)
    duplicate-call notice     fired 23 times on one file while 23 copies of a method landed
    repeatCalls counter       counts identical calls correctly; NOTHING in the file compares it to a threshold
    loop guard                disarms itself when the repeated call SUCCEEDS (recentAt pairs the reply with a
                              `landed` count, so a landing write can never match)
    destructive-write guard   asserts "Earlier steps depend on those" - a hardcoded string nothing checks; in 11 of
                              12 refusals the named symbols had zero call sites
    EXIT classifier           reads the annotated answer, and the notice appended after the EXIT line hides failure
    console.assert            prints "Assertion failed:" and exits 0, so a self-test cannot fail
    verifyProject             records "ran and exited cleanly" on exit 0 and discards the output entirely

**How to apply:** when adding a guard, the question is not "does it detect?" but "what does it DO, and is that thing
on the path that executes?" Two checks, both cheap, both of which caught a dead fix in one night:

1. Trace the value to its consumer and confirm the consumer runs in the configuration being measured. `batchStepFailed`
   is correct and only runs with `AGENT_BATCH_ACTIONS=1`, which no measurement set has used.
2. Before ranking a fix, ask whether the runs it would have changed were actually WRONG. Nine runs finished
   `verified: true` carrying a non-zero exit; **seven of them scored correct**. A stricter gate would have blocked
   seven and caught zero.

And an advisory is not a fix. A warning a model ignores 75% of the time is a detection wired to nothing.

Related: [[advisory-vs-mechanical-recovery]], [[fix-the-deciding-path-not-the-advisory-one]],
[[silent-failures-are-the-class]], [[goal-coupling-wrong-denominator]].
