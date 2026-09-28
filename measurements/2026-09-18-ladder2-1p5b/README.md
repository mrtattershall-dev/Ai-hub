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

---

# RESULT — ladder 2

Rule 3 verified. All ten arm/case controls passed offline before the window, both halves each (a
perfect fragment verifies; the inversion written as a one-liner is accepted and still fails). GPU
window 09:32:58Z to 09:37Z, stopped with `--yes` and verified: every `legasus-1p5b` app `stopped`.

    arm         case  verified  unauth  no-op  scope  semantic  variance
    R2          A      10/10       0      0      0       0         1
    R2          B      10/10       0      0      0       0         1
    R3          A       1/10       0      0      0       9         4
    R3          B       7/10       0      0      0       0         5
    R3P         A       6/10       4      0      0       0         2
    R3P         B       2/10       8      0      0       0         2
    FMT_BOUND   A       3/10       4      3      0       0         3
    FMT_BOUND   B       3/10       4      1      0       3         6
    FMT_ENG     A       9/10       1      0      0       0         2
    FMT_ENG     B       8/10       2      0      0       0         2

## Q1: THE PREDICTION IS FALSIFIED, AND THE FALSIFICATION IS THE RESULT

I predicted that removing deletion authority would return `R3P` to ceiling. **It did not.**

    R3    8/20 verified
    R3P   8/20 verified          p = 1.000

Not a small shortfall. **Identical.** "Authority to delete what already exists" is *not* the boundary,
and the sharper, more actionable statement I hoped to earn is not available.

### What changed instead was the entire character of the failure

    R3     20 outputs committed, 8 correct     ->  12 WRONG PROGRAMS COMMITTED
    R3P     8 outputs committed, 8 correct     ->   0 wrong programs, 12 REFUSALS

    semantic errors      R3  9/20   ->  R3P  0/20      p = 0.0012
    commit precision     R3  8/20   ->  R3P  8/8       p = 0.0084

Every single output `R3P` authorized was correct, in both cases. Every failure was the apparatus
declining to commit. `R3`'s failures were the apparatus committing something that destroyed existing
behaviour — 9 of 10 samples in case A returned `if n < 10: return "small"` as the replacement for a
region containing the zero guard, so `classify(0)` became `"small"`.

> The protection did exactly what it was built to do and **nothing** it was predicted to do. It did not
> make the model more capable. It converted destructive successes into safe refusals.

That distinction is the Legasus thesis stated as a measurement — *attempt authority is not commit
authority* — and it is worth more than the ceiling I predicted would appear. But it must not be
reported as a win on the preregistered endpoint, because on that endpoint there was no movement at all.

### The new mechanism, and it is not deletion

`R3P` case B refused 8 of 10, and **4 of those returned the whole function**. Case A refused 4. The
difference between the cases is how much fixed code sits *below* the marker: one line in case A, three
in case B.

> Showing the model an entire function appears to invite it to produce an entire function, and the
> more of it it can see beyond its slot, the stronger the pull.

Two cases is not a test of that. It is the next rung.

## Q2: THE INVERSION IS REAL, AND IT REPRODUCES WITH THE FORMAT CONFOUND REMOVED

Layout held fixed — same field sheet, same field names, same line count. One field's wording varies.

    FMT_BOUND   applies to: upper bound 10 (exclusive), no lower bound      6/20
    FMT_ENG     applies to: values below 10, with no lower limit           17/20     p = 0.0011

Among outputs that were authorized at all, so acceptance strictness cannot explain it:

    FMT_BOUND   wrong condition 7 of 13     n > 10 (4)   n > 0 (2)   n <= 10 (1)
    FMT_ENG     wrong condition 0 of 17     n < 10 (17)

Ladder 1's post-hoc observation survives its clean test. Handing the 1.5B a *normalized specification*
of a bound makes it worse than handing it the same bound as a relation — and `n > 0` from
"no lower bound" shows the model reading the metadata field as a constraint to implement rather than a
statement about the absence of one.

**This is directly actionable and costs nothing:** wherever Legasus renders a domain for a model, it
renders the relation, never the bound metadata. `assemble.mjs`'s `renderDomain` already does this for
intervals. The finding says that choice is load-bearing, not cosmetic.

## Two measurement limits found in this run, both reported rather than repaired after the fact

1. **The probe set contains no `n == 10`.** So `if n <= 10` verifies, and one of `FMT_BOUND`'s six
   verified samples is correct only because the exact boundary is never probed. The honest figure with
   a boundary probe is 5/20. The contrast with 17/20 is unaffected; the number is not.
2. **`scope_violation` cannot see a preserved behaviour turning into another legal value.** One `R3`
   case-A sample made `classify(50)` return `"zero"`; `"zero"` is in the allowed value set, so the
   scope tally read 0 while `preservation_kept` correctly caught it. `verified` is right everywhere —
   the *taxonomy column* under-reports, which is this project's fifth-occurrence hazard in a new place.

Neither is patched retroactively. Both go into the next family's design.

## Reproducibility — the first estimate this ladder has produced

`R2` and `R3` were re-run rather than carried over, so their ladder-1 figures are now replicated under
a different acceptance policy:

    R2  A  10/10 -> 10/10        R2  B  10/10 -> 10/10
    R3  A   3/10 ->  1/10        R3  B   7/10 ->  7/10

`R2` is at ceiling twice; `R3` case B reproduces exactly; `R3` case A moves by 2. **A cell's noise is
about ±2 at n = 10**, exactly as the preregistration warned. So `R3P` vs `R3` at 8/20 vs 8/20 is a
genuine null, and `FMT_ENG` vs `FMT_BOUND` at 17/20 vs 6/20 is far outside it.

## What this changes

The next rung is **`R3P` with a narrow window**: the slot plus one line of fixed context either side,
instead of the whole function. If refusals fall while commit precision stays at 8/8, then the binding
constraint at this rung is **how much code the model can see**, not what it is authorized to do — and
the ladder has been measuring visibility, not authority, since `R3`.

That is a cheaper and more testable claim than the one I predicted, and it exists only because the
prediction failed.
