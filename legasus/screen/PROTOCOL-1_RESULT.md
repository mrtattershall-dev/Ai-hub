# PROTOCOL-1 RESULT — no difference in accepted work

Ran 2026-09-23 10:04:27Z → 10:11:06Z (6m 39s). Ten runs, the frozen interleaved order, all
completed — no truncation, no UNATTEMPTED, no retries, no rescue instructions.

**DEVELOPMENT COMPARISON.** These five tasks are already-inspected development cases whose
failure modes have been read in detail. This is not a held-out evaluation.

## Headline

    ACCEPTED IMPROVEMENTS      CONTROL 3/5      TREATMENT 3/5

No difference.

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

One swap in each direction. Three ties. With n=5 and a single run per cell, that is exactly
what noise looks like, and it is not evidence of an effect in either direction.

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
count is identical. So on these five tasks the blocked actions were **not load-bearing**.

Two of the refused intents are worth noting as controller-scope facts rather than model errors:
`run_python` is the testing tool both arms were explicitly told to use, and `wait_for_verification`
is not a hub tool at all. The controller's phase vocabulary does not cover the testing guidance
the tasks give, which is a mismatch in the treatment as frozen, not a finding about the model.

## What this supports

SUPPORTED
- On these five tasks, with everything else held fixed, controller-owned state and sequencing
  produced **no change in accepted improvements**.
- It did so at lower effort and with far fewer executed actions.
- Neither arm broke protected behaviour; the acceptance policy had nothing to roll back.

NOT SUPPORTED
- No general advantage or disadvantage. n=5, one run per cell, one model, one backend.
- No claim that the controller helps or hurts. A 3–3 split with one swap each way is a null
  result, not a tie that favours anyone.
- No attribution to any single narrowed responsibility: prompt, sequencing and gating moved
  together.

## Variance worth recording

PILOT-2 ran the same five tasks on the same model and t5 **broke protected behaviour**
(`cartTotal` → NaN). Here t5 passed in the control arm and failed only the requested check in
the treatment arm. Same model, same task, different outcome across runs. That variance is larger
than the arm difference this experiment measured, which is the strongest reason not to read
anything into 3 vs 3.

## Next

A treatment loss would have been useful evidence about this controller. A win would have
justified a fresh-task evaluation. **A null justifies neither.** The honest next step, if this
line continues, is either more runs per cell to see past the variance, or a controller whose
phase vocabulary admits the testing tools the tasks actually require.
