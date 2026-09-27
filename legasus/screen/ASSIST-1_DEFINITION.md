# ASSIST-1 DEFINITION — can Legasus supply the assistance itself, and reach working software?

Frozen 2026-09-27, before any run. Step 1 runs **locally at $0**. No paid run is authorized by this
document.

## The hypothesis, restated as the thing to measure

Not "is the model capable". **Can the system supply the right context, choose useful observations,
divide the work, and turn a failure into a successful next step — without a person doing those things?**

Everything measured so far says the guidance has been mine: I chose the site, the instruction, the
region, the decomposition, the evidence and the next experiment. **The target is to move each of those
decisions into Legasus and see whether working software still comes out.**

## The four steps, in order, each a gate on the next

    STEP 1  a ceiling exists            establish that the chosen model CAN produce an accepted
                                        handler with assistance a person tuned. Until this passes,
                                        step 2 cannot be interpreted: automating assistance that never
                                        worked would measure nothing.
    STEP 2  Legasus produces it         the same task, the same gate, with the system choosing the
                                        assistance - site, instruction shape, evidence, decomposition -
                                        and no person in the loop.
    STEP 3  verified independently      the acceptance gate, unchanged, plus the strict no-error spec
                                        reported beside it, plus re-verification through every
                                        invocation path.
    STEP 4  counted                     my interventions, failed attempts, wall clock, and dollars -
                                        for BOTH steps, so step 2 can be compared to step 1 on effort
                                        and not only on outcome.

## The intervention ledger, which is the point of the exercise

Every human decision in step 1 is recorded as a numbered intervention, with what was changed and why.
**That list is the specification for step 2**: whatever is on it, Legasus must decide for itself. A step-2
run that needs an intervention not on the list, or repeats one from it, is a failure of step 2 and is
reported as one.

Interventions already carried in from earlier work, and counted from the start:

    I1  the task is one named handler with a negative clause     (farm-plant)
    I2  the edit interface is a hole in the file at a named site (fim, the 5-line region)
    I3  the instruction is one line, not nine                    (the length finding)
    I4  the tail trim, because the model closes the document      (deterministic, recorded)
    I5  the starting page is the VERIFIED baseline                (AUDIT-1, zero errors)

## Held fixed in step 1

    model              qwen2.5-coder:1.5b, local, $0
    starting page      legasus/bench/farm/baseline-verified.html, sha256 2a87c27f510f2a7d
    task               farm-plant (6 steps), gate unchanged
    strict spec        farm-plant-v2 reported beside it, never fed back
    decoding           temperature 0.2, seeds 1-5, 1500-token cap, 900 s deadline
    harness            the set frozen in AUDIT-1

**Why the 1.5B first:** it is free, and the verified baseline is a materially better starting point than
anything it has been given before — every previous attempt inherited a page that threw on every
keypress. If the ceiling exists here, the whole demonstration can run at $0. If it does not, step 1
moves to the 7B and needs authorization, and that failure is itself worth recording.

## Stopping rule for step 1

At most **three tuning rounds**, each a numbered intervention, five seeds per round. Stop at the first
accepted candidate. If three rounds produce nothing accepted, **step 1 fails for this model** and is
reported as a ceiling that was not established — not as a model limit, since the assistance space is
not exhausted.

## Pre-registered readings

- **Step 1 passes.** A ceiling exists at $0, and the intervention list is the target for step 2.
- **Step 1 fails on the 1.5B.** Either the assistance space needs more search, or this model cannot do
  it under any assistance a person has tried. Both stay open; the choice is then whether to authorize
  the 7B for step 1.
- **Step 1 passes and step 2 fails.** The capability gap is located exactly where this project has
  always suspected: not in generation, but in deciding what to generate and what to look at.
- **Step 1 and step 2 both pass.** That is the demonstration, and the numbers from step 4 say what it
  cost relative to a person doing it.

**What this cannot show:** that the system would handle an unfamiliar task or an unfamiliar failure.
One handler, one page, one catalogue.
