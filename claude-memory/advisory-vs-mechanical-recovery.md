---
name: advisory-vs-mechanical-recovery
description: "The hub's recovery mechanisms are all advisory text; small models ignore them, so recovery must be mechanical"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T18:03:50.815Z
---

2026-09-10, ai-coding-hub. Every recovery mechanism in the agent loop is a sentence appended
to a TOOL RESULT: the auto-finish nudge, the sameErr warning, the ledger reminder. That works
on a 30B (which is why it was never noticed) and does nothing on a 7B.

**Measured:** a "you already ran this and got the identical result, do something different"
nudge fired **24 times** and the model repeated the same failing `outline_file` call straight
through it. It also pushed the model into DIFFERENT wrong actions — tool errors went 0 → 8,
work done 13/18 → 10/18. Reverted.

**Consequence:** on a small model the hub can DETECT every failure mode it has and CORRECT
none of them. It detects, then kills the run. Hence `stopped`, never `done`.

**Why informational fixes fail:** repetition is self-reinforcing in context. Once two
identical assistant turns are in history the model copies the pattern, and information added
at the TOP of the context cannot outweigh recent precedent at the BOTTOM. Confirmed by
injecting the full file contents into the opening message: 0/5 productive either way.

**Ruled out with data (do not re-run):** sampling temperature (stuck 4/5 at 0.2, still 2/5
at 1.0), context starvation (above), path separators (zero backslashes in any tool path).

**How to apply:** recovery must be mechanical — refuse a duplicate (tool,args) call, PRUNE
the repeated turns out of history so the copied pattern is gone (strongest; `pruneHistory`
already exists), or have the hub take the obvious action itself after the 2nd identical
attempt. See also [[unstated-env-fact-looks-like-model-quality]] and [[gpu-cost-per-token]].

**Measurement caveat:** shape-suite variance is wide (2/6–5/6 per pass, n=3), so differences
under ~3/18 are noise. Judge changes on tool-error counts, not completion counts alone.
