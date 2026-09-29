# GRAPH-VALIDITY-1 — node discrimination on held-out shapes

**Date:** 2026-09-29 · **Cost:** $0, local, no model calls · **Stage:** 1 (graph-as-checker) only

The question this answers, and the one it does not:

| | status |
|---|---|
| **Derivation validity** — does the graph adapt to a page it was not written against, and refuse where the page does not support a node? | established (a330e1c7, extended here) |
| **Node discrimination** — can each node fail for its OWN reason, on shapes other than `s01`? | **established here, with one declared limit** |
| Graph-as-feedback (Stage 2) | still closed; this was its precondition, not its evidence |

Run it with `node server/graphNodeMutants.mjs`. Result: **20 passed, 0 failed, 1 declared limit.**

## The shapes, and why these three

Not all filter buttons. Each was chosen so that derivation has to do something different:

| | shape | what it forces |
|---|---|---|
| `g1` | filter button, with a **distractor** `#clear-filter` already on the page, wired to nothing, while the required control is `#reset-filter` | a name-matching checker would score the distractor as the control |
| `g2` | **keyboard** trigger, no selector at all | there is no surface node to require; C and W must be REFUSED, and the remaining nodes must still be separable |
| `g3` | filter button on a page whose update path is an **anonymous** handler | there is no named route; U must be REFUSED |

## What the mutants found before they could measure anything

Two defects in the derivation, both of which made a node not its own measurement. Both were found by
mutants written **before** the run, and both were fixed in the checker — the mutants were not adjusted
to match what the checker happened to do.

**(1) Effects were paired to steps by position, and the order is inverted.** `requirement.effects` is
`["#q is empty", "every item in the list is visible again"]`; `provenance.additionSteps` is `[3, 4, 6]`
where step 3 asserts *every item back* and step 4 asserts *the field is empty*. The emitter records **no**
correspondence between the two lists — I assumed one. So `E1` was labelled "the field is empty" while
being settled by the all-items-back assertion, and **step 6 was silently dropped from the graph
entirely**. Every effect mutant landed on the other effect: the harness reported `E1 ESCAPED / E2 BROKEN`
and its mirror image, which is the signature of a swap.

Effect nodes now come **one per addition step, named by the assertion that settles them**, with
`requirement.effects` recorded as the provenance of the addition set as a whole — which is all the
emitter actually supports. `s01` went from 6 nodes to 7; the recovered node is the repeat click.

**(2) `U` and `P1` were one measurement under two names.** Both read `carriedSteps[1]`. No mutant could
ever fail one and spare the other, so every route-breaking mutant was scored OVER-BROAD for breaking a
"sentinel" that was not a separate thing. They are now separated the way the emitter's own steps
separate them: **U is the route as it already works** (a carried step before the first addition),
**P is the invariant re-exercised after** the addition (a carried step after it, never the no-error
step). Where no such step exists the node is **refused, not faked** — which is why `g2` now reports
`REFUSED P1: no carried step re-exercises "everything that already works keeps working" after the
addition`.

A hard check now enforces it: **no two nodes may rest on the same spec step**, and `derive` throws if
they do. That is a derivation bug, not something to discover downstream.

## Re-exercise edges

The emitter asserts some things twice — step 6 repeats step 3's assertion after a second click, step 5
repeats step 2's after the addition has been used. Those later nodes are not independent claims; they
ask whether the **same** assertion still holds under a further exercise. The criterion for declaring the
edge needs no interpretation: **the two steps' `expect` strings are byte-identical.**

This is what makes the collateral honest in both directions. A mutant that destroys a behaviour outright
counts the repeat as expected collateral — *and* the repeat still has to earn its place by a mutant that
fails **only** it: a control that works the first time and not the second.

## Results

Every node, on every shape, failed for its own reason with its declared sentinels intact.

| shape | nodes | refused | mutants |
|---|---|---|---|
| `g1` | C, W, E1(3), E2(4), E3(6 · re-exercise of E1), U(2), P1(5 · re-exercise of U) | — | 7, all CAUGHT |
| `g2` | E1(3), E2(4 · re-exercise of E1), U(2) | C/W (no selector), P1 (no post-addition step) | 3 CAUGHT + 1 declared limit |
| `g3` | C, W, E1(3), E2(4), E3(6 · re-exercise of E1), P1(5) | U (no named route) | 6, all CAUGHT |

The two mutants that matter most, because nothing else separates their nodes:

- **`g1` P1 vs U** — a candidate whose new control is correct but which **detaches the page's input
  listener when clicked**. Filtering works before the addition is used (U intact) and not after (P1
  fails). Before the fix these were the same step and this distinction did not exist.
- **`g1`/`g3` E3** — a control that **works exactly once**. E1 and E2 pass; only the repeat step catches it.

## The declared limit — `g2` E2

On the KEY shape the emitter presses the trigger **twice with nothing in between**, so at step 4 the page
is already in the starting state. A handler that resets once and then stops responding is
**observationally identical** to a correct one at that step, and escapes.

This is recorded as a pre-declared limit, not a passing test: the mutant is marked `expectEscape` and
**this file fails the day it stops escaping**, which would mean the step changed shape. E2 is still
independently falsifiable — a second press that *moves* the page is caught — but it cannot detect a
handler that has gone quiet. The filter shapes do not have this gap, because they type text between the
two clicks.

**Named future work:** the KEY branch of `emitTaskAuto` should perturb state between the two presses.
Not changed here — `g2` is already emitted and under validation, and editing the emitter mid-validation
would make this run incomparable with the derivation results it extends.

## What this does and does not license

**Does:** the graph's nodes are separate measurements on three shapes it was not written against, with
their evidence assigned at derivation time and never chosen after seeing a candidate.

**Does not:** say anything about whether showing a generator the missing nodes helps it. That is Stage 2,
it is a different treatment, and it needs its own arms and its own null. Nor does it extend past these
two trigger kinds (click-on-created-control, keydown) and these page shapes.

## Still not done

- The **"named required control already exists"** case. `g1` has a *distractor* with a different id; it
  does not have the required control already present, and the emitter will not produce that by
  construction.
- More than one preserved invariant on a shape (every task here has exactly one).
- A shape where the update route takes parameters, which `derive` currently will not recognise.
