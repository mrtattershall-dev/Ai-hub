# Governed hub runs: the campaign's acceptance path now governs the entry point the user uses

2026-09-24. No model calls. Built after COMPONENT-CONNECTIONS.md showed the evaluator,
acceptance policy and rollback were RUNNERS-ONLY: a run started from the hub's UI could finish
with a broken workspace and nothing would say so.

## What was connected — and what was not invented

`server/governance.js` reuses `evaluate()` and `applyAcceptance()` **unchanged**. There is no new
evaluator, no new policy, no Legasus module. It is the runner's path applied to one run:

    /agent/start  { goal, governed: { checks: { requested: {script, files?}, protected: {script, files?} } } }

**Three preconditions, each a loud BLOCKED (409 with the reason), never a silent downgrade:**

1. the hub is running the qualified execution path (`AGENT_WORKER_EXEC=1` and
   `AGENT_BOUND_ROUTES=1`) — a "protected" run whose model executes on the host is not what the
   campaigns measured and may not carry their label;
2. the checks validate (the evaluator's own shape: shell scripts run in the worker, candidate
   mounted read-only at `/candidate`, checks at `/check`);
3. the **starting state is verified**: committed (identity recorded), protected check PASS on
   it, requested check evaluable. A start whose protected check already fails is refused —
   there is nothing to protect or restore to.

**At the terminal boundary** (done / error / stopped, while the workspace is still held): the
candidate is evaluated, the policy applied, both verdicts recorded on the run, an `acceptance`
step pushed, and if protected behaviour broke the workspace is restored to the verified start
and **rechecked**. The rejected candidate is captured under `runs/rejected/<runId>-rejected`.

**Protection status is a field on every run**, shown as a badge in the UI:

    NONE                     "No behavioral acceptance protection: no checks were declared, the
                              starting state was not verified, the result will not be evaluated,
                              and nothing will be rolled back."
    BEHAVIORAL_ACCEPTANCE    declared checks, verified start, evaluated and dispositioned
    FAILED_TO_APPLY          governed, but the conclusion itself threw — visible, never silent

UI (`AgentPage.jsx`): a "Governed run · declare checks" toggle with a JSON textarea; the button
reads "Build it (governed)"; the status bar carries the badge and, after the run, the
disposition. A BLOCKED start is a toast with the server's reason. Client built (`vite build`).

## Proven through the real route — `server/governedRun.test.mjs`, 24/24

    1  ordinary run          protection NONE, the note in words, no acceptance fields
    2  bad seed              protected FAILS on the start -> 409 BLOCKED, no run, workspace untouched
    3  unqualified hub       409 BLOCKED with the reason
    4  malformed checks      409 BLOCKED: "protected: missing"
    5  model BREAKS g()      candidate protected FAIL recorded; RESTORED; workspace byte-identical
                             to the verified start; surviving protected PASS; two tree ids; step visible
    6  model FIXES f()       RETAIN, counts as completion, the fix survived, start verdict recorded
    7  model does nothing    PRESERVE_INCOMPLETE, not a completion, the note carries it

## A defect this test found in the shared path

Case 5's first run: RESTORED, recheck PASS — and the file was **not** byte-identical
(`\r\n` where `\n` was verified). `core.autocrlf` (the Windows default on this machine)
rewrites line endings on checkout: the tree id matches, the recheck passes, the bytes are not
what was verified. **Every campaign RESTORED so far had this property** — behaviour preserved,
bytes git-normalised. Fixed repo-locally (`core.autocrlf false`) in `governance.js` and in
`batch.js`'s task repos; batch 24/24 and batchAcceptance 27/27 still green.

## What this changes in COMPONENT-CONNECTIONS.md

    evaluator / acceptance    RUNNERS-ONLY  ->  CONNECTED for governed hub runs; every other
                                                run is labelled NONE
    batch lifecycle / report  RUNNERS-ONLY  (unchanged: campaigns still run through batch.js)

## Limits, stated

- Governed runs require the operator to write the checks. Nothing derives them from the goal
  — that would put the evaluator's definition in the same hands as the instruction
  (contract-derivation contamination, recorded earlier).
- One run at a time, one workspace: the verified start is the workspace as it stands when the
  governed run begins, not a fresh seed. A later governed run's start is the previous run's
  surviving state.
- `refused_d2` / `stopped_d2_restored` terminals are concluded too, after d2's own restore,
  so acceptance judges the state that actually persists.
- The queue and supervisor entrances do not accept `governed` yet; runs from them are NONE
  and say so.
- This is protection of what survives. It does nothing for whether the model produces a
  verified repair — BENCH-2 stands.
