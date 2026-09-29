---
name: wall-clock-is-not-model-latency
description: Goal seconds include tool time and pre-plan queueing; callStats (ms/tokPerSec/outTok/promptTok) is the only instrument that measures the model — four inferences in one night died on this
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T20:15:04.921Z
---

Set K (2026-09-12): I built four separate inferences on wall-clock proxies and a direct instrument refuted every
one — "the endpoint is 32% slower", "the pruner inflated prompts", "goals compound", "s/call is blowing up".

**Why:** a goal's `secs` in the trial log is the whole goal — model calls, `node`/`mocha`/`npm`/browser tool
execution, AND the latency before the first step. Dividing it by model calls produces an "s/call" that is mostly
measuring the test suite. Every run record already carries `callStats`: per call `{ms, tokPerSec, outTok,
promptTok, attempts}`. Model time is `sum(ms)`; everything else is not the model.

**How to apply:** before attributing a slowdown to a model, a prompt, or a hub change, sum `callStats.ms` and
compare it to the run's step span — that ratio is the model's share. In set K it was 49% against set H's 71–80%,
which located the problem instantly. Two traps to remember: the **planner call is recorded separately**
(`kind: plan`, `n: 0`) and is absent from `callStats`, so a run can burn 455 of 480 seconds invisibly; and
`tokPerSec` averaged over a run is poisoned by cold-start calls (45 → 144 within one run), so use
`lastTokPerSec` for steady state. Also: `.sort()` mutates — I printed a "by run order" series that was already
sorted descending and read a falling trend off a rising one.

Related: [[silent-failures-are-the-class]], [[verify-the-path-the-change-is-on]].
