# BENCH-2 — definition, frozen before any generation

**BENCH-1's definition, unchanged, run again on a later hub commit.** Written and committed
2026-09-24 before the GPU app is deployed, so nothing here can be shaped by the outcome.

Authorized spend cap: **$10** (user, 2026-09-24: "Run the benchmark again. 10 dollar budget").

## What is identical to BENCH-1

Everything in `legasus/screen/BENCH-1_DEFINITION.md`: the same 15 external QuixBugs tasks
(same selection rule, same seeds, same adapter, same requested/protected checks), the same 5
internally authored sequential steps, the same guidance text, the same order (external first),
300s per task, 2 hours total with 180s reserve, no retries, no comparison arm.

Same model and serving: Qwen2.5-Coder-7B-Instruct on an A10G, Modal app `legasus-7b`, context
16384, min containers 1, scaledown 900s. Same sampling as BENCH-1: temperature 0.2, top_p /
top_k / repetition penalty **unset** (the SAMPLING-1 knobs exist in both hub and server and are
deliberately not turned on - the generation regime is held constant so that the two workflow
fixes below are the only intended difference).

Same worker image `sha256:fa49b576430b1288a585522bbf011fbd218cedcb379eb7bb57e3a69fec08a8c3`,
worker isolation ON, route bounding ON, acceptance ON, d2 OFF, protocol controller OFF.

## What is different: two hub commits, nothing else

BENCH-1 ran hub `98f738a`. BENCH-2 runs hub `ec71665`, which adds exactly:

1. `46a349d` — the repeat warning now survives the whole-file substitution. In BENCH-1 the
   warning first reached the model on its 4th identical call; the guard stops at 3, so most
   stalled runs were terminated before being told they were repeating. Now it reaches the model
   on the call the guard fires. **The repeat limit (3) is unchanged.**
2. `ec71665` — for a goal-named file of at most 8192 bytes, the complete numbered contents are
   supplied in the opening context, labelled with path and sha256, and the model is told it need
   not outline or read it. Every one of the 15 QuixBugs targets is under this limit, so all 15
   external tasks will have their target supplied. Larger files behave as before.

Both were proven through the real route with scripted replies (`repeatWarning.test.mjs` 15/15,
`suppliedFile.test.mjs` 16/16). **Neither has been observed with a live model.** That is what
this run measures.

The runner (`bench1.mjs`) gained only a run label (`BENCH_EXPERIMENT`) and records the hub
commit and the sampling/supply settings in its config block. Tasks, limits and order are the
same code paths as BENCH-1.

## What will be compared, declared now

Against BENCH-1's recorded values, per group, never summed:

    EXTERNAL  accepted (verified)              2 / 15
              NO_EDIT_ATTEMPTED (first obstacle) 10 / 13 failures
              runs whose first tool was outline_file/read_file on the supplied target
              runs terminated by the repeat guard
              candidate regressions produced / surviving      1 / 0
    SEQUENTIAL consecutive steps accumulated   0 / 5

Failures are classified by the same procedure (`benchClassify.mjs`, first evidenced obstacle).

**One run of each is n=1 per configuration.** BENCH-1 vs BENCH-2 is a before/after on one
model with two changes bundled; it cannot attribute an effect to either fix separately, and a
difference within the run-to-run variance seen elsewhere in this programme (±19 goals attempted
across identical arms in set H) is not evidence of anything. A *large* change in the
NO_EDIT_ATTEMPTED count is the only outcome this design can read.

## Spend bounding — as BENCH-1

Only paid resource: the A10G container (~$1.10/hr). Stopped with `modal app stop --yes` right
after the run and confirmed; scaledown 900s releases it regardless; 2-hour wall clock enforced
in the runner. Worst case ≈ $2.50. Modal's CLI exposes no balance; spend is bounded by these
mechanisms and reported as measured GPU time, not as a dollar figure I cannot read.

## What this cannot show

Everything BENCH-1 could not: no comparison with other frameworks; public tasks plausibly in
training data; bug-fix shape only for the external group. Additionally: if the model still stalls
with the file supplied, that says the stall is not (only) the outline transition; if it stops
stalling, this design cannot say which of the two fixes did it.
