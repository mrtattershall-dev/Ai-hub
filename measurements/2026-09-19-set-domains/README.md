# PREREGISTRATION — does the architecture generalize off integer intervals?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why this family exists

Every claim in this program — `OBSERVE`'s placement, `DECIDE`'s ordering, contract-derived probes,
deadness by execution, the transaction guarantee, the four rendering families — was measured on
`classify(n)` with comparisons against integers. **One domain kind, one function shape.** That is the
largest unexamined assumption left, and the architecture's claim is about *domains and containment*, not
about numbers.

Finite sets are the right second kind: they are not intervals in disguise (`{1, 5, 9}` has no `lo`/`hi`
that describes it) and they reach all three relations naturally.

Building the apparatus for them already found two defects that the interval-only world was hiding — a
duplicated `containsPoint` that returned `false` for every set, so `DECIDE` would have called every pair
of sets disjoint while `PROVE` judged them correctly; and a parser that stripped an unmatched trailing
parenthesis, silently turning `n in (1, 5, 9)` into an unmodelled domain. Both fixed in `86afeb5`.

## The cases

    S_DISJ     {1,5,7} and {2,4,6,8}              disjoint, ENGINEERING CHOICE, 0 violated edges
    S_NEST     {4,6} inside {2,4,6,8}             set inside set, DERIVED, 1 edge
    S_MIX      {4,6} inside n < 10                THE KINDS MIX, DERIVED, 1 edge
    S_TRIPLE   4 inside {4,6} inside {2,4,6,8}    point inside set inside set, DERIVED, 3 edges
    S_UNDET    {4,6} and {6,10}                   intersecting without containment - NO GENERATION

`S_UNDET` is not an invented case. It is the relation intervals could barely express: two sets that share
a value while neither contains the other. The transaction must be **refused**, not ordered.

## Hypothesis

> The pipeline's guarantees are properties of the domain model, not of integer intervals. A new domain
> kind with the same three relations should produce the same downstream behaviour.

## Predictions

**Primary.** `P(correct | assembled)` at or near `1.000` across all three capacities, matching what `R4`
and `T3` produced for intervals (162/162 and 105/105).

**Secondary.** The `DECIDE` ablation breaks the constrained cases and **not** `S_DISJ`, reproducing the
specificity result on a domain kind it was never measured on.

**A NEW FAILURE MODE, PREDICTED IN ADVANCE.** A set invites an error a range cannot: writing **the
spanning range instead of the set**. `2 <= n <= 8` satisfies every member of `{2, 4, 6, 8}` and is wrong
at 3, 5 and 7. I predict some models write it, and that **contract-derived gap probes catch it without any
detector being added for it** — the probe values include each member's neighbours precisely because of
this, and `auditProbeSet` refuses a probe set that lacks them.

Naming it now matters: if it appears and is caught, that is a novel error class *predicted before
generation* and stopped by truth derived from the contract. If it appears and is **not** caught, the probe
argument is wrong and the gap probes do not do what I claim.

**Guardrail.** No transaction carrying a wrong domain may reach commit. Cumulative it is 0 of 619.

## Falsification

- **If `P(correct | assembled)` falls well below the interval families**, something in the pipeline was
  interval-specific and the generality claim is overstated.
- **If `S_DISJ` breaks under the ablation**, the same concern as before — something other than ordering
  changed.
- **If `S_UNDET` generates anything**, an intersecting-without-containment pair silently became ordered.
- **If a spanning-range realization verifies**, the gap probes are decoration.

## Controls, all witnessed before any tokens were spent

    S_DISJ    ORDERED       order evens then odds    basis DERIVED_WITH_ENGINEERING_CHOICE
    S_NEST    ORDERED       order mid2 then evens    basis DERIVED
    S_MIX     ORDERED       order mid2 then low      basis DERIVED
    S_TRIPLE  ORDERED       order four then mid2 then evens   basis DERIVED
    S_UNDET   UNDETERMINED  NO GENERATION   blocked by mid2/cross at n=6

**The anti-oracle control matters more here than anywhere else**, because a set has a second obvious
spelling that a range does not. `n in (2, 4, 6, 8)` and `n == 2 or n == 4 or n == 6 or n == 8` denote the
same domain, `CONSTRAIN` admits both, and a verifier that accepted only the first would be an oracle for a
spelling rather than a check on meaning. **Both are asserted to verify**, and they do.

The ablation instrument registers PASS and FAIL at every dose on perfect fragments:

    S_DISJ   edges 0   DECIDE OFF verified            expected verified
    S_NEST   edges 1   DECIDE OFF failed: mid2        expected failed
    S_MIX    edges 1   DECIDE OFF failed: mid2        expected failed
    S_TRIPLE edges 3   DECIDE OFF failed: mid2,four   expected failed

`CONSTRAIN` required **no change** for this family. Its envelope is shape-based, so it already admits
`if n in (...)`, the bracket spelling, `elif`, and the `or`-chain. That is the interface contract doing
what it was designed to do rather than a lucky coincidence, and it is recorded here because a stage that
had needed special-casing per domain kind would have been a design failure.

## Reporting

`RESULT.json` is authoritative; console output is non-evidentiary.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    samples      20 transactions per case per model
    temperature  0.6
    cases        S_DISJ, S_NEST, S_MIX, S_TRIPLE generate; S_UNDET refuses

---

# RESULT — the architecture generalized. The MODELS did not.

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**
**Every number below is generated from `RESULT.json`.**

## The primary prediction is FALSIFIED

    model   transaction yield   P(correct|assembled)   verified end-to-end
    1.5B          0.850               0.118                 0.100
    7B            1.000               0.250                 0.250
    14B           1.000               0.738                 0.738

I predicted `P(correct | assembled)` at or near `1.000`, matching `R4`'s 162/162 and `T3`'s 105/105 on
intervals. It is nowhere near. On the stated endpoint, **the prediction failed.**

    model   case       assembled   verified   dead-op   probe-fail
    7B      S_DISJ       20/20        20         0          0
    7B      S_NEST       20/20         0         0         20
    7B      S_MIX        20/20         0         0         20
    7B      S_TRIPLE     20/20         0         0         20

The signature is specific: **`S_DISJ` is perfect at 7B and 14B; every case involving containment fails, on
probes rather than on dead operations.**

## But the mechanism is the models, and the verifier was exactly right

Judged by **execution** — because the realizations include forms no parser here reads:

    every realization denotes the requested set   87   verified 87   (100.0%)
    at least one WRONG domain                   141   verified  0

    ZERO LEAKS.   28 distinct guards, 0 failed to evaluate.

`P(correct | verified)` is **1.000** and `P(verified | all realizations correct)` is **1.000**. The
verifier accepted every correct realization and rejected every incorrect one, across five different
algebras it was never told about.

    106x  verified  64  correct        evens   n in [2, 4, 6, 8]
      87x  verified   0  WRONG DOMAIN  mid2    4 <= n <= 6
      54x  verified  13  correct        four    n == 4
      45x  verified  43  correct        mid2    n == 4 or n == 6
      34x  verified  31  correct        odds    n in [1, 5, 7]
      28x  verified   0  WRONG DOMAIN  evens   n % 2 == 0
      19x  verified   0  WRONG DOMAIN  mid2    n >= 4 and n <= 6
      17x  verified   4  correct        evens   n in (2, 4, 6, 8)
      14x  verified  10  correct        odds    n == 1 or n == 5 or n == 7
      14x  verified   5  correct        evens   n == 2 or n == 4 or n == 6 or n == 8
       6x  verified   0  WRONG DOMAIN  mid2    n == 4
       6x  verified   0  WRONG DOMAIN  mid2    n == 4 or n == 5 or n == 6
       4x  verified   0  WRONG DOMAIN  odds    n % 2 != 0

The sub-100% rates on correct forms are not verifier error: a transaction verifies only when **every**
operation in it is right, so a correct `evens` paired with a spanning-range `mid2` fails as it should.

## The predicted failure mode appeared, and was caught every time

Named in the preregistration before generation:

> A set invites an error a range cannot: writing **the spanning range instead of the set**.

    mid2 asked for {4, 6}    ->  4 <= n <= 6        87 times, 0 verified
                             ->  n >= 4 and n <= 6  19 times, 0 verified
                             ->  n in range(4, 7)    4 times, 0 verified

**106 spanning-range realizations, none verified.** They satisfy every member and die at 5 — on the gap
probes that exist because of this argument, with **no detector written for them**.

## And one failure mode I did NOT predict, caught the same way

    evens asked for {2, 4, 6, 8}  ->  n % 2 == 0     28 times, 0 verified
    odds  asked for {1, 5, 7}     ->  n % 2 != 0      4 times, 0 verified

The model inferred a **rule** from an enumeration and wrote modular arithmetic. `n % 2 == 0` admits 0, 10
and -2; `n % 2 != 0` admits 3 and 9. This is a genuinely new algebra — not a wrong boundary, not a wrong
spelling, a different mathematical object — and it was rejected 32 times out of 32 without anyone
anticipating it.

That is the successor to invented bounds, and the geometry is inverted:

    invented bounds    correct interval  ->  model adds a boundary that was never specified
    spanning range     correct sparse set -> model fills in values BETWEEN the members
    inferred rule      correct sparse set -> model replaces the set with a PATTERN it generalizes

Three unrelated error geometries, one verification principle: **specify the truth, and you do not have to
anticipate the stupidity.**

## The anti-oracle property holds on the new kind

Four distinct correct algebras all verified: `n in [2, 4, 6, 8]`, `n in (2, 4, 6, 8)`,
`n == 2 or n == 4 or n == 6 or n == 8`, and `n == 4` for the point. A verifier that accepted only the
membership spelling would have been an oracle for a spelling rather than a check on meaning — and the
or-chain is 43/45.

`CONSTRAIN` admitted all of them, including the wrong ones, which is correct: the shapes are legal. Its
op-yield stayed `1.000` at 7B and 14B. **All the work landed on `PROVE`, which is the division the
architecture claims.**

## What this does and does not establish

**Established:** the pipeline's guarantees are properties of the domain model, not of integer intervals.
Containment, disjointness and refusal-on-overlap all behaved correctly on a kind with no `lo`/`hi`;
`S_UNDET` refused; `CONSTRAIN` needed no change; the ablation instrument registered PASS at 0 violated
edges and FAIL at 1, 1 and 3 before any tokens were spent.

**Not established, and stated plainly:** sets are *harder for these models* than intervals, and badly so
at 1.5B and 7B. That is a `PROPOSE`-side fact, and under this architecture it shows up as a lower verified
rate rather than as wrong code in the repository — which is exactly the trade the design exists to make.
The honest one-line summary is **the architecture generalized and the models did not**, and the reason
that sentence is available at all is that the two are measured separately.

## An instrument defect in this family's own leak checker

Its first version **reported ZERO LEAKS while every evaluation threw.** The recorded condition is stored
without its `if` and colon, so every generated probe program was a syntax error, the result was `null`,
the `continue` skipped it, and every transaction fell into the "all correct" bucket by default. It printed
exactly the answer I was hoping for, and was caught only because Python's stderr was visible.

It now **counts every evaluation and refuses to report at all if any failed** — "nothing was wrong" must
not be indistinguishable from "nothing was checked". A second defect in the same script keyed the per-form
table by condition alone, so `n == 4` written by `four` (correct) and by `mid2` (wrong) collapsed into one
row and the table contradicted the aggregate above it. Both fixed; the aggregate was always computed
per-operation and stands.
