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
