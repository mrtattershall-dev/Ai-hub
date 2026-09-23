# ENDURANCE-1 — configuration and queue, frozen before launch

Recorded before any generation. **Not a comparison**: one configuration, run unattended, to see
whether the whole repaired path holds together for a sustained period.

## Why this run exists

Every component has been qualified separately. What has **not** been tested is all of it running
together for longer than a short scripted check — and the final report has failed three times,
each after the expensive work was already done.

## Configuration

| | |
|---|---|
| model | Qwen2.5-Coder-7B-Instruct, A10G, Modal `legasus-7b`, `mycoder` |
| worker | `sha256:fa49b576…`, `--network none`, isolation ON |
| route bounding | ON — `spawn_subtask`, `verify_project`, `verify_godot`, `see_screen` removed |
| acceptance policy | **ON** — this is the piece being exercised at length |
| d2 | **OFF** — enabling it needs a target set this configuration has never run with, and d2 is not what this run tests. Recorded rather than left ambiguous. |
| controller (PROTOCOL v2) | **OFF** — an experimental treatment, not part of the baseline system |
| budgets | 300s per task, 30 minutes total, 120s reserve |
| retries | none |

## Queue

The five qualified tasks × **3 replicates** = **15 tasks**, each from its **own seed**
(`chain: false`). Replicates give the run enough work to exercise duration; they are not a
comparison and no arm difference exists to read.

## Success criteria, fixed now

1. **Stops within budget, with no active work left behind** — confirmed by `confirmNoneRunning`,
   which asks the daemon which containers are running, not by a stop request returning 200.
2. **Preserves accepted work and rolls back detected regressions** — RETAIN keeps work;
   a protected-behaviour failure is captured, restored and re-verified.
3. **Accounts for every task** — 15/15 in a terminal state, asserted against the queue length.
4. **Produces the final report automatically, with no manual repair** — the criterion that has
   failed three times, and the reason for this run.

## Duration is reported as measured

The queue may well finish early: PILOT-2 did five tasks in six minutes. If it does, the report
says the **actual elapsed time**. A short run that passes is a short run that passes — it is not
"30 minutes of endurance", and will not be described as such.

## What a clean run earns

A two-hour trial. Not two days.
