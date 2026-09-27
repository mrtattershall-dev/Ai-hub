# REPAIR-1 DEFINITION — can the system turn observed failures into working improvements without a human writing the fix?

Frozen 2026-09-27, before any round is run.

## Authorization, stated precisely

**Directed by Micheal, 2026-09-27:** *"A bounded recovery experiment is now worth doing: retain the
untouched 7B candidates, feed the model the captured runtime error and existing interface contract,
and let it propose the repair. If the page then runs, provide the occupied-tile failure. Keep the
acceptance gate unchanged and count all repair attempts, time, and cost. Don't supply your rewiring
or corrected decrement."*

**No cap was stated.** The word in the instruction is *bounded*, so the bound below is **mine, not an
authorization**, and it is stated as such — the lesson from arm B is that staying under a cap set for
a different experiment is not authorization for this one.

    self-imposed bound   4 candidates x at most 3 repair rounds; stop at $0.50 of A10G time
    estimate             about 12-18 minutes of container time, roughly $0.25-0.35
    prior spend          $0.29 across arms C, C2 and B

## The question

Arm B's 7B candidates all failed, and **the analysis of why was mine**: I neutralised a null
dereference and rewired invented buttons by hand, and only then could a remaining one-line defect be
seen. That explains the failures; it does not overturn them, and it is not something the product can
do for itself. This asks instead: **given only what the gate observed, does the model repair its own
candidate?**

## Held fixed

    the candidates       the four code-bearing arm B outputs (seeds 2-5), UNTOUCHED, byte for byte
    the gate             the same play, the same protected spec, the same independent evaluator and
                         the same acceptance policy, through the shared judgeCandidate
    the baseline         the accepted increment-1 page remains startRef, so a repair that abandons
                         movement is still a regression
    the model            qwen2.5-coder:7b, same digest, same pinned ollama 0.33.3, same container
    decoding             temperature 0.2, seed 1, 1500-token cap, 900 s deadline

## What the model is told, and what it is NOT told

**Given — all of it machine-captured in this run:**

    the current file
    the captured runtime error, VERBATIM, e.g.
        [JS ERROR] Cannot read properties of null (reading 'addEventListener')
    the interface contract the task already declares
    once the page runs: the failing step's own name and the observed state, as the play printed them

**Withheld — every part of my analysis:**

    no mention that the buttons do not exist        no mention of keydown or any event name
    no rewiring, no corrected decrement             no hint about guard placement
    no description of the defect in my words

`repairLoop.test` includes an evidence audit that searches what the harness ADDS to the prompt for
those words and fails if any appear. (It audits the added text only: the candidate's own code
contains `getElementById` and `keydown`, so searching the whole prompt would flag the file.)

## The loop

1. Judge the untouched candidate. Record the failure class: RUNTIME_EXCEPTION_AT_LOAD, SEAM_MISSING
   or BEHAVIOUR.
2. Hand the model the evidence for that class. It replies with FIND/REPLACE blocks, applied **only**
   on an exact unique match — no fuzzy matching, and nothing applied unless every block applies.
3. Judge again. **Keep the round's text only if the protected spec still passes**; otherwise revert
   that round, so the loop never builds on damage and never loses the repair subject. The acceptance
   policy still restores the workspace itself, and nothing is promoted without RETAIN.
4. Stop at RETAIN or after 3 rounds. **Every round counts, including rounds that produce no
   applicable edit.**

## Recorded

Per round: the evidence given, the raw reply, blocks parsed, apply results, the resulting play and
failure class, the disposition, whether the working copy was kept or reverted, generation ms and
tokens. Per candidate: rounds used, generation seconds, wall clock, and acceptance. Plus dollars for
the whole experiment.

## Pre-registered readings

- **A repair reaches RETAIN.** Then the system has turned an observed failure into a working
  improvement without a human writing the fix. That is the capability the product needs, and it
  would be the first accepted functional addition in this line of work. It would still be an
  **assisted** result: the site, the format and the task decomposition remain supplied.
- **Repairs apply but do not fix.** Then feeding back machine evidence is not sufficient at this
  size, and the next question is what the evidence lacks — which is a concrete, cheap thing to
  iterate on.
- **Repairs do not apply at all** (FIND never matches). Then the edit format is the obstacle in the
  repair direction too, which would be consistent with the anchor-protocol failures already
  recorded.
- **A repair breaks the protected behaviour.** The policy must restore it and the loop must revert
  that round; if either fails to happen, that is a defect in the loop and is reported as one.

**Not in scope:** autonomy. The candidate, the task and the edit format are all supplied. This
measures whether observed failures can drive repairs, not whether Legasus can choose what to repair.
