# BIND-CJS step 10 result — H-CAU and H-POST denied; K3 returned "none"
2026-09-21 05:35. Preregistration `legasus/BIND-CJS_CAUSAL.md` (567eaa5), frozen before the
fixture existed. Mechanism `legasus/cjs-preload.mjs` @ e41c1e3, unchanged. Both hypotheses were
**evaluated, never adopted.** Hygiene: 3 pids recorded, 0 alive at sweep.

## The three worlds

| world | requests recorded | worker executions | H-CAU | H-POST | what the worker said |
|---|---|---|---|---|---|
| C-REQ *(control)* | 1 | 1 | **true** | **true** | "a request arrived" |
| C-A | 1 | 1 | **true** | **true** | "own timer, no request consulted" |
| C-A0 *(counterfactual)* | 0 | 1 | false | **true** | "own timer, no request consulted" |

**K0 HELD** — both rules fire on the genuine case, so they were capable of saying *belongs* and
the rest of the experiment is informative rather than vacuous.

**K1 CONFIRMED.** In C-A, H-CAU says *belongs*: a request was recorded, the execution followed
it. C-A0 — the same world with the request removed — produces **the same execution anyway**. The
succession is inert, and that is shown by the counterfactual run rather than by my description
of the fixture. *Requesting X and then observing X does not establish that X happened because of
the request.*

**K2 CONFIRMED.** In C-A0, H-POST says *belongs* for an execution inside the intervention's
window with **no request issued at all**. Temporal containment does not establish causation.

## K3 returned "none", and that is the result rather than a gap

The frozen question was whether **any** recorded field distinguishes C-A's execution — request
present, causally inert — from C-REQ's — request present, causally responsible. Comparing every
field the record carries for the two executions:

    loaded identity        SUBJECT   =   SUBJECT
    role                   worker    =   worker
    inside the window      true      =   true
    after the request      true      =   true
    process identity       present   =   present

**Nothing separates them.** The two executions are indistinguishable in the evidence, and they
differ in whether the intervention was responsible for them.

Per the preregistration this is not repaired. Adding a field now — anything that happens to
separate these two fixtures — would be manufacturing the distinction from the worlds that
motivated it, which is the error the charter exists to prevent.

## Where the distinguishing information actually was

C-A and C-A0 differ in exactly one thing: whether the request was issued. The execution is
identical in both. **The information that showed C-A's request to be inert exists only ACROSS the
two runs** — and a live intervention performs one run. It cannot also observe the world in which
it did nothing.

This was flagged in the preregistration before the fixture was built, precisely so that seeing it
could not be mistaken for discovering it. It is a finding about what retrospective observation of
a single run can support. It is **not** a licence to design an evidentiary structure that
establishes the relation during the action — that would be candidate #6, and it would have to be
attacked exactly like the five before it.

## The map after five expeditions

    last execution identity                    NO   (step 7)
    every execution identity preserved         NO   (step 8)
    uniformity across identities               NO   (step 8)
    process ancestry                           NO   (step 9 — and not even evaluable)
    request-then-execution (H-CAU)             NO   (step 10)
    execution-within-window (H-POST)           NO   (step 10)

Six candidate answers removed. None replaced. **What makes an observed execution evidence about a
particular intervention remains unknown**, and no concept, state or field has been created for it
at any point in this sequence.

## What was NOT done

No causal criterion adopted or named. The competing-causes world (two requests, both plausibly
responsible) was deliberately not built — it is a later expedition and must not be solved in
advance by this fixture. The mechanism is untouched and is not accused of anything: every worker
here executed the ORIGINAL, because no worker received the mechanism, which is the point of the
fixture rather than a failure of it.

## Next falsification, not started

The honest next move is **not** to look for candidate #6. It is to characterise the boundary this
result points at: given a single run, enumerate what an intervention can and cannot establish
about the executions it observes, and construct a world for each claimed capability. If the
enumeration collapses to "very little", that is a substantive finding about autonomous authority,
not an unfinished feature — and it should be reached by construction, not by inference from five
dead candidates.
