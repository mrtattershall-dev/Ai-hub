# The request boundary: did the model receive the new information and still repeat?

**Yes.** Resolved from the actual outgoing requests, with no GPU. Two separate findings:

1. **The model received the new information and repeated anyway.** Not a transport or
   history-handling failure.
2. **The Hub has a real defect on top of that**: the repeat warning reaches the model two calls
   late, and most stalled runs are stopped before it ever arrives.

## Part 1 — the live pascal run, read directly from its transcript

A correction first: I initially claimed the transcripts store `"[object Object]"` and record
nothing of what was sent. That was **my inspection** calling `String()` on an array. The
transcripts store the real per-turn **delta** — the messages new since the model last spoke —
which is why repeated turns show 3 messages (tool result, task ledger, asset library). They
record the boundary. So do all 500 historical transcripts under `measurements/`.

What the Hub sent before each byte-identical reply (`legasus/fixtures/bench1/pascal-transcript.jsonl`):

    turn 2   TOOL RESULT (outline_file): [pascal.py — 34 lines, 1 declarations] 2: def pascal(n):
    turn 3   THE HUB IS SHOWING YOU pascal.py (the whole file): ``` 1: 2: def pascal(n): 3: rows = [[1]] ...
    turn 4   THE HUB IS SHOWING YOU pascal.py (the whole file): ``` ...
    turn 5   TOOL RESULT (outline_file): [...] ⚠️ You already ran this exact outline_file ...
    turn 6   (same, with warning)
    turn 7   (same, with warning)   -> stopped: same response 3 times

Each was followed by the **same** reply: `THOUGHT: Before making any changes, I need to
understand the current implementation… ACTION: outline_file PATH: pascal.py`.

The delivered information changed materially — a one-line outline, then **the complete file,
twice**, then the outline with a warning — while the reply did not change at all. The model
was handed everything it had asked for and re-asked for it.

## Part 1b — the same route with a recording backend

`server/wiringBoundary.test.mjs` replays the recorded replies through the real Hub against a
fake backend that logs every request. 9/9:

    tool RESULT delivered              YES, every turn (request #3 onward)
    repeat WARNING delivered           YES — but 2 calls after the guard fired
    consecutive requests differ        YES (0 identical pairs of 8; history grows 2 → 18)
    warning appears before the result  NO (in order)

One correction to that test on the way: its first version asserted the result would be the
**newest** message, found nothing, and printed "the Hub did NOT deliver". The Hub appends a
TASK LEDGER and an ASSET LIBRARY block after every result, so the result sits two back. A
wrong-shaped check read as a finding, again.

## The Hub defect, located in source

`agent.js` ~4081: on the **second** identical read-tool call the Hub *substitutes* the whole file
for the tool result (`THE HUB IS SHOWING YOU …`) and sets `run.justSubstituted = true`, which
"buys the model one pardon from the repetition guard." The ⚠️ warning is attached to the tool
result — and the substitution **replaces** that result. So for the two substituted calls the
warning never goes out. It first reaches the model on the 4th call.

The guard stops the run after **3** identical replies. The warning arrives after call **4**. In
most stalls the model is stopped before it is ever told it is repeating.

## Part 2 — the historical audit, 500 transcripts, sets E/F/G (14B and Qwen3-Coder, 2026-09-11)

`server/stallAudit.mjs`. No code changes, no model calls. Denominators throughout.

    stalled (identical consecutive replies)          202 / 500

    of the 202 stalled:
      tool RESULT in the delta before the repeat       196 yes     6 no
      repeat WARNING in ANY later delta                 47 yes   155 no
      SENT changed between the two identical replies   152 yes    50 no
      EDITED successfully after the stall               74 yes   128 no
      outcome: stopped by the repeat guard             189
               budget                                    11
               finished                                   1
      stopped by the guard with NO warning ever sent   151 / 202

### By model — the most important line in this audit

    coder14b   setE 73/100   setF 73/100   setG 48/58     ->  194 / 258   (75%)
    coder30b   setE  6/64    setF  1/100   setG  1/78     ->    8 / 242   ( 3%)

**Same Hub, same route, same guard, same substitution path, same tasks.** With the workflow
held constant, one model stalls in three runs out of four and the other almost never.
BENCH-1's 7B (10/15, 67%) sits with the 14B.

**CORRECTED.** An earlier draft said this "locates the dominant factor in the model." That is
too strong. 75% versus 3% is a **historical association across two models on one workflow** —
not proof that the model rather than the workflow causes the stalls. Model sensitivity and a
workflow defect can coexist, and here they demonstrably do: the warning-delivery bug is a
workflow defect independent of any model, and the 14B/7B are more sensitive to whatever the
workflow presents than the 30B is. Neither reading excludes the other. The bug is real
regardless of the association and was repaired first (`repeatWarning.test.mjs`).

Representative traces (result reached, warning reached, still repeated):
`measurements/2026-09-11-setG/runs/coder14b-setg/runs/071d5478…`, `0b66a858…`, `16869c97…`.
Result did not reach the model (6 cases): `0196bc24…`, `320b67f7…`, `894f73e1…`.

**Read with care.** These are different models (14B, Qwen3-Coder) from BENCH-1's 7B on the same
Hub route. The 50 "sent unchanged" cases are the one place the outgoing message *was* frozen,
and they are a minority. And 74 of 202 stalled runs later edited successfully — the stall is
not always terminal.

## What this settles, and what it does not

SETTLED: the identical replies in BENCH-1 were produced **with** the tool result present
(196/202 historically; 10/10 in BENCH-1 by replay) and, in the live pascal run, with the entire
file present twice. The next fix does **not** belong in transport or history handling.

SETTLED: the warning path is defective — substituted out for two calls, and 151/202 stalls were
killed before it was delivered. This is a Hub bug independent of the model.

NOT SETTLED: *why* the model repeats given the information. One hypothesis consistent with the
record: the TASK LEDGER sent every turn still lists **"1. Outline pascal.py"** as remaining —
the model never marks it done, so its own plan keeps telling it step 1 is next. Untested.

NOT SETTLED: whether the model could have solved these tasks once unstuck. The ten runs did not
exercise repair quality and cannot diagnose coding ability — they show only that no edit was
attempted.
