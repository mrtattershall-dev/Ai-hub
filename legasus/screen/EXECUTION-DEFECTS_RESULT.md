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

---

## Follow-up — 2026-09-24, the three bounded items

**1. The contradictory prompt is corrected.** `systemPromptFor(effectiveTools)` renders the
system prompt from the tool set the hub actually has: a removed tool's doc block is dropped and
the two finishing rules that named `see_screen` / `verify_project` are replaced by the rule for
what is available (`run_python` / `run_command`). With every tool available the output is
byte-identical to `SYSTEM_PROMPT`. Proven on what reaches the model (`effectivePrompt.test.mjs`
9/9): bounded, none of the four removed tools is mentioned; unbounded control documents all
four and equals `SYSTEM_PROMPT` exactly. One slip on the way: the first patch anchored on
`export function lerp`, which also occurs inside the prompt's example code, so the renderer was
inserted INTO the prompt text; caught because the import came back `undefined`, reverted,
appended at end of file.

**2. A genuinely late response is exercised.** `fakemodel --hold-ms N` sends the complete
reply at once and holds the stream open; the stop lands with the bytes already in hand; the
abort ends the stream and the hub keeps the partial-that-is-complete. Proven
(`callDeadline.test.mjs` case 3b, suite 34/34): ledger `COMPLETED_NOT_ACTED_ON` with the byte
count, transcript keeps the reply marked `discarded`, **no tool executed, the workspace was
not mutated** (the reply was a `write_file`).

**3. The finish-gate escape has its own regression test** with a positive control
(`finishGateHost.test.mjs` 10/10; the marker names the OS the entry ran on).

**Distinctions kept explicit:**
- `run.unconfirmedRemoteCalls` counts every call whose `serverOutcome` is UNKNOWN and is never
  decremented; the deadline step says the request may still be computing and a replacement
  call can overlap it; `bench1.mjs` carries the count per run.
- `RESTORED` now requires three checked things: reset succeeded, protected recheck PASS, and
  **every byte** on disk equals the start commit's blob with nothing extra (`survivingBytes:
  IDENTICAL_TO_START`); otherwise `RESTORE_FAILED` with the differing paths. Earlier RESTORED
  claims stand at tree-equality + recheck level only. `core.autocrlf false` is set repo-locally
  before every restore.

**Badge:** running → "BEHAVIORAL ACCEPTANCE ENABLED · verdict pending"; finished → "ACCEPTANCE
· <disposition>". It never shows success before the verdict exists.

Sweep: callDeadline 34 · effectivePrompt 9 · finishGateHost 10 · governedRun 24 · acceptance 27
· batchAcceptance 27 · repeatWarning 15 · suppliedFile 16 · removedTool 12 · wiringBoundary 9 ·
routeBound 18 · protocolIntegration 23. Client rebuilt.
