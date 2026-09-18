# PREREGISTRATION — the responsibility ladder

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What is already established, and what it is not

    whole-function baseline    5/20 verified
    semantic contract          3/20 verified
    bounded residual job      20/20 verified
    scope creep               present -> 0
    no-op                     present -> 0
    semantic A/B distinction  model failed -> Legasus handled it

The bounded arm's model output collapsed to one identical fragment 20/20 times, and the prompt
contained that fragment. So the established claim is narrow and precise:

> There exists a sufficiently small responsibility allocation under which this previously unreliable
> model/task combination becomes completely reliable in this sample.

That is the **endpoint of a curve**, not the curve. It does not show the 1.5B can perform arbitrary
bounded behavioural edits.

## The question

> **How much responsibility can be left inside the 1.5B before reliability collapses?**

One responsibility is revealed at a time. Everything else — task, model, temperature, token budget,
scoring — is held identical, so a change in outcome is attributable to the rung and nothing else.

## The ladder, frozen

| Rung | What the model must supply | Status |
|---|---|---|
| `R0` | transcription — the exact condition and result appear in its own prompt | **measured, 20/20** |
| `R1` | syntax — given the normalized domain and result as *data*, translate to code | new |
| `R2` | local semantics — given the intent contract, derive the guard and return; placement still owned by Legasus | new |
| `R3` | bounded integration — given a small authorized region of real code, produce the edited region | new |
| `R4` | multi-operation transaction — several bounded pieces, Legasus owns ordering | **deferred, see below** |
| `R5` | whole-function authority | **measured, 5/20 and 3/20** |

**R4 is deferred and the reason is recorded rather than skipped.** This task has one operation.
Running R4 would require a different task family, which would confound *rung* with *task* — the one
thing this ladder exists to separate. It needs its own family and its own window.

## What is measured at every rung

Not just "is it still 10/10". The shape is the result:

    verified rate          conformance by execution
    scope violations       behaviour nobody requested
    no-op rate             the requested change absent
    semantic errors        the contested input resolves against the ruling
    output variance        distinct outputs across samples - collapse to one string is itself a signal
    unauthorized rate      output outside the authorized shape; refused, never repaired

The last is this system's analogue of a repair/retry rate. Repairing an unauthorized output would move
authority back to the apparatus and make the rung unreadable.

## Prediction, written before running

> Reliability will not decline smoothly. I expect `R1` and `R2` to stay high — both keep placement and
> scope outside the model — and `R3` to fall sharply, because it is the first rung that returns
> *integration* authority: the model sees real surrounding code and can once again delete, duplicate or
> extend it.

**A smooth decline would falsify this** and would be the more interesting outcome, because it would
mean responsibility trades off continuously rather than at a boundary.

**No rung is predicted to win.** If `R1` already collapses, the reliable region is narrower than the
bounded arm suggested, and R0's 20/20 was transcription and nothing more.

## Power

3 new rungs x 2 cases x 10 samples = **60 generations**. A mechanism check. A cliff of the size
predicted (near-perfect to near-zero) is readable at this sample; a gentle slope is not, and a
difference of one or two samples between adjacent rungs will be reported as inconclusive.

## Apparatus control, before the window

Each rung's assembly is verified offline with a **perfect** model output, proving the rung can reach
10/10 if the model cooperates. Without that, a low score is ambiguous between model failure and broken
harness — the control that made the bounded arm readable.

## Cost and safety

Same T4 app, `scaledown_window` 5 minutes, hard 30-minute cap, stop with `--yes` and verify. AC power
confirmed before the window. **Rule 3:** the endpoint must name the exact model before any generation.
