# CONSTRAINTS-2 PART 1 — **NO BUDGET QUALIFIED. THE COMPARISON IS NOT RUNNABLE AT THIS INTERFACE.**

2026-09-27, **$0**, local, `qwen2.5-coder:1.5b`. 18 model calls, 0 interventions. Criterion declared in
`CONSTRAINTS-2_DEFINITION.md` and committed at `c2f6984`, amended for coherence at `18bdcb0` **before
any of these outcomes was read**. No evaluation on untouched pages is run, because the rule says it is
not.

## The rule, and what each budget did against it

A budget QUALIFIES when both arms (1) DELIVER — the constraint arm renders at least one **constraint**
fact, the nearby arm a non-empty window — and (2) REACH THE GATE in at least 2 of 3 seeds. Select the
largest qualifying budget; if none qualifies, report NOT RUNNABLE.

    budget  arm          block   delivered                     reached gate   qualifies
    40      constraints  24 tok  0 constraint facts             3 of 3         NO - nothing delivered
                                 (one redraw fact only)
            nearby       12 tok  a 1-line window                2 of 3
    80      constraints  79 tok  1 constraint fact + strategy   2 of 3         NO - nearby reached
            nearby       73 tok  an 8-line window               0 of 3              the gate 0 times
    120     constraints 103 tok  1 constraint fact + strategy   2 of 3         NO - nearby reached
                                 + 1 redraw fact                                    the gate 0 times
            nearby      101 tok  an 11-line window              0 of 3

**None of the three qualifies, and the two failures have different causes.** At 40 the constraint block
is too small to carry a constraint at all — it fits only `drawPanel() takes no arguments`. At 80 and 120
the constraint block does carry `LAMPS is declared const`, but at those sizes the nearby-code block stops
producing containable output entirely: 3 of 3 refused at each, as EMPTY (the model writes more comment
lines to the token cap) or UNBALANCED.

**So the viable windows of the two strategies do not overlap.** Every size at which the constraint arm
can say the thing it exists to say is a size at which the competing arm produces nothing judgeable, and
the one size where both produce judgeable output is a size where the constraint arm has no constraint to
deliver. That is the finding, and it is a property of this interface — not of either strategy's merit.

## The whole table, over every assigned task

18 tasks assigned: 3 budgets x 2 arms x 3 seeds. **The denominator is 18 and stays 18.**

    accepted additions                    0 of 18
    reached the gate and were judged      9 of 18
    refused by containment                9 of 18   (6 EMPTY, 2 UNBALANCED, 1 EMPTY at budget 40)
    protected-set failures                0 of 18
    restored                              0 of 18
    delivery failures                     3 of 18   (budget 40's constraint arm, all three seeds)
    interventions by a person             0

`accepted / delivered` is 0 of 15 and is not quoted without `accepted / assigned` = 0 of 18 beside it.
Neither number is informative here: nothing was accepted under any condition.

## The instrument behaved, and this is the part that can be trusted

    token matching       differences of 12, 6 and 2 tokens between the arms' full prompts
    every reading        reproduced on a second interleaved measurement
    every reading        taken on the INFILL template, confirmed per cell, so the counts are the ones
                         the run actually spent
    oracle cost          48 counting calls, 129.3 s, recorded SEPARATELY and never added to generation
    rendered requests    each arm's block, full prompt head, its sha256 and the suffix's sha256 are
                         stored for all six cells

## An observation I am recording and NOT acting on

At budget 40, the cell that failed on delivery behaved better than any other. Its block was a single
line — `FACT line 23: drawPanel() takes no arguments, and the code here calls it after changing state` —
and all three seeds reached the gate, passed 5 steps, and **raised no `Assignment to constant variable`
at all**, where the nearby arm at the same budget raised it in 2 of 2 judged candidates.

**That is three seeds on the page I am permitted to tune against, and it is not a result.** It also does
not qualify under the rule, and the rule is not being reinterpreted to admit it: a redraw fact is not a
constraint fact, and the criterion said constraint facts. Anything built on this observation needs its
own pre-registration, on pages that have not been seen.

## What this establishes, and what it does not

- **Established:** the comparison as specified — equal-token prompts, one carrying extracted
  constraints and one carrying nearby code, on this FIM interface with this model — **cannot be run at
  these budgets**, because no budget lets both arms produce judgeable output while the constraint arm
  has a constraint to deliver.
- **Established:** the measuring apparatus works. Token matching is tight, reproducible, and taken on
  the template the run uses.
- **NOT established:** that extracted constraints help, or that they do not. **Still no evidence either
  way.** This was the question, and it remains open.
- **NOT established:** anything about the nearby-code strategy's merit. Its refusals at 80 and 120 say
  that a comment block of that size defeats containment at this interface, not that pasting nearby code
  is a poor idea.
- **NOT established:** anything about the model's capability. 0 of 18 accepted is consistent with a
  capability limit and with an interface limit, and this design cannot separate them.
- **NOT established:** anything at all about an untouched page. Part 2 did not run.

## Where this leaves the milestone

The milestone is unchanged and unmet: **one useful addition caused by automatically selected guidance,
on a page nobody tuned against.** ASSIST-5 remains the closest point reached, on a familiar page.
TRANSFER-1 remains the only unfamiliar-page attempt, at 0 of 5.

The honest next question is not "which context helps" — that question is blocked here by the delivery
mechanism. It is **whether a comment block above a FIM slot is a viable way to deliver anything at all
to this model**, given that a single line was the only block size at which both arms functioned. Any
successor experiment should be pre-registered against that, on unseen pages, and this record stands
unrevised whatever it finds.
