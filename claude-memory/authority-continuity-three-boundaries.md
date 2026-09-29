---
name: authority-continuity-three-boundaries
description: "2026-09-29 slice: the hub has THREE controller-created boundaries and they fail differently - spawn_subtask crosses authority ambiently, queue_task crosses it by attenuation (works), repair/retry dropped it entirely until Step 6; branch integration/governed-slice, flag off, unmerged"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1083fe36-a6a5-4016-ac41-924676bb2324
  modified: 2026-09-29T12:19:58.121Z
---

Branch `integration/governed-slice` (worktree `ai-coding-hub-slice`), cut from `fix/append-preservation`.
`AGENT_GOVERNED_WRITES` stays **off**; nothing is merged and `main` is untouched.

## THE THREE BOUNDARIES, MEASURED

    spawn_subtask   authority crosses AMBIENTLY and unrecorded, because `runAuthorities` is module-
                    scoped and the subtask loop touches authority nowhere. BOUNDED by the parent's set,
                    so not escalation - but unnarrowed, and no step type records the crossing. Also
                    CANNOT COMPOSE: agent.js:2778 refuses `spawn_subtask` inside a sub-task
                    categorically, so grandchildren are unreachable at any SUBTASK_MAX_DEPTH.
    queue_task      crosses by ATTENUATION and is recorded. A_child = A_parent ∩ R_requested.
    repair/retry    dropped authority ENTIRELY - the repair path enqueued from the run-failure handler
                    with no crossing, so a retry of authorized work arrived unauthorized. Step 6 fixed
                    this as a CONTINUATION.

## WHAT WAS ESTABLISHED

- **Attenuation is not amplification.** Parent `{a}` + request `{a,b,c,everything}` -> `{a}`. Held over
  4000 random inputs (must-fire control: a UNION implementation is caught on 3007 of 4000), and across
  two real process boundaries via a queue item.
- **Widening permission did not widen acceptability.** Governance answers "may this run write this
  PATH"; preservation answers "may this CONTENT survive". Adding `t.py` to scope did not make a
  `beta`-dropping write to `s.py` acceptable. Frozen in
  `FROZEN_widening-did-not-widen-acceptability.md`.
- **Repair authority is a CONTINUATION, stored as a reference and resolved at install time.** The item
  carries `continuationOf: <failed item id>` and NO paths; copying the scope at enqueue would turn a
  historical permission into a redeemable possession. Removing the source refuses with
  `SOURCE_ITEM_GONE`.
- **It is EXISTENCE checked, not freshness checked.** Root authority can still be revoked while the
  failed item persists carrying its historical scope. That is P6, frozen and untested.

## TWO DEFECTS FOUND IN PASSING

`_activeRun` was assigned only on the `spawn_subtask` branch, so `queue_task`'s
`generation = (_activeRun && _activeRun.generation || 0) + 1` produced **1 forever** - measured [1,1]
before the fix and [1,2] after, so `MAX_GENERATIONS` could not bind on the queue route at all. And the
crossing record's root must be read from the token's `ancestry[0].from`; `delegate()` records no
top-level `from`, so reading one printed `root: null`.

**How to apply:** when adding a boundary, ask which of the three shapes it has - too much (ambient), too
little (dropped), or attenuated - and check reachability BEFORE freezing a world: W6 and R7 were both
vacuous by construction. Also: the queue id is `randomUUID().slice(0,8)` = **32 bits**, and Step 6 made
it authority-bearing (it resolves the authority source). Status: new dependency, collision properties
UNESTABLISHED, deliberately not investigated.

Related: [[detector-semantics-vs-route-governance]], [[bounded-authority-trades-destruction-for-refusal]],
[[authorization-is-not-verification]], [[untested-is-not-a-failed-result]],
[[legasus-production-decision-2026-09-22]].
