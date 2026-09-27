# DOM-EVIDENCE-1 DEFINITION — does DOM evidence let the model repair the missing-element failure without human rewiring?

Frozen 2026-09-27, before any round is run. **NOT RUN. No paid run is authorized by this document.**

## The question, narrowly

REPAIR-2 seed 2: given the error text alone, the model applied the textbook fix for an element that
is **not there yet** (defer to `DOMContentLoaded`) when the element is **not there at all**. The
message cannot tell those apart. **Does supplying the facts that do tell them apart let the model
repair it?**

Nothing else changes. The candidates are the same untouched arm B outputs, the task is the same, the
gate is the same, and no rewiring or corrected decrement is supplied in either arm.

## The two arms, differing in ONE thing

    arm E0  evidence: basic   the file, the captured error message, the declared contract, and once
                              the page runs, the failing step's name and observed state.
                              THIS ARM IS ALREADY RUN: it is REPAIR-2, and its records stand.
    arm E1  evidence: dom     the same, PLUS four facts read off the page at the failure:
                                the element lookups that returned nothing (the failing selector)
                                the ids the document contained AT THAT MOMENT
                                the ids the document contains ONCE READY, with the readyState
                                the stack of the raised error

`--evidence basic|dom` selects between them and nothing else differs. Both are already implemented
and tested (`repairLoop.test` 27/27, cell 6 asserts the four facts appear and that none of my
analysis does).

## What is supplied, and what is not

    supplied      the candidate, the task, the edit format, indentation tolerance, and in E1 the
                  four DOM facts above - every one of them read off the page by the harness
    NOT supplied  that the buttons do not exist; any mention of keydown or any event name; the
                  rewiring; the corrected decrement; any description of the defect in my words
    audited       the test suite strips the candidate's own text from the prompt and searches what
                  remains for those words, failing if any appear

## Measured, and reported APART

    FULL ACCEPTANCE          the acceptance policy says RETAIN. This is the result. It is the only
                             thing that counts as a repair.
    intermediate improvement reported separately and never summed with it:
                               failure class moved (e.g. RUNTIME_EXCEPTION_AT_LOAD -> BEHAVIOUR)
                               steps newly passing
                               the page became observable at all
                             REPAIR-2 produced one such improvement and zero repairs, and the two
                             must not be blended into a single score.
    cost of failure          rounds used, generation seconds, tokens, dollars - including rounds
                             that produced no applicable edit

## Discipline carried in from the last run

    no repeated cycles       a repeated (file, evidence) pair or a byte-identical reply ends the loop
                             with NO_NEW_INFORMATION. REPAIR-1 spent two thirds of its budget on the
                             same refusal three times.
    explicit tolerance only  whitespace tolerance is opt-in, its rule is recorded verbatim in every
                             round, a match must be UNIQUE, and reordered lines are still refused.
                             Nothing is scored for similarity and no region is inferred.
    both sides retained      the original candidate with its sha256, the text before each round with
                             its sha256, and a line diff of what the applied blocks did.
    baseline honesty         the comparison stays on `farm-plant` (6 steps). `farm-plant-v2` exists
                             and is stricter, and the accepted baseline fails it; adopting it here
                             would mix a second repair into the measurement.

## Pre-registered readings

- **E1 reaches RETAIN where E0 did not.** Then machine-captured DOM evidence is sufficient to drive
  this repair, and the product has its first observed-failure-to-working-improvement. Still assisted:
  the site, the format, the tolerance and the evidence selection are all the harness's work.
- **E1 changes the repair family but still fails.** The most likely outcome, and the useful one: it
  would show the evidence redirected the model, and the remaining obstacle would be named by
  whatever the new failure is.
- **E1 behaves like E0.** Then the error message was not the binding constraint, and my account of
  why REPAIR-2 failed is wrong. That is worth knowing and is the reason this arm is worth running.
- **E1 is worse.** More evidence can distract; that outcome would be reported as plainly as a win.

**This does not test autonomy.** The candidate, the task, the decomposition, the edit format and the
choice of which facts to capture are all mine. What it tests is whether a failure the system can
observe is enough to drive a repair it did not have to be told.

## Estimated cost when authorized

Four candidates, at most 3 rounds each, on the 7B: about 12 rounds, roughly 10-15 minutes of A10G,
**about $0.20-0.30**. Prior hosted spend is about $0.57. **Awaiting authorization; nothing is
deployed.**
