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

---

# RESULT — bounded authority, Qwen2.5-Coder-1.5B on Modal T4

Rule 3 verified before generation. Assembly control verified offline before the window. Same model,
same temperature, same endpoint as the previous run. GPU window under five minutes, stopped and
verified.

    arm        case A     case B     what the model was responsible for
    BASELINE    3/10       2/10      rewrite the whole function from a task statement
    CONTRACT    2/10       1/10      rewrite the whole function, given the semantic contract
    BOUNDED   10/10      10/10      write one guard and its return

    BOUNDED detail, both cases:  authorized 10/10   delta 10/10   preserved 10/10
                                 precedence 10/10   scope violations 0

The preregistered prediction was that bounded generation should reduce no-op and scope-creep failures.
Both went to zero.

## The finding is about the SYSTEM, and the caveat is not optional

The model produced **the identical fragment 20 times out of 20**:

    if n < 10:
        return "small"

and the bounded prompt says *"it must produce "small" when n < 10"*. That fragment is close to a
transcription of its own instruction.

> **This is not evidence that the 1.5B became better at anything.** It is evidence that the system
> succeeds when the model's residual job is small enough to be reliable.

Stating it the other way would be the most tempting misreading available, and it would be false.

## What IS strong, and is the actual result

**Case A and case B received byte-identical prompts.** Same condition, same value, same two lines back
from the model. Every difference in the finished program came from Legasus:

    case A   ruling: existing > requested   ->  placed after the zero guard   ->  classify(0) == "zero"
    case B   ruling: requested > existing   ->  placed before the zero guard  ->  classify(0) == "small"

**The model contributed nothing to the semantic distinction, and the distinction was still correct in
both directions, ten times out of ten.** Intent was derived from the specification by 12C, converted to
a position mechanically, and executed without the model being told - or needing to understand - which
behaviour wins.

That is the thing the previous run showed prose could not achieve: the same ruling, stated to the model
in words, produced it 1 time in 10.

## The failure that moved

    scope creep      6/10 -> 0/10      no unrequested behaviour can be added: unauthorized output is
                                        refused, not repaired
    no-op            6/10 -> 0/10      the model cannot return the function unchanged, because it is
                                        never given the function
    source-order     dominant -> n/a    placement is not the model's decision

Each disappeared because the authority to commit it was removed, not because the model improved.

## Honest limits

- **The fragment task is near-transcription.** A stronger arm would require a fragment the prompt does
  not contain - a condition the model must derive, or a value it must compute. Until that runs, this
  measures reliability at a trivial residual job.
- **20 generations.** A mechanism check. The effect is large enough to read (3/20 against 20/20 on the
  same end goal) and the sample is still small.
- **Zero variance is itself a signal to distrust.** 20 identical outputs at temperature 0.6 means the
  task left nothing to vary, which is consistent with transcription.
- `BASELINE` and `CONTRACT` were **not re-run**. Their recorded figures stand as history.

## Where this leaves the thesis

The bottleneck named after the previous run - *model execution of the bounded obligation* - is not
where the system now fails, because the obligation was made small enough that execution is not in
question. The open question moved rather than closed:

> How much residual generation can the model be given before reliability collapses again?

That is a dose-response question, and it is the next experiment: widen the fragment step by step -
condition stated, then condition derived, then value computed - and find where 10/10 breaks.
