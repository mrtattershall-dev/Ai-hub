# Project rule — every behavioural observation carries its state-establishing steps

**Fresh load is not neutral. It is merely another application state.**

An assertion presumes a state. If the probe does not establish that state, the probe measures something
else — and usually measures it as a pass.

## Three occurrences, all mine, all within one day

| instrument | the defect | what it did |
|---|---|---|
| `obligationMutants` | ran each obligation inside one long sequence | a later check inherited earlier steps' state; specificity could only be shown against *earlier* steps |
| `rescore.featureConstructed` | probe held only the addition steps | clicked "clear" on a page never filtered, so "everything visible again" was trivially true — an **inert** control scored as constructed |
| `featureGraph` node W | clicked from a fresh load | nothing was filtered, so a **correct** clear button changed nothing and failed its own node |

Note the direction is not consistent: twice it produced a **false pass**, once a **false fail**. The
defect is not a bias, it is an absence — which is why it keeps reappearing in different disguises.

## The rule

Before asserting anything about behaviour, run the steps that put the application in the state the
assertion is about. Where a task already declares that structure — `provenance.carriedSteps`,
`additionSteps`, a spec's own ordering — use it rather than re-deriving it by hand.

And where independence is required, the prerequisite closure must run **in its own fresh load**, so one
node's setup cannot satisfy another node's assertion.

## A related wording rule

**"Derives the expected graph without reading the candidate, then reads and runs the candidate to
determine which nodes are missing."**

Not "explains missing parts without reading the candidate" — the second half necessarily inspects it.
What is protected is that the *expectation* was fixed beforehand, not that the candidate is never read.

---

# NARROWED 2026-09-29, later the same day

Everything above stands as written and is deliberately not edited — the sequence of corrections is the
evidence, and this record is the one place the project practises append-never-overwrite on itself.

This rule was recorded at `a330e1c7` (03:01), **after** `featureGraph.mjs` first existed (02:46) but
**before** the two commits that fixed four defects in it (03:18, 03:42). Two of its statements were too
broad. It was found by auditing which written claims depended on logic that changed later the same day —
the check itself, not memory.

## 1. "Use the declared structure rather than re-deriving it" — too broad

Using a declared list is safe. **Assuming a correspondence between two declared lists is not**, and that
is exactly what went wrong next:

- `requirement.effects[i]` was paired to `provenance.additionSteps[i]` **by array position**. The emitter
  records no such correspondence, and on the filter shape the order is **inverted** — so a node was
  labelled with one effect while being settled by a different assertion, and one addition step was
  dropped from the graph entirely.
- Two nodes both read `carriedSteps[1]`, becoming one measurement under two names that no mutant could
  separate.

**Narrowed:** a trace link must be **explicit**, never inferred from array order or from two lists
happening to be the same length. Where the declared structure states no correspondence, derive the link
from the thing that actually settles the claim — for an effect node, the assertion of its own step.
`featureGraph.derive` now throws if two nodes rest on the same step.

## 2. "Establish the state" — necessary, and not sufficient

A declared sequence can put the page in a state where the assertion distinguishes nothing: on the
keyboard shape the trigger is pressed twice with nothing in between, so at the second press a handler
that has stopped responding is observationally identical to a correct one. A mutant escaped through
exactly that gap.

**Added:** the established state must be one in which the claim is **false**, so that only the action
under test can make it true. `behaviorModel.mjs` settles this by observation on the delivered baseline —
an action is a valid perturbation for a claim `K` if applying it produces a state in which `K` is false.
Where no such action exists the node is refused as `NO_PERTURBATION`, rather than checked from a state
that proves nothing.

## 3. The wording rule's scope

**Still true:** no candidate is read before the expectation is fixed.
**No longer true:** that the expectation is derived from declared text alone. `featureGraph.derive` now
*requires* a behavioural observation of the delivered baseline and throws without one. The baseline is
input, not a candidate, so the safeguard is intact — but "derivation reads only the spec" would be wrong.

## 4. A label warning for anyone quoting this file

The table above cites `featureGraph` **node W**. `W` survived today's changes, but its refusal path
(`NO_PERTURBATION`) did not exist when this rule was written. More importantly, the node labels changed
meaning at 03:18: any text quoting *"E1 = the field is empty"*, *"U and P1"* as independent, or a count
of *6 nodes* on `s01` is quoting the pre-fix ontology. The current values are in
`GRAPH-VALIDITY-1_RESULT.md`.
