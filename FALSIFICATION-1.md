# FALSIFICATION-1 — "the manager makes a 7B better" is unproven, and was tested fairly

**Recorded 2026-09-28. Stage 5 ablations cancelled: they would explain a difference that does not
exist in the manager's favour.**

## The claim that failed

> Breaking a repair into a localized, planner-guided edit makes a capable model complete more work,
> and preserves established behaviour better, than asking it to rewrite the page.

## What was measured

Same model (`qwen2.5-coder:7b`), same hosted backend, same decoding, same call cap, same machine-emitted
requirements, same independent evaluator, same restoration path, same campaign supervision. Both arms
got an output contract and containment of the same kind. The control was proved capable of winning
before it was used (16 assertions), and every gate was validated first (stage 1: 21 modules hashed;
stage 2: five controls, each failing for its intended reason; interruption: 27 assertions).

| | arm A — Legasus | arm B — direct |
|---|---|---|
| stage 3, fresh pages | 6 / 6 (13 calls, 484 s) | 6 / 6 (**6 calls, 237 s**) |
| stage 4, G1 (3 obligations) | 4 / 4 (9 calls) | 4 / 4 (**4 calls**) |
| stage 4, G2 (6 obligations) | 3 / 3 (6 calls) | 3 / 3 (**3 calls**) |
| stage 4, G3 (7 obligations) | **0 / 3, could not attempt** | 3 / 3 (**3 calls**) |
| regressions produced, anywhere | **0** | **0** |

**The manager matched the control's completions where it could attempt them, at twice the calls, and
could not attempt the third requirement shape at all. Neither arm damaged anything, so the safety
machinery had no danger to prevent.**

## What is now falsified, and what is not

**Falsified:** that this manager improves completion or preservation for a 7B on small, single-page,
single-file features where the model can correctly rewrite the whole page in one shot. On that family
it is overhead.

**Not falsified, because not tested:** anything outside that family. Naming what was tested is the
point of recording this — "Legasus is useless" is not what the evidence says, and neither is "Legasus
helps."

## The condition Legasus must beat, pre-registered

A task where direct whole-page generation **fails, becomes expensive, or damages prior working
behaviour** — and the manager completes it safely against the same model and budget.

The mechanism to aim at is the one asymmetry this audit did not exercise: **arm B's cost scales with
the size of what must be reproduced; arm A's does not.** At ~1 KB pages, reproducing everything is
cheap and reliable. The claim is that it stops being so.

So the next benchmark must vary **reproduction burden**, not feature difficulty:

| varied | from | to |
|---|---|---|
| page size | ~1 KB | 10-30 KB |
| accumulated obligations | 7 | 25+ |
| files the behaviour spans | 1 | more than 1 |

### Declared in advance, so this cannot be tuned until the architecture wins

- **Success for Legasus** is a crossover: a page size or obligation count at which arm B's verified
  completion rate falls and arm A's does not, at matched cost.
- **Failure** is no crossover within the declared range. If arm B still wins at 30 KB and 25
  obligations, the localized-edit thesis is not merely unproven for small pages — it is in trouble
  generally, and this record says so in advance.
- **The stopping rule is fixed before the run**, not extended until a crossover appears.
- **The ladder is not lengthened specifically to make the manager look better.** If a deeper benchmark
  is built it answers the question or it reports another null.

## Why this result is worth having

The control was given every advantage the manager has except the thing under test, and it was proved
able to win before it ran. That is why the null is informative rather than an artefact: the usual
failure mode — the control loses because its harness is broken — was checked for and excluded.

Two apparatus discoveries were preserved rather than repaired, because they are findings about the
task-generation and observation boundaries:

- **e2 / e6** — the emitter can state a requirement whose behavioural delta is already satisfied. On e6
  the *browser* supplied it: `<input type="search">` clears on Escape in Chromium.
- **e5** — the observer cannot represent an effect requiring composition across adapters
  (`type → submit → effect`); it reasons about each plan separately. A representation weaker than the
  proposition it is trying to establish.

Cost of reaching this result: **$0.417** under AUDIT-2's $5 authorization, plus $0.363 under AUDIT-1's
separate closed one.
