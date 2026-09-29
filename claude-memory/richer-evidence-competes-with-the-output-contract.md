---
name: richer-evidence-competes-with-the-output-contract
description: DOM-EVIDENCE-1 2026-09-27 - structured diagnosis feedback cut applied edits from 6 to 1 because 3 of 4 candidates stopped answering in the required edit format; +394 prompt tokens, output collapsed 4066 -> 631
metadata:
  type: project
---

2026-09-27, DOM-EVIDENCE-1 ($2 authorized, ~$0.20 spent): raw-error feedback (E0) against
structured-diagnosis feedback (E2), 4 candidates each, one harness commit, everything else
pinned. **Old-spec acceptance 0/4 in BOTH arms.**

Reported on EVERY starting candidate, 4 per arm, declines included:

    arm  accepted(old)  error-free(post-run)  model calls  declines  applied  gen s  tokens
    E0     0 of 4          1 of 4                  9          0         6     67.2   4066
    E2     0 of 4          0 of 4                  4          0         1     11.7    631

E2's lower call count is the loop's no-new-information stop firing sooner, NOT refusal - the
policy declined zero times. **Never quote acceptance among candidates whose edits applied
(0 of 3 vs 0 of 1): that denominator lets a narrower attempt rate masquerade as better
capability.** The comparison tests the whole POLICY including whether to call the model, so it
cannot isolate prompting.

**The mechanism is format compliance, not diagnosis quality.** Three of four E2 candidates
produced NO edit block, answering with a fenced HTML snippet instead. The system prompt
demanding the FIND/REPLACE format was byte-identical; the user message grew by **exactly 394
prompt tokens** in every seed. This is the third time added prose has changed completion
behaviour on this model family - see [[gate-prompt-suppressor]] and
[[redundant-wording-changes-completion-behaviour]]. **Richer evidence is not free: it competes
with the output contract.**

**The one E2 edit was the best repair DIRECTION produced so far:** it dropped the invented
button and switched to `gameCanvas`, the only id the document has, with correct guarded
planting. It failed because the requirement is the `p` KEY and a canvas click is not a key
press. So the evidence did redirect the repair in the single round that produced one.

E0's best row: seed 5 ended error-free with movement intact and no planting - the cleanest
state any repaired candidate has reached, and NOT an accepted repair.

Two of my own record defects, closed: `row.diagnosis` held the engine's plan and the gate's
classification was assigned over it (destroying the engine record on every applied round), and
`evidenceGiven` stored 1,200 chars starting at the file so the whole diagnosis fell outside the
window. Neither changed what the model received - verified by the 394-token delta, not assumed.

The question it answered: more valid repairs? No, 0 of 8 overall. Comparable repairs for less
work? No - there were no repairs, and the only error-free preserved state (movement intact, no
planting) came from the RAW-ERROR arm. Cost $0.204 for a 665 s window, of which generation was
79 s; about $0.026 per starting candidate, undefined per valid repair.

**How to apply:** when adding evidence to a prompt that also demands an output format, measure
FORMAT COMPLIANCE as its own outcome, and try restating the contract after the evidence or
shortening the evidence to facts alone. Cost note: generation was 12% of the container window,
so this loop's budget is priced in verifications, not tokens
([[verifying-costs-more-than-generating]]).
