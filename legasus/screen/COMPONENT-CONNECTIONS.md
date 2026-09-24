# Component connections — mapped from source, 2026-09-24

Read-only map of hub `7584b4f` (worktree `ai-coding-hub-phase1`) and the Legasus worktree
(`ai-coding-hub-indent`). No refactoring, no wiring done to complete the list. Line numbers are
`server/agent.js` unless stated. "Real-route test" means the check drives the actual Express /
agent path with scripted replies, not a unit of the module in isolation.

Labels:  **CONNECTED** = production entry point reaches an enforcement site and a real-route
test proves it acts · **INACTIVE** = connected but off in the configuration under test ·
**RUNNERS-ONLY** = reachable only from campaign scripts, never from the served hub ·
**EXPERIMENTAL** = no production entry point.

| component | production entry point | required configuration | actual enforcement point | real-route test | label |
|---|---|---|---|---|---|
| Worker isolation | `execAgentCommand` → `runInWorker` (agent.js:688) | `AGENT_WORKER_EXEC=1`; Docker daemon; image by digest (`worker.js`) | run_command / run_python execute only in the container; no host fallback; infra failure ≠ non-zero exit | `hubWorker.test.mjs` 13, `workerIsolation.test.mjs` 21 | CONNECTED (default OFF in the served hub; ON in every campaign since PILOT-1) |
| Route bounding | tool table at load (agent.js:2018, 2033); detached approval site (5193); subtask site (3129) | `AGENT_BOUND_ROUTES=1` | spawn_subtask, verify_project, verify_godot, see_screen removed; human-approved path refused; uncovered traversals recorded by arm | `routeBound.test.mjs` 18, `wiringBoundary.test.mjs` 9 | CONNECTED (default OFF; ON in campaigns) |
| Repeat guard + warning | tool-result feedback site (agent.js ~4081) | none (always on; limit 3) | identical replies terminate the run; warning now survives whole-file substitution | `repeatWarning.test.mjs` 15 | CONNECTED, always on |
| Supplied-file context | `suppliedFileMessages` (agent.js:739), called at run start (4842) | on by default, `AGENT_SUPPLY_MAX_BYTES` (8192) | opening context only; records `run.suppliedFiles`; no enforcement — it changes what the model is shown | `suppliedFile.test.mjs` 16 | CONNECTED, always on; **behaviour with a live model unmeasured until BENCH-2** |
| d2 load-preservation | start capture `observeTargets` (4889); finalisation `evaluateD2` (224) → `quarantine` (252) / `restoreTo` + `verifyAt` (304) | `AGENT_D2_ENFORCE=1` **and** `AGENT_D2_TARGETS` non-empty, else startup refuses (agent.js:96) | at finish: START=LOADS + FINISH=THROWS → refuse, quarantine outside workspace, restore start state | `d2Access.test.mjs` 20; `d2Revoke.test.mjs` (deliberately red: same-user ACL bypass preserved) | CONNECTED; **INACTIVE** in BENCH-1/2 (d2 OFF). Its check (loadability of named targets) is a subset of what the evaluator's protected check already measures for these tasks |
| Phase controller (PROTOCOL v2) | `protocolFor(run)` at three sites (3365, 3499, 4148) | `AGENT_PROTOCOL=1`; targets default to every js/mjs/py in the workspace | admits/refuses actions by phase; controller refusals recorded per run; does not own execution | `protocolIntegration.test.mjs` 23, `protocol.test.mjs` 45 | CONNECTED; **INACTIVE** in BENCH-1/2 (OFF). Tested only as a separate arm (PROTOCOL-1/2) |
| Host execution event (Phase 1) | `emitHostEvent` after every tool execution (3897) | `HOST_EVENT_LOG` for the file sink (agent.js:58); emits regardless | **none** — observation only | covered by wiringBoundary (events present in run.steps) | CONNECTED, observation only |
| Independent evaluator | `evaluate()` (`evaluator.js`) | Docker; read-only mounts `/candidate`, `/check` | verdict PASS/FAIL/EVALUATION_ERROR bound to candidate tree id | `evaluator.test.mjs` 17 | RUNNERS-ONLY — imported by `batch.js`/`acceptance.js`, never by `index.js`/`agent.js` |
| Acceptance policy | `applyAcceptance()` (`acceptance.js`), called from `batch.js` | invoked by a runner with a start ref and capture dir | RETAIN / PRESERVE_INCOMPLETE / RESTORED / RESTORE_FAILED / HELD; baseline advances only on RETAIN | `acceptance.test.mjs` 27, `batchAcceptance.test.mjs` 27, live in ENDURANCE-2 (14/14 restored) | RUNNERS-ONLY — **a run started from the served hub's UI gets no acceptance verdict and no rollback**; `index.js` imports only `agent.js` |
| Batch lifecycle + campaign report | `runBatch()`, `campaignReport.js` | runner-supplied journal/workspace paths | fresh workspace per task, BLOCKED on unmet prerequisite, reconciliation against the planned queue | `batch.test.mjs` 24, `enduranceRecovery` 28, `statusContract` 29, `campaignReport` 19 | RUNNERS-ONLY |
| Sampling regime (SAMPLING-1) | request options (agent.js:2315); server `_params` (`modal_serve_vllm.py`, uncommitted) | `AGENT_TEMPERATURE` / `AGENT_TOP_P` / `AGENT_TOP_K` / `AGENT_REPEAT_PENALTY` | server applies whatever is sent; unset keys are not sent | no real-route test located that reads the server side | CONNECTED, **INACTIVE** (all unset in BENCH-1/2: temp 0.2 only). The server-side half is an uncommitted working-tree change that has been deployed |
| Authority calculus (LegaParse / LegaCore / LegaGate …) | **none.** Lives in `ai-coding-hub-indent/legasus/lega*`; `grep` finds zero imports of any `lega*` module from `server/*.js` in either worktree | n/a | n/a — d2 owns the refusal and imports no Legasus module | its own gate suites in the Legasus tree (GATE2–7); nothing on the hub route | EXPERIMENTAL — needs a concrete consumer and a comparison against the acceptance policy before any claim about the hub. The `integration/epistemic-admission` worktree (`8495c86`) was **not examined** here |

## What this map says about "full Legasus"

There is no single configuration with every row enabled. Four rows are RUNNERS-ONLY and two
are INACTIVE by explicit choice for this benchmark; the calculus has no hub entry point at all.
Turning rows on is not additive: d2 and the evaluator's protected check overlap on these tasks,
and the phase controller has only ever been measured as its own arm.

## Demonstrated missing requirement (recorded, not acted on)

The acceptance policy — the one mechanism shown live to stop regressions from surviving — is
reachable only from campaign runners. The served hub can still finish a run with a broken
workspace. That is a gap between what the campaigns measure and what the product does. It is
**not** wired here: the user's instruction is to connect only against a demonstrated missing
requirement, and whether the served hub is the object of study is a decision, not a finding.
