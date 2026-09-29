# GRAPH-VALIDITY-1 — node discrimination on held-out shapes

**Date:** 2026-09-29 · **Cost:** $0, local, no model calls · **Stage:** 1 (graph-as-checker) only

`node server/graphNodeMutants.mjs` → **20 passed, 0 failed.**
`node server/reExerciseRule.test.mjs` → **15 passed, 0 failed.**
`node server/featureGraph.test.mjs` → **11 passed, 0 failed.**

## Read this before the results: what 20/20 does NOT establish

| level | question | status |
|---|---|---|
| **Internal validity** | do the graph's nodes map correctly to the emitted steps, and do mutants discriminate between them? | **this is what was established** |
| **Construct validity** | do the nodes capture what an independent person means by "this feature is done"? | **not established** |
| **External validity** | do the results transfer to unfamiliar projects and requirements? | **not established** |

The loop here is closed-world: **the emitter defines the task, and the same ontology defines what counts
as solving it.** `emitTaskAuto` writes the trigger/effects/invariants; `featureGraph` derives nodes from
those fields; the checker verifies those nodes; the mutants validate that checker. A green result
establishes *"the graph reasons correctly over an emitter-shaped task"* — not *"the graph captures a
software feature."* Better mutation testing makes the closed loop **more convincing without making it
less closed**: it proves the checker detects faults expressed in its own language, not that its language
contains the right faults.

Concretely, for "add a clear-filter control" this graph says nothing about keyboard activation, a visible
and discoverable label, a disabled state when already clear, placement, duplicate controls, behaviour
across reloads or async data, or whether a clear control was the right design at all. The graph is not
wrong about those. It is **silent**, and silence must not be read as coverage.

**The named next requirement** is a semantic-independence boundary: requirements authored outside the
emitter's ontology, with acceptance evidence that does not come from the checker being graded. Until
then, no result here may be cited as evidence of feature understanding.

## The shapes

Not all filter buttons. Each forces derivation to do something different:

| | shape | what it forces |
|---|---|---|
| `g1` | filter button, with a **distractor** `#clear-filter` already on the page wired to nothing, while the required control is `#reset-filter` | a name-matching checker scores the distractor as the control |
| `g2` | **keyboard** trigger, no selector at all | no surface node exists; C and W must be refused and the rest still separable |
| `g3` | filter button on a page whose update path is an **anonymous** handler | no named route; U must be refused |

## Four defects the mutants found, all fixed in the checker

The mutants were written before each run and were **not** adjusted to match what the checker happened to
do. Every fix went into the thing being validated.

**(1) Effects were paired to steps by position, and the order is inverted.** `requirement.effects` is
`["#q is empty", "every item visible"]`; `additionSteps` is `[3, 4, 6]` where step 3 asserts *every item
back* and step 4 asserts *the field is empty*. The emitter records **no** correspondence — I inferred one
from array order. `E1` was labelled "the field is empty" while settled by the all-items-back assertion,
and **step 6 was dropped from the graph entirely**. A trace link must be explicit, never inferred from
array order. Effect nodes now come one per addition step, named by the assertion that settles them.
`s01` went from 6 nodes to 7.

**(2) `U` and `P1` were one measurement under two names** — both read `carriedSteps[1]`. No mutant could
fail one and spare the other, so every route-breaking mutant was scored OVER-BROAD for breaking a
"sentinel" that was not a separate thing. `U` is now the route *as it already works*; `P` is the
invariant *re-exercised after* the addition, never the no-error step. `derive` now **throws** if two
nodes rest on the same step.

**(3) The repeat criterion was syntactic, and it was wrong in both directions.**

- *v1* — byte-identical `expect` alone. A repeat with nothing in between was kept, and a mutant that
  stopped responding after the first use **escaped**. This was recorded as a declared limit.
- *v2* — "was the observed perturbation applied in between". Right for a repeated **trigger**, wrong for
  a repeated **route** assertion: it **falsely refused** `P1` ("typing still narrows") and invented a
  durability node in its place. What makes `P1` worth asserting twice is that the *trigger* fired in
  between and undid the narrowing, not that more text was typed.
- *v3, current* — a repeat is meaningful only when some **intervening action could have altered the
  property being asserted**, in two unequal tiers:

  | tier | meaning |
  |---|---|
  | `OBSERVED` | the intervening action was measured **on the delivered baseline** to leave the claim's target state |
  | `CONDITIONAL` | the intervening action is the **trigger**, which cannot be observed on the baseline because it does not exist there — so the repeat is recorded as **depending on** the node that owns the trigger's first application |
  | *neither* | `UNOBSERVABLE_REPEAT`: refused, and a derived distinguishing sequence built in its place |

**(4) The prior-exercise lookup ran over nodes instead of over steps.** A repeat of a step the graph did
not turn into a node looked like a *fresh* claim and was never asked whether it distinguishes anything.
`g3`'s `P1` was in exactly that state — it passed its mutant by luck, not by rule. The lookup now spans
all spec steps, and `g3` `P1` is now correctly classified `CONDITIONAL, re-exercise of step 2`.

## The behavioural layer, and the criterion that drives it

`server/behaviorModel.mjs` observes the **delivered baseline** (never a candidate) and answers one
question:

> An action is a **valid perturbation** for a claim `K` if, on the baseline, applying it produces a state
> in which **`K` is false**.

That is checkable with no candidate in hand. If `K` is false after the perturbation and true after the
trigger, the trigger is the only thing that could have made it true. The model is deliberately small —
the load state, the actions the task already uses, and which of them leave the claim's target state. It
is not a learned automaton.

## The declared limit dissolved

The `g2` blind spot from the first run was recorded as *"this file fails the day it stops escaping."* It
now stops escaping, deliberately: the task's own step 4 is refused as `UNOBSERVABLE_REPEAT`, and a
derived node `D` runs **perturb → trigger → perturb → trigger** and requires the restore. Both g2
durability mutants — *second press moves the page* and *resets once then stops responding* — are now
**CAUGHT** with sentinels intact. The flip from ESCAPED to CAUGHT is the evidence the derived sequence
does real work; the goalpost was moved on purpose and recorded, not quietly.

## Results

| shape | nodes | refused | mutants |
|---|---|---|---|
| `g1` | C, W, E1(3), E2(4), E3(6 · OBSERVED re-exercise), U(2), P1(5 · CONDITIONAL re-exercise) | — | 7, all CAUGHT |
| `g2` | E1(3), U(2), D(derived) | C/W `NO_SURFACE_REQUIRED`, P1 `NO_POST_ADDITION_EXERCISE`, E2 `UNOBSERVABLE_REPEAT` | 4, all CAUGHT |
| `g3` | C, W, E1(3), E2(4), E3(6 · OBSERVED), P1(5 · CONDITIONAL) | U `NO_UPDATE_ROUTE` | 6, all CAUGHT |

The mutants that matter most, because nothing else separates their nodes: a candidate that **detaches the
page's input listener when clicked** (U intact, P1 fails); a control that **works exactly once**; and on
g2 a handler that **goes quiet after the first use**, which no step the emitter wrote could see.

## Typed uncertainties

Refusals are first-class outcomes with a type, not prose comments: `NO_SURFACE_REQUIRED`,
`NO_UPDATE_ROUTE`, `NO_ROUTE_EVIDENCE`, `NO_POST_ADDITION_EXERCISE`, `UNOBSERVABLE_REPEAT`,
`NO_PERTURBATION`, `NO_ACTION_VOCABULARY`, `UNOBSERVABLE_BASELINE`.

## The fault operators, and what they do not include

A passing mutant suite is only as broad as its fault operators. These are the classes exercised:
*control never created, control created but inert, effect omitted, state restored after the effect,
works-exactly-once, existing route destroyed outright, existing route detached on first use.*

**Not exercised:** wrong-element targeting, async and timing faults, faults that appear only after many
repetitions, state leaking between interactions, spurious added output (the restore claim is
subset-inclusion on visible text and cannot see it), and anything outside the emitter's ontology — see
the construct-validity section.

## Still not done

- The **"named required control already exists"** case. `g1` has a distractor with a different id; the
  emitter will not produce the required control already present.
- More than one preserved invariant on a shape (every task here has exactly one).
- A shape whose update route takes parameters, which `derive` will not recognise.
- Requirements authored **outside** the emitter's ontology, with independent acceptance evidence.

Stage 2 (graph-as-feedback) stays closed. This was its precondition, not its evidence.
