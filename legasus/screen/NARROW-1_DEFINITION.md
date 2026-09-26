# NARROW-1 — does restricting the 1.5B's output responsibility convert an interface failure into an executable candidate, without changing the verifier or the acceptance standard?

2026-09-26. Frozen before any live generation. **The 1.5B cell costs $0** (local ollama). The
7B cell is defined here and **NOT authorized**; it needs a cap.

## The question, exactly

Not "make the farm work". **Determine whether restricting the 1.5B's output responsibility
converts an interface/protocol failure into an executable candidate without changing the
verifier or acceptance standard** — and, when it still fails, WHERE the failure moves.

## What is already known (the first column of the 2x2)

    M1-LIVE-1  whole game, agent loop      836 s, 21,133 chars, never completed   no artifact
    M1-LIVE-2  one increment, agent loop   echoed two guidance lines 3x           no file write

Both are consistent with too much responsibility at one generation boundary. Neither shows the
model cannot implement increment 1. That is what this run tests.

## The 2x2

                        broad / current protocol         narrow artifact protocol
    1.5B local          FAILED (M1-LIVE-1, M1-LIVE-2)    THIS RUN ($0)
    7B hosted           capability control, if useful    strongest comparison (needs a cap)

**Nothing may differ between cells except the protocol.** Held identical: the model, the task
and its increments, the play spec, the protected spec, the evaluator, the acceptance policy,
the resource limits, the machine.

## The narrow protocol (server/narrowArtifact.mjs, `narrow-artifact-v1`)

    system     "You output exactly one fenced code block and nothing else." Nothing about
               tools, plans, ledgers, budgets or verification.
    user       the increment's one-line ask, the entry file's name, the state contract, and
               (for a later increment) the current file. One instruction: reply with one
               fenced block.
    extraction DETERMINISTIC and done by the harness: the first fence opens the artifact, the
               next fence at line start closes it. No closing fence = the reply was cut off;
               it is reported, never written. The model never invokes a tool.
    writing    the harness writes the artifact to the entry file and commits it.
    judging    UNCHANGED: the same play (legasus/bench/farm/play.json subset), the same
               evaluator (server/evaluator.js), the same acceptance policy
               (server/acceptance.js). Not one line of the gate is touched.

## Boundaries recorded per attempt (the measurement)

    B1 artifactProduced   a fenced block is present
    B2 artifactComplete   its closing fence arrived AND the model stopped naturally
    B3 contractClean      nothing but whitespace outside the fence
    B4 reachedExecution   the page loaded and the play produced verdicts (not UNAVAILABLE)
    B5 passedDiagnostic   every requested step passed
    B6 passedProtected    the protected spec passed, or none was specified
    B7 accepted           the acceptance policy said RETAIN

Plus, per attempt: `terminationReason` (**stop** = natural, **length** = token ceiling,
**harness_deadline** = wall clock) and `naturalStop`; elapsed ms to first token, to the
written artifact, to the play verdict, to acceptance; output and prompt tokens; reply chars;
the verbatim reply (bounded); the play log; the acceptance disposition. Strict (B3 gates use of
the artifact, as the protocol says) and lenient readings are BOTH recorded from one run.

**Why terminationReason is now a variable, not a footnote.** At 2.3 output tokens/s a complete
page is minutes of generation. A model that knows the answer but cannot emit it before a
deadline is a different failure class from one that cannot construct it, and M1-LIVE-1 could
not tell them apart. Every attempt here says which.

## The run

    task        farm-i1 only (movement + the state contract; requested steps 1-3; nothing
                protected - it is built from nothing)
    model       qwen2.5-coder:1.5b via local ollama, temperature 0.2
    attempts    5 seeds (1..5) - one attempt is not a result for a stochastic generator
    bounds      900 s deadline per attempt, 4000 max tokens (so the ceiling and the deadline
                are distinguishable), no retries, no tool use
    cost        $0

## Pre-registered readings

- **The protocol was the problem** if attempts now reliably reach B2 (a complete artifact) -
  whether or not they pass B5. Emitting complete files and failing behaviourally is the
  outcome that proves the earlier failure was substantially interface, not capability.
- **A capability or inference-performance limit** if attempts still cannot reach B2. Then the
  reason matters: `length`/`harness_deadline` points at emission speed (a performance limit,
  addressable by a smaller artifact or a faster model); `stop` with no fence, or a fence around
  prose, points at the model not constructing the file at all.
- **Mixed** is a real outcome: report the count at each boundary, not an average.
- No claim about the farm, about later increments, or about the 7B follows from this run.
- The instrument itself is proven able to fail: `narrowArtifact.test.mjs` 23/23 shows every
  boundary passing and failing on scripted replies, with the gate unchanged.

## The 7B cell, defined now, launched only with a cap

Identical harness, identical frozen chain, `--model-url` pointed at the hosted
Qwen2.5-Coder-7B-Instruct, same 5 seeds, same bounds. Planned: 5 attempts x ~1 min of
generation plus deploy and shutdown, well under 1 h -> ~$1.1 GPU-only / ~$1.6 conservative at
the verified A10 rate, with the watchdog and the observed-stop discipline unchanged. **No
spend authorized in this file.**
