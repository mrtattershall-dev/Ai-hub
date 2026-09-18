# PREREGISTRATION — the visibility ladder

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## What ladder 2 established, and the two mechanisms it left tangled

Removing deletion authority did not move the verified rate at all — `R3` and `R3P` both landed at
8/20, p = 1.000. What it moved was what happened on failure:

    R3    committed 20 outputs,  8 correct  ->  12 WRONG PROGRAMS COMMITTED
    R3P   committed  8 outputs,  8 correct  ->   0 wrong, 12 REFUSALS

And the refusals were not uniform. `R3P` case B, with three fixed lines below the marker, refused 8/10
and **four of those returned the whole function**; case A, with one line below, refused 4.

**Two mechanisms are bundled in that observation, and this ladder does not separate them:**

1. **visible-source load** — more program state for the model to coordinate
2. **completion affordance** — showing an entire function invites answering with an entire function

## The claim, phrased narrowly on purpose

> **Holding authority and semantics fixed, reducing the visible source surface is predicted to reduce
> refusals while preserving commit precision.**

If that holds, source visibility matters. **It will not yet say why.** Splitting visibility from
affordance is the experiment after this one, and no result here may be reported as having done it.

## Two measurements, not one

A pass rate cannot express what ladder 2 found: 8 correct with 12 corruptions and 8 correct with 12
refusals score identically and are not remotely the same system. Every arm reports both.

    GENERATION CAPABILITY   P(correct attempt)       verified / samples
    COMMIT INTEGRITY        P(correct | committed)   verified / authorized

`R3P` did not improve the first. It took the second from 0.40 to 1.00.

Also recorded per arm: refusal rate, whole-function emission rate, no-op, `preservation_broken`,
`vocabulary_violation`, `semantic_error`, `boundary_error`, output variance.

## The ladder

| Arm | Fixed source visible around the slot | units | lines |
|---|---|---|---|
| `W0` | none — the slot alone | 0 | 0 |
| `W1` | one statement either side | 2 | 4 |
| `W2` | two statements either side | 4 | 8 |
| `FULL` | the entire function | 9 | 16 |

Everything else is byte-identical across arms: the same English-rendered domain, the same
authorization, the same assembler, the same verifier, the same model and settings, the same output
grammar. Only the window block changes.

**The window is measured in STATEMENTS, not lines, and that is not cosmetic.** A fixed line radius cuts
a guard away from its return — the first draft of this harness showed `if n > 10000:` with no body
below the marker — and a truncated block is itself an invitation to complete it. That would put
completion affordance *inside* the variable meant to isolate visible-source load, which is the one
confound this ladder exists to avoid.

**`BLOCK` is omitted and the reason is recorded rather than the arm silently dropped.** `classify`'s
body is a flat sequence of return guards, so its enclosing local block *is* the function body and a
`BLOCK` rung would differ from `FULL` by the `def` line alone. Adding a nested block would mean a
behaviour shape gate 12A does not extract, confounding rung with extraction path. It needs its own
family, like `R4`.

## A longer function than ladder 2's, and why

A six-line function cannot carry a visibility ladder: at the case-B marker a window of three lines
either side *is* the whole function, so two rungs would be the same condition wearing different names.
`classify` here has nine statements.

**Absolute rates are therefore NOT comparable to ladder 2's 8/20.** The ladder is internally
comparable, which is what a dose-response curve requires and all it requires.

## Two repairs carried forward prospectively — nothing historical is rescored

- **`n == 10` joins the probe set.** Ladder 2 found that without it `if n <= 10` verifies. Ladder 2's
  published `FMT_BOUND` 6/20 stands with its annotation and its stricter descriptive count of 5/20;
  this family simply cannot repeat the hole.
- **`scope_violation` is superseded, not repaired.** What it measured is a result outside the declared
  vocabulary, so it is named `vocabulary_violation`. The case it could not see — a preserved input
  returning another *legal* value, `50 -> "zero"` — is `preservation_broken`, a separate column that
  always could see it.

## Apparatus control — three halves, not two

Per arm and case: a perfect fragment must verify; the ladder-1 inversion `if n > 10: return "small"`
must be **accepted and still fail**; and `if n <= 10: return "small"` must be **accepted and still
fail**. The last is the positive control for the new boundary probe — without it the probe could be
present and toothless, which is this ledger's "control that could not fire". All three passed for
every arm and case offline before this was committed.

## Prediction, written before running

> Refusals fall as the window narrows, and `W0` refuses least. Commit integrity stays at or near 1.00
> at every rung, because the authority boundary is unchanged. Whole-function emissions concentrate at
> `FULL`.
>
> **Falsified if** refusals are flat across rungs — which would mean visibility is not the constraint
> and ladder 2's case A/B asymmetry was noise — **or** if commit integrity falls as the window narrows,
> which would mean a narrow window buys acceptance by making wrong answers easier to express.

**No arm is predicted to win on generation capability.** A monotone refusal curve with flat commit
integrity is the interesting outcome; a flat refusal curve is the more consequential one, because it
would send the next experiment somewhere else entirely.

## Power

4 arms x 2 cases x 10 samples = **80 generations**. Ladder 2 measured a cell's noise at about ±2 at
n = 10, so a difference of one or two samples between adjacent rungs is not readable and will be
reported as inconclusive. The `W0` vs `FULL` contrast is the one this sample can carry.

## Cost and safety

Same T4 app, `scaledown_window` 5 minutes, `min_containers` 0, hard 30-minute cap. Stop with
`modal app stop --yes` and verify with `modal app list`. AC power confirmed before the window.
**Rule 3:** the endpoint must name the exact model before any generation runs.

---

# RESULT — the visibility ladder

Rule 3 verified. All eight arm/case controls passed all three halves offline before the window. GPU
window 10:11:18Z to ~10:16Z, stopped and verified: six `legasus-1p5b` rows, **zero** not `stopped`.

    arm   case  units  lines  verified  refused  whole-fn  P(correct)  P(correct|committed)
    W0    A       0      0      0/10       9        8         0.00          0.00
    W0    B       0      0      0/10       8        6         0.00          0.00
    W1    A       2      4      7/10       3        0         0.70          1.00
    W1    B       2      4      6/10       4        0         0.60          1.00
    W2    A       4      8      4/10       6        0         0.40          1.00
    W2    B       4      8      9/10       1        0         0.90          1.00
    FULL  A       9     16      8/10       2        0         0.80          1.00
    FULL  B       9     16      9/10       1        0         0.90          1.00

## The prediction is falsified, and in the opposite direction

I predicted refusals would **fall** as the window narrowed, with `W0` refusing least.

    W0    17/20 refused        the narrowest window refused the MOST
    W1     7/20 refused
    W2     7/20 refused
    FULL   3/20 refused        the widest window refused the LEAST

> Reducing the visible source surface did not reduce refusals. Removing it entirely destroyed the arm.

And the mechanism the ladder was built to chase inverted with it. Ladder 2's motivating observation was
that showing a whole function invites a whole function back. Across 80 generations here:

    whole-function emissions at W0 (no source shown)     14
    whole-function emissions at W1, W2 and FULL           0

**Completion affordance was strongest where there was no function to complete.** Shown nothing, the
model invented one — `def get_size(size):`, `def get_small_or_large(n):`. Shown the actual function, it
never once returned a function. The affordance hypothesis is not merely unsupported; the data point
that motivated it did not reproduce on a longer function.

## W0 is void as a rung, and the reason is an apparatus defect rather than a model limit

`W0`'s three authorized outputs all failed to load:

    if value < 10: return "small"        NameError: name 'value' is not defined

With zero source lines visible, **the prompt never says the parameter is called `n`.** The delta says
"values below 10". So the model guessed `value`, `size`, and function names to hang them on.

`W0` therefore did not remove *visible-source load*. It removed a **CURRENT PROGRAM FACT that Legasus
holds and failed to render** — the same shape as every other finding in this project, where the
apparatus is the variable and the model is constant. It cannot be reported as a point on the
visibility axis, exactly as ladder 1's `R1` could not be reported as a point on the responsibility
axis.

### The control that should have caught it, and could not

Every arm passed its apparatus control: feed a perfect fragment, it assembles, it verifies, so the arm
can reach 10/10 if the model cooperates. `W0` passed that and scored 0/20.

> **An apparatus control proves the ASSEMBLER works. It says nothing about whether the PROMPT is
> sufficient.**

Those are different questions and this project had a mechanism for only one of them. `sufficiency.mjs`
is the other: every identifier the expected output depends on must be obtainable from the prompt. It is
proven on the real prompts, replayed byte-for-byte — it **rejects `W0`, naming `n` as the missing
fact, and admits `W1`** — and it is a required control for every family after this one.

## What held, at a much larger sample: commit integrity

    authorized outputs at W1, W2 and FULL     43
    of those, verified                        43        P(correct | committed) = 1.00

Every single thing the system committed was correct, at every rung where the model had the facts it
needed. With ladder 2's `R3P` 8/8 that is **51 of 51**.

Acceptance moved a lot across these rungs. Commit integrity did not move at all. That is the two-axis
picture doing exactly what it was separated out to do — and it is the half of ladder 2's finding that
survives contact with a different function, a longer window and four times the sample.

## Visibility is not the constraint in this range

Excluding the void rung, verified rates are 13/20, 13/20 and 17/20 across a window that grows from two
statements to nine. Against a cell noise of about ±2 at n = 10, that is flat-to-slightly-rising, with
`FULL` the best arm.

The one suggestive detail is `W2` case A: 4/10, with **4 refusals for repeating a fixed line**, against
0 such refusals at `FULL` case A. A mid-sized window showing several guards but not the whole function
may invite echoing one. It is a 4-sample gap against ±2 noise and a non-monotone one, so it is recorded
as suggestive and nothing more.

## Honest limits

- **`W0` is void.** Re-running it with the parameter name rendered is a separate, clean experiment, and
  it is the interesting one: it would ask whether zero visible source is *sufficient* once the facts
  are supplied.
- **The `W2`/`FULL` case-A asymmetry is not separable from noise** at this sample.
- **One function, one operation, one task.** `BLOCK` was omitted before the run with its reason
  recorded; `R4` remains deferred.
- Absolute rates are **not** comparable to ladder 2's, by design — a longer function was required for
  the window to have range at all.

## What this changes

Two things, and neither is the thing I predicted.

1. **The next experiment is not about visibility.** It is `W0` repaired — the slot alone, with the
   parameter name supplied as the program fact it is. If that returns to ceiling, the floor of this
   system is *no visible source at all*, which is a far stronger claim than anything the ladder was
   built to test, and the whole visibility axis collapses into a fact-sufficiency question.
2. **Prompt sufficiency joins the mandatory controls**, beside the assembler control and the
   can-this-fail control. Three questions, three mechanisms:

        can the apparatus express a pass?        assembler control
        can the apparatus express a failure?     inversion / off-by-one control
        can the model obtain the facts?          sufficiency control      <- new, and this run is why
