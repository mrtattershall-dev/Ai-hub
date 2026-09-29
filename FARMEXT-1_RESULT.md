# FARMEXT-1 — the first valid test of bounded insertion. Both arms 0 of 5.

2026-09-29, $0, local `qwen2.5-coder:1.5b`. Whole-artifact versus bounded insertion, on a real farm
extension, judged by the corrected error-sensitive gate.

## Why this test counts when farm-i1 would not have

A slot needs existing code and a legitimate place to insert. On a build-from-nothing task, supplying a
scaffold converts "build the game" into "fill in my blank", and the comparison is rigged before a token
is generated. Here the insertion site is **part of the delivered program**: `baseline-verified.html`
already has working movement and its own keydown handler.

Verified before either arm ran: baseline **passes 1, 2, 3, 8** — including the trailing `noErrors`
check the NARROW-2 subset dropped — and **fails 4**, the requested feature.

## Result

| seed | whole artifact (chat) | bounded insertion (contract) |
|---|---|---|
| 1 | REJECTED — page produced, did not plant | REFUSED_EMPTY |
| 2 | explanation + code fragment | REFUSED_EMPTY |
| 3 | explanation + code fragment | REFUSED_EMPTY |
| 4 | explanation + code fragment | REFUSED_EMPTY |
| 5 | explanation + code fragment | REFUSED_EMPTY |

**chat 0/5 · contract 0/5 · discordant seed-pairs 0.**

This is the third pre-registered outcome: **the farm family is harder than the filter family regardless
of interface.** Neither method is shown better here, and neither is shown worse.

## The failure modes differ, and both are informative

**Whole artifact stopped producing artifacts.** Four of five replies began *"To implement the
functionality where pressing the 'p' key…"* and delivered a **function in a fenced block, not the
complete page** that was asked for. The same interface scored 12/12 on the filter family. So free-form
output is not a property that travels: on a harder task the model shifted from producing the artifact to
explaining the change.

**Bounded insertion produced comments, not code.** All five completions were **comments only**, which
`containToSlot` reports as EMPTY. One continued the pattern by inventing a requirement that appears
nowhere in its prompt:

    // When the t key is pressed: the current day is incremented, and the game state is updated.

The prompt does not mention the `t` key, advancing time, or the day counter — confirmed by search. The
model was continuing the instruction-comment pattern rather than answering it. This is the recorded
INC4-1 failure mode: **instruction comments invite more comments.**

## A classifier imprecision, recorded

`DECLINED_TO_ACT` is slightly too strong for what happened. Those four replies did produce code — a
function — just not in the requested shape. The honest label is **"explanation plus fragment"**, which
is distinct from advice with no code at all. The extractor requires a complete page and correctly
refused; the *name* of the refusal conflates two behaviours that should be counted separately.

## What this establishes, and what it does not

**Establishes:** on this farm extension, across five seeds, neither output method produced an accepted
artifact under an error-sensitive gate. Bounded insertion still has **no accepted artifact anywhere**,
and this was its most favourable available ground.

**Does not establish** anything about the farm family generally. **n = 5 seeds on ONE task**, not five
tasks. Seed-paired replicates measure sampling variability on one extension; they say nothing about
generality across farm work. Even a 5-0 split would give exact two-sided p = 0.0625 and would not be a
formal winner; 0-0 is not evidence of equivalence either.

**Does not compare** to the historical NARROW rates. Those used a gate now known to be blind. Only the
two arms here are compared, and only to each other.
