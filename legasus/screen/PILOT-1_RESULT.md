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

---

# CORRECTIONS AND TERMINAL EVALUATION — 2026-09-23

## "RUNNER: PASS" was broader than the result supports

Narrowed to what was actually demonstrated:

| property | demonstrated? |
|---|---|
| queue execution | YES — all five attempted and accounted for |
| deadline handling | YES — termination reported at 302–303s per 300s limit |
| workspace separation | YES — partial changes preserved and absent from the next task |
| automatic reporting | **NO — it failed and required manual reconstruction** |
| live evaluation | **UNEXERCISED in this pilot** (no task reached a finish boundary) |
| verified task completion | 0/5 |

A pass on three of six properties is not "the runner passes".

## The preserved terminal candidates ARE evaluated (0/5 verified)

Skipping evaluation for timed-out tasks was wrong. Once execution is confirmed stopped, the
preserved workspace is not an arbitrary mid-edit snapshot — **it is exactly what survived the
allotted budget**, which is what the budget was there to measure. It also closes a real gap: a
model can write working code and never call `task_done`, and skipping evaluation would score that
delivered behaviour as no completion.

Termination and behaviour are separate axes and stay separate:

| task | termination | requested | protected | terminal tree | why requested failed |
|---|---|---|---|---|---|
| t1-repair-node-average | TIMEOUT | FAIL | PASS | `1e1b4346` | `average([2,4,6]) = 3`, expected 4 |
| t2-repair-python-parse | TIMEOUT | FAIL | PASS | `42ab814d` | assertion failed in `parse_pairs` |
| t3-add-node-median | TIMEOUT | FAIL | PASS | `875897ca` | `median is not exported` |
| t4-add-python-slugify | TIMEOUT | FAIL | PASS | `0ff4aa38` | assertion failed — no `slugify` |
| t5-multifile-node-discount | TIMEOUT | FAIL | PASS | `53efcf15` | `applyDiscount is not exported` |

**VERIFIED COMPLETIONS: 0/5.** Now supported by evaluation rather than by its absence.

**Protected behaviour PASSED in all five.** Nothing that already worked was destroyed. Note the
attribution: in t5 that is partly because a hub guard refused a `write_file` which would have
removed `round2` — the guard preserved it, not the model.

## "A competent plan establishes comprehension" — withdrawn

What was observed is **plausible planning followed by little usable execution**. That is all.
Candidate explanations remain open and this pilot separates none of them:

    responsibility overload | action formatting | model capability | loop behaviour

PROTOCOL-1 tests one of them. The others need their own designs.

## A third defect, found by testing for the first two

Renaming `at` → `preservedAt` fixed the instance and left the **shape** intact: `Journal.record`
spread the payload OVER the envelope, so the next colliding key would have silently overwritten
the timestamp exactly the same way. The envelope now wins, and a colliding payload key is kept
under a `payload_` prefix rather than dropped — discarding recorded data silently is the same
class of fault as overwriting it.

## Termination evidence was vacuous, and is now real

`confirmStopped(attemptId)` was passed the BATCH's attempt id. `agent.js` generates its own
container names, so that id was never attached to anything: it confirmed the absence of a
container that was never created, and reported success. A stop request returning 200 plus a
vacuous confirmation is not evidence that execution stopped.

`confirmNoneRunning()` now requires that **no worker container is still running** before a
workspace is evaluated or reused, and distinguishes "none running" from "the daemon could not be
asked".

## Evidence preserved

    PILOT-1_report-AS-GENERATED.json   the ORIGINAL broken report, 11 null fields per task
    PILOT-1_journal.jsonl              the journal as written during the run
    PILOT-1_RESULT.md                  this reconstruction

The broken report is kept deliberately. It is the evidence for the reporting failure, and a
reconstruction that replaced it would erase the finding.

Tests that FAIL on the unfixed code: `batchReport.test.mjs` (14/14 now). The existing 24 batch
checks passed straight through all three defects, so re-running them proves nothing about these.
