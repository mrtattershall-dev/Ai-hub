# BIND-CJS step 11 result — the single run's epistemic boundary, carved by construction
2026-09-21 06:05. Preregistration `legasus/BIND-CJS_BOUNDARY.md` (5d47d25), frozen before the
fixture existed. Mechanism `legasus/cjs-preload.mjs` @ e41c1e3, unchanged. Hygiene: 7 pids
recorded, 0 alive at sweep.

## Method control

**P7 (responsibility) independently reproduced step 10's result** — `NOT_IDENTIFIABLE_STRONG`,
from a different fixture, a different driver and a different normalization. The method can
detect a known identifiability failure, so the rest is readable.

## Results — every row earned by two constructed worlds

| # | Proposition | decider(+/−) | bundles identical | status |
|---|---|---|---|---|
| P1 | a request was issued | true / false | no | **IDENTIFIABLE** |
| P2 | module M was served | true / false | no | **IDENTIFIABLE** |
| P3 | an execution occurred outside the witness | true / false | no | **IDENTIFIABLE** |
| P4 | that execution followed the request | true / false | no | **IDENTIFIABLE** |
| P5 | every **OBSERVED** execution used M | true / false | no | **IDENTIFIABLE** |
| P6 | no **UNOBSERVED** execution occurred | — | **yes** | **NOT_IDENTIFIABLE_STRONG** |
| P7 | the request was responsible for the execution | — | **yes** | **NOT_IDENTIFIABLE_STRONG** |

All seven matched their preregistered expectation.

## The boundary, stated as narrowly as the evidence allows

**For these constructed worlds, under this observation model**, a single run establishes that a
request was issued, that a module was served, that an execution occurred, its order relative to
the request, and the identities of the executions it observed. It does **not** establish that
its observations are complete, nor that its request was responsible for what followed.

## P5 and P6 are the pair that matters

P5 survives **only because it is quantified over observations**. P6 shows the quantifier cannot
be widened: in P6's World−, a process executed the target with the observation channel removed,
and the recorded bundle is **byte-identical** to a world where nothing executed at all.

So *"every execution used M"* is not a claim this evidence supports; *"every execution **I
observed** used M"* is. Every proposition quantified over "all executions" silently inherits
P6's limit, and the difference between those two sentences is the difference between a claim the
run entitles and one it does not.

## The preregistered trap, checked

Failure of the stronger propositions did **not** destroy the weaker ones. Five of seven survived
in the same runs that killed two. The correct reading is *this run establishes P1–P5 and does not
establish P6–P7* — not "the run tells us nothing". The P1–P5 rows existed precisely to make that
distinction measurable rather than rhetorical, and they did their job.

## Limitations, recorded rather than smoothed

- **P2's contrast is not minimal.** Its World− removes the mapping, which also changes the
  identity the witness loads. The decider consults only the served count, so the row stands, but
  the two worlds differ in more than the proposition. A minimal contrast would serve an identity
  copy instead.
- **`NOT_IDENTIFIABLE_STRONG` is relative to the recorded fields**, which are this apparatus's
  choice. It says no classifier over *these* fields can separate the worlds. It is an
  identifiability failure under this observation model — **not an impossibility proof**, and it
  must never be quoted as one.
- Seven propositions, chosen by me. The set is a start, not a taxonomy.

## What was not done

No membership rule, no interface, no repair, no field added to rescue P6 or P7. Nothing was
named. The mechanism is untouched.

## Where this leaves the work

    six candidate membership rules        dead, none replaced      (steps 7-10)
    the single run's boundary             carved, 5 in / 2 out     (step 11)

The question is no longer "which rule decides membership" but "how strong a proposition does this
evidence warrant". That reframing was earned by construction — every row above is two worlds and
a comparison, not an argument.

## Next falsification, not started

Widen the proposition set and attack the survivors. P1–P5 survived *one* contrast each; a
proposition that survives one world is not established, only not-yet-killed. P4 in particular
looks fragile: it was tested with a clean ordering, and clock skew across processes, or two
executions bracketing the request, may break it. Each survivor deserves its own hostile world
before any of it is treated as a foundation.
