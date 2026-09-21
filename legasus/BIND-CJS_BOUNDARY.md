# BIND-CJS step 11 — the epistemic boundary of a single run (frozen 2026-09-21 05:50)

## Why this is not candidate #6

Six candidate membership rules have died. Step 10 changed the question: in C-REQ and C-A the
entire recorded evidence was observationally identical while responsibility differed. That is
not a bad classifier; **the distinction was absent from the classifier's input.**

So this expedition stops searching for a rule and instead measures the **resolution of the
instrument**: for each proposition a single run might claim, construct two worlds that differ in
that proposition's truth and ask whether the recorded evidence distinguishes them.

## The method

For each proposition P:

    construct World+ (P true) and World- (P false), differing in P and as little else as possible
    run both under identical instrumentation
    apply a DECIDER over recorded fields only - stated per proposition, in advance
    compare the two NORMALIZED evidence bundles

Three possible outcomes, and they are not the same:

    IDENTIFIABLE              the decider says true for World+ and false for World-
    NOT_IDENTIFIABLE_STRONG   the normalized bundles are IDENTICAL - no classifier over these
                              fields could distinguish them, not merely this one
    NOT_IDENTIFIABLE_WEAK     the decider fails but the bundles differ somewhere - this decider
                              is insufficient; something in the record might still bear on it

The strong form is the one that matters, and it is the form step 10 produced.

**Normalization, frozen:** pids are replaced by role labels, absolute timestamps by rank order,
absolute paths by basenames. Without this, two runs always differ and every proposition would
look identifiable. The normalization is stated here so it cannot be tuned afterwards.

## The propositions, and their preregistered expectations

These are **candidates to attack**, not a taxonomy being confirmed. An expectation is what I
predict, not what the row is.

| # | Proposition | Decider over recorded fields | Expected |
|---|---|---|---|
| P1 | a request was issued | a request record exists | IDENTIFIABLE |
| P2 | module M was served | the mechanism log holds a served record | IDENTIFIABLE |
| P3 | an execution occurred outside the witness | a marker with a non-witness role exists | IDENTIFIABLE |
| P4 | that execution followed the request | execution rank > request rank | IDENTIFIABLE |
| P5 | every OBSERVED execution used M | the set of observed identities is exactly {M} | IDENTIFIABLE |
| P6 | **no unobserved execution occurred** | *no field bears on it* | **NOT_IDENTIFIABLE_STRONG** |
| P7 | the request was responsible for the execution | any field separating C-REQ from C-A | **NOT_IDENTIFIABLE_STRONG** |

**P7 is a known negative, deliberately included.** Step 10 already established it. If the method
fails to reproduce that result, the method is broken and nothing else here may be read.

**P6 is the new attack.** World- contains an execution that occurs with the observation channel
disabled, so it writes no marker. If the two bundles are identical, then *"I observed every
relevant execution"* is not identifiable from a single run — and every proposition quantified
over "all executions" silently inherits that limit.

## The trap this preregisters against

**Failure to establish a stronger proposition must not destroy a weaker one supported by the same
run.** If P6 and P7 die while P1-P5 survive, the correct reading is that the run establishes
P1-P5 and does not establish P6-P7 — not that the run "tells us nothing". Over-correcting from
false certainty into useless skepticism would be its own failure, and the P1-P5 rows exist
precisely to make that visible rather than rhetorical.

## What this expedition may not do

- It may not propose a membership rule, an interface, or a repair for anything that dies.
- It may not add a field to rescue a proposition. A proposition that dies, dies.
- It may not treat my expectation column as the result. Every row must be earned by its worlds.
- Mechanism (`legasus/cjs-preload.mjs` @ e41c1e3) and BIND's interpretation stay untouched.
- It may not claim a general theorem. Every finding is *for these constructed worlds, under this
  observation model* — an identifiability failure, not an impossibility proof.

## Process hygiene

Every spawned pid recorded and swept BY PID, result reported. Never by image name.
