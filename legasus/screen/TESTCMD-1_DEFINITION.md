# TESTCMD-1 — definition, frozen before any generation

2026-09-25, committed before deploy. **Cap: not yet authorized — do not launch until it is.**

## The question

BENCH-3 established that this configuration produces about 5 verified repairs in 45 attempts,
with per-replicate spread 1–3 of 15. The traces say why the other 40 failed, and the reason is
not what I first reported:

- **The test data was never in a task workspace.** The worker bind-mounts the workspace and
  nothing else; each seed is a single buggy `.py`. The cases lived on the host and were
  materialised into `/check` only at evaluation time. The model could not run the task's tests.
- **The one mechanical oracle it reached for is a false pass.** QuixBugs examples sit in an
  orphan string literal, so `doctest.testmod` returns attempted 0, failed 0, exit 0 on broken
  code (proved in the worker).
- Where the model had expected values — written beside the call in the file — it sometimes
  used them and repaired the bug (`lcs_length` r2) and sometimes had the identical observation
  and did nothing (`lcs_length` r3).

So: **does a usable failing-test signal change what the model does?**

## The two arms

    CONTROL    the seed exactly as BENCH-1/2/3 ran it (buggy module alone), BENCH_GUIDANCE verbatim
    TESTCMD    the same seed PLUS run_tests.py and task_cases.jsonl, and two sentences:
               "This workspace contains run_tests.py and the task's test cases.
                Run `python3 run_tests.py` to see, for every case, the expected value against
                what your code actually produces."

Verified before freezing: the arms' `requested` and `protected` checks are byte-identical, and
the goal differs by exactly those two sentences. Same model, sampling, limits, worker,
isolation, acceptance policy, evaluator, repeat guard.

15 tasks × 2 arms × 2 replicates = **60 units**, interleaved, **arm order alternating by task**
(even index CONTROL first, odd index TESTCMD first) so a drifting backend cannot favour one arm.
300s per task, no retries, 3-hour wall clock, plan recorded first so an unrun unit is
UNATTEMPTED rather than missing.

## The label, which is not negotiable

**The exposed cases ARE the graded cases.** `taskTests.test.mjs` asserts byte-identity with the
requested check's case file. Any TESTCMD result is therefore **repair with supplied tests** and
is never evidence of generalization to unseen inputs. The protected check remains a subset of
those cases, so passing them does not automatically satisfy protected behaviour — but it is not
independent evidence either.

## What is measured, and what would count

| measure | what it is | reading |
|---|---|---|
| `verifiedRepairs` | acceptance RETAIN | the outcome question |
| **`caseDelta`** | graded cases passed by **the candidate the model produced**, minus the seed's baseline | **the real question: do failures lead to useful edits?** A run moving 2/9 → 7/9 did work even without finishing. Candidate-side, so a rolled-back run is not scored as inert; regressions counted separately |
| `editsOnTarget`, `runsThatEdited` | writes that hit the module under test | did it act at all |
| `sawFailingTest` → `editAfterFailure` | an edit to the target following a failing observation, in order | the transition the traces showed missing |
| `regressionsProduced` / surviving | protected FAIL / RESTORE_FAILED | the cost side |
| `commandInvoked` | did it run `run_tests.py` | **recorded last, deliberately.** Invoked-and-unchanged and never-invoked are different negative results; a treatment is not validated by being used |

Pre-registered readings: TESTCMD raising `caseDelta` and `editAfterFailure` without raising
`verifiedRepairs` is a real but partial effect and must be reported as such. TESTCMD raising
nothing, with `commandInvoked` high, locates the obstacle after feedback availability — which
would be the more valuable result, and is the one my current hypothesis does **not** predict.
Two replicates is a variance floor, not a significance test: BENCH-3 showed per-replicate
spread of 1–3 on 15 tasks, so a difference of one or two repairs reads as noise.

## What it cannot settle

Nothing about held-out generalization. Nothing about other models. Nothing about `lcs_length`
r3, where the signal was present and unused — if that pattern persists under TESTCMD, the
obstacle is not feedback availability at all.

## Spend bounding

A10G ≈ $1.10/hr. 60 units at BENCH-3's observed pace (~110s/unit) ≈ 1.8h ≈ $2; worst case
(every unit to its 300s limit) 5h, bounded by the 3-hour wall clock ≈ $3.30. App stopped with
`modal app stop --yes` in the same job, confirmed after; scaledown 900s regardless.
