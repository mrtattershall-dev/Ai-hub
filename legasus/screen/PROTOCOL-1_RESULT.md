# PROTOCOL-1 RESULT — equal accepted counts in this run

Ran 2026-09-23 10:04:27Z → 10:11:06Z (6m 39s). Ten runs, the frozen interleaved order, all
completed — no truncation, no UNATTEMPTED, no retries, no rescue instructions.

**DEVELOPMENT COMPARISON.** These five tasks are already-inspected development cases whose
failure modes have been read in detail. This is not a held-out evaluation.

## Headline

    ACCEPTED IMPROVEMENTS      CONTROL 3/5      TREATMENT 3/5

Equal counts **in this run**, with DIFFERENT tasks succeeding in each arm. That is not the
same as "no difference", and this experiment did not establish one.

| | CONTROL | TREATMENT |
|---|---|---|
| accepted improvements | **3** | **3** |
| requested behaviour PASS | 3 | 3 |
| protected behaviour retained | 5/5 | 5/5 |
| protected behaviour broken | 0 | 0 |
| evaluation errors | 0 | 0 |
| model calls | 35 | 27 |
| tokens | 195,082 | 148,454 |
| seconds | 218 | 160 |
| **tool executions** | **32** | **10** |
| controller refusals | 0 | **12** |

## Paired, per task

| task | CONTROL | TREATMENT | |
|---|---|---|---|
| t1-repair-node-average | no | **ACCEPT** | treatment |
| t2-repair-python-parse | ACCEPT | ACCEPT | tie |
| t3-add-node-median | no | no | tie |
| t4-add-python-slugify | ACCEPT | ACCEPT | tie |
| t5-multifile-node-discount | **ACCEPT** | no | control |

One swap in each direction. Three ties.

**CORRECTED.** This was first written as "exactly what noise looks like". That overstates it:
repeated outcomes across PILOT-2 and this run DO show variability, but its SIZE was never
estimated and never separated from a treatment effect. One run per cell cannot do either.
The honest statement is that this design cannot distinguish a real effect of this size from
run-to-run variation - not that the difference is noise.

## The one real observation

The treatment arm reached **the same three accepted improvements with a third of the tool
executions** (10 vs 32), fewer model calls (27 vs 35), fewer tokens and less wall clock — while
the gate refused 12 actions.

Refusals, by reason:

    6x  UNKNOWN_INTENT   run_python
    3x  WRONG_PHASE      outline_file
    2x  UNKNOWN_INTENT   wait_for_verification
    1x  WRONG_PHASE      edit_file

Following the reading rule fixed in advance: the direct observation is **execution blocked by
the controller**, not suppressed generation. The model kept proposing; 12 of its proposals did
not execute. Whether that cost useful work is answered by the accepted count — and the accepted
count is identical.

**CORRECTED.** This first concluded the blocked actions were "not load-bearing". Equal totals
do not establish that. The treatment LOST t5 and GAINED t1: a refused action could well have
mattered to t5 while t1 succeeded for an unrelated reason, and the two cancel in the total.
What the equal count shows is that blocking 12 actions did not reduce the TOTAL here. Whether
any individual refusal cost a task is unexamined.

Two of the refused intents are worth noting as controller-scope facts rather than model errors:
`run_python` is the testing tool both arms were explicitly told to use, and `wait_for_verification`
is not a hub tool at all. The controller's phase vocabulary does not cover the testing guidance
the tasks give, which is a mismatch in the treatment as frozen, not a finding about the model.

## What this supports

SUPPORTED
- On these five tasks, in this run, both arms produced **3 accepted improvements** - with
  different tasks succeeding in each arm.
- It did so at lower effort and with far fewer executed actions.
- Neither arm broke protected behaviour; the acceptance policy had nothing to roll back.

NOT SUPPORTED
- No general advantage or disadvantage. n=5, one run per cell, one model, one backend.
- No claim that the controller helps or hurts, and **no claim that it makes no difference**.
  Equal totals with different per-task outcomes leave that open.
- No claim about the SIZE of run-to-run variation, which was never estimated.
- No attribution to any single narrowed responsibility: prompt, sequencing and gating moved
  together.

## Variance worth recording

PILOT-2 ran the same five tasks on the same model and t5 **broke protected behaviour**
(`cartTotal` → NaN). Here t5 passed in the control arm and failed only the requested check in
the treatment arm. Same model, same task, different outcome across runs. **CORRECTED**: "variance larger than the effect" asserts a comparison of two quantities,
neither of which was measured. What is actually established is that the SAME task on the SAME
model produced different outcomes on different runs. Its magnitude is unknown, and so is any
treatment effect. Both would need repeated runs per cell.

## Next

A treatment loss would have been useful evidence about this controller. A win would have
justified a fresh-task evaluation.

**CORRECTED.** "A null justifies neither" was wrong. Equal completion counts alongside
materially fewer calls and executions DO justify investigating efficiency - they just do not
establish an efficiency advantage. The reduction is large enough to retain as an observation
from these runs:

    model calls        27 vs 35        (-8)
    tool executions    10 vs 32        (-22)
    tokens        148,454 vs 195,082   (-46,628)
    seconds           160 vs 218       (-58)

These are measurements from this run, NOT estimates of repeatable savings.

Order of next steps: fix the vocabulary mismatch FIRST, as a NEW controller version, before
spending anything on replication. Replicating a controller with a known defect measures the
defect.
