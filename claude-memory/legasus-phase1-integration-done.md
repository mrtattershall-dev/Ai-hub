---
name: legasus-phase1-integration-done
description: "2026-09-22 — FIRST Hub→Legasus integration on the real Agent path. NARROWED 2026-09-29: PRESENT BUT INERT IN PRODUCTION — no ordinary launch sets HOST_EVENT_LOG, so emitHostEvent returns on line 1 with zero sinks"
metadata: 
  node_type: memory
  type: project
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-29T11:59:39.414Z
---

2026-09-22: Legasus is INSIDE the Hub Agent for the first time. Before this, `server/` had zero
references to legasus in either direction — it had only ever been run AGAINST the hub (97 test
files under coverage). Every prior Legasus result is therefore of the beside-the-Agent kind.

**Where:** worktree `~/Projects/ai-coding-hub-phase1`, branch `phase1-host-event`, commit
`a879d05` from 3f5a8ff. **NOT merged** — tatte reviews. Main tree untouched because
`fuzzForever` reruns `fuzzLoop` against on-disk code every batch.

    server/hostEvent.js        canonical event + sink registry + file sink
    server/hostEvent.test.mjs  C1-C5, 20 passed, real NODE_EXIT=0
    server/suiteBaseline.mjs   90-file sequential sweep, child exit status is the verdict
    server/agent.js            +43/-5: import, env-gated sink, emit at 3396, entrance threading

**What it licenses:** the hub can transmit canonical execution evidence into a consumer on its
real Agent path *without a difference detectable by the 90-file suite at the characterised
resolution*. NOT "without changing behaviour" — the instrument has measured noise. **No claim
that Legasus improves coding**; a Phase 1 sink returns nothing and has no channel to.

**Coverage, always with its denominator: 1 of 3 execution sites, 1 of 6 mutation mechanisms.**
agent.js:2690 (subtask) and :4590 (approved-pending) still execute tools with no event and no
before-image; the PTY mutates out-of-process.

**Why:** three design decisions that should survive any refactor —
- the emit sits BEFORE the duplicate-call guard, which rewrites `result` 11 lines later (do
  not move it after; a consumer would get the hub's commentary, not the tool's answer);
- absence of a before-image is a typed REASON (not-a-write / tool-not-covered /
  ext-not-covered / new-file), never a null — see [[append-file-escapes-the-duplicate-guard]];
- a FILE sink (`HOST_EVENT_LOG`), because the hub under test is a child process; an in-process
  listener would only test an imitation of the boundary. Unset = zero sinks = C4's off-state.

**How to apply:**
- Baseline characterisation before integration is not optional here: `batchActions.test.mjs`
  and `verifierInfra.test.mjs` are LOAD-SENSITIVE (3/3 PASS in isolation, fail under a loaded
  sweep). Both FAILED pristine and PASSED after — uncharacterised, the available inference was
  "Phase 1 fixed two tests", which is false and flattering.
- `realChain`/`realGame`/`realModel` exit 2 in 0s without `MODEL_BASE` — environmental
  preconditions, not defects.
- Next is Phase 2 (`legasus/screen/PHASE2-INTERVENTION_PREREG.md`): effect class (d), a write
  after which the module no longer `require()`s — the measured Set G survivor mechanism
  ([[setg-survivors-load-time-throws]]).

Records: `legasus/screen/PHASE1-OBSERVATION_{PREREG,RESULT}.md`. Related:
[[hub-location-and-coord]], [[modal-spend-policy]].

## NARROWED 2026-09-29 — present on the real path, INERT in production

CONSOLIDATION-1 established what this entry left implicit. The emit site is real and on the ordinary
Agent path, exactly as recorded. But `attachFileSink` runs only behind `if (process.env.HOST_EVENT_LOG)`,
and that variable is set in **no ordinary launch** — not `start-hub.bat`, not `npm start`, not any
config. Its only setters are `qualify.mjs` and two test files. With zero sinks `emitHostEvent` returns
on its first line, so on a hub a user actually starts the call executes and **discards its argument**.
`server/agent.js:45` says so in a comment.

The honest form: *the integration exists and is reachable; it transmits nothing in production because
nothing subscribes.* Not a contradiction of what is recorded above — this entry already said
"Unset = zero sinks = C4's off-state" — it is the part a reader of the DESCRIPTION line alone would
have got wrong, and I was that reader.

The same shape holds across the tree: `legasus/runtime/` and `legasus/legaknow/` are **test-only** on
`consolidation/connect-components`, `legascreen` has zero importers under `server/` or `client/`, and a
governed run on a user-started hub returns **409 BLOCKED**. See [[representation-is-not-the-property]].
