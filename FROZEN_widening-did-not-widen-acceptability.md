# FROZEN RESULT — widening permission did not widen acceptability

Frozen 2026-09-29 on `integration/governed-slice`. Measured, not argued. This file records what was
observed, the design that makes it a measurement, and — at the end — what it does **not** license.

## THE CLAIM

    Authorized(a)  does NOT imply  Acceptable(a)

and, in the other direction,

    an action does NOT become permissible merely because it would succeed

Both halves were observed in the same live path, on the same three tools, in one run each.

## THE OBSERVATIONS

`server/governedLoop.test.mjs`, a real hub with `AGENT_GOVERNED_WRITES=1` and an owner-supplied
`writeScope` on `POST /agent/start`. One fixed script, run twice with different scope.

    scenario 1, scope = [s.py]
        write_file s.py alpha+beta       AUTHORIZED  -> landed
        write_file s.py alpha only       AUTHORIZED  -> PRESERVATION refused; beta RESTORED
        append_file s.py duplicate alpha AUTHORIZED  -> PRESERVATION refused
        write_file t.py                  UNAUTHORIZED-> GOVERNANCE refused; t.py absent

    scenario 2, scope = [s.py, t.py]   -- identical script
        write_file t.py                  AUTHORIZED  -> LANDED
        write_file s.py alpha only       AUTHORIZED  -> PRESERVATION still refused; beta RESTORED

End state, scenario 1: `s.py` holds `alpha` exactly once and `beta` present; `t.py` absent;
`destructiveRefused 1` and `duplicateRefused 1` on the run record with notes naming both.

## WHY THIS IS A MEASUREMENT AND NOT AN ANECDOTE

Three controls, each ruling out a way the result could be vacuous:

1. **The scope control (scenario 2).** `t.py` lands when in scope. So scenario 1's `t.py` refusal was
   SCOPE — not a broken write, not a bad path, not something about `t.py`.
2. **The specificity control** (`governed-dispatch.test.mjs`, mode `ungoverned`). Flag off, no
   authority, identical calls: all three tools succeed. So the refusals are governance, and not a hub
   that had lost the ability to write. Without this, an `agent.js` that refused everything would
   satisfy every refusal assertion.
3. **The independence control (scenario 2 again).** Widening permission to include `t.py` did not make
   the `beta`-dropping write to `s.py` acceptable. The two mechanisms did not move together.

Control 3 is the whole point. Without it, "governance refused X and preservation refused Y" is
consistent with one underlying mechanism wearing two names. Widening one and watching the other not
move is what separates the propositions.

## AND THE AUTHORITY DIRECTION

`governed-dispatch.test.mjs`, mode `forged`: a well-formed grant for the exact target, supplied by the
caller **in tool arguments**, is ignored — all three tools refuse and nothing reaches disk. Authority
comes from the owner side of the boundary or it does not exist.

The negative space is part of the result. `writeScope` is not inferred from the goal text, the model's
plan, its `FILES:` line, or tool arguments. **The thing requesting an action does not define the
boundary within which its request is considered authorized.**

## THE THREE QUESTIONS, AND WHICH ONE EACH CONTROL TOUCHES

    CAN             is the effect physically possible?      the ungoverned control: yes, it lands
    MAY             may this actor attempt this effect?      governance: refused t.py out of scope
    SHOULD SURVIVE  may the resulting state persist?         preservation: refused and restored beta

`CAN` was exercised only as the flag-off control — capability was never separately manipulated, and
no claim is made about it beyond "with nothing governing, the write happens".

## WHAT THIS DOES NOT LICENSE

- **Nothing about autonomous runs.** Every observation above is a human-initiated run with a
  requester-supplied scope. Queue and supervisor runs pass no scope and are untested under the flag.
- **Nothing about other routes.** `spawn_subtask` re-enters the tools at a second call site and the
  human-approval resume at a third. Characterized separately in `server/subtaskAuthority.test.mjs`,
  which found the sub-task case to be **ambient inheritance** — a defect, not a result.
- **Nothing about scale or importance of the effect.** The governed operation is one contract
  (`EDIT_FIXTURE`, operation `edit`) over three write tools on workspace-relative paths. That a
  release, a payment flow or a schema migration would sort into the same three questions is a
  conjecture this experiment does not test.
- **Nothing about performance, cost or completion.** None measured.
- **Nothing about whether the flag should be on.** It is off everywhere. Turning it on where callers
  pass no scope would refuse every write.
- **No revision-freshness, single-use, expiry, allowance or ancestor-revocation claim.** E1 fires only
  when a grant pins a revision and the installer pins none; `governed-edit.mjs` records E4-E8 as not
  implemented and its own check-then-write window as narrowed rather than closed.

## IF THIS RESULT IS LATER CONTRADICTED

The three controls are the places to look first. A future change that makes the scope control fail
(`t.py` refused even when in scope) has broken governance; one that makes the specificity control fail
(ungoverned writes refused) has broken writing; one that makes the independence control fail (`beta`
surviving only because scope was narrow) means the two mechanisms were coupled all along and this
result was an artefact. Nothing in this file is to be reinterpreted under new semantics — it is what
was observed on this branch on this date.
