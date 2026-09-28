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

---

# RESULT — the responsibility ladder

Rule 3 verified. All six rung/case apparatus controls verified offline before the window. Same model,
temperature and task throughout. GPU window under five minutes, stopped and verified.

    rung  case  verified  unauth  no-op  scope  semantic  variance
    R0    A      10/10       0      0      0       0         1      (measured previously)
    R0    B      10/10       0      0      0       0         1
    R1    A       0/10      10      0      0       0         1
    R1    B       1/10       7      1      1       2         4
    R2    A      10/10       0      0      0       0         1
    R2    B      10/10       0      0      0       0         1
    R3    A       3/10       0      0      1       6         4
    R3    B       7/10       0      0      0       1         6
    R5    A       3/10 and 2/10 across two prompt styles   (measured previously)
    R5    B       2/10 and 1/10

## The prediction was half right, and the half that failed is the useful half

I predicted R1 and R2 would stay high and R3 would fall sharply. **R3 fell exactly as predicted and
for the predicted reason.** R1 did not stay high — it collapsed below both of its neighbours.

**A non-monotonic ladder is the signature of a confound, not a dose-response curve.** R1 is supposed to
be *less* demanding than R2, so R1 < R2 means the rungs differed in something other than
responsibility. They did: R1's prompt presents the domain as a **data sheet**
(`upper bound: 10 (exclusive)`) while R0, R2 and R3 use English. The ladder varied prompt FORMAT as
well as authority.

## What R1 actually shows, once format is separated from semantics

Post-hoc on the saved raw outputs, clearly labelled — the preregistered primary stands as recorded:

    R1 case A   correct condition, rejected on format only : 5      wrong condition: 5
    R1 case B   correct condition, rejected on format only : 4      wrong condition: 6

    conditions the model produced from "upper bound: 10 (exclusive)":
      A:  n > 10  (5)   n < 10  (5)
      B:  n > 10  (3)   n <= 10 (2)   n < 10 (4)   n <= 10 and n > 0 (1)

Two distinct causes, and both matter:

1. **Apparatus over-strictness.** The acceptor required the guard and return on separate lines; the
   model wrote `if n > 10: return "small"` on one. Roughly half the rejections were format alone.
2. **A real finding.** Given the bound as structured data, the 1.5B inverted it — `n > 10` for an
   *upper* bound — in half the samples. Given the same bound in English (`values below 10`, rung R2)
   it produced `n < 10` **20 times out of 20**.

> Handing the model a normalized specification made it *worse* than handing it the sentence.

That is the opposite of what "less responsibility is easier" predicts, and it is an interface finding
rather than a capability one.

## R3 is the boundary, and the failure mode changes there

R3 is the first rung that returns **integration** authority: the model sees a region of real code and
returns its replacement. Verified drops to 3/10 and 7/10, and — more informative — the failure mode
changes:

    R0, R2   failures are zero
    R1       failures are format and condition
    R3       failures are SEMANTIC: 6/10 in case A

The case-A mechanism is visible in the output: the model returned

    if n < 10:
        return "small"

as the replacement for a region **containing the zero guard** — deleting the behaviour it was told to
preserve, so `classify(0)` became `"small"`. A correct fragment, destructively integrated.

Case B is easier for the same reason it was easier all along: there the new behaviour is *supposed* to
win, so dropping the zero guard is closer to correct.

## The shape

    transcription (R0)          20/20
    derive guard from English   20/20        R2 - and this is NOT transcription: the prompt
                                             contains "below 10", the model must render `n < 10`
    normalized data (R1)        VOID as a rung - format confound, with a real inversion finding inside
    region integration (R3)     10/20, failure mode turns SEMANTIC
    whole function (R5)          5/20 and 3/20

**The collapse coincides exactly with the return of integration authority**, and when it collapses the
model starts making precedence errors again — the very failures the bounded arm had eliminated.

## Honest limits

- **R1 is void as a rung.** It cannot be reported as a point on the responsibility axis. Re-running it
  in English form is a separate, clean experiment.
- **10 samples per cell.** A cliff this size is readable; the A/B asymmetry at R3 (3 vs 7) is not
  separable from noise at this sample.
- **R4 was deferred before the run** and remains so.
- The apparatus control passed at every rung, so no shortfall here is the harness.

## What this changes

The next rung to build is not R4. It is **R3 with the preserved region protected** — the region handed
to the model excludes the guard it must not touch, so integration authority is returned *without*
deletion authority. If that restores 10/10, the boundary is not "integration" but specifically
"authority to delete what already exists", which is a much sharper and more actionable statement.
