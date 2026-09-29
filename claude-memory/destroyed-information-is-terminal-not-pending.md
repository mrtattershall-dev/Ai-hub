---
name: destroyed-information-is-terminal-not-pending
description: "A question blocked because the distinguishing coordinate was never recorded is TERMINAL, not an open task — never re-attempt it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-20T05:48:00.993Z
---

Distinguish **blocked** from **terminal** when listing open questions. A question blocked by the platform unblocks on a different host; by sequencing, when the sequence advances; by owner authority, on a decision. But a question blocked because the distinguishing information **was never recorded** unblocks *never*.

Owner's framing, 2026-09-20: an unresolved attribution of that kind "is not a task waiting for a sufficiently clever agent. It is the maximally justified terminal state of that evidence" — a successful epistemic outcome, not unfinished bookkeeping.

**Why:** "That distinction matters enormously for long autonomy. Otherwise an agent can waste days attempting to reconstruct information that no longer exists." A fresh run produces observations with nothing to join on, so it would not resolve the old case — it would silently *replace* it, which is worse than leaving it unresolved.

**How to apply:** tag every open question with a block class (PLATFORM / SEQUENCING / OWNER / EPISTEMIC / TERMINAL) so a later run cannot rediscover a terminal question as an opportunity. Report the terminal ones as results, not as backlog. Related: [[falsification-sequence-beats-final-count]], [[measure-the-thing-itself]].
