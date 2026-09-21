# REACH-1 — the reachability proof radius (frozen 2026-09-21, before any measurement)

Supersedes the call-hop measurement named in `H-INFO_OPERATIONAL.md`. That measurement was a
proxy; this is the object it was proxying for.

## The scope ladder (installed as vocabulary, not as a claim)

    syntactically possible
        -> function-domain possible
            -> caller-producible
                -> program-reachable
                    -> environment-reachable
                        -> observed in execution

**Evidence at one level does not license the next.** The `validate_cuda("")` retraction was
exactly one unjustified promotion: level 2 evidence reported as a level 4 claim. Note the quantifiers
are genuinely different —

    LOCAL     exists x in the nominal function domain : bad behavior occurs
    PROGRAM   exists an execution of the actual program : bad behavior occurs

The second needs a witness that the program can generate the decisive input. No detector in this
branch has ever carried one.

## The question

> What is the minimal evidence closure required to lift a function-scoped existential claim into a
> program-scoped reachable claim, and where does that closure reside relative to the decision site?

## The measurable

For each case: `D` = decision site, `S*` = decisive state. `E` = the smallest set of program facts
needed to establish `REACHABLE(S*)` or `UNREACHABLE(S*)`.

Recorded **separately**, because the whole point is that they may come apart:

    STRUCTURAL   call-graph radius from D
                 number of distinct files crossed
    COMPLEXITY   number of definitions / configuration sources required
                 number of control-flow and data-flow edges traversed
                 whether the closure terminates in an explicitly trusted primitive
    BLOCKING     whether dynamic dispatch, config, environment, network, plugin dispatch or
                 reflection prevents the proof at all

## Three-valued output, because exact reachability is not decidable in general

    REACHABLE     a construction path exists, with the facts that show it
    UNREACHABLE   an upstream constraint excludes S*, with the fact that excludes it
    UNKNOWN       the closure hits a blocking source

`UNKNOWN` is a **result**, not a failure of the harness, and must never collapse to either of the
other two. This is the same discipline as `unmeasured` in the load-sampling protocol.

## Stopping rule, frozen before construction

A backward trace on a value stops when it reaches, and only when it reaches:

    a literal                       -> fact recorded, branch settled
    a trusted primitive             -> the frozen list is exactly:
                                       os.environ.get, dict.get, the `or` operator's fallback,
                                       a default parameter value, a module-level constant
    a blocking source               -> branch UNKNOWN, blocking kind recorded
    a fact already in the closure   -> cycle, branch closed, no new facts

Nothing is added to the trusted list after a measurement begins.

## Predictions

**R1 — the dissociation, and the reason this is a descent and not a rename.** Structural distance
and proof complexity come apart in both directions on the case set:

    (a) at least one case has LARGE radius and a SETTLED verdict reached through a short closure
        terminating in a trusted primitive;
    (b) at least one case has radius <= 1 and verdict UNKNOWN.

FALSIFIER: verdicts are monotone in radius across every case. **If R1 fails, radius is an adequate
proxy, "reachability proof radius" earns no standing over it, and the refinement is discarded.**
This is the discrimination rule applied to my own new construct.

**R2 — the operational payload.** In a majority of cases the closure extends **beyond the
detector's locality boundary**, frozen here as *the body of the function containing D*.
FALSIFIER: most closures are settled inside that body.

**R3 — the line-killer.** If every case is settled inside the function body, reachability is local,
no certificate architecture is needed, and the whole line dies. Recorded as a live outcome.

## The architectural consequence, stated in advance so it cannot be invented from the results

If R2 holds, a detector must emit **two** outputs and not one:

    LOCAL     "under input state S*, function F exhibits property X"
    PROGRAM   "S* is reachable in program P, therefore P can exhibit X"

with `PROGRAM` **unemittable** unless a reachability edge is attached. Note the narrower
conclusion this licenses — not *local screening can never license program claims*, but:

> **A purely local detector cannot license program-level claims from local evidence alone. It can
> consume a separately established reachability certificate.**

That keeps the architecture compositional: `local hazard + reachability witness -> program-level
candidate`. Nothing is installed by this preregistration.

## Case set

Calibration, outcomes already known, therefore **retrospective and non-probative**: the three
Stage B cases frozen at adbee47, plus the MoneyPrinterTurbo font specimen.

Prospective: cases drawn by the frozen `case_select.py` rule from the same PyTorch tree, **not
previously diagnosed**, measured after R1/R2/R3 are frozen. Only the prospective set scores.

## Rules

Target trees stay read-only. The trusted-primitive list is frozen above. A closure that the harness
cannot complete is `UNKNOWN` with the blocking kind recorded, never a settled verdict. If the
harness ends up measuring radius alone and reporting it as proof complexity, that is the seventh
instance of the substitution pattern and is scored as an apparatus failure, not a result.
