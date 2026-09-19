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
