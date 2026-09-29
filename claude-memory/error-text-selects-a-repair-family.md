---
name: error-text-selects-a-repair-family
description: REPAIR-1/2 2026-09-27 - fed only the captured runtime error, the 7B chose the textbook DOMContentLoaded fix for a null element that does not exist at all; 0/4 repaired, but one round made a page observable for the first time
metadata:
  type: project
---

2026-09-27, REPAIR-1/2 ($0.28; ~$0.57 hosted total): the untouched arm B candidates, the
captured error verbatim, the declared contract, the failing step's own name - and NONE of my
analysis. Gate unchanged. **0 of 4 repaired in both runs.**

**REPAIR-1, exact matching:** 12 rounds, 0 applicable edits. The model located the region
containing the defect in 4 of 4 and was refused on TRANSCRIPTION - seeds 2/5 quoted at
column 0 where the file indents by 8, seeds 3/4 regrouped non-adjacent lines. Rounds 2-3
re-sent identical evidence and got identical replies, so two thirds of the budget bought the
same refusal.

**REPAIR-2**, with file-anchored tolerant matching (span located ignoring whitespace, FILE's
lines replaced, replacement re-indented to the FILE - the OPPOSITE of
[[tolerant-matcher-deindents-and-destroys]]) plus the refusal fed back: seeds 2/5 applied,
3/4 still refused. Exactly as predicted offline.

**The finding:** seed 2 round 1 wrapped the wiring in `DOMContentLoaded` - the textbook fix
for "null element, script ran too early". The page went from play [] /
RUNTIME_EXCEPTION_AT_LOAD to play [2,3,5] with state readable and movement working. It still
failed: in the state observed the element is absent even at `readyState: complete`, so the
deferred lookup still threw. **The error text is equally consistent with "not there yet" and
"not there at all", and the model chose the first.** Feeding back the error alone selects a
plausible repair FAMILY, not the right fix. (An absent id at readyState complete rules out
"readiness will create it" in that observed state; it does not rule out a later dynamic
insertion.)

**Why:** this is the capability the product needs - observed failure to working improvement -
and it is not there yet. But the gap is now specific and cheap to attack, and the next step
is still machine-only: on a null-element error, report the ids the document actually
contains.

**How to apply:** when feeding failure evidence to a model, ask what OTHER causes the same
message admits, and add the machine fact that discriminates them. Also found: exact substring
matching spliced mid-line (a FIND of `go();` matched inside `      go();`), so exact matches
must be line-aligned. And the ACCEPTED baseline carries a latent defect - draw() sets
textContent on a missing #day element - which only surfaces once a candidate makes the keys
work. See [[7b-one-clause-from-passing]], [[advisory-vs-mechanical-recovery]],
[[silent-failures-are-the-class]].
