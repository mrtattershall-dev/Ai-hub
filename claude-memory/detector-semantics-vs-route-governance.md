---
name: detector-semantics-vs-route-governance
description: "tatte's 2026-09-22 split for the hub/Legasus destruction experiment: preservation SEMANTICS (can it detect the regression class at all) and ROUTE governance (must every route satisfy the obligation) are independent questions - a governed boundary can succeed at one and fail badly at the other"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1083fe36-a6a5-4016-ac41-924676bb2324
  modified: 2026-09-22T09:33:04.944Z
---

For the hub destruction experiment, tatte required two questions be kept independent instead of
contaminating each other:

    A. PRESERVATION SEMANTICS   can the system detect the actual classes of regression at all -
                                symbol loss, duplication, behaviour change?
    B. EFFECT/ROUTE GOVERNANCE  given a preservation obligation, must every way of producing that
                                effect satisfy it?

**Why:** Legasus could succeed completely at B and still fail badly at A. A perfect governed mutation
boundary cannot save anything if the evidence it enforces says a destructive mutation is acceptable.
Conflating them lets a routing win be told as a detection win, or vice versa. Measured on this repo
the two came apart immediately and in opposite directions:

- **Set G was an A failure, not a B failure.** Its corruption was definition *multiplication*
  (`s6_graph.py` at 1987 lines, 28 `def __init__`, 33 `def nodes`), and `lostDefs` compares name
  *sets*, so 1 -> 28 is never a loss. All six duplicate refusals in the replay arrived by `edit_file`
  and `write_file` - **covered** routes with a before-image. The damage escaped because `defCounts`
  did not exist yet (`458db0b`, 2026-09-12, *after* set G ran), not because a route was unguarded. A
  perfectly route-complete removal predicate would have accepted it on every route it covered.
- **`append_file` is a B failure, demonstrated not inferred.** Same file, same corruption:
  `write_file` refuses `foo` 1->2, `append_file` lands it, and a third control appending a genuinely
  new definition lands cleanly - so the route is specifically blind, not broken.
- **The `REMOVE:` override is NEITHER.** Detection worked, the route was covered, and a contentless
  self-declaration by the actor was dispositive. That is action acceptability on its own axis.

**How to apply:** before claiming a preservation improvement, say which question it answers. Ask what
regression CLASS the predicate can represent (a set-difference predicate cannot represent a count
increase) separately from which call sites evaluate it. And check the usage denominator: the hub's two
worst structural bypasses (`spawn_subtask`, `download_file`) executed **zero** times in 17,466
recorded replies, so covering them is prophylaxis against an unexercised hazard and can earn no
measured credit - while `append_file` executed 31 times in set G alone with both predicates gated off.

Related: [[append-file-escapes-the-duplicate-guard]], [[legasus-production-decision-2026-09-22]],
[[fix-the-deciding-path-not-the-advisory-one]], [[hub-detects-but-does-not-act]],
[[bounded-authority-trades-destruction-for-refusal]], [[measure-the-thing-itself]].
