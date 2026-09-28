# TRANSFER-3 across three pages — **2 of 3 pages completed, 0 interventions, $0.** A defect in my renderer explains why the key constraint never reached the model; it does not explain the whole failure.

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

**THE PRIMARY MEASURE IS PER-PAGE COMPLETION: did Legasus finish within its budget? 2 of 3 pages
completed.** 0 interventions anywhere, 0 protected-set failures anywhere, 0 restores, $0.

**Per-attempt outcomes, which explain reliability and expense but are NOT a success rate.** Colour was
accepted on its third seed (seeds 1 and 2 refused); scores on its first; stack failed on all nine.
**2 accepted of 13 attempts.**

    an earlier version of this table said "3 accepted of 13". That was simply wrong arithmetic: the
    accepted attempts are one on colour and one on scores.

**And 2/13 is not an independent success-rate estimate.** Each page STOPS AT ITS FIRST SUCCESS, so a page
that succeeds early contributes few attempts and a page that never succeeds contributes its whole budget.
That biases the ratio downward and it cannot be read as "the policy succeeds once in every six or seven
tries". What the per-attempt numbers legitimately show is **cost and variability**: scores cost 1 call and
35 s of generation, colour cost 3 calls and 122 s, stack spent 9 calls and 371 s and finished nothing.

## Both accepted results independently rechecked

    s3-04-colour   rebuilt to sha 03603335cacacc12, MATCHES the judged candidate; re-run in a fresh
                   process and browser: 7 of 7, 0 errors
    s3-06-scores   rebuilt to sha c0aabf44f93107c7, MATCHES the judged candidate; re-run in a fresh
                   process and browser: 7 of 7, 0 errors

What the model wrote, kept by containment:

    colour   colorIndex = 0;  plus a redraw            (13-line completion, 10 lines dropped)
    scores   playerA = 0; playerB = 0;  plus a redraw

That is **reproducible execution** of both artefacts. **Reproducible generation remains untested.**

## THE FAILURE, and what my defect does and does not explain

`s3-05-stack` did not complete. **A defect in my renderer explains why the relevant constraint never
reached the model. It does not explain the failure.** Those are different claims, and only the first is
established: the extractor found the right fact and my renderer threw it away.

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
- **Established:** completing a page depends on getting a usable draw within the budget - 2 accepted of 13
  attempts, and colour needed its third seed. This is a statement about cost and variability, NOT a success
  rate, because each page stops at its first success.
- **Established, by the failure:** a budget-driven renderer defect can silently deliver the least useful
  facts available. The extractor was right all along, and the delivery threw its answer away.

## What this does NOT establish

- **Not that the facts cause the successes.** Colour got 1 fact, scores got 2, stack got 0 - which is
  suggestive and is not a control. No arm ran without facts on a page that succeeded with them.
- **Not reproducible generation**, on any page.
- **Not generality.** Three pages, one model, one requirement shape ("one key restores the load state"),
  one edit interface, and all three subjects written by the same model from one-line asks.
- **NOT that the renderer defect caused the failure.** It caused the MISSING CONSTRAINT. Whether
  delivering that constraint produces a successful repair is **unknown**, and it is the question the fix
  has to answer rather than assume. Six of the nine attempts produced no code at all, which a missing fact
  does not by itself explain.

## Nothing has been changed

Per the protocol, this failure is preserved and committed before any fix. The renderer defect is named
above; the fix and its test belong to a successor with its own subjects, because s3-05-stack is now a page
whose failure informed a change and can no longer serve as a clean subject for it.
