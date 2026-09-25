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

### The overrunning unit, in the primary accounting

    task                  ext-mergesort
    arm                   AUTODIAG_ARM, replicate 1
    acceptance outcome    PRESERVE_INCOMPLETE - not accepted; requested FAIL, protected PASS
    termination           TIMEOUT
    elapsed               5,977s (99m 37s) of a 300s nominal task limit
    paired counterpart    ext-mergesort@CONTROLr1, PRESERVE_INCOMPLETE, 301s

    deadline due          07:54:33Z (295s after dispatch)
    call actually ended   09:29:02Z - the await unwound 5,669s AFTER its deadline fired
    outcome recorded      DEADLINE_LOCAL_ABORT, serverOutcome UNKNOWN, 0 chars received

    ACTION AFTER ITS DEADLINE:  none. 0 tool executions in the whole run, 0 steps recorded
                                after the deadline, 0 diagnostics delivered, 1 model call.

So the overrun produced no work and no late action - but it consumed 99 of the 150 minutes and
**is the reason 31 units never started**. It stays in every count below. An analysis excluding
it and its paired counterpart is shown separately and labelled as such.

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

### Shown separately, and labelled: excluding the overrun and its pair

This is a SECONDARY view. The primary accounting above keeps every run.

    excluding ext-mergesort from BOTH arms (13 pairs)
      CONTROL          0 repairs / 14 runs
      AUTODIAG_ARM     8 repairs / 13 runs
      only AUTODIAG    8    only CONTROL 0    both 0    neither 5

Excluding it changes no repair count - mergesort was PRESERVE_INCOMPLETE in both arms. It
changes only the denominators. The overrun's cost was to the EXPERIMENT (31 units lost), not
to the comparison's numerator.

## Why `integrity: false`, and what the 31 unexecuted units are

    integrity.duplicates       []        none
    integrity.missingFields    []        none
    integrity.unaccounted      31        every replicate-2 unit (30), plus ext-pascal@AUTODIAG_ARMr1
    reconciliation.ok          true      29 recorded runs reconcile exactly against 29 counted

**`integrity: false` is caused by the 31 unaccounted units and nothing else.** No row is
malformed and no row is duplicated; the check is failing for the one correct reason - 31
planned units have no record at all.

They were never started: the campaign wall clock (147m of 150m) expired while the overrun was
still running, and the runner's loop broke on the deadline WITHOUT writing an `UNATTEMPTED`
row for each remaining entry. The reconciliation caught the gap, which is the property
working; the rows were still missing. **Fixed since** - every unexecuted queue entry now gets
its own row carrying the reason it never ran (`deadlineRecovery.test.mjs`, UNACCOUNTED 0,
integrity true).

The 31:

    replicate 2, all 15 tasks, both arms                    30 units
    ext-pascal@AUTODIAG_ARMr1                                1 unit
                                                            --
                                                            31

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
- **Say there was "no time confound".** WITHDRAWN. Removing the outlier does not remove its
  effect: that unit consumed most of the campaign and is the reason the planned replication
  never happened. The treatment's extra diagnostic execution time is also part of its cost, not
  a nuisance to be subtracted. The defensible statement is:

  > **Apart from one severe overrun, completed units stayed within the nominal task limit. The
  > overrun truncated the experiment.**

  (The 484s mean I first computed was an artifact of that outlier and is not a pace difference,
  but that correction does not license a "no confound" claim.)

## Defects found in my own apparatus, and fixed

**1. Unbounded waits cost half the experiment.** The runner's polling loop tested its deadline
only BETWEEN awaits, so one await that never settled escaped it entirely. `runDiagnostic` called
`docker` with an in-container timeout only.

Repaired, and then TESTED rather than assumed - the timeouts alone were a plausible repair, not
a demonstrated one, and "36/36 still green" proved nothing because those suites passed before
the 99-minute wait too. `server/deadlineRecovery.test.mjs` drives the REAL campaign entry point
against a backend that accepts the request, sends nothing, never closes and ignores the client
going away. **14/14:**

    regains control          4 units in 80s against a never-settling backend, exiting on its own
    no late tool execution   0 tool steps in any run; no workspace file carries a late write
    confirmed stopped        the hub is SIGKILLed, its exit awaited under a bound, and the
                             worker asked to confirm no attempt is still running - if either
                             cannot be confirmed the campaign HALTS with an explicit reason
                             instead of starting the next unit on top of live execution
    full accounting          every planned unit has a row; UNACCOUNTED 0; integrity true

**Stated because the test states it: this does NOT prove the outer wall fires when the inner
deadline does not.** Against this backend the Hub's own per-call deadline recovers the unit
first, so the runner's wall is defence in depth that the scenario never needed. AUTODIAG-1's
actual failure - a deadline firing while its await ran on - cannot be reproduced with this
stub, because node unwinds its fetch correctly here. A 30s HTTP timeout stops waiting for a
response; it is not evidence that the operation underneath ended, and the confirm-stopped step
exists for exactly that reason.

**2. My monitor filter showed only failures.** Mid-run I reported that "only CONTROL events are
surfacing". They were: my grep alternation included `COMPLETE`, which is a substring of
`PRESERVE_INCOMPLETE`, so every failing unit matched and every `RETAIN` did not. A filter that
surfaces only failures would have made a working treatment look absent. Corrected during the
run; the numbers above come from the durable summary, never from the notification stream.

**3. The UNATTEMPTED gap is closed.** The 31 unrun units were reported as UNACCOUNTED rather
than UNATTEMPTED because the runner broke on the deadline without writing a row. Every
unexecuted queue entry now gets its own row with the reason it never ran, asserted end to end.

## What this earns

**Both outcomes are the result, and neither cancels the other:**

    PRODUCTIVITY   8 treatment-only repairs across 14 complete pairs; 0 control repairs in 15
                   runs; 3 treatment regressions, all restored
    OPERATIONAL    a severe task-budget failure prevented completion - one unit took 99 of 150
                   minutes and 31 of 60 planned units never started

A repeat, with only the operational fixes changed, to establish whether 8-vs-0 recurs. Frozen
as AUTODIAG-2. Not authorized, not launched. Nothing here should be cited as a repeatable
effect until a second replicate exists.

Records: `AUTODIAG-1_REPORT.json`, `AUTODIAG-1_summary.jsonl`, `AUTODIAG-1_console.log`.
