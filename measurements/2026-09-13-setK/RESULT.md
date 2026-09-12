# Set K — RESULT: the window never got to test the thesis, and the number that survived says the hub is not the ceiling

**27/100 correct, 37 goals attempted, 172.5 min.** GPU stopped clean at 15:11:52 (`stopApp` exit 0, confirmed by
`modal app list`: state `stopped`, 0 tasks). Cost ≈ **$12.65**.

Serving `ai-coding-hub-indent` @ `6ae7db8` — proved in the run's own log, not asserted: `hub tree
.../ai-coding-hub-indent`, `hub 6ae7db8315b1c02e648a061a695832f316759fc5`. Rule 3 identity proved before goal 1:
`ENDPOINT {"ok":true,"engine":"vllm","model":"Qwen/Qwen3-Coder-30B-A3B-Instruct","gpu":"H100","max_len":16384,"lora":null}`.

## Against the pre-registration

| prediction | target | actual | verdict |
|---|---|---|---|
| 1. goals attempted | ≥ 85 | **37** | **FAILS** — set H reached 53 in a *shorter* window |
| 2. score | ≥ 60 | **27** | **FAILS** — set H scored 39 |
| 3. conversion per goal attempted | within ±10 pts of 73.6% | **73.0%** | **HOLDS**, to 0.6 points |

## Prediction 1 failed, and not because the thesis is wrong

The thesis on trial was **reach**: set H left 47 goals unstarted, and at its observed hit rate those were argued to be
worth ~+34 goals. Set K doubled the window to test it.

**63 goals never started — more than set H's 47.** The window was consumed before the work began:

- **83+ minutes of a 172-minute window went on latency before the first step of each goal.** Measured as
  `createdAt` → first recorded step, in true run order: `2, 1, 1, 2, 3, 1, 2, 2, 1, 59, 52, 111, 70, 121, 115, 113,
  77, 75, 133, 257, 208, 300, 430, 220, 338, 355, 327, 455`. First half mean 31s; last half 243s; still rising at
  the end.
- It is **not** prompt size or reply length: the planner prompt grew only 1,482 → 2,019 chars (+36%) and its reply
  stayed flat (463 → 479). One 2,255-char prompt produced 288 characters **in 455 seconds** — ~0.6 tok/s on an H100
  serving a 3B-active MoE.
- It is **not** retries: 0 of 393 calls had `attempts > 1`; `connRetries` 0; `ctxSquashes` 0.
- `tok/s` across the window ranged **6.8 to 180.4** — a 26× spread, which is the latency story in one number.
- Set H's control arm ran the *same script with the same defaults* at a flat **4s** pre-plan gap across 40 runs. So
  this is not configuration.

The planner call is recorded separately (`kind: plan`, `n: 0`) and is **absent from `callStats`**, which is why model
time looked identical to set H (39s vs 37s per run) while wall clock diverged. The experiment was defeated by the
serving layer, not by the hypothesis. **Reach remains untested.**

## Prediction 3 held — and it is the finding

Conversion per goal *attempted* is indifferent to how slow the endpoint was:

| | attempted | correct | conversion |
|---|---|---|---|
| set H MoE (110-min window, 2 arms concurrent) | 53 | 39 | **73.6%** |
| set K MoE (180-min window, solo, three fixes) | 37 | 27 | **73.0%** |

Three fixes shipped tonight — the context window (`d80b38f`), the class-method outline (`579a41a`), the refusal
hand-back (`6ae7db8`) — all verified as *firing in production*, and per-attempt conversion moved **−0.6 points**.

Per project (correct of 10): s1 5→3 · s2 6→4 · s3 6→4 · s4 0→0 · s5 4→1 · s6 4→4 · s7 4→3 · s8 4→2 · s9 2→**3** ·
s10 4→3. Every decline tracks fewer attempts, not worse work.

## The fixes were cleared on four independent instruments

I suspected my own pruner twice — it retains ~1.85× more messages, so longer prompts were the obvious suspect — and
measurement refuted it both times:

| instrument | set K | set H fix | verdict |
|---|---|---|---|
| tokens/call (same goals, joined via `rows.json`) | 7,040 | 7,069 | identical |
| prompt chars, early→late growth | 1.04× | 1.06× | **smallest of three arms** |
| reply chars (mean) | 888 | 1,058 | shorter |
| model time per run | 39s | 37s | identical |

The pruner's real effect appears exactly where it should and is small: end-of-run prompts 8,349 tokens vs ~7,500,
about **+11% retained context**, inside the 9,011 budget. Structurally it *cannot* accumulate across goals — each
goal is its own run with fresh history. The hand-back fired **2 of 2** refusals, and the run that used it completed.

## Four stop mechanisms, none of them the window

| cause | runs |
|---|---|
| 30-call step budget | 3 |
| finish gate ("project does not run", 3 strikes) | 2 |
| 8-minute per-goal time cap | 2 |

Goal 28 hit the **time** cap on **6 calls and 17 seconds of model time** — 455 of its 480 seconds were spent waiting
for the planner. Raising the outer window relieves none of these three caps.

And goal 11 — the goal traced by hand earlier that night (`8e7cf9aa`) — died again on a fixed hub: 30 calls, **zero
ERROR answers, zero refusals, zero hub notes**, four self-written debug scripts (`test_checkout.js`,
`debug_test.js`, `detailed_debug.js`, `final_debug.js`), chasing a contradiction in its own assertions. The hub never
blocked it once. That is the capability ceiling, not the tooling.

## What I got wrong

- **The ceiling arithmetic I recorded as decisive.** "+47 unstarted × 71.7% ≈ +34 goals, ~17× the hub-defect block"
  assumed per-goal cost is flat. It is not: set K's cost per goal rose 30s → 385s across blocks of five, and set H
  rises too (shallower, plateauing ~100–120s). Goals-attempted is **sublinear** in window length.
- **Four inferences built on wall clock, each overturned by a direct instrument.** Goal `secs` includes tool
  execution and pre-plan latency; `s/call` derived from it measures the test suite, not the model. `callStats`
  (`ms`, `tokPerSec`, `outTok`, `promptTok`) was on every run record the whole time.
- **"The endpoint is 32% slower."** That average was poisoned by cold-start calls; steady-state `lastTokPerSec` is
  126.6 against set H's 128.3.
- **A sort that mutated the array it then printed "by run order"**, which made a rising latency curve look like a
  falling one until I re-derived it non-destructively.

## What this does NOT settle

The reach thesis. One arm, one window, and the variable under test never got exercised because the serving layer ate
the time. A rerun would need `MIN_CONTAINERS ≥ 1` (or a warm endpoint proved before goal 1) and a per-goal time cap
raised above the observed pre-plan latency — otherwise the same 8-minute cap will keep killing goals that have done
nothing.

What this run *does* establish: **per-attempt conversion is flat at ~73% across set H and set K**, through twenty-odd
hub fixes and three more tonight. Whatever is costing the other 27%, it is not the hub refusing, mis-editing, or
losing the model's context.
