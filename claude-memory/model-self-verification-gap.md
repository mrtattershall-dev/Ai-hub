---
name: model-self-verification-gap
description: "Qwen3-Coder writes correct code then a self-check that contradicts it, sees the failure, and finishes anyway — three occurrences, two languages, two prompt sets"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T20:54:34.526Z
---

Measured 2026-09-10 across 70 agent goals in two independent prompt sets, Qwen3-Coder-30B:

    q4_time.py   assert humanize(120)  == "2m"      passes, agrees with the code
                 assert humanize(3660) == "61m 0s"  FAILS - contradicts the line above
    r3_path.py   assert normalizePath("/a/../../b") == "/b"   FAILS - code returns otherwise

In both cases **the function is correct** and the model's own self-check is wrong. It ran the
file, saw the AssertionError, and called finish anyway. Both goals explicitly asked it to
"run it" - so verification WAS the deliverable, making these real misses, not scoring
artifacts.

**The generalisation:** this model's IMPLEMENTATION is more reliable than its VERIFICATION.
It reaches for ambitious edge cases in tests (`..` escaping above root, whole-minute
formatting) that its implementation does not satisfy, and never reconciles them.

**How to apply.** Do not treat `run_command`/`run_python` exit codes as ground truth for "did
this work". When the model authors both the code and the test, a green run only proves they
agree with each other, and a red run does NOT prove the code is wrong - on both occasions
here the code was fine. Score the artifact separately from the model's own test. A hub-side
improvement worth trying: when a self-check fails, ask which is wrong - the code or the
assertion - rather than assuming the code.

Of 70 goals these were 2 of the 3 distinct failures; the third was a doc file never written.
See [[advisory-vs-mechanical-recovery]] and [[capability-floor-7b-vs-14b]]. Raw logs in the
repo at `measurements/2026-09-10-small-model-loop/`.

**2026-09-10 update - the 14B does it too, and it is the dominant failure.** Qwen2.5-Coder-14B-
Instruct-AWQ, 25 fresh goals (measurements/2026-09-10-14b-30min, commit 3706bd6), hand-verified:
four goals had a CORRECT implementation failed by the model's own assert (a try/assert.fail
caught by its own catch; "test" counted 2 in a sentence where it appears 3 times; an
order-dependent expected list; a test that reuses an emitter with a leftover listener), and one
"test" goal invented the API it was testing (enqueue/dequeue on a push/pop queue; mocha
describe/it under plain node). Scoring by exit code undercounted the 14B by ~4 goals.
How to apply: never treat the model's own test as ground truth - check requested functions
exist and test them independently (see also [[hub-target-14b-coder]]).
