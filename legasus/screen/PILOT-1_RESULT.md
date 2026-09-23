# PILOT-1 RESULT — the unattended runner, 30 minutes

Ran 2026-09-23 06:28:54Z → 06:55:01Z (26m 06s). Unattended throughout.
Model: local `qwen2.5-coder:1.5b` (Modal did not serve — see MODAL-PILOT_FAILURE.md).
Worker image: `sha256:fa49b576…` | enforced configuration | no retries | **interventions: none**.

## Verdict, in two separate parts

**RUNNER: PASS.** Every queued task ended in a known state, every limit was respected, the batch
stopped itself inside its window, and nothing was lost.

**PRODUCTIVITY: ZERO.** 0 of 5 tasks completed. Not a single requested behaviour was delivered.

These are different findings and neither substitutes for the other.

## Accounting

    queued 5 | accounted for 5 | complete: true | missing: none
    COMPLETED 0 | FAILED 5 | INTERRUPTED 0 | UNATTEMPTED 0 | EVAL_ERROR 0

No evaluator errors: the instrument did not fail, and no infrastructure failure was scored as a
coding failure.

## Per task

| task | state | termination | requested | protected | start tree | surviving tree | elapsed | tool calls |
|---|---|---|---|---|---|---|---|---|
| t1-repair-node-average | FAILED | per-task limit (300s), partial preserved | not evaluated | not evaluated | `373037f0` | none promoted | 302s | 0 |
| t2-repair-python-parse | FAILED | per-task limit (300s), partial preserved | not evaluated | not evaluated | `449e6af3` | none promoted | 302s | 1 |
| t3-add-node-median | FAILED | per-task limit (300s), partial preserved | not evaluated | not evaluated | `63a3a0fe` | none promoted | 303s | 2 |
| t4-add-python-slugify | FAILED | per-task limit (300s), partial preserved | not evaluated | not evaluated | `68e9e56c` | none promoted | 303s | 0 |
| t5-multifile-node-discount | FAILED | per-task limit (300s), partial preserved | not evaluated | not evaluated | `016e94fd` | none promoted | 303s | 2 |

**"not evaluated" is deliberate and is not a missing number.** A task stopped at its limit never
finished, so the evaluator was never run against it — evaluating an unfinished workspace would
measure an arbitrary mid-edit state. Its partial state is preserved for audit instead.

**"none promoted"**: no task reached a finish boundary, so no candidate was ever promoted. Each
starting identity is recorded above; the partial trees sit under `audit-partial/`.

Timing is the cleanest signal here: 302, 302, 303, 303, 303 seconds against a 300s limit. The
per-task deadline stopped **active work** within ~3s every time.

## Why productivity was zero

Five runs, 1500 seconds, **5 tool calls in total** and **0 files correctly changed**:

- **2 runs never emitted a parseable action at all** — "Could not parse an action" and nothing
  after it. The model planned and then stopped producing usable output.
- **1 run** attempted a `write_file` on `pricing.js` that would have **removed `round2`**. The
  hub's own guard refused it and the file was left unchanged. That is the protected behaviour
  surviving because a guard caught the model, not because the model preserved it.
- **1 run** called `task_done` twice with an empty argument, then repeated it identically.
- **1 run** wrote `main.py` — **a file no task mentioned** — twice, identically.

Every run produced a competent-looking BUILD PLAN first. The failure is not comprehension of the
task; it is the step from plan to execution. That is consistent with the recorded 12–19s stall,
in a different shape: here the loop consumed its whole budget without acting rather than quitting
early.

## What this does and does not support

SUPPORTED
- The unattended loop accounts for its work: 5/5, one terminal record each, nothing dropped.
- Per-task and total limits hold, and the deadline stops active work rather than just new starts.
- Timed-out partial state is preserved for audit and never becomes the next task's start state.
- Fresh workspace per task; no host-side execution; no uncovered-route traversals.

NOT SUPPORTED
- Nothing about PROTOCOL-1. One arm, five different tasks: no causal comparison exists here.
- Nothing new about productivity beyond what was already recorded. A 1.5B was used because Modal
  failed; this is not evidence about larger models.
- The evaluator's PASS path was never exercised **in this pilot** (no task finished). It is
  qualified separately at 17/17, including that path.

## Two reporting defects found by running it

1. **The report was mostly null.** `batch.js` dropped the per-task `outcome`, so elapsed time,
   model calls, tokens and d2 state never reached the report — exactly the columns that were
   required. The data existed in the journal and run records the whole time; the generator did
   not carry it. Fixed: `outcome` is now attached to every result.
2. **A journal field clobbered its own timestamp.** `partial_preserved` recorded `at: <path>`,
   overwriting the event's `at` timestamp, so three journal lines carried a Windows path where
   the time should have been. Renamed to `preservedAt`.

The table above was reconstructed from the journal and run records, which is legitimate because
those records survived. But a report that needs reconstruction is a report that failed, and both
defects are fixed rather than noted.

## Cost

No GPU spend. Modal was deployed, never served a request, and was stopped.
