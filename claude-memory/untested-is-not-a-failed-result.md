---
name: untested-is-not-a-failed-result
description: "2026-09-29: four apparatus faults in two experiments each produced a believable false conclusion - a leaked mock marker, the SYSTEM PROMPT's own GOAL: example, assumed dequeue order, and a swallowed 404 that never deleted anything; UNTESTED is a third category alongside pass and fail"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1083fe36-a6a5-4016-ac41-924676bb2324
  modified: 2026-09-29T12:20:21.231Z
---

In one session, four apparatus faults each manufactured a plausible result. None was a mechanism
failure; every one looked like one.

    1  mock routed on a goal MARKER          the marker leaks - the parent's own queue_task reply and
                                             the tool result that follows both contain the child's goal
                                             text, so the PARENT was served the CHILD's script and,
                                             holding {a,b}, wrote both files itself. 22 passed / 2
                                             failed, and the PASSES were the dangerous half.
    2  routed on the first `GOAL:` line      the SYSTEM PROMPT contains `GOAL: write the level-loading
                                             module ...` as a worked EXAMPLE at messages[0], so both
                                             runs matched the same text and the CHILD ran the parent's
                                             script and never wrote. Read as a governance refusal.
    3  assumed dequeue order                 an auto-generated REPAIR item preempted the queued work,
                                             so the run measured as a "grandchild" was an unauthorized
                                             retry. This one exposed a real defect, but only because
                                             the record said `installed: []`.
    4  a swallowed 404                       DELETE sent to `/api/queue/:id` when the router is mounted
                                             at `/api/agent`; `.catch(() => null)` ate it, the item was
                                             never removed, and the world reported a MECHANISM FAILURE
                                             in exactly the place the candidate claimed to be strong.

**Why:** the tell in (2) is the sharpest diagnostic available - the **flag-off control also failed**. A
control that fails with the mechanism switched OFF can only be apparatus. And in (4) the record
independently contradicted the intended world: the field read `unresolved: null`, meaning the source
item was FOUND, which cannot happen if it was deleted.

**How to apply:**

- **Report UNTESTED as its own category.** "R6: UNTESTED - the deletion intervention did not occur" is
  not a pass and not a failure. Do not let a pre-commitment that "failure here means the candidate is
  wounded" convert an unrun world into a result.
- **Never infer an effect from the request.** Establish the POSTCONDITION: `sourceGone` asserts the item
  is absent from the queue before the dependent run is allowed to proceed. "DELETE requested" does not
  establish "source absent".
- **Assert the subject actually ran.** "Never ran" and "was refused" leave the SAME footprint on disk.
  Require that each run's own mock was CALLED, and that the run under test really is the one intended
  (check its goal text, not dequeue position).
- **Attribute from the run record, never from final filesystem state**, and assert the OTHER actors
  attempted nothing.
- **Do not route test doubles on conversation text.** Give each run its own mock on its own port; the
  hub re-reads `HUB_DB` per request, so repointing it between runs separates them structurally.

Related: [[fixture-blocked-by-another-guard]], [[measure-the-thing-itself]],
[[apparatus-control-proves-assembler-not-prompt]], [[silent-failures-are-the-class]],
[[authority-continuity-three-boundaries]], [[replay-steps-channel-is-authoritative]].
