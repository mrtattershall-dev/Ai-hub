# BENCH-3 — definition, frozen before any generation

2026-09-24, committed before deploy. Authorized: **5-hour run, $15 cap** (tatte: "Run a 5 hour
benchmark. Keep it under 15").

**The question this design can read that no earlier run could: repeatability.** Every prior
count was n=1 per task and therefore descriptive. BENCH-3 runs the same frozen external tasks
**three times each**, so a per-task result is a 3-replicate observation and the run-to-run
variance of the whole pipeline is measured on itself.

## Structure

    EXTERNAL      the same 15 QuixBugs tasks as BENCH-1/2, x3 replicates, each replicate from
                  the same frozen seeds in FRESH workspaces (task@r1, task@r2, task@r3 in the
                  plan, so the denominator and duplicate checks stay exact)
    SEQUENTIAL    the same 5-step chain, ONCE (accumulation replicates are a different design)

    50 planned units · 300s per task · no retries · 5-hour wall clock (BENCH_TOTAL_SEC=18000),
    180s reserve · a replicate not started before the deadline is reported UNATTEMPTED, never
    silently dropped (the plan is recorded first).

## Configuration

Hub at the commit in the console header — includes everything CHECK-1 ran plus the terminal-
persistence fix (finalizedAt ack; runner waits for it; persistTerminal.test.mjs 9/9). Same
model and serving as BENCH-2/CHECK-1: Qwen2.5-Coder-7B-Instruct, A10G, `legasus-7b`, ctx
16384, temp 0.2 only. Worker isolation ON · route bounding ON (incl. finish gate) · acceptance
ON · d2 OFF · protocol OFF · supplied-file ON · per-call deadline via `budgetSec: 300`.
`BENCH_EXPERIMENT=BENCH-3 BENCH_REPS=3 BENCH_TOTAL_SEC=18000`.

## Declared readings

- **Per task across 3 replicates:** accepted 0/3, 1/3, 2/3, 3/3 — how much of BENCH-1 vs
  BENCH-2's differences (flatten/gcd flipping) is run-to-run noise.
- **Totals with spread:** accepted per replicate (three numbers, never averaged into one
  without the spread), edit attempts, regressions produced/surviving, call-ledger outcomes,
  unconfirmed remote calls, task-level timeouts.
- Same non-claims as before: no comparison arm, public tasks plausibly in training data,
  bug-fix shape only for the external group. Three replicates measure variance; they do not
  make any single-task conclusion strong.

## Spend bounding

A10G ≈ $1.10/hr. 5h wall clock ≈ $5.50–6 with warm-up — under half the $15 cap. Mechanisms:
runner-enforced 5-hour budget stops active work; app stopped with `modal app stop --yes`
immediately after and confirmed; scaledown 900s regardless. Worst case if the stop is missed:
5h + 15min ≈ $6.

## Time budget check, declared before launch

45 tasks x 300s worst case = 3.75h external + 5 x 300s = 25min sequential ≈ 4.2h worst case,
inside 5h. CHECK-1's actual pace (≈87s/task) predicts ≈ 1.4h; the run ends when the queue
does, and duration is reported as measured.
