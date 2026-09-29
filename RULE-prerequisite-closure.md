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
