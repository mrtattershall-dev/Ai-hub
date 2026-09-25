# TESTCMD-1 RESULT — the supplied test package did not raise verified repairs, and was mostly not used

Ran 2026-09-25 03:22:07Z → 05:49:13Z. **147m 6s of the frozen 150m bound** — the wall clock
stopped the run, not the queue. Unattended; interventions none. GPU stopped by the scripted
`modal app stop --yes` at 05:49:21Z, **confirmed `stopped`**.

**Spend: ESTIMATE ~$2.75** (2.45h of A10G at ~$1.10/hr plus ~2 min warm-up), against the **$5
authorized by Micheal**. This remains an estimate and is labelled as one; actual charges will
be reported when Modal exposes them.

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

**The package did not raise verified repairs. The numbers run against it.** But they do not
establish that it hurt: BENCH-3 measured this pipeline's own per-replicate spread at 1–3 of 15
on these same tasks, and CONTROL's replicates here are 3 and 5 — the control arm is itself
running above BENCH-3's observed range. Against that variance, {3,5} versus {2,2} is a
difference this design cannot resolve. The honest statement is **no demonstrated benefit**,
not a demonstrated cost.

## The finding that actually matters: it was mostly not used

**The supplied runner executed in 6 of 27 TEST_PACKAGE runs.** In the other 21 the model never
ran it — so for those, the "treatment" reduced to extra files on disk and ~3.7 KB of extra
opening context. The pre-registered distinction applies: this is the **never-invoked** negative
result, not the "insufficient feedback" one.

The 6 runs where it did execute, with what followed:

    longest_common_subsequence   4 invocations, 4 with real SUMMARY output, 0 edits, PRESERVE_INCOMPLETE
    flatten (r1)                 5 invocations, 1 with real output,        3 edits, RETAIN
    flatten (r2)                 3 invocations, 0 with real output,        3 edits, RETAIN
    max_sublist_sum              1 invocation,  1 with real output,        0 edits, PRESERVE_INCOMPLETE
    mergesort                    1 invocation,  1 with real output,       33 edits, PRESERVE_INCOMPLETE
    kth                          1 invocation,  1 with real output,        3 edits, PRESERVE_INCOMPLETE

So where feedback was both produced and delivered, it was followed by a repair in 2 of 6 and by
nothing useful in 4 — including one run that saw four consecutive correct failure reports and
made **zero** edits. That is a real observation about this model on these tasks, and it is
based on six runs.

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
- That the package hurt. The difference sits inside demonstrated run-to-run variance.
- Anything about generalization: the exposed cases are the graded cases.

The most actionable thing in this record is the invocation rate, not the repair count. The
model was handed a working diagnostic and used it 6 times in 27. Whether that is an
instruction-following failure, a prompt-position problem, or a capability limit is the next
question, and it is answerable from these transcripts without buying anything.

Records: `TESTCMD-1_REPORT.json`, `TESTCMD-1_summary.jsonl`, `TESTCMD-1_console.log`.
