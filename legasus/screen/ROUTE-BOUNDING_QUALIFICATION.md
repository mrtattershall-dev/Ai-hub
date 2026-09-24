# EXECUTION-PATH BOUNDING — QUALIFICATION RECORD

Status: **QUALIFIED**, with the two routes carrying **different strengths of claim**
(13/13, `server/routeBound.test.mjs`)
Date: 2026-09-22
Answers step 2: *bound the experiment to covered execution paths — uncovered subtask and
approved-pending routes must be unavailable in both arms or get their own qualification.*

## The three sites, in the current file

| site | line | status |
|---|---|---|
| `drive()` | 3621 | **COVERED** — host events, before-images, the d2 terminal gate |
| `runSubtask()` | 2894 | uncovered → made **UNAVAILABLE** |
| `driveDetached()` approve handler | ~4909 | uncovered → **CLOSED + DETECTED** |

(The earlier census cited 2690/3396/4590; the file has changed since. Line numbers were
re-derived from the dispatch expression, not carried forward.)

## The two closures are not the same claim

**UNAVAILABLE — `runSubtask`.** `spawn_subtask` is the only entry to that dispatch, and under
bounding it is **deleted** from the tool table. The model is not offered it, and the existing
unknown-tool branch rejects the name if it emits one anyway. Asserted through agent.js's own
`__toolPolicyTest.hasTool` — the lookup the run loop actually performs — in **both**
configurations: callable unbounded, not callable bounded. Deleted rather than stubbed, because
a stub still answers *"yes, that tool exists"*.

**CLOSED + DETECTED — `driveDetached`.** Execution there requires a human to approve a command.
An unattended campaign has no approver, but **"nobody clicked the button" is not "this route
cannot execute"** — this project already has a route that executed 0 times in 17,466 replies
and was reachable the entire time. So the site is gated *and* instrumented: if it ever
executes, `noteUncoveredTraversal` records it and `runIsBounded()` returns false.

The gate's **decision** is tested in both configurations. That the call sits in the right place
in the approve handler is a **separate claim**, carried by review of that site, and is reported
as separate rather than folded into the pass count.

## Exclusion is the rule, not a warning

A run that traversed an uncovered site is not a noisier data point — the d2 property was never
established on that path. Such a run does not enter the comparison. `runIsBounded()` returns a
**reason naming the site**, because an exclusion with no attributable cause is indistinguishable
from an apparatus failure.

The detector records **before** the tool runs: a tool that throws still traversed the route, and
a detector firing only on success would miss precisely the destructive cases.

## Two defects caught while wiring this

1. **An early `return` in an Express handler.** The first version returned on refusal, which
   would have left the HTTP request without a response and the run parked with nothing driving
   it. The deny branch falls through to `res.json` and resume; the refusal now does the same.
2. **A TDZ `ReferenceError`, live only when bounding is ON.** The bounding statement touches
   `AUTO_TOOLS`, declared *after* the tool table; placed next to the table it throws at module
   load — and only in the configuration the campaign would use. Invisible to every unbounded
   check. The test now loads agent.js **with bounding on**, in a child process, which is what
   rules it out. Same failure class as the five undefined-symbol slips already on record.

## Identical in both arms

This is configuration, not treatment: both arms get the same tool table and the same detector.
Arms differ in **authority**, not in what they can reach. `AGENT_BOUND_ROUTES` is off by
default, so the ordinary hub is unchanged.

## Not claimed

- Bounding does not make the subtask *code* unreachable by any means — it removes the model's
  route to it. A future caller added elsewhere would reopen it; the detector is what would
  notice.
- No claim that the covered site is fully instrumented for every mechanism — Phase 1 covered
  1 of 3 sites and 1 of 6 mechanisms, and only the d2 property is qualified on it.

---

## Addendum: sealing the audit store, and what it costs

Qualifying the boundary (step 1) left it **unwired**: `agent.js` quarantined and never locked.
It now seals each capture after quarantine's own verification, gated on `AGENT_D2_SEAL_AUDIT`,
read **at call time** so both configurations are exercisable from one test process.

Wiring it unconditionally failed `d2Integration` 4 ways, and the failures were correct:

- `existsSync(bundle)` returns **false** once sealed — `stat()` returns `EPERM` too.
- The post-hoc recovery assertion could no longer read the artifact.

So the honest statement is: **after sealing, "the candidate's work was preserved" rests on
quarantine's PRE-SEAL verification** (bundle verify + tree match), not on any post-hoc recovery.
The unsealed arm still asserts recovery end-to-end; the sealed arm asserts the seal, with the
unsealed run's successful read as its positive control. Two claims, kept apart.

`d2Integration` is now 48/48 and drives the **campaign configuration** — otherwise sealing would
be a code path nothing runs until the campaign runs it.

### A success report over an unperformed action

`icacls <dir> /remove:d <user> /T` on a sealed directory prints
*"Successfully processed 0 files"* and exits 0 while changing **nothing**: `/T` must enumerate
the tree, and the deny ACE is exactly what prevents that. Both cleanup paths used it, so every
sealed test run was leaving undeletable directories in the source tree while reporting success.

`unlockAuditDir()` removes the deny on the **directory first, without `/T`**, then recurses, and
verifies by reading the directory rather than by an exit code. `server/legasus-audit/` is now
gitignored — a bundle in git history would be readable by anyone who can read the repo, which
defeats the lock entirely.

---

## CORRECTION — 2026-09-24 (EXECUTION-DEFECTS_RESULT.md §3, finishGateHost.test.mjs)

The claim above that model-chosen host execution was closed under bounding was **incomplete**.
The finish gate (`agent.js`, `if (!run.verified)`) called `verifier.verify(WORKSPACE)`, which
runs `python <entry>` / `node <entry>` on the HOST without a tool call. Every campaign that
reached a finish (PILOT-2, ENDURANCE-1/2, PROTOCOL-1/2, BENCH-1) executed model-edited code on
the host at that point. **This is a confirmed execution path outside isolation, not evidence
that any compromise occurred.** The campaigns' recovery and behavioural results stand at the
level they were measured (evaluator in the worker, acceptance dispositions, restorations); what
they did not demonstrate is that all generated code stayed inside the worker.

Closed 2026-09-24 under bounding (`route_closed` step; finish UNVERIFIED by the hub, judged by
the evaluator). Proven by `finishGateHost.test.mjs` 10/10: the bounded finish path is reached
and writes no host marker; the unbounded positive control reaches the same gate and does.

**Still open, recorded here so the claim stays narrow:** `test_web` loads model-written
HTML/JS in a headless browser on the host and is NOT removed under bounding. No campaign task
so far was a web page, so it did not fire; it remains an unclosed host-side execution route
for web goals.
