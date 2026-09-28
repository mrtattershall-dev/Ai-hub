# ASSISTED-1 DEFINITION — a bounded assisted-success test on code the rules were not written against

Frozen 2026-09-27, **before the pages exist**. Local, **$0**. No paid run is authorized; the $10 text
remains UNVERIFIED and unspendable (see `CONSTRAINTS-2_DEFINITION.md`).

## The question, stated at the size it actually is

> **Can we obtain one verified success on a page nobody tuned against, and what assistance did it
> require?**

Not whether this model has a capability ceiling. **One successful solution establishes ATTAINABILITY,
not a performance ceiling**, and a bounded number of calls cannot settle a model's ultimate capability.
The two outcomes are asymmetric and are written down now so neither can be inflated later:

    SUCCESS   establishes that this model can complete THIS addition with THE RECORDED ASSISTANCE. Its
              value is that the recorded assistance becomes a concrete target for automated guidance:
              a list of things the policy would have to produce by itself.
    FAILURE   establishes that THE TESTED ASSISTANCE DID NOT PRODUCE SUCCESS WITHIN THE DECLARED
              BUDGET. It does NOT prove a capability limit, and it does NOT rule out another interface,
              another assistance set, or another budget. The wording in the result will be exactly:
              **"No success within the declared assistance budget."**

## The pages, and which one is spent

**A page is untouched only until I inspect it.** The moment I read it and adapt the assistance to what I
find, it is a DEVELOPMENT CASE. That is appropriate here and it is also irreversible, so two pages are
generated at the same time, before either is read:

    PAGE A   the development case for THIS experiment. I inspect it, define the addition and its
             checks, and adapt assistance to it freely. It is spent, and no transfer claim may ever
             rest on it.
    PAGE B   RESERVED AND SEALED. Generated in the same batch, committed with its sha256, and NOT
             INSPECTED. It exists so that a future transfer test has a page which was written before
             any of this experiment's assistance was designed. Reading it early would destroy the only
             property that makes it useful.

Both are written by the local 1.5B from one-line requests. Neither is a farm page or a lamp page.

## 1. BUDGET

    model calls for attempts        20, hard limit
    interventions by me             12, hard limit
    whichever runs out first        ends the experiment

**Page generation does NOT count against the 20.** It is experimenter setup, not assistance, and it is
counted and reported separately as `pageGenerationCalls`. Token-counting oracle calls do not count
either and are reported separately as `oracleCalls`; they produce no candidate.

**What one intervention is.** Any distinct item of information, correction, or configuration that I
supply and the automatic policy did not produce by itself. Counted once per DISTINCT item; re-using the
same item on a later attempt is not a new intervention. Every one is recorded with its text at the
moment it is introduced, in order, so the ledger is a sequence and not a total.

## 2. BASELINE

Before any attempt, and recorded:

    the page loads with no page or console error
    its FULL declared interaction sequence PASSES, every step, from a fresh load
    the REQUESTED ADDITION IS ABSENT - its steps FAIL on the baseline, and they fail for the right
      reason (the behaviour is missing, not the harness broken)
    the baseline file's sha256

A baseline that does not satisfy all four is not a baseline, and the experiment does not start on it.

## 3. ASSISTANCE BOUNDARY

**I may supply:**

    LOCATION   where the edit goes - the site, the anchor, the enclosing function
    CONTEXT    facts about the program: declarations, how existing code writes the state, the redraw's
               name and arity, what the error was
    SCAFFOLD   the surrounding structure - the trigger branch, a redraw call, a guard - i.e. code that
               is not the change itself
    FEEDBACK   the captured error text, the diagnosis, the failing step, and what was refused and why

**I may NOT supply the target implementation.** Specifically: no statement that performs the required
state change, and no code which, if the model merely copied it, would satisfy the addition's checks. If
I catch myself about to write the answer, the experiment stops and records that it stopped there.

**Every line of code I supply is recorded verbatim**, in the ledger, at the point it was introduced -
scaffolds included. A reader must be able to subtract my contribution from the result and see what is
left.

## 4. SUCCESS

A success requires **all** of:

    the addition's own checks PASS - every step of its declared sequence, from a fresh load
    EVERY CARRIED-FORWARD CHECK PASSES - the page's pre-existing interaction sequence, unchanged
    no page or console error at any point (`noErrors`)
    the independent evaluator returns PASS on a named git tree
    acceptance disposition RETAIN

Retained for every attempt, success or not: **the RAW completion as it came back, and the TRANSFORMED
candidate** the system actually wrote to disk, both stored, so the system's own contribution
(truncation, containment, splicing) is visible and never mistaken for the model's output.

## 5. FAILURE

If the budget runs out, the result says exactly: **"No success within the declared assistance budget."**
Followed by the ledger: how many calls, how many interventions, what each was, where each attempt
stopped, and what the last failing step was. No inference about capability. No claim about other
interfaces.

## What no outcome here can establish

- A capability ceiling, in either direction.
- Anything about transfer. Page A is a development case by the time it has been used, and page B is
  sealed precisely because this experiment will contaminate anything it touches.
- Anything about automated guidance. A success here is a TARGET for automation, not an instance of it.
  The distinction is the whole point: ASSIST-1 established attainability on the farm page with 7
  recorded interventions, and turning those into an automatic policy took four further experiments.
