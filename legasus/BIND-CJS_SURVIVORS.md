# BIND-CJS step 12 — murder the survivors (frozen 2026-09-21 06:25)

Step 11 left five propositions alive. Each survived **one** contrast, which makes them
not-yet-killed rather than established. This expedition attacks all five, and the attacks are
**false-positive** attacks: construct a world where the proposition is FALSE and the frozen
decider still answers TRUE.

A proposition that a decider affirms in a world where it is false is not identifiable by that
decider, whatever it did in step 11.

## The five hostile worlds

| # | Proposition (step 11 decider) | The world built against it |
|---|---|---|
| S1 | *a request was issued* — a request record exists | The request channel is **pre-seeded by another writer** before the run; the witness issues nothing. A record exists; no request was made by the intervention. |
| S2 | *module M was served* — the mechanism log holds a served record | The witness calls `require.resolve` on the target and **never loads it**. The hook answers the resolution and logs `served`; nothing is supplied to any execution. (Grounded in step 7's measured 10 served records for 5 evaluations.) |
| S3 | *an execution occurred outside the witness* — a marker with a non-witness role | The witness **labels itself** `worker`. Role is a self-reported env field; no external process exists. |
| S4 | *the execution followed the request* — execution rank > request rank | The worker **begins its operation before** the request and loads the target after. The observed event follows; the execution does not. |
| S5 | *every observed execution used M* — observed identities = {MUTANT} | An **impostor** file, not the requested mutant, self-identifies as `MUTANT` and is served. Identity is self-reported. |

## Predictions

**M1–M5: all five deciders answer TRUE in their hostile world, and all five propositions die.**

That is a deliberately bold slate. FALSIFIER for each: the decider answers false, or the world
cannot be constructed as described. Any survivor of *this* round is more interesting than the
casualties, because it will have survived two genuinely different attacks.

**M-CTL (must-fire negative).** For each proposition, the step-11 World− is re-run unchanged and
the decider must still answer FALSE there. A decider that answers true everywhere would produce
five false "deaths" and prove nothing.

## What S4 is really testing, and what it may not settle

"Followed" is not one proposition. Start, completion, observation, and marker emission are four
different events, and step 11's decider silently used the last. S4 constructs a world where they
disagree. It is **not** authorised to decide which reading is correct — only to establish whether
the distinction has consequences. If the decider cannot tell them apart, the finding is that
"followed the request" is underspecified in this evidence, not that any particular reading wins.

## Rules

- No repair. A proposition that dies, dies; no field is added to rescue one.
- No naming. If a theme appears across the casualties it is recorded as an observation, not
  promoted to a principle, and certainly not to a law.
- The step-11 deciders are used **verbatim**. Changing a decider to survive an attack would be
  the defect this whole sequence exists to prevent.
- Mechanism (`legasus/cjs-preload.mjs` @ e41c1e3) and BIND's interpretation untouched.
- Every finding is *for these constructed worlds, under this observation model*. Not a theorem.

## Process hygiene

Every spawned pid recorded and swept BY PID, result reported. Never by image name.
