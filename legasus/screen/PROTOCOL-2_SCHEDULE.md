# PROTOCOL-2 SCHEDULE — recorded BEFORE launching

30 runs × 300s permits 150 minutes of work. The campaign budget is **60 minutes**. The schedule
must therefore be decided in advance, not discovered when the clock runs out.

## Replicate-major order

Every task gets its **first pair before any task gets its second**:

    replicate 1:  t1 pair, t2 pair, t3 pair, t4 pair, t5 pair
    replicate 2:  t1 pair, t2 pair, t3 pair, t4 pair, t5 pair
    replicate 3:  t1 pair, t2 pair, t3 pair, t4 pair, t5 pair

So a truncated campaign yields **complete replicates across all five tasks**, rather than three
replicates of t1 and none of t5.

Within each pair the leading arm alternates, as in PROTOCOL-1:

    replicate 1:  C,T | T,C | C,T | T,C | C,T
    replicate 2:  T,C | C,T | T,C | C,T | T,C
    replicate 3:  C,T | T,C | C,T | T,C | C,T

## Pair reservation — adjacency is not enough

**Before launching a pair, the remaining budget must cover BOTH runs at their maximum allowance
plus cleanup:**

    required = 2 × 300s + 60s cleanup = 660s

If `deadline - now < 660s`, the pair is **not started** and every remaining run is recorded
UNATTEMPTED. Adjacency alone would let a pair begin with 310s left and strand its second run —
which is precisely the half-pair the ordering exists to prevent.

The check is made **before each pair**, against the real clock. Runs that finish early return
their unused time to the budget, so a fast campaign gets more pairs; a slow one stops cleanly.

## Fixed, and not tuned during the run

300s per run · 60 minutes total · 120s reserve · no retries · no rescue instructions ·
no changes to the controller, prompts, tasks or budgets once started.

## Two wording corrections, carried into the record

**On three replicates.** Three gives *more* evidence of variability than one. It is a **chosen
budget, not a statistical threshold** — nothing about three is special, and it supports no
significance claim. The earlier phrasing ("the smallest number that lets variation be observed")
implied a property three does not have.

**On `wait_for_verification`.** The instruction defect is demonstrated: v1's VERIFY text said
"nothing is required from you", and a controller instruction should not tell the model to do
nothing when a turn is expected. That the wording **caused** the model to invent
`wait_for_verification` is a **hypothesis**, not a finding. The invention was observed; its cause
was not traced.
