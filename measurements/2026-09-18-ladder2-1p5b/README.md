# PREREGISTRATION — ladder 2: what exactly is the boundary?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

Ladder 1 (`measurements/2026-09-18-ladder-1p5b/`) produced one clean boundary and one void rung. Its
recorded table stands exactly as published; **nothing here rescores it.**

## Question 1 — is the boundary "integration", or specifically "authority to delete what exists"?

Ladder 1's `R3` handed the model a region of real code and asked for its replacement. Verified fell to
10/20 and the failures turned **semantic**: the model returned a correct fragment as the replacement
for a region that **contained the guard it was told to preserve**, deleting it.

That region held code that had to survive, so surviving was the model's job. Two arms separate the two
readings:

| Arm | Authorized region | Deletion authority |
|---|---|---|
| `R3` | the zero guard and its return | **present** |
| `R3P` | a slot between lines declared FIXED | **removed** |

The model sees the same real code either way, derives the same condition, and writes the same two
lines. **One variable: does the authorized region contain code that must survive?**

`R3P` gives no preservation sentence, because preservation is no longer something the model can fail
at. The one thing its prompt does tell the model is *where* its lines go, via a single frozen marker
line. That is an `ENGINEERING_CHOICE` Legasus already owns — placement is derived from the precedence
ruling, never from the reference — and it is the same authority the bounded arm exercised silently.
The leakage scan runs over the prompt **with that exact marker line removed**, so the exemption is
mechanical and narrow rather than an accident of which words the regexes happen to catch.

## Question 2 — the `R1` inversion, with the format confound removed

`R1` is void as a rung: its prompt was a data sheet while its neighbours were English, so it varied
surface as well as responsibility. Inside that void sat a real observation — given
`upper bound: 10 (exclusive)` the model produced `n > 10` in about half the samples.

Here the **layout is held fixed** — same field sheet, same field names, same line count — and only the
wording of one field changes:

    FMT_BOUND     applies to:  upper bound 10 (exclusive), no lower bound
    FMT_ENG       applies to:  values below 10, with no lower limit

Same information, same responsibility, same shape. Only the surface differs.

**These two arms receive byte-identical prompts for case A and case B** (the requested domain does not
depend on the case), so they are **20 samples of one condition** each, and will be reported pooled. The
A/B split still exercises something real — the identical fragment must verify under two different
Legasus placements — but it is not an experimental contrast for these arms.

## The acceptance policy changed, and that is why arms are re-run rather than carried over

Ladder 1 rejected `if n > 10: return "small"` for being on one line. That counted a **format**
rejection as a failure and made roughly half of `R1`'s zeros unreadable. Ladder 2 normalizes surface
before acceptance: a one-line `if` is split, a comment-only line is ignored. Nothing else.

Because the policy changed, `R2` and `R3` are **re-run inside this window** rather than carried across
from ladder 1's table. Measuring an arm again costs ten generations; arguing that a policy change could
only have helped costs a claim nobody can check.

**The tolerance must not be able to rescue a wrong answer.** Every arm's apparatus control therefore
has two halves: a *perfect* fragment must verify, and the ladder-1 inversion `if n > 10: return
"small"` — written as a one-liner, so it exercises the new tolerance — must be **accepted and still
fail**. Both halves passed offline before this was committed.

## Arms

    R2          derive the guard from the intent contract, stated in prose     ladder 1: 20/20
    R3          replace a region that contains the preserved guard             ladder 1: 10/20
    R3P         write into a slot between FIXED lines                          new
    FMT_BOUND   render a domain given as bound metadata                        new
    FMT_ENG     render the same domain given as a relation                     new

5 arms x 2 cases x 10 samples = **100 generations.**

## Prediction, written before running

> **Q1.** If the boundary is *deletion authority* rather than integration, `R3P` returns to near
> ceiling while the within-window `R3` reproduces roughly 10/20. If instead `R3P` also collapses, the
> boundary is **seeing real code at all**, and the reliable region is narrower than ladder 1 suggested.
>
> **Q2.** If the ladder-1 inversion is real, `FMT_BOUND` produces `n > 10` at a materially higher rate
> than `FMT_ENG`. If the two arms are indistinguishable, that inversion was noise or an artifact of the
> old acceptor, and ladder 1's post-hoc paragraph about it should be read as unsupported.

**No arm is predicted to win, and the falsifying outcome is the more consequential one.** An `R3P`
collapse would mean bounded reliability does not survive contact with real surrounding code — a much
worse result for the thesis than the one ladder 1 recorded, and it would be reported with the same
weight as a success.

## Honest limits, stated in advance

- 10 samples per cell (20 pooled for the `FMT` arms). A cliff of the size ladder 1 saw is readable; a
  difference of one or two samples between adjacent arms is not, and will be reported as inconclusive.
- `R3P` removes deletion authority **and** the preservation sentence at once. If it succeeds, the
  credit cannot be split between the two without a third arm.
- One task, one function, one operation. `R4` remains deferred for the reason recorded in ladder 1.

## Cost and safety

Same T4 app, `scaledown_window` 5 minutes, `min_containers` 0, hard 30-minute cap. Stop with
`modal app stop --yes` and verify with `modal app list`. AC power confirmed before the window.
**Rule 3:** the endpoint must name the exact model before any generation runs.
