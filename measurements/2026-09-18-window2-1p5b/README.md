# PREREGISTRATION — the visibility ladder, repaired

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

Revision 1 (`measurements/2026-09-18-window-1p5b/`) stands exactly as published. Nothing here rescores
it.

## What revision 1 left open

Its `W0` rung is **void**. With zero source lines visible the prompt never said the parameter was
called `n`, so the model wrote `value < 10`, `size < 10`, and invented whole functions to hang a guard
on. That removed a **current program fact**, not a quantity of visible source, so it cannot be a point
on the visibility axis.

Two readings of `W0`'s collapse survive revision 1 and it cannot separate them:

1. the model needed the **missing fact**, and will be fine once it has it
2. the presence of **any real context** suppresses the urge to write a function, independent of facts

Revision 1 also found the opposite of its own prediction: refusals *rose* as the window narrowed, and
all 14 whole-function emissions sat at `W0`. Whether that survives a sufficient prompt is the question.

## The one change

Every arm now carries the parameter name as a **rendered program fact**:

    The function takes one parameter, named n.

Legasus reads it from the source. It is not a hint about the answer, and it is **identical in every
arm** — redundant at `FULL`, where the source shows it anyway — so the window remains the only
variable.

## Three controls now, not two

Revision 1 passed an assembler control on an arm the model could not possibly satisfy.

    can the apparatus express a pass?        assembler control
    can the apparatus express a failure?     inversion and off-by-one controls
    can the model obtain the facts?          SUFFICIENCY control      <- new, and revision 1 is why

All three pass for all four arms and both cases. The sufficiency control **earned its place before
this was committed**: the first draft of the fact line derived the parameter through a regex that a
shell-quoted `node -e` had silently corrupted, so the prompt read *"named undefined"* — and the
sufficiency control caught it, reporting that `n` was never supplied. It is now also asserted at
derivation, because a derived fact that comes out `undefined` and is rendered anyway is this project's
signature silent failure.

## Arms

    W0    the slot alone, facts supplied          0 units
    W1    one statement either side               2 units
    W2    two statements either side              4 units
    FULL  the entire function                     9 units

4 arms x 2 cases x 10 samples = **80 generations.** Same model, temperature, token budget, acceptance
policy, assembler, verifier and probe set as revision 1, so `W1`, `W2` and `FULL` double as a
cross-run replication of revision 1's 13/20, 13/20 and 17/20.

## Prediction, written before running

> `W0` rises sharply from its void 0/20 — it must, since its authorized outputs previously could not
> even load. Beyond that I predict **no monotone relationship** between window size and verified rate:
> revision 1 already falsified the visibility hypothesis in the direction I expected it to hold, and I
> am not predicting a reversal. Commit integrity stays at 1.00 everywhere the facts are present.
>
> **The discriminating measurement is whole-function emission at `W0`.** If it drops to near zero, the
> missing fact explains revision 1's collapse and reading 1 wins. If it stays high while the arm still
> loads, then context presence — not facts — suppresses the function affordance, and reading 2 wins.

**No arm is predicted to win on generation capability**, and `W0` reaching ceiling would be the
strongest result available here: it would mean the floor of this system is *no visible source at all*,
collapsing the visibility axis into a fact-sufficiency question.

If commit integrity falls below 1.00 at any rung, that is the most important line in the result
regardless of anything else, because 51 of 51 across two prior families is the claim most at risk of
being a small-sample artifact.

## Power

Cell noise is about ±2 at n = 10 from ladder 2 and revision 1. Differences of one or two samples
between adjacent rungs are not readable and will be reported as inconclusive. `W0` against `FULL`, and
`W0`'s whole-function count against revision 1's 14, are the contrasts this sample can carry.

## Cost and safety

Same T4 app under tatte's standing authorization ("Use the t4 as needed", recorded in `COORD.md`).
`scaledown_window` 5 minutes, `min_containers` 0, hard 30-minute cap, AC power confirmed, stop with
`--yes` and verify. **Rule 3** before any generation.

---

# RESULT — the visibility ladder, repaired

Rule 3 verified. All three controls passed for all four arms and both cases, sufficiency included. GPU
window 10:21:57Z to ~10:25Z, stopped and verified: seven `legasus-1p5b` rows, **zero** not `stopped`.

    arm   case  units  verified  refused  whole-fn  repeated-line  P(correct)  P(correct|committed)
    W0    A       0      3/10       7        6           0            0.30           1.00
    W0    B       0      2/10       8        8           0            0.20           1.00
    W1    A       2      9/10       1        0           0            0.90           1.00
    W1    B       2      2/10       8        0           6            0.20           1.00
    W2    A       4      4/10       6        0           6            0.40           1.00
    W2    B       4      5/10       5        0           3            0.50           1.00
    FULL  A       9      7/10       3        0           3            0.70           1.00
    FULL  B       9      4/10       6        1           5            0.40           1.00

## The preregistered discrimination is decisive, and it is reading 2

The question was whether `W0`'s collapse in revision 1 came from the **missing fact** or from the
**absence of context**. The preregistered discriminator was whole-function emission at `W0`.

    whole-function emissions at W0, revision 1 (fact missing)    14 / 20
    whole-function emissions at W0, revision 2 (fact supplied)   14 / 20      p = 1.000

**Unchanged. Exactly.** And the fact repair plainly worked — revision 1 produced `def get_size(size):`
with an invented parameter, revision 2 produces `def get_size(n):` using the supplied name correctly,
and every `W0` output that reached the verifier now loads and passes.

> Supplying the missing fact fixed what the fact controlled and **did nothing whatever** to the
> function affordance. Context presence, not information, is what suppresses it.

Across the whole family that separation is stark:

    whole-function emissions   W0 (no context)  14/20      every other arm  1/60     p = 3.5e-10

## The two failure modes sit on opposite sides of the visibility axis

This is the structure the ladder actually found, and it is not the one it was built to look for:

    arm     whole-function refusals     repeated-a-fixed-line refusals
    W0             14                            0
    W1              0                            6
    W2              0                            9
    FULL            1                            8

With no source, the model **invents a function**. With source, it **echoes a line it was told not to
touch**. Neither mode is a matter of degree along a single axis, so there is no "right amount of
visible source" to read off these arms — there is a trade between two distinct failures, and the
apparatus refuses both.

## Commit integrity, now at a sample worth quoting

    authorized outputs, this family    36
    of those, verified                 36        P(correct | committed) = 1.00 in all eight cells

Every authorized output in every cell was the identical correct fragment `if n < 10: return "small"`.
With revision 1's 43/43 and ladder 2's `R3P` 8/8:

    87 committed outputs, 87 correct        one-sided 95% lower bound on the rate: 0.966

Generation capability swung from 0.20 to 0.90 across these cells. **Commit integrity did not move
once.** Every bit of the variance was absorbed by refusals, which is precisely what the authority
boundary is for, measured across three families, two functions and two window regimes.

## No monotone visibility relationship — as predicted this time

    W0  5/20      W1 11/20      W2 9/20      FULL 11/20

Against a cell noise of about ±2 at n = 10, `W1` through `FULL` are indistinguishable from each other.
The preregistration predicted no monotone relationship and did not predict a reversal; that held.

The case asymmetries are larger than the arm differences — `W1` case A 9/10 against case B 2/10 — and
nothing in this design explains them. They are recorded, not interpreted.

## One unplanned cross-run observation, labelled as such

Revision 2 differs from revision 1 by **one sentence**: the rendered parameter-name fact, which is
redundant at every arm that shows the source. On the three arms both revisions share:

    repeated-a-fixed-line refusals    revision 1   6 / 60
                                      revision 2  23 / 60      p = 5.0e-4
    FULL verified                     revision 1  17 / 20
                                      revision 2  11 / 20      p = 0.082

This is a **cross-run comparison, not a controlled contrast**, and it was not preregistered. But the
direction is consistent on all three shared arms and the mechanism is specific: adding one redundant
sentence nearly quadrupled the rate at which the model echoed a line it was forbidden to touch. This
project's ledger already contains one instance of a single well-meant sentence taking a gate from 4/4
to 0/4. It is recorded here as a hypothesis with a named next test, not as a finding.

## Honest limits

- The cross-run comparison above is exploratory. A controlled version varies the fact line within one
  window, holding everything else fixed.
- Case asymmetries exceed arm differences and are unexplained.
- `W0` is now a valid rung but a poor one: 5/20, and 14/20 of its samples never reach the verifier.
- One task, one function, one operation. `BLOCK` omitted with its reason recorded; `R4` still deferred.

## What this changes

1. **The visibility axis is closed as a dose-response question.** There is no monotone curve to find
   between two statements and nine. The interesting variable was never the amount of source — it is
   whether there is *any*, because that single bit flips which failure mode the model exhibits.
2. **The next controlled experiment is the redundant sentence**, not another window size: same window,
   fact line present or absent, measuring repeated-line refusals. It is the cheapest test available
   and it bears directly on how Legasus should render obligations.
3. **Commit integrity at 87/87 is now the project's most robust empirical claim** — stronger than any
   statement about what the model can generate, and it belongs in `LEGASUS.md` as a measured property
   of the authority boundary rather than a design intention.

---

## SCOPE OF THIS CONCLUSION — added after the result, restricting it, never extending it

The conclusion this family supports, stated narrowly and canonically:

> Within this task family, reducing source visibility does **not** monotonically improve reliable
> generation. Instead, different visibility regimes induce **different unauthorized output modes**.

No "best window" is claimed and none is implied. "Amount of context" is probably the wrong abstraction
altogether; what the visible context **affords the model to emit** is the better one, and it is what the
two opposing failure modes actually track:

    no context      -> the model invents surrounding structure
    more context    -> the model reproduces surrounding structure

The cross-run repeated-fixed-line observation (6/60 against 23/60) remains **purely
hypothesis-generating**. It crosses two runs that were never designed to be compared, and it is not
cited as evidence here or anywhere else. Its controlled replacement is
`measurements/2026-09-18-redundancy-1p5b/`.

What this family does support at full strength is the invariance, not the curve:

    P(correct attempt)       0.20 to 0.90 across cells
    P(correct | committed)   1.00 in every cell

The architecture claim is that the second is insensitive to the first — **model reliability is not
repository reliability** — and it is the piece to protect. It does not prove universal safety. It shows
the same pattern holding while the model's candidate-generation behaviour changed dramatically, which
is the kind of invariance an architecture is supposed to create.
