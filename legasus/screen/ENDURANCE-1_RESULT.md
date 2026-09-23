# ENDURANCE-1 RESULT — the integrated system ran unattended and reported itself

Ran 2026-09-23 14:14:07Z → 14:25:04Z. **Elapsed 10m 57s of a 30-minute budget.**

**The queue was exhausted early. 10m57s is the measured duration. This is NOT 30 minutes of
endurance and is not described as such anywhere in this record.**

## The four criteria

| # | criterion | result |
|---|---|---|
| 1 | stops within budget, no active work left behind | **YES** — `confirmNoneRunning` asked the daemon; nothing was still running |
| 2 | preserves accepted work / rolls back regressions | **PARTLY — see below** |
| 3 | accounts for every task | **YES** — 15/15 |
| 4 | final report produced automatically | **YES** — integrity true, reconciliation true, no manual repair |

**Criterion 4 is the one that mattered.** It had failed three times, each after the expensive
work was done. This run wrote its own report and it reconciled.

## Criterion 2 is only half-demonstrated

    RETAIN                4    accepted work preserved
    PRESERVE_INCOMPLETE  11    kept, not counted, not promoted
    protected regressions DETECTED: 0

**Preservation was exercised. Rollback was not** — nothing broke protected behaviour in these
15 runs, so the restore path never fired. The rollback claim rests on PROTOCOL-2, where one
regression in each arm was caught and restored, and on the replayed t5 candidate. It is **not**
evidenced by this run, and a run in which nothing broke cannot evidence it.

All 15 runs passed their protected checks (15/15).

**CORRECTED WORDING.** That establishes only that **the checked behaviour survived**. It does
not establish that the model preserved everything — unchecked behaviour is unmeasured — nor
that the hub's own guards contributed nothing. PILOT-2 showed a guard refusing a write that
would have removed round2, so guards demonstrably do act on this path.

## Work produced

    accepted improvements   4 / 15
    model calls           109
    tokens            604,970
    tool executions       114
    seconds               572 (task time; 657s wall clock including orchestration)
    evaluation errors       0

Per replicate, accepted:

    rep1   t1+  t2-  t3-  t4-  t5-
    rep2   t1-  t2+  t3-  t4-  t5-
    rep3   t1+  t2-  t3-  t4+  t5-

t1 and t2 each flipped across replicates again; t3 and t5 were never accepted; t4 once. This is
the same instability PROTOCOL-2 measured, in a fourth independent set of runs.

## A note on the accepted count

PROTOCOL-2's control arm (same tasks, same model, no controller, 15 runs) accepted **6**. This
run, in the same configuration, accepted **4**. Nothing was changed between them that should
affect completion. **CORRECTED WORDING.** This is **another observed difference across runs**. It is not
necessarily an independent replication — the two sets differ in orchestration and were not run
as a designed repeat — and two numbers cannot quantify variability. What it does support: a
single campaign's completion count is an unreliable estimate of repeatable performance, which is
a reason not to read PROTOCOL-2's 6-vs-7 as a treatment signal.

## What this earns

A **two-hour trial**, as agreed. Not two days.

And it should be read narrowly: the system ran 15 tasks unattended in 11 minutes, accounted for
all of them, and produced a correct report without help. Sustained operation over hours is
untested, and the rollback path did not fire here.
