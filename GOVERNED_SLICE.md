# The integration slice: one revision where both mechanisms protect a running controller

The audit of 2026-09-29 found two real mechanisms and no revision where both were live:

    property                          native preservation    governed boundary
    live on the running hub                  yes                   no
    covers append_file                       no  (now yes)         yes
    has a production authority installer     n/a                   no

This branch is the narrow bridge. It is **not** a merge: `main` is untouched, and so is every other
branch.

## WHAT WAS BROUGHT IN, MEASURED RATHER THAN ESTIMATED

Base: `fix/append-preservation` @ `285f9db6` — which already carries the verified append-preservation
fix, so half the table above was already satisfied here.

The static import closure of `governed-edit.mjs` is **three files**, which is what made this a slice
instead of a merge:

    legasus/runtime/epistemic-admission/governed-edit.mjs      239 lines
    legasus/legaknow/calculus.mjs                              292
    legasus/legaknow/observation.mjs                           155

Plus its four own tests (e0 target binding, e1 revision binding, e3 evidence obligations,
effect-readback) and `write-interceptor.mjs`. All four passed in this worktree **before any wiring**,
establishing that the boundary is sound in isolation.

Deliberately NOT brought in: `legasus/runtime/governedWorkspace/` and its 551 lines of tests. That is
the coordination layer whose `createWorkspace` has **zero non-test importers**. It is a different layer
from `governWrite`, it has no consumer, and importing it would have made the slice bigger without
making anything live.

`server/agent.js` diff: **133 insertions, 11 deletions.**

## THE MISSING PIECE WAS THE INSTALLER, AND THE SCOPE MODEL FORCED ITS SHAPE

`governedEdit` compares the requested relative path against `authority.context.implementation` for
EXACT equality, and its own header records E5 (allowance) as not implemented. **One grant authorizes
exactly one file.** So a run-level installer cannot hand over a single "workspace" token; it must mint
a SET.

    POST /agent/start   { goal, writeScope: ['s.py', 't.py'] }
        -> startRun(..., { writeScope })
        -> setRunAuthorities(issueWriteScope(writeScope))
        -> one delegate({ from: 'OWNER', ... context: { implementation: path } }) per path

Three properties of that design, each deliberate:

1. **Scope comes from the requester, before any model call.** Never from the goal text and never from
   the plan's `FILES:` line — both are model-authored, and scope taken from either would be the agent
   authorizing itself.
2. **No scope means no authority, not implicit permission.** With the flag on, an unauthorized run
   refuses every write. That is the correct failure, and it is exactly why the flag must not be turned
   on in a hub whose callers do not pass a scope yet.
3. **Selection is not widening.** `governWrite` picks the grant whose pinned target matches the
   resolved path; each grant still authorizes only its own path, and `governedEdit` re-checks the one
   selected. When nothing matches, the wrapper still calls `governedEdit` — with the first grant if
   any exist, so the boundary reports SCOPE_MISMATCH against a real pinned target — rather than
   deciding the refusal itself. A wrapper that decided refusals would be a second implementation of
   the rule, and two implementations that agree are not one rule.

Module-scoped authority is sound here **only** because the hub enforces one top-level run at a time
(concurrent starts answered 409). If that invariant is relaxed, this must move onto the run object.
The code carries that reminder.

## THE THREE OUTCOMES, PROVEN THROUGH REAL DISPATCH

### `legasus/runtime/epistemic-admission/governed-dispatch.test.mjs` — 30 passed, 0 failed

Through `tools[name](args)`, one process per mode because the flag and the authority are read at
import time.

    authorized     scope covers three paths -> write_file, append_file, edit_file all SUCCEED and
                   produce the EXACT bytes (a.txt AAA, b.txt BBB, c.txt CCC)
    noauthority    no scope -> all three REFUSE, and a.txt/b.txt are absent while c.txt is untouched
    outofscope     scope names another file -> all three refuse with SCOPE_MISMATCH, no effect
    forged         a well-formed grant for the exact target, supplied IN TOOL ARGUMENTS -> ignored,
                   all three refuse, no effect. Self-issued permission buys nothing.
    ungoverned     THE SPECIFICITY CONTROL. Flag off, no scope, identical calls -> all three SUCCEED.

That last mode is the one that makes the other four mean something. Without it, an `agent.js` that had
simply lost the ability to write would pass every refusal assertion above.

`classA-governed-child.mjs` already existed and **nothing spawned it** — grep found no reference under
any spelling, so the only place `setRunAuthority` was ever called was itself unreachable. A-4 was listed
as a requirement in `ACTION-GOVERNANCE-1_AMENDMENT-4.md` with no claimed result, which was honest: it
was specified and never run. It runs now.

### `server/governedLoop.test.mjs` — 12 passed, 0 failed

A real hub, a scripted mock model, `AGENT_GOVERNED_WRITES=1`, and an owner-supplied `writeScope` on
`/agent/start`. This reaches the preservation check, which lives in the tool loop and which
`callTool` cannot touch.

One script, run twice with different scope:

    write_file s.py with alpha+beta      in scope, new file      -> LANDS
    write_file s.py with alpha only      in scope, DROPS beta    -> preservation refuses, beta RESTORED
    append_file s.py duplicating alpha   in scope                -> duplicate predicate refuses
    write_file t.py                      OUT of scope            -> governance refuses

Observed: `s.py` ends with `alpha` exactly once and `beta` present; `t.py` absent;
`destructiveRefused 1` and `duplicateRefused 1` on the run record, with notes naming both. Scenario 2
puts `t.py` in scope and it is created — so scenario 1's refusal was scope, not breakage — while `beta`
is still protected, so **widening permission does not widen acceptability.**

That is the whole point of the slice, and it is now a measurement rather than an argument:

    GOVERNANCE    may this run write this PATH        refused t.py
    PRESERVATION  is this CONTENT acceptable          refused dropping beta; refused duplicating alpha

A write can be fully authorized and still refused, by a different mechanism, in the same path, on the
same call.

## THE FLAG-OFF PATH IS UNCHANGED

With `AGENT_GOVERNED_WRITES` unset, 11 of 12 write/preservation suites pass (68 assertions, 0 failed):
appendFile 5, appendFragment 7, appendSyntax 4, defLoss 6, destructiveWrite 8, duplicateDecls 9,
exportLoss 7, noopEdit 4, emptyReplace 8, editAddress 9, markerGuard 7. `editTruth` exits 124 from a
90s cap with `ok` as its last line — the same slow-test signature seen on the unmodified tree three
days ago.

## NOT ESTABLISHED

- **That this should be turned on anywhere.** The flag stays off. Turning it on in a hub whose callers
  do not pass `writeScope` would refuse every write — an outage, not governance. Nothing here changes
  the live hub.
- **Queue and supervisor runs.** `startRun` is also called by the queue (`source: 'queue'`) and the
  supervisor, and neither passes a `writeScope`. Under the flag they would be unauthorized and refuse
  everything. Inheriting or issuing scope for non-human-initiated runs is UNSOLVED and untouched here.
- **Sub-tasks.** `spawn_subtask` re-enters the tools through a different call site
  (`tools[tool](args)` in the subtask loop) and the human-approval resume through a third. Whether
  governance covers those is not tested and is not claimed. The audit named both.
- **Multi-run concurrency.** Stated above: module-scoped authority rests on the one-run invariant.
- **Anything about performance, cost, or completion.** No score was measured and none is claimed.
- **Symlink/junction containment**, which `governed-edit.mjs` itself records as untested.

## WHAT THIS UNBLOCKS

The removal control (destruction experiment step 5) was unrunnable because an inert mechanism has no
benefit to remove. There is now a revision where the mechanism enforces, with a control proving the
refusals are governance rather than breakage. Step 5 can be specified against **this** branch. It is
still not run, and nothing here preregisters its result.
