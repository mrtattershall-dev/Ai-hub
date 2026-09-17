# Concern graph — Site Selection v2 foundation

**Development status. Not frozen, not validated.** The six sealed tasks are spent prospective evidence
and are now development/challenge data; nothing measured against them may be presented as validation.

## Why v1's abstraction was wrong

`featureGroups` assumed a feature lives inside one module-level function body. That was true of goals 64
and 74 and of nothing in the sealed substrate, so v1 abstained 6/6 and derived nothing at all.

A **concern** is program state plus every location that participates in it, with roles derived from what
each location DOES to the state:

    OWNER      declares or initialises it
    MUTATOR    writes to it
    CONSUMER   reads it
    REGISTRY   a module-level collection enumerating variants of it

Module level is a unit like any other, so module state and registries participate on the same footing as
functions — the generalization v1 lacked.

## What it now sees, where v1 saw nothing

    a01   OWNER Tally.__init__   MUTATOR Tally.add    CONSUMER Tally.count, Tally.total
    a02   OWNER Metrics.__init__ MUTATOR record_day   CONSUMER day_total, busiest_day
    b01   OWNER Stack.__init__   MUTATOR push, pop    CONSUMER peek, size

## Development numbers, on spent evidence

    a01  refs 2  cands 4  recovered 2/2  precision 0.50
    a02  refs 3  cands 4  recovered 3/3  precision 0.75
    a03  refs 4  cands 2  recovered 1/4  precision 0.50
    b01  refs 2  cands 5  recovered 2/2  precision 0.40
    b02  refs 3  cands 0  recovered 0/3   no concern found
    b03  refs 4  cands 0  recovered 0/4   no concern found

    pooled recall 8/18 = 0.444    inflation 0.83x      (v1: nothing derived at all)

## What the remaining failures say

**a03 (1/4).** Its concern is a VARIANT — the string `"quoted"` appearing in a registry, a formatter and
a dispatch branch — not a state symbol. Variant concerns are a second concern KIND the graph does not yet
model.

**b02, b03 (0 concerns).** Their state is a plain local (`result`, `out`, `pending`, `depth`) inside one
function, not an attribute or module constant. `stateSymbols` does not look there. These are also the
no-analogy tasks, so a v2 selector should ABSTAIN on them regardless — but it must abstain because no
relation is named, not because the graph is blind.

Both are missing generality, not missing special cases. Neither is fixed by naming a task.

## Two general defects found and fixed while building this

  * a class was listed as a participant alongside its own methods, double-counting the same lines. A
    container only participates if it touches the state outside its nested units.
  * `busiest_day` was classified MUTATOR because a loose "line contains `=`" test matched `key=lambda`.
    A keyword argument is not a write. A write is an assignment to the symbol, an indexed assignment into
    it, or a mutating method call on it.

## Before v2 can be measured

    1  model variant concerns and function-local state, as concern KINDS
    2  derive candidate sites from participant roles, with calibrated abstention
    3  FREEZE and hash the selector
    4  author a NEW holdout family under the construction rules, sealed before the selector sees it
    5  only then report coverage, true/false-apply, recall, precision, exact match, inflation

Coverage remains the critical metric. A cautious parser that abstains beautifully has not migrated
anything.
