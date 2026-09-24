# Two execution defects from BENCH-2, fixed and proven without compute — and a third found on the way

2026-09-24. No model calls. Code-generation strategy (prompt, sampling, repeat limit, supplied
file) unchanged. Isolation unchanged or tightened, never loosened.

## 1. A model call that never returns is now recorded as that, not as a failed task

BENCH-2 lost 4 of 15 external runs to a request that never came back, and the classifier filed
them as budget exhaustion by the model. Cause in source: the serving container streams
heartbeats, so the inter-token stall timer (90s) never fires; the first-byte window (420s) and
ceiling (1800s) both exceed a 300s task; the runner stopped the run with the request open.

**Built** (`server/agent.js`):
- **Call ledger.** Every model request gets `{callId, callKind, dispatchedAt, deadlineMs,
  completedAt, elapsedMs, outcome, serverOutcome}` on the run (persisted with it) and as
  `kind: 'call'` records in the transcript. Outcomes: `COMPLETED`, `COMPLETED_EMPTY`,
  `DEADLINE_LOCAL_ABORT`, `ABORTED_BY_STOP`, `ERROR`. For every non-completed outcome
  `serverOutcome: 'UNKNOWN'` — the hub aborted its side and knows nothing more.
- **Per-call deadline below the remaining task budget.** A caller may declare `budgetSec`
  and/or `callDeadlineSec` on `/agent/start`; the deadline is the minimum of the declared cap,
  `AGENT_CALL_DEADLINE_S`, and (budget remaining − 5s). With none declared, nothing changes:
  the pre-existing timers apply. `bench1.mjs` now declares its 300s budget.
- **Empty is not timeout.** A genuinely empty reply is `COMPLETED_EMPTY`, transcribed as
  `reply: ''` with `empty: true`. A deadline never writes a `reply` field — it is an error
  record with an outcome. The terminal step reads: *"a call that never returned, not a task
  the model failed."*
- **Local abort is never reported as server cancellation.** The step text says *"server
  outcome unknown — not a confirmed cancellation."*

**Proven** (`server/callDeadline.test.mjs`, 28/28, real hub route, two misbehaving stubs added
to `fakemodel.mjs`: `--never` streams heartbeats forever; `--delay-ms N` answers late; both
log what the *server* saw):

    never replies      aborted at a deadline below the budget; ledger complete; UNKNOWN; the
                       server saw the client abort; the transcript has no reply field
    budget remains     a fresh call follows the lost one; the run is not killed by one loss
    replies late       run stopped mid-call: no tool ran afterwards; ABORTED_BY_STOP; the
                       server found the client gone and never sent the answer
    genuinely empty    COMPLETED_EMPTY, reply '' + empty: true, no deadline text, run bounded
    ordinary path      every call COMPLETED, no deadline when no budget declared, finished

Two of the stub's own checks were wrong first: `req.on('close')` fires when the *request* is
read, not when the client leaves (so "client gone" was true immediately), and its request id
was the script pointer, which resets on a fresh run. Both fixed; the test now reads the
server's view from a per-request sequence.

## 2. A removed tool is answered as unavailable, with alternatives — not as a parse error

BENCH-2 chain step 1 asked for `verify_project` three times; route bounding removes it; the hub
said "Could not parse an action" each time. The tools bounding removes are now remembered by
name; a recognisable action naming one receives:

> TOOL UNAVAILABLE in this configuration: verify_project. Your action was understood — this is
> NOT a parse error — and it was NOT executed … Supported testing alternatives: run_python …
> and run_command (for example "python3 -m py_compile <file>.py", "node <file>.js" …).

Applied at all three action sites (turn loop, unknown-tool check, sub-task loop). The tool
stays removed. The repeat guard still bounds a model that keeps asking.

**Proven** (`server/removedTool.test.mjs`, 12/12): the message reaches the model; no parse
failure logged; `verify_project` never executes; the next `run_python` executes and returns
its output; continued repetition stops at the existing bound (1 further attempt after the
valid action).

**Not changed, recorded:** the system prompt still documents `verify_project` and tells the
model to run it before finishing (`agentPrompt.js:172, 285`). That is why the model asks for
it. Removing those lines under bounding is a *prompt* change, and every prompt change so far
has moved behaviour in ways that needed measuring — so it is left for a measured run, not
slipped in with a feedback fix.

## 3. Found on the way: the finish gate executed model code on the host under bounding

`callDeadline.test`'s ordinary-path case, under `AGENT_BOUND_ROUTES=1`, produced the step
*"Verified (python): … `python m.py` ran"* — on the host. The finish gate (`agent.js`, `if
(!run.verified)`) calls `verifier.verify(WORKSPACE)`, which runs `python <entry>` / `node
<entry>` (`verifyProject.js`) without a tool call. Route bounding closed the `verify_project`
**tool** and left the **gate** that does the same thing.

Every campaign since PILOT-1 that reached a finish ran this on the host: BENCH-1's two accepted
runs, ENDURANCE-2's finishes, PROTOCOL-1/2. **ROUTE-BOUNDING_QUALIFICATION.md's claim that
model-chosen host execution was closed was incomplete.** The isolated worker still executed
the model's `run_python`/`run_command`; the evaluator still measured in the worker; what
escaped was the finish-time verifier, on the host, on model-edited files.

**Fixed:** under bounding the gate is closed — a `route_closed` step records *"Finish-time host
verification is closed in this configuration; the finish is recorded UNVERIFIED by the hub and
judged by the independent evaluator"* and `run.finishVerification = 'CLOSED_UNDER_BOUNDING'`.
The ordinary (unbounded) hub keeps its gate. Proven by the same ordinary-path case, which now
finishes via the closed gate with no host execution, and by `repeatWarning.test` case 2.

## Regression sweep after the change

    callDeadline 28 · removedTool 12 · repeatWarning 15 · suppliedFile 16 · wiringBoundary 9
    routeBound 18 · hubWorker 13 · protocolIntegration 23 · statusContract 29
    modelBudget 13 · finishGateEntry 5 (+3 pre-existing known-open) · batchAcceptance 27 · d2Access 20

One regression caught on the way: the new `route_closed` step carried a `tool:` field and was
counted as a tool call by a test that counts `steps.filter(s => s.tool)`. Non-execution steps
now carry `route:` instead.

## What this does and does not settle

SETTLED: after this, a run record can distinguish "the model failed the task" from "the model
call never completed" — the precondition the user set for any further paid benchmark.

NOT SETTLED: why the four BENCH-2 calls never returned (runaway generation vs. lost request).
The serving side still keeps only a tail of its log; a server-side request log is still needed
for that question. Nothing here changes what the model generates.
