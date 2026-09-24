# TRANSITION-1 — frozen before generation

Question: does **reading the complete file directly, instead of outlining first**, change
progression from tool result to edit on small files?

## Why this and only this

BENCH-1: 10 of 15 external runs stalled on a read-only tool before any edit. The boundary check
established the model *received* the tool result and repeated anyway, so the change is to the
**workflow**, not transport. Model, sampling, budget and repeat guard are all held fixed.

## One narrow change

    CONTROL     the current workflow, unchanged
    TREATMENT   for files under 200 lines, the outline step is replaced by a direct read of the
                complete file: outline_file on such a file returns the full numbered contents
                (exactly what read_file would return) instead of the one-line declaration list

Nothing else differs. Same prompts, same guidance, same guard, same substitution path, same
limits. The treatment is a change to what one tool returns for small files — not a new tool,
not a prompt change, not a controller.

## What the boundary finding already bounds

The Hub's substitution path **already** hands the model the whole file on the 2nd identical
outline call — and in the live pascal run the model repeated anyway, twice, with the full file
in front of it. So this comparison cannot assume that "seeing the file" is sufficient. What it
tests is narrower: whether receiving the full file **on the first call, as the answer to the
model's own request**, changes the next action — versus receiving it as an unrequested
substitution after a repeat.

If the treatment shows no difference, the "read the whole file" hypothesis is weakened and the
ledger-anchor hypothesis (the TASK LEDGER re-lists "outline" as remaining every turn) becomes
the next candidate. That is a separate frozen test, not an amendment to this one.

## Design

| | |
|---|---|
| tasks | the 15 BENCH-1 external tasks, same frozen seeds |
| arms | CONTROL vs TREATMENT, each task in both, interleaved in adjacent pairs, leading arm alternating |
| model / backend | Qwen2.5-Coder-7B-Instruct, A10G, Modal `legasus-7b`, unchanged sampling |
| budget | 300s per run, 2 hours total, 180s reserve, no retries |
| guard | unchanged — not weakened |
| acceptance | identical in both arms |
| spend | within the authorized $10 cap; app stopped after the run |

## Measurement — separate, never summed

1. **progression to an edit** — did any write/edit tool execute on the target? (the primary
   outcome: it is what the ten stalls lacked)
2. **verified completion** — accepted improvements
3. **regressions** — candidate regressions detected, and regressions remaining after acceptance
4. **cost** — calls, tokens, seconds, over all attempted runs

Eliminating repetition could replace a harmless stall with a **bad edit**. (1) and (3) are
reported side by side for that reason: more edits with more regressions is not an improvement.

## Reading rules, fixed now

- Equal progression counts would not establish "no effect"; n=15 per arm, one run each.
- A treatment gain in (1) with a loss in (2) or a rise in (3) is a mixed result, not a win.
- These 15 tasks are QuixBugs — public, plausibly in training data — and already inspected.
  Development comparison, not a held-out evaluation.
