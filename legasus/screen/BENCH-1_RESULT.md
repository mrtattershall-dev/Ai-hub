# BENCH-1 RESULT — verified performance on fresh tasks, and unattended operation

Ran 2026-09-23 19:07:25Z → 19:24:22Z. **16m 26s of a 2-hour budget** — the queue was exhausted
early. Unattended from launch to final report. **Interventions during the run: none.**

**NO COMPARISON ARM.** This is what one configuration achieved. It says nothing about any other
framework, and must not be cited as if it did.

## Operation

| | |
|---|---|
| stopped cleanly, nothing left running | **YES** |
| every queued task accounted for | **YES** — 20/20, `UNACCOUNTED: 0` |
| final report produced automatically | **YES**, reconciliation true |
| status | `COMPLETED 16 · BLOCKED 4 · INTERRUPTED 0 · UNATTEMPTED 0` |

## EXTERNAL — 15 independent QuixBugs bug fixes

    accepted (verified)      2 / 15      flatten, gcd
    requested PASS           2 / 15
    protected retained      14 / 15
    terminated by timeout    1 / 15      (get_factors)
    evaluation errors        0
    model calls            102
    tokens             579,018
    task seconds           867

**Candidate regressions detected: 1. Remaining after acceptance: 0.**
`ext-kth` produced a candidate that broke protected behaviour; it was captured, rolled back, and
the restoration verified. That distinction is the point — one regression *was produced*, and none
*survived*.

The other 12 failures are `PRESERVE_INCOMPLETE`: the model did not break anything, and did not
fix the bug either.

## SEQUENTIAL — 5 internally authored steps on one project

    step 1 (count)      attempted, NOT accepted
    steps 2-5           BLOCKED - prerequisite not accepted
    CONSECUTIVE steps accumulated:  0

The chain stopped at the first step, exactly as designed. Steps 2–5 were **never run from a
seed**, which would have silently converted the chain into four independent tasks and reported
them as if accumulation had happened.

**This measures nothing about steps 2–5.** They are untested, not failed.

## Reading these two numbers

2/15 and 0/5 are **not** summed and answer different questions: one is verified repair of
independent bugs, the other is how far accumulation got. Neither is a capability claim beyond
this workload, this model and this configuration.

QuixBugs is public and long-lived, so these programs are **plausibly in the model's training
data**. "Independently authored" means we did not write them; it does not mean unseen.

## A third false alarm in the integrity check — mine

The report generated automatically and then reported `integrity: false`. The cause: four
**BLOCKED** chain steps flagged for missing `requested`/`protected`, which a task that was never
attempted correctly does not have.

`BLOCKED` had no entry in the status-field table. This is the **third** time a status without
its own field list produced a false alarm — and this time the status was one I added **in the
same session** as the check it broke. Fixed; `BLOCKED` now owes identity and a reason, nothing
more.

**Both versions preserved:**

    BENCH-1_REPORT-AS-GENERATED.json   integrity false, 4 BLOCKED steps flagged
    BENCH-1_REPORT-corrected.json      integrity true

Arm totals are identical between them; only the check changed.

## Spend

The GPU app was stopped immediately after the run (`modal app stop --yes`, confirmed
`stopping...`). Elapsed GPU time ≈ 17 minutes of run plus warm-up, against the authorized **$10**
cap. At the A10G rate that is well under $1.

## What remains untested

- Sequential accumulation beyond step 1.
- Feature-addition and multi-file task shapes from an external source — all 15 external tasks are
  single-function bug fixes from one benchmark.
- Any comparison against another system.
- Whether these results hold on tasks absent from training data.
