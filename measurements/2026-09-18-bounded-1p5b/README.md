# PREREGISTRATION — can bounded authority make the 1.5B execute a contract it ignored?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What the previous run established

Giving the 1.5B a correct semantic ruling in prose did not make it execute that ruling. The failure
topology was decisive and was **not** about precedence:

    scope creep          6/10 BASELINE-A invented `return "large"`, destroying a preserved behaviour
    no-op                6/10 CONTRACT-A returned the original function unchanged
    source-order inertia `contested=zero` dominated both arms and both cases

> Intent was successfully represented. It was not reliably converted into action.

## The question now

> **Can deterministic authority enforcement make the same 1.5B execute a semantic contract it already
> failed to obey voluntarily?**

Not a smarter prompt. **Less authority.**

## Three arms

| Arm | What the model is responsible for |
|---|---|
| `BASELINE` | rewrite the whole function from an ordinary task statement |
| `CONTRACT` | rewrite the whole function, given the derived semantic contract |
| `BOUNDED` | write **one guard and its return**, nothing else |

`BASELINE` and `CONTRACT` are the arms already run and are **not re-run**; their recorded numbers
stand. `BOUNDED` is the new intervention, run under identical model, temperature and token budget.

## What moves from the model to Legasus in the bounded arm

    Legasus   scope, placement, preservation, precedence, authority boundary
    1.5B      write one bounded semantic fragment

Placement is derived from the precedence ruling, which 12C derived from the specification — never from
the reference. *If the existing behaviour wins the overlap, the new guard must not precede it; if the
requested behaviour wins, it must.* Choosing one of the legal realizations is an `ENGINEERING_CHOICE`
and is labelled as one; the model is not asked to make it.

The model never sees the function it is editing assembled, and cannot return it.

## Prediction, written before running

> If semantic intent is correctly derived and **execution authority** is the binding constraint, then
> mechanically bounded generation should reduce no-op and scope-creep failures and improve verified
> conformance relative to `CONTRACT` whole-function generation.

**This is not predicted to win.** If the bounded model still ignores a one-line local obligation, that
isolates something narrower and more serious: the 1.5B struggles with *local instruction execution*,
not merely with global coordination. That outcome is as informative as success and will be reported
with the same weight.

## Endpoints, fixed now

    PRIMARY     conformance by EXECUTION, per arm per case
    TAXONOMY    preserved for every sample, because the tally carried the last run:
                  delta made?           did the requested behaviour appear at all
                  preservation kept?    negative and large-input results unchanged
                  scope violation?      any behaviour nobody requested
                  precedence correct?   the contested input resolves to the ruling
                  parsed / loaded?
    GUARD       leakage scan over every prompt; any hit voids that prompt

Conformance is scored by running the produced code. No reference comparison, so two structurally
different correct answers both count.

## Power

10 samples per case for the new arm, 2 cases = **20 generations**. A mechanism check, not a rate
estimate. Against the recorded `CONTRACT` figures of 2/10 and 1/10, only a large shift is readable; a
one-or-two sample difference is inconclusive and will be reported as such.

## The observation deliberately NOT built on

`small=positive` appeared 6/10 in `CONTRACT-A` and 0/10 in `BASELINE-A`. It suggests the abstract
obligations package may perturb interpretation, but n=10 cannot separate that from noise or prompt
shape. It is preserved as an observation and is not the design of this experiment.

## Cost and safety

T4, weights in-container, `scaledown_window` 5 minutes, `min_containers` 0, hard 30-minute cap. Stop
with `modal app stop --yes` and verify with `modal app list`. AC power confirmed before the window.
**Rule 3:** the endpoint must name the exact model before any generation runs.
