# TRANSFER-3 across three pages — **2 of 3 accepted, 0 interventions, $0.** The failure was caused by a defect in my renderer, not by the model.

2026-09-27, local, `qwen2.5-coder:1.5b`. Same frozen policy, same per-page budget (12 calls, 4 rounds,
seeds 1-3), no human in the loop on any page. Policy hashes verified identical to the freeze at
`aa22d06`. **This record is written and committed before anything is changed.**

## The four questions, per page

    page            feature works?   carried-forward   attempts      time        interventions
    s3-04-colour    YES  7 of 7      ALL PASS          3 of 12       156 s wall   0
                                                       (accepted on   122 s gen
                                                        seed 3)
    s3-05-stack     NO               ALL PASS          9 of 12       413 s wall   0
                                                       (2 judged,     371 s gen
                                                        7 refused)
    s3-06-scores    YES  7 of 7      ALL PASS          1 of 12        81 s wall   0
                                                       (accepted on    35 s gen
                                                        seed 1)

**Rate: 2 of 3 pages. 0 interventions anywhere. 0 protected-set failures anywhere. 0 restores. $0.**

**Per seed, which matters more than per page:** colour succeeded on seed 3 of 3 (seeds 1 and 2 refused);
scores succeeded on seed 1 of 1; stack failed on all 9. So **3 accepted of 13 attempts** across the three
pages - the per-attempt rate is about 1 in 4, and a single page's success should not be read as a reliable
one.

## Both accepted results independently rechecked

    s3-04-colour   rebuilt to sha 03603335cacacc12, MATCHES the judged candidate; re-run in a fresh
                   process and browser: 7 of 7, 0 errors
    s3-06-scores   rebuilt to sha c0aabf44f93107c7, MATCHES the judged candidate; re-run in a fresh
                   process and browser: 7 of 7, 0 errors

What the model wrote, kept by containment:

    colour   colorIndex = 0;  plus a redraw            (13-line completion, 10 lines dropped)
    scores   playerA = 0; playerB = 0;  plus a redraw

That is **reproducible execution** of both artefacts. **Reproducible generation remains untested.**

## THE FAILURE, and its cause is mine

`s3-05-stack` failed, and the reason is not the model and not the page. **The extractor found the right
fact and my renderer threw it away.**

The extractor's own output on that page is correct:

    stack   CONST_CONTAINER   call depth 1     <- exactly the fact the task needed
    ctx     CONST_CONTAINER   call depth 2

But the block actually delivered to the model, at the declared 240-character budget, was:

    // FACT line 24: pushBlock() takes no arguments, and the code here calls it after changing state.
    // FACT line 16: drawStack() takes no arguments, and the code here calls it after changing state.

**Zero constraint facts. Two redraw facts.** `renderCompact` walks blocks in priority order and, when one
does not fit, **skips it and keeps going** - a greedy first-fit. The `stack` constraint is three lines
(declaration, existing write, strategy) and exceeds 240 characters, so the single most relevant fact was
dropped while two less relevant ones fitted in the space it left.

**This is the defect CONSTRAINTS-1 already fixed in the other renderer and not in this one.** The prose
renderer degrades from the bottom precisely so that a high-priority fact cannot be starved by low-priority
ones; `renderCompact` has the opposite behaviour, and no test caught it because every previous page
happened to fit.

Consequences worth recording separately:

- The model, handed two redraw facts and no constraint, **echoed a FACT comment line into its own output**
  and called `pushBlock()` - which pushes a block rather than clearing the stack. Two candidates reached
  the gate and failed the addition; seven were refused EMPTY.
- **The escalation rule fired for the first time** (R1 -> R2 after round 2 produced no code) and did not
  help: R2 produced no code either, and the run stopped itself at "no code at either shape" with 3 of 12
  calls unspent. So the rule works mechanically, and on this page it did not rescue anything.
- **The carried-forward checks passed on every single one of the nine attempts.** Nothing was broken, and
  nothing needed restoring. The failure is entirely "did not build", not "damaged what worked".

## What this establishes

- **Established:** the frozen policy, with no human help, extended **two** unfamiliar pages so that the
  requested feature works and every carried-forward check still passes, verified independently in both
  cases. That is a repeat of the success on different code, which is what this test asked for.
- **Established:** across all three pages and 13 attempts, **zero regressions**: no protected-set failure,
  no restore, and every carried-forward check passing on every attempt including the nine failures.
- **Established:** the per-attempt success rate is low - 3 of 13 - so per-page success depends on getting
  a usable draw within the budget.
- **Established, by the failure:** a budget-driven renderer defect can silently deliver the least useful
  facts available. The page's failure is diagnostic of my code, and the extractor was right all along.

## What this does NOT establish

- **Not that the facts cause the successes.** Colour got 1 fact, scores got 2, stack got 0 - which is
  suggestive and is not a control. No arm ran without facts on a page that succeeded with them.
- **Not reproducible generation**, on any page.
- **Not generality.** Three pages, one model, one requirement shape ("one key restores the load state"),
  one edit interface, and all three subjects written by the same model from one-line asks.
- **Not that fixing the renderer would make stack succeed.** That is the obvious hypothesis and it is
  untested; the stack page also failed to produce code at all in six of nine attempts, which the renderer
  cannot explain by itself.

## Nothing has been changed

Per the protocol, this failure is preserved and committed before any fix. The renderer defect is named
above; the fix and its test belong to a successor with its own subjects, because s3-05-stack is now a page
whose failure informed a change and can no longer serve as a clean subject for it.
