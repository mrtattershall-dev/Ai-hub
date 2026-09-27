# DOM-EVIDENCE-1 DEFINITION — does additional runtime evidence improve repair under an otherwise identical loop?

Frozen 2026-09-27, second version, before any round is run. **NOT RUN. This document authorizes no
spending; the cost below is an estimate.**

## The question, stated as the comparison

REPAIR-2 seed 2: given the error text alone, the model applied the textbook fix for an element that
is **not there yet** (defer to `DOMContentLoaded`) when, in the state observed, the element was **not
there at all**. The message cannot separate those. **Does adding runtime evidence that can separate
them improve repair, with everything else held identical?**

## Both arms run NOW, on the current harness

    arm E0   evidence: basic   the file, the captured error message, the declared contract, and once
                               the page runs, the failing step's name and observed state
    arm E1   evidence: dom     the same, PLUS four facts read off the page at the failure

**E0 is re-run. It is not taken from REPAIR-2.** REPAIR-2 ran before repeat-stopping existed, before
the match rule and diff retention were recorded, before line-aligned exact matching, and before the
DOM capture was instrumented. Any of those can change how many repair opportunities a run gets, what
it costs, and what it produces. **A historical run cannot serve as the control for a harness it did
not execute on.** REPAIR-1 and REPAIR-2 stay in the record as context and as the reason this
experiment exists.

## Held identical across the two arms

    candidates            the same four untouched arm B outputs (seeds 2-5), byte for byte, with
                          their sha256 recorded per run
    model                 qwen2.5-coder:7b, digest dae161e27b0e90dd, Q4_K_M
    serving version       ollama PINNED to 0.33.3, verified in the build log and the startup line
    matching              --match normalized, the same rule text recorded in every round
    stopping rules        at most 3 rounds; a repeated (file, evidence) pair or a byte-identical
                          reply ends the loop with NO_NEW_INFORMATION
    budgets               the same round cap, the same 1500-token cap, the same 900 s deadline
    decoding              temperature 0.2, seed 1
    the loop's gate       farm-plant (6 steps), unchanged, for continuity with arm B
    harness commit        one commit for both arms, recorded in the result

**The ONLY difference is `--evidence basic` against `--evidence dom`.**

## What the DOM arm adds, and what those facts do and do not establish

    the element lookups that returned nothing        e.g. "plant"
    the ids the document contained AT THAT MOMENT    e.g. ["gameCanvas"]
    the ids it contains ONCE READY, with readyState  e.g. ["gameCanvas"], readyState complete
    the stack of the raised error                    file and line

**What `readyState: complete` plus the absent id establishes:** in the state observed, waiting for DOM
readiness will not produce that element. **What it does not establish:** that the element can never
appear. A later dynamic insertion — by another script, a timer, a fetch callback, a framework — is not
ruled out by this observation. The evidence is a report of an observed state, not a proof about the
page's future.

## Reporting, kept separate

    OLD-SPEC ACCEPTANCE          farm-plant, 6 steps: the acceptance policy says RETAIN. This is the
                                 loop's result.
    NEW-SPEC ERROR-FREE          farm-plant-v2, 7 steps, measured AFTERWARDS on the file the loop
                                 ended with, via --post-check. It is recorded separately and it
                                 decides nothing: it never reaches the model, the evidence, the
                                 revert rule or the acceptance verdict.
    intermediate improvement     failure class moved, steps newly passing, the page became observable
                                 at all. Never summed with either acceptance figure.
    cost of failure              rounds used, generation seconds, tokens, dollars, including rounds
                                 that produced no applicable edit

**A candidate that passes the old gate while still throwing during movement will be reported as
"passed spec v1, not error-free", never as a working repair.** `repairLoop.test` cell 7 pins this: a
repair the six-step gate accepts is shown failing the seven-step spec with 17 errors raised, and the
stricter requirement is shown never to have appeared in anything the model was told.

## What is supplied, and what is not

    supplied      the candidate, the task, the edit format, indentation tolerance, and in E1 the four
                  DOM facts - each of them read off the page by the harness
    NOT supplied  that the buttons do not exist; any event name; the rewiring; the corrected
                  decrement; the stricter spec's requirement; any description of the defect in my
                  words
    audited       the suite strips the candidate's own text from the prompt and fails if any of those
                  words appear in what remains

## Pre-registered readings

- **E1 reaches RETAIN where E0 does not.** Additional runtime evidence improves repair under an
  identical loop. Report the old-spec acceptance and the new-spec result separately, and expect the
  new spec to still fail unless the model also fixed the inherited `#day` defect.
- **E1 changes the repair family but still fails.** The likely outcome: the evidence redirected the
  model and something else now binds. Whatever the new failure is, name it and stop.
- **E1 behaves like E0.** The error message was not the binding constraint, and my account of
  REPAIR-2 was wrong. This is the outcome that makes the experiment worth running.
- **E1 is worse.** More evidence can distract. Reported as plainly as a win.

**This does not test autonomy.** The candidate, the task, the decomposition, the edit format and the
choice of which facts to capture are all mine. It tests whether a failure the system can observe is
enough to drive a repair nobody wrote for it.

## Estimate, not a request

Eight runs (4 candidates x 2 arms), at most 3 rounds each, on the 7B: roughly 20-30 minutes of A10G,
**about $0.40-0.55**. Prior hosted spend is about $0.57. **Nothing is deployed and no authorization is
implied by this estimate.**
