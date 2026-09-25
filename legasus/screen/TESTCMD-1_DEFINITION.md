# TESTCMD-1 — definition, frozen before any generation

2026-09-25, committed before deploy.

## AUTHORIZATION, RECORDED BEFORE DEPLOYMENT

**AUTHORIZED: up to $15 total for TESTCMD-1**, including startup, execution, idle time and
shutdown (2026-09-25).

**OPERATING LIMIT I CHOSE: $5.** That is a self-imposed stricter bound, not the authorization.
Running well inside the authorization is my choice to make; describing the authorization as
something smaller than it was is not.

**CORRECTED 2026-09-25 (this section was wrong when committed).** It previously read
"Micheal authorized ... up to $5" and described the $15 as coming from "a non-authorizing
voice, which then withdrew it". That mischaracterised the user's own authorization. The $15
authorization was genuine and was the user's. The $5 was my operating limit. Both figures are
now stated as what they are, and the original wording is preserved in git history
(commit 4a3cc67) rather than silently replaced.

No tasks added, no model change, no retries - the experiment ran exactly as frozen.

**AMENDED 2026-09-25** before launch, on three points: the treatment is named as a package;
newly-passing and newly-failing cases are reported separately alongside accepted repairs and
the acceptance disposition; and feedback *delivery* is recorded, not just invocation.

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

    CONTROL        the seed exactly as BENCH-1/2/3 ran it (buggy module alone),
                   BENCH_GUIDANCE verbatim
    TEST_PACKAGE   the same seed PLUS the graded cases (task_cases.jsonl), PLUS a runner over
                   them (run_tests.py), PLUS two sentences:
                   "This workspace contains run_tests.py and the task's test cases.
                    Run `python3 run_tests.py` to see, for every case, the expected value
                    against what your code actually produces."

**THE TREATMENT IS A PACKAGE, AND IT IS LARGER THAN TWO SENTENCES.** Measured, not assumed:

    goal text delta                          +176 bytes (the two sentences)
    files added to the workspace             run_tests.py (3,741 B), task_cases.jsonl (247 B)
    ADDITIONAL OPENING-CONTEXT CONTENT       run_tests.py inlined IN FULL - 98 numbered lines,
                                             3,741 bytes, with a sha256 header

The last line is the part that is easy to miss. The guidance names `run_tests.py`, so the
Hub's supplied-file feature treats it as a goal-named file under the 8,192-byte limit and
inlines its entire source into the opening context. So the treatment arm receives the two
sentences AND ~3.7 KB of extra prompt content that the control does not - including the
runner's own docstring, which states that these are the graded cases. `task_cases.jsonl` is
NOT named in the goal and is NOT inlined; it exists on disk only.

The package is therefore: supplied tests on disk + a runner on disk + that runner's full
source in the prompt + two sentences of instruction. A result here is about the whole bundle
and cannot attribute an effect to any one part - separating them would take three more arms,
which this does not have. Describing the arm difference as "two sentences" would be wrong.

Verified before freezing: the arms' `requested` and `protected` checks are byte-identical.
Same model, sampling, limits, worker, isolation, acceptance policy, evaluator, repeat guard.
The arms differ by the package described above, and by nothing else.

15 tasks × 2 arms × 2 replicates = **60 units**, interleaved, **arm order alternating by task**
(even index CONTROL first, odd index TEST_PACKAGE first) so a drifting backend cannot favour one arm.
300s per task, no retries, 2.5-hour wall clock, plan recorded first so an unrun unit is
UNATTEMPTED rather than missing.

## The label, which is not negotiable

**The exposed cases ARE the graded cases.** `taskTests.test.mjs` asserts byte-identity with the
requested check's case file. Any TEST_PACKAGE result is therefore **repair with supplied tests** and
is never evidence of generalization to unseen inputs. The protected check remains a subset of
those cases, so passing them does not automatically satisfy protected behaviour — but it is not
independent evidence either.

## What is measured, and what would count

**Accepted repairs and the acceptance disposition are reported beside the case movement,
always** - more passing cases can coexist with a protected regression, so neither number is
shown alone.

| measure | what it is | reading |
|---|---|---|
| `verifiedRepairs`, `dispositions` | acceptance RETAIN, and the full disposition breakdown | the outcome question, never omitted |
| **`newlyPassing` / `newlyFailing`** | WHICH graded cases the candidate turned from failing to passing, and which from passing to failing - as case numbers, **never netted against each other** | **the real question: do failures lead to useful edits?** A run moving 2/9 to 7/9 did work even without finishing - and a run that gained four and lost one is a different thing from a run that gained three |
| `runsWithNewlyPassing` / `runsWithNewlyFailing` / `runsWithBoth` | counts of RUNS, not of cases | **case counts are never pooled across tasks.** The 15 tasks carry 3-14 cases each, so a summed case total weights the wide tasks and reads as progress the per-task view does not support |
| `editsOnTarget`, `runsThatEdited` | writes that hit the module under test | did it act at all |
| `sawFailingTest` to `editAfterFailure` | an edit to the target following a failing observation, in order | the transition the traces showed missing |
| `regressionsProduced` / `regressionsSurviving` | protected FAIL / RESTORE_FAILED | the cost side |
| `commandInvoked` | did it run `run_tests.py` | recorded last, deliberately |
| **`feedbackDelivered`**, `invokedButNotDelivered` | did the runner's OUTPUT reach a later model request - read from the transcript deltas | **invoking a command does not prove usable feedback reached the next request.** This Hub has already shipped a defect where a warning was generated and substituted away before it was sent. Without this, "invoked but no effect" and "invoked but never delivered" are indistinguishable, and only the first is about the model |

Case measurement runs a pristine runner on a scratch copy of the candidate, with the runner
and case file overwritten before execution - a candidate that edited its own tests changes
nothing in the measurement, and nothing in the evaluator's verdict either
(`taskTests.test.mjs` case 6).

Pre-registered readings:

- TEST_PACKAGE raising newly-passing cases and `editAfterFailure` **without** raising
  `verifiedRepairs` is a real but partial effect, and must be reported as such.
- TEST_PACKAGE raising nothing **while `feedbackDelivered` is high** would show that **this
  feedback package was insufficient under these conditions**. It would NOT locate the whole
  obstacle after feedback availability: a different package - held-out cases, a different
  report format, more or fewer cases - is untested, and so is every other model.
- TEST_PACKAGE raising nothing **with `invokedButNotDelivered` high** is a delivery defect in
  the Hub, not a result about the model, and would need fixing before the arm means anything.
- Two replicates is a variance floor, not a significance test: BENCH-3 showed per-replicate
  spread of 1-3 on 15 tasks, so a difference of one or two repairs reads as noise.

## What it cannot settle

Nothing about held-out generalization. Nothing about other models. Nothing about `lcs_length`
r3, where the signal was present and unused - if that pattern persists under TEST_PACKAGE, the
obstacle is not feedback availability at all.

## Spend bounding

**Authorized: $15 total. Operating limit I chose: $5.** A10G ~ $1.10/hr.

    fixed runtime bound    TESTCMD_TOTAL_SEC=9000 (2.5h), enforced in the runner, which stops
                           active work rather than only new starts
    no extra retries       retries: none, unchanged from every prior campaign
    ESTIMATE (planning)    60 units at BENCH-3's observed pace (~110s/unit) ~ 1.8h ~ $2
    CONDITIONAL figure     2.5h wall clock plus warm-up ~ $2.90 - CONDITIONAL ON THE STATED
                           SHUTDOWN ASSUMPTIONS HOLDING: that the runner's wall clock stops
                           active work, that `modal app stop --yes` succeeds, and that no
                           request remains in flight afterwards

**Automatic scaledown is not by itself a spending ceiling.** `scaledown_window=900` releases
an IDLE container; a container still serving a request is not idle, so scaledown bounds idle
time, not total spend. It is a backstop against a missed stop, not a proof of a maximum.

Every figure above is an ESTIMATE and is labelled as such until actual charges are available.
The app is stopped with `modal app stop --yes` in the same job and the stopped state confirmed
after; actual charges will be reported when Modal exposes them, and estimates stay labelled
estimates until then.
