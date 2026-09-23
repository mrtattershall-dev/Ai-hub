# ENDURANCE-2 — the two-hour trial, frozen before launch

Recorded before generation. **ENDURANCE-1's configuration is unchanged.** The only differences
are the budget, the queue length, and a clearly labelled scripted fault probe.

## Question

Does the integrated system keep operating and reporting correctly **for hours**?

Not whether it produces more work. Repetitions fill the clock; they are **not new evidence of
general capability**, and the accepted count from this run will not be read as one.

## Configuration — identical to ENDURANCE-1

worker isolation ON · route bounding ON · acceptance ON · d2 OFF · PROTOCOL controller OFF ·
Qwen2.5-Coder-7B-Instruct on A10G via Modal `legasus-7b` · worker `sha256:fa49b576…`

## Budget and queue

| | |
|---|---|
| per-task limit | **300s**, unchanged |
| total budget | **2 hours** (7200s) |
| cleanup reserve | **120s**, unchanged |
| queue | **208 attempts** = 200 model tasks (5 frozen tasks × 40 replicates) + 8 scripted probes |
| unused tasks | recorded **UNATTEMPTED** |
| retries | none |

At ENDURANCE-1's pace (~44s per attempt) roughly 165 attempts fill two hours. 208 is headroom,
so the run ends on the **clock**, not on an exhausted queue.

## The scripted fault probe

**8 probes, spaced every 5th replicate.**

A deterministic scripted edit that breaks protected behaviour on purpose (`cartTotal(items)` →
NaN), in its **own disposable workspace**, through the **same batch path** — same evaluator,
same acceptance policy, same journal.

Three properties that make it legitimate:

- **No model is involved.** It spends no generation and cannot be confused with model output.
- **It is not a task chosen because the model breaks it.** That would bias the workload and
  still would not guarantee the restore path executes.
- **It is excluded from the productivity totals**, recorded under its own `FAULT_PROBE` arm. It
  measures the machinery, not the model; counting it either way would corrupt both numbers.

Smoke-tested: 1 probe → `RESTORED 1/1`, accounting 6/6.

## Success

1. Stops within budget, **no active work left behind** (confirmed by asking the daemon).
2. Preserves accepted work; **probes are detected and rolled back**.
3. **Every attempt accounted for** — including UNATTEMPTED.
4. **Final report produced automatically**, reconciled, with **no operator intervention**.

## What will not be claimed

- That the accepted count says anything about capability. The tasks repeat.
- That protected checks passing means the model preserved everything, or that the hub's guards
  contributed nothing.
- That this establishes two-day operation. It establishes two hours, if it passes.
