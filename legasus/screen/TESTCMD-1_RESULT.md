# TESTCMD-1 RESULT — the supplied test package did not raise verified repairs, and was mostly not used

Ran 2026-09-25 03:22:07Z → 05:49:13Z. **147m 6s of the frozen 150m bound** — the wall clock
stopped the run, not the queue. Unattended; interventions none. GPU stopped by the scripted
`modal app stop --yes` at 05:49:21Z, **confirmed `stopped`**.

**Spend: ESTIMATE ~$2.75** (2.45h of A10G at ~$1.10/hr plus ~2 min warm-up). **Authorized:
$15. Operating limit I chose: $5.** This remains an estimate and is labelled as one; actual
charges will be reported when Modal exposes them.

**LABEL: repair with SUPPLIED tests.** The exposed cases are the graded cases. Nothing here is
evidence about held-out generalization.

## Headline, with the outcome measure first

                                    CONTROL        TEST_PACKAGE
    verified repairs (RETAIN)        8 / 28          4 / 27
    per replicate                    3/15, 5/13      2/15, 2/12
    runs with newly-passing cases   10 / 28          4 / 27
    runs with newly-failing cases    2 / 28          1 / 27
    runs that edited the target     17 / 28         12 / 27
    saw a failing test               7 / 28          9 / 27
    edit after a failing test        6 / 28          8 / 27
    regressions produced             6 / 28          4 / 27
    regressions surviving            0                0

**Observed: 8/28 versus 4/27, favouring the control arm descriptively.**

**CORRECTED 2026-09-25.** This paragraph previously said the difference was "inside
demonstrated variance" because BENCH-3 measured a 1-3/15 per-replicate spread. That was
unsupported: BENCH-3 is a separate experiment on a different configuration, and its range does
not license a noise claim about this difference. The observed result is reported as observed,
with its limits stated rather than converted into a verdict:

    observed                 8/28 (CONTROL) versus 4/27 (TEST_PACKAGE)
    repetitions              2 planned per cell; replicate 2 is short on both arms
    task coverage            UNEQUAL - see the complete-pair table below
    what it supports         a descriptive difference favouring the control arm
    what it does not         that the package hurt, that the difference is noise, or any
                             estimate of how often it would recur

### Complete pairs only (both arms ran the same task in the same replicate)

All attempts and costs are retained above. This is a narrower view shown because unequal
coverage makes the headline ratio hard to read - not a replacement for it.

    complete pairs (both arms, same task, same replicate)   27 of 30 planned
    CONTROL repairs within those pairs                       8
    TEST_PACKAGE repairs within those pairs                  4
    both arms repaired                                       1   (flatten r1)
    only CONTROL repaired                                    7
    only TEST_PACKAGE repaired                               3
    neither repaired                                        16
    incomplete (one arm only)                                1   (mergesort r2, CONTROL only)

## The finding that actually matters: it was mostly not used

**The supplied runner executed in 6 of 27 TEST_PACKAGE runs.** In the other 21 the model never
ran it — so for those, the "treatment" reduced to extra files on disk and ~3.7 KB of extra
opening context. The pre-registered distinction applies: this is the **never-invoked** negative
result, not the "insufficient feedback" one.

**CORRECTED 2026-09-25 - the table that stood here was wrong.** It linked each run to the
FIRST summary row matching its task name, so both replicates of a task were shown with
replicate 1's outcome. Re-derived by zipping runs to rows in execution order
(`TESTCMD-1_TRACE-ANALYSIS.md`):

    run                            confirmed/named  delivered   next action     outcome
    longest_common_subsequence r2      4 / 0        4 requests  edited target   6->10/10  RETAIN
    flatten r2                         1 / 4        1 request   edited target   1->1/7    PRESERVE_INCOMPLETE
    kth r2                             1 / 0        1 request   edited target   3->0/7    RESTORED (no import)
    max_sublist_sum r1                 1 / 0        1 request   outline_file    2->2/6    PRESERVE_INCOMPLETE
    mergesort r1                       1 / 0        1 request   edited target   1->1/14   PRESERVE_INCOMPLETE

**1 success in 5 confirmed-runner runs**, not "2 of 6". The treatment arm's other three
successes (flatten r1, lcs_length r1 and r2) used the runner **not at all**. The claim that a
run "saw four consecutive correct failure reports and made zero edits" was the same artifact:
that run is longest_common_subsequence r2, it did edit, and it is the one success.

Execution evidence, classified without inferring non-execution from syntax:

    CONFIRMED_RUNNER  8 steps / 5 runs    execution OBSERVED
    NAMED_NO_OUTPUT   7 steps             invoked; usefulness UNKNOWN - NOT ruled out
    UNKNOWN_EXEC      1 step              cannot be ruled in or out
    OTHER_ROUTE      32 steps             clearly ad-hoc code of the model's own

Execution was **observed** in 5 runs. That is not the same as all other execution being ruled
out.

## A hypothesis I raised mid-run and then falsified

While the run was in flight I saw one TEST_PACKAGE unit loop on `outline_file` seven times and
suggested the package's extra context might have reintroduced the BENCH-1 outline stall. **The
full data does not support that**, and I am recording the retraction rather than the guess:

    runs opening with 3+ consecutive outline_file:   CONTROL 3/28     TEST_PACKAGE 1/27
    first tool = run_python:                         CONTROL 17/28    TEST_PACKAGE 16/27

The stall is *less* common in the treatment arm. One run is not a pattern; I should not have
offered it as a live alternative explanation on that evidence.

## Three defects in my own apparatus, all found and none hidden

**1. `commandInvoked` under-counted, and I misreported because of it.** The live detector
required the literal `run_tests.py`; the model reached the runner as `import run_tests;
run_tests.main()`. During the run I told the user that `cmd=0` meant "never invoked, not
invoked without effect" — wrong for those units. The internally inconsistent pair
`cmd=0 delivered=true` is what exposed it. Fixed in source (matches the module form, the `.py`
form and `exec(open(...))`, still rejects doctest and unrelated code); **every figure in this
report is recomputed from the preserved run records, not from the live column.**

**2. Five units were never run, and were reported as UNACCOUNTED rather than UNATTEMPTED.**
`ext-mergesort@TEST_PACKAGEr2`, `ext-next_palindrome@CONTROLr2/@TEST_PACKAGEr2`,
`ext-pascal@CONTROLr2/@TEST_PACKAGEr2`. Cause: the 150-minute bound fired, and the runner's
loop breaks on the deadline without writing an UNATTEMPTED row. The reconciliation caught the
gap — `UNACCOUNTED: 5`, planned 60, recorded 55 — which is the property working as designed,
but the definition said unrun units would be UNATTEMPTED and they were not. The arms are
therefore 28 vs 27, not 30 vs 30; replicate 2 is short on both sides and pascal/next_palindrome
have no r2 pair at all.

**3. Seven "case measurement errors" are not instrument failures.** All seven are
`candidate does not import`, and all seven are on RESTORED runs — the model produced an
unparseable candidate, which acceptance rolled back. That is a *valid* measurement (zero cases
pass) that my summary filed under errors and excluded from the case counts. Counted properly
they are 4 CONTROL and 3 TEST_PACKAGE runs whose candidate did not import.

## What this settles, and what it does not

SETTLED: supplying the graded cases, a runner over them, and an instruction naming it did not
raise verified repairs for this model on these tasks under these conditions, and the model
invoked the runner in under a quarter of its opportunities.

NOT SETTLED, and explicitly not claimed:
- That feedback availability is not the obstacle. **This package** was insufficient here. A
  different one — held-out cases, a different report format, fewer cases, the runner invoked
  for the model rather than offered to it — is untested, as is every other model.
- That the package hurt. The observed difference favours the control arm descriptively; with
  2 planned repetitions, unequal task coverage and no repeat-rate estimate, this design does
  not support a claim that the package caused harm - nor that the difference is noise.
- Anything about generalization: the exposed cases are the graded cases.

The most actionable thing in this record is the invocation rate, not the repair count. The
model was handed a working diagnostic and execution was observed in 5 of 27 runs.

**CORRECTED 2026-09-25.** I previously wrote that whether this is "an instruction-following
failure, a prompt-position problem, or a capability limit ... is answerable from these
transcripts". It is not. Transcripts establish **what instruction reached the model and what
happened afterwards**; those three remain causal hypotheses needing their own tests. See
`TESTCMD-1_TRACE-ANALYSIS.md`, scoped accordingly - it finds the instruction present, intact
and identically positioned in all 25 capturable runs.

Records: `TESTCMD-1_REPORT.json`, `TESTCMD-1_summary.jsonl`, `TESTCMD-1_console.log`,
`TESTCMD-1_TRACE-ANALYSIS.md`.
