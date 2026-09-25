# AUTODIAG-1 RESULT — the largest effect measured in this programme, on half the planned run

Ran 2026-09-25 07:10:49Z → 09:37:52Z. **147m 3s of the frozen 150m bound.** Unattended;
interventions none. GPU stopped by the scripted `modal app stop --yes` at 09:38:03Z,
**confirmed `stopped`**.

**Spend: ESTIMATE ~$2.75** (2.45h A10G at ~$1.10/hr plus warm-up). **Authorized: $5** (Micheal,
recorded before deploy). Estimate, labelled as one; actual charges to follow.

**LABEL: repair with SUPPLIED TEST RESULTS.** The diagnostic runs the graded cases. Nothing
here is evidence about held-out inputs.

## Read this first: the run is HALF COMPLETE, and that is my defect

    planned          60 units
    recorded         29 units
    never run        31 units  (every replicate-2 unit, plus pascal@AUTODIAG r1)
    integrity        false - and correctly so: 31 UNACCOUNTED, 0 duplicates, 0 missing fields
    reconciliation   true

**One unit consumed 99 of the 150 minutes.** `mergesort@AUTODIAG_ARMr1`: the planner model call
hung, its 295s local deadline **did fire** and is recorded — and the await nevertheless did not
unwind for **5,964 seconds**. The unit ended only when the Hub's own 90-minute budget tripped.
So the comparison below rests on **replicate 1 only**, and one arm is short a task.

## The result, as observed

                                       CONTROL        AUTODIAG_ARM
    runs                                15             14
    verified repairs (RETAIN)            0              8
    dispositions                  PRESERVE 15    RETAIN 8, RESTORED 3, PRESERVE 3
    regressions produced                 0              3
    regressions surviving                0              0
    runs with newly-passing cases        0              8
    runs with newly-failing cases        0              1
    runs that edited the target          3             12
    diagnostics delivered                0             28 over 13 runs
    diagnostics skipped / unavailable    0              0 / 0
    model calls / tokens                81 / 448k      70 / 405k

### Complete pairs (replicate 1; 14 tasks where both arms ran)

    both arms repaired         0
    only CONTROL repaired      0
    only AUTODIAG repaired     8
    neither repaired           6

**Every task that was repaired at all was repaired only in the treatment arm.** The control arm
produced zero accepted repairs and zero newly-passing cases across 15 runs.

## Success is accepted repairs — and the cost is reported beside it

The treatment produced **3 regressions** (`find_in_sorted`, `is_valid_parenthesization`,
`max_sublist_sum`), all captured and **restored**, none surviving. It also edited far more
often (12/14 vs 3/15): the feedback moved the model from inaction into action, and some of that
action was wrong. The 8 repairs and the 3 regressions are separate facts and are not netted.

## What I can and cannot say

CAN: in this run, on these tasks, with the graded cases supplied and executed automatically,
this model produced 8 accepted repairs where the control produced 0, and the effect is far
larger than any difference previously measured here (BENCH-3: 5 accepted across 45 runs of the
control-equivalent configuration; TESTCMD-1: 8/28 and 4/27).

CANNOT:
- **Claim a repeat rate.** One replicate. The planned second replicate never ran.
- **Claim it generalizes.** The diagnostic runs the graded cases; that is the whole design and
  the label on it.
- **Attribute it to any component.** The treatment is automatic execution and delivery of test
  results. It is not the wider framework and does not license claims about it.
- **Rule out a time confound by assertion.** Measured instead: excluding the hung unit, the
  treatment's median unit was 53s and the control's 36s, and every non-hung unit finished well
  inside the 300s per-task bound. No unit in either arm was given extra model time. The mean I
  first computed (484s) was an artifact of the single 99-minute outlier and is not a real pace
  difference.

## Defects found in my own apparatus, and fixed

**1. Unbounded waits cost half the experiment.** The runner polled the Hub with `fetch` and no
timeout, and `runDiagnostic` called `docker` with an in-container timeout only. Neither was
implicated with certainty in the 99-minute unit — the recorded evidence shows a model call
whose abort fired but whose await did not unwind, and I cannot determine from these records
why — but both are the same unbounded-wait class and both are now bounded: every runner request
carries a 30s timeout, the docker exec carries a host-side timeout, and a unit that outlives its
budget is recorded as overrunning rather than trusted away.

**2. My monitor filter showed only failures.** Mid-run I reported that "only CONTROL events are
surfacing". They were: my grep alternation included `COMPLETE`, which is a substring of
`PRESERVE_INCOMPLETE`, so every failing unit matched and every `RETAIN` did not. A filter that
surfaces only failures would have made a working treatment look absent. Corrected during the
run; the numbers above come from the durable summary, never from the notification stream.

**3. The UNATTEMPTED gap persists.** The 31 unrun units are reported as UNACCOUNTED rather than
UNATTEMPTED — the runner still breaks on the deadline without writing a row. The reconciliation
catches it every time, which is the property working; the row is still not written.

## What this earns

A repeat, with the waits now bounded, to establish whether 8-vs-0 recurs. That is the next
paid run and it is not authorized. Nothing here should be cited as a repeatable effect until a
second replicate exists.

Records: `AUTODIAG-1_REPORT.json`, `AUTODIAG-1_summary.jsonl`, `AUTODIAG-1_console.log`.
