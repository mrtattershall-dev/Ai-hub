# SYSTEMS-INVENTORY-1 — every system, five columns, with the draft's overstatements kept visible

**Date:** 2026-10-06 · Trees pinned: hub `ai-coding-hub` **c952cbc9** (what `start-hub.bat` launches);
candidate-0 `ai-coding-hub-consolidation` **456156e7** (what the A-series measured; the SIM-0 commits
265e15be…d60cdab9 are its ancestors). Read-only; no code changed.

## Why this file exists, and what it replaces

A chat draft (2026-10-06, this session) listed the systems in three states — INTEGRATED / STARTED / NOT STARTED —
with an approximate tally. The reviewer rejected it as authoritative. The draft's rows are kept below under
**"Draft, as written"**, each overstatement named, because the overstatements are themselves findings about how
status gets misreported here (the CONSOLIDATION-1 lesson again: one word collapses several questions).

## The columns

| dimension | values | the question |
|---|---|---|
| **Implementation** | absent / specification / implemented | does code exist that does this? |
| **Product connection** | disconnected / conditional / ordinary path | is it reachable from what a user launches, and under what condition? |
| **Evidence** | source only / scripted / live | what established the row: a symbol count, a scripted harness, or a live run? |
| **Composition** | untested / established for named cases / failed | shown to work WITH the pieces it depends on — for which cases? |
| **Next gap** | — | the one concrete missing connection or validation |

A symbol count is **source only**: it proves presence or absence in the searched scope, never execution. Rows
whose only evidence is a count are *connected in source*, not live, and say so.

## Corrections to the draft (the reviewer's, verified against the records)

| draft said | correction | where |
|---|---|---|
| "composition UNESTABLISHED in every row" | **Full** composition is unestablished. A-3 **established** retain (B0/P0), scoped refusal (P1) and restoration (P2) on the configured, controlled path — composition *for named cases* | A3_RESULT.md |
| "nothing names the judged subject at conclusion" | the evaluator's cid1 **does** name it; git HEAD names different contents, and other consumers need reconciliation to that canon | A4_RECONCILIATION.md item 4; A5 identity canon |
| "missing check == failing check, an unresolved hole" | P3 exercised a *completed, failing* command. A-4 E1/E2 **implemented and exercised** infrastructure-error handling (409 WorkerUnavailable; EVALUATION_ERROR → HELD). Malformed-check classification is a separate, open policy question | A4 item 3 |
| "the product has zero retention" | runs, notes, the ledger and git history all persist and reload. What is absent is **cross-run knowledge retention**: nothing carries a lesson from run N into run N+1's planning or verification. That is why a memory-on/off comparison has identical arms today | AUTONOMY.md; LEGASUS-GOAL.md |
| "syntax sweep STARTED" | ordinary-path preservation already invokes syntax checking (`quickCheck`, W6/W8). Only the **load** sweep is candidate-0-only | A4 W6/W8; verifyProject.js |
| "LegaScreen ABSENT" | the directory holds implementations and specifications (53 files). It is **implemented, disconnected** — zero importers — deliberately | manifest row 10 |
| tally "22 / ~60 / ~15" | dropped: the rows mixed subsystems, functions, pages and prerequisites, so counts measured nothing | — |
| rows graded INTEGRATED by symbol count | relabelled *connected in source* unless a live or scripted record exists | A1_RESCORE method note |

## The inventory

### 1. Hub runtime
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| agent loop `drive()` | implemented | ordinary path | live (A-2 run 31ccad68; A-3 all cases) | established for named cases (A-3 B0/P0/P1/P2, candidate-0) | ordinary launch dies at the first model call (coder14b undeployed) |
| model tools write/edit/append/read/search/shell | implemented | ordinary path | live (A-3) | established (governed) for P0/P1 under flags | — |
| model tools `note`, `download_file` | implemented | ordinary path | source + A-4 W3/W9 | **failed** (bypass `governWrite`) | A-5 R6: route through `governWrite` |
| `spawn_subtask`, `git_undo` | implemented | ordinary path | corpus: 0 executions in 17,466 replies | untested | — |
| prompt assembly / reply parser | implemented | ordinary path | live | untested as a unit | planner call carries no ledger and no workspace state (COORD 8160) — tracked defect 1 |
| queue + supervisor | implemented | conditional (`AGENT_SUPERVISOR`) | live (campaigns) | untested with governance | — |
| approval policy + denylist | implemented | ordinary path (default strict) | scripted (strictInspection 30/0, candidate-0) | untested with governance | A-REPAIR-1 impurity check is candidate-0 only |
| task ledger `TASKS.md` | implemented | ordinary path | live | **failed** item 5 (unauthorized writer W2 into the target) | A-5 R1: bookkeeping dir |
| escalation `ESCALATIONS.md` | implemented | ordinary path | live (A-2; M0 +6 ms after settlement) | **failed** item 5 (W4) | A-5 R2 |
| workspace git checkpoints | implemented | ordinary path | live | untested against the identity canon | commits bookkeeping (W12) |
| recovery controller | implemented | conditional (campaign launchers) | live (52/52 exact restores, campaigns) | established for campaign cases | no ordinary-path consumer |
| finish verdicts / run index | implemented | ordinary path (FG-1) / candidate-0 (FG-2, FG-5) | live + scripted | untested | hub tree lacks FG-2/FG-5 |
| cost accounting, terminal, auth | implemented | ordinary path | source only | untested | — |

### 2. Model serving
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| wire protocol | implemented | ordinary path | live | — | — |
| local Ollama 1.5B/3B | implemented | ordinary path | live (M0) | established (M0 reached PRESERVE_INCOMPLETE on its own) | 7B+ crashes this laptop |
| Modal serve scripts (5) | implemented | conditional (config) | live historically | — | **`coder14b` not deployed** → the ordinary launch cannot finish an edit as configured |
| free providers | implemented | conditional | live historically | — | none survives 24/7 |
| fine-tuned runs 5–8 | implemented | conditional | scripted | — | comparability unestablished; hub may not be serving run5 |
| representation router | **absent** | — | — | — | the brand claim needs it; no held-out set exists |

### 3. Verification
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| `verify_project` finish gate | implemented | ordinary path | live | established (the gate fires) | 80-file cap; empty workspace → ok |
| syntax check (`quickCheck`) | implemented | ordinary path | live (W6/W8, every run) | **failed** item 5 (host `py_compile` writes `__pycache__` into the target) | A-5 R4 |
| load sweep | implemented | candidate-0 only | scripted (12/12) | untested | not on the hub tree |
| Docker worker + evaluator | implemented | conditional (`AGENT_WORKER_EXEC`) | scripted + live (A-3; A-4 E1/E2) | established (E1 409, E2 HELD) | worker killed mid-check untested |
| evaluator-failure distinction | **implemented** | conditional | scripted (A-4 E1/E2) | established for E1/E2 | malformed-check classification: open policy question |
| Godot / game / visual / browser checks | implemented | ordinary path | source only today | untested | reach per page not re-verified |
| `run_tests.py`, mutant validators | implemented | conditional (campaigns) | scripted | — | — |

### 4. Governance spine
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| governed writes (`governWrite` / `governedEdit`) | implemented | conditional (`AGENT_GOVERNED_WRITES` + `writeScope`); **absent on the hub tree** | scripted + live (A-3) | **established** for retain/refuse (P0/P1) | the ordinary launcher exposes neither the flag nor a `writeScope` — tracked defect 2 |
| acceptance / restore | implemented | conditional (409 without worker + bound routes); absent on hub | live (A-3 P2) | **established** for restore to the start subject | the ordinary launch cannot satisfy the env facts (trichotomy position 3) |
| authority calculus (`derive` / `observe` / `delegate`) | implemented | disconnected (`derive` has no server caller in either tree) | source only | untested | PRODUCT-0B |
| ADMIT (`runtime/epistemic-admission`) | implemented | disconnected | scripted (B-REPAIR-1 9/0) | untested on any product path | **PRODUCT-0A** |
| cid1 content identity | implemented (two modules on candidate-0) | conditional (evaluator) | scripted + live | established: the evaluator names the judged subject; git HEAD does not | reconcile consumers to the A-5 canon |
| COMMIT boundary (K8) | implemented | conditional | scripted (COMMIT-1/2, 17/0) | established for T1–T6 and ABA | the TOCTOU window inside `applyAcceptance` is unclaimed |
| ancestry / staleness; promotion receipts | implemented | disconnected | scripted | untested | no non-test caller |
| host-event emit (Phase 1) | implemented | conditional (`HOST_EVENT_LOG`, set by nothing) | source only | untested | returns on line 1 and discards its argument |
| `d2.js` refusal, `routeBound`, `authorityScope` | implemented | conditional | scripted | — | — |
| event-log restart restore | **absent** | — | — | — | nothing persists `ws.events()` |
| 13-hub-writer ruling (A-5 R1–R8) | specification | — | scripted (effect accounting on every recorded run) | 3 of 4 milestone-gate checks **fail today** | awaiting issuance, then claims on agent.js and four modules |

### 5. Legasus research corpus (`legasus/`; 42 server imports on candidate-0, 0 on the hub tree)
| subsystem | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| `runtime/epistemic-admission` (1,368 files) | implemented | disconnected | scripted | untested | 0A |
| `runtime/governedWorkspace` | implemented | conditional | live (A-3) | established for named cases | — |
| `legaknow` calculus + attack suites | implemented | disconnected | scripted | untested | 0B |
| `legacore` contracts / gates (rev2–6 frozen) | implemented | disconnected | scripted | — | — |
| `legalabs` (608 files) | implemented (research) | disconnected | scripted | — | not a product component |
| `legascreen` (53 files) | implemented | disconnected, deliberately | scripted (V0–V3 preregs) | untested | last, after 0C |
| `transfer` / BIND / BIND-CJS | implemented | disconnected | scripted (CANNOT_ATTACH for CJS) | — | BIND-CJS |
| `legaverify / gate / parse / exercise / external` | implemented | disconnected | scripted | — | — |
| `legadomain / progress / reward / commit / purpose / render` | specification (2–6 files each) | — | — | — | not built in substance |
| EH1 evidence harness | implemented | disconnected (probes only) | scripted (31/31) | — | no product consumer |
| SIM-0 / SIM-0b (evidence horizon) | implemented (research) | disconnected | scripted, sealed | — | **name collision**: an earlier "SIM-0/SIM-1" (59054803, a watcher experiment) is on the same branch |

### 6. Client (10 pages)
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| Agent / Code / History / Settings / Terminal | implemented | ordinary path | live (A-2 browser) | — | — |
| Game / Godot / Assets / Training / Strategy | implemented | ordinary path | source only today | untested | reach unverified |
| governed-run toggle in AgentPage | implemented (candidate-0) | conditional (409 on hub) | live (the 409) | — | **the client sends no `writeScope`** (0 occurrences, both trees) — tracked defect 2 |
| client divergence (712 vs 746 lines) | — | — | source | — | reconcile |

### 7–13. Support layers
| system | Implementation | Product connection | Evidence | Composition | Next gap |
|---|---|---|---|---|---|
| Google integration | implemented | ordinary path | source only | untested | never exercised in a campaign |
| asset library + licences | implemented | conditional | scripted (`rescanLicences`) | — | repo stays private: no-redistribute packs |
| training-data factory | implemented | disconnected (offline) | scripted | — | comparability rescore |
| experiment launchers (~35) | implemented | **these alone set the governance flags** | scripted / live | — | — |
| fuzz (`fuzzForever` PID 21088) | implemented | disconnected | live, on **old** code c952cbc9 | — | candidate-0 campaign not started |
| offline replay rig (164 scenarios) | implemented | disconnected | scripted | — | — |
| engine era (`ai-native-engine`) | implemented | disconnected since August | live then | — | farming milestone unmet |
| session infra (memory hierarchy, COORD, hooks) | implemented | for sessions, not the product | live | — | **cross-run knowledge retention in the product: absent** |
| ops (`start-hub.bat`, Dockerfile, private repo) | implemented | ordinary path | live | — | keep-awake; Dec-2026 server; the laptop |
| vision surfaces (watcher, phone, ask-why, FULL/AUTHORIZE, orchestrator) | **absent** | — | — | — | — |

## Tracked defects — top level, so they are not buried under subsystem rows

| # | defect | what the records establish | status |
|---|---|---|---|
| 1 | **planner-goal omission** | the planner call is `[system: plannerSystemFor(goal), user: history[1] + planTaskFor(goal)]` — no ledger, no workspace state (COORD 8160); A-2's planning step was skipped on the model error; A-5 leaves the M0 `f()→h()` drift's origin (planning / generation / feedback) unseparated | named by the reviewer as **reproduced**; the reproduction record is not among this tree's A-series files — **locate and link it before any repair** |
| 2 | **UI writeScope omission** | `POST /agent/start` reads `writeScope` from the body (agent.js:4531); `client/src` contains **0** occurrences in both trees — the UI can never issue a governed scope, so every UI run is B0 (authorizes nothing) | **verified here** (source) + A-3 B0 |
| 3 | **worker `.ok` bug** | `worker.js:178/205/249/286` and `evaluator.js:93–108` branch on `.ok`; A-4 E1/E2 exercised the failure paths that exist | named by the reviewer; **not located in the records I can read** — tracked as stated, not repaired blind |

## Amendment 1 (2026-10-06) — the three defects, relayed from the research workspace and verified locally

The reproduction records live in the reviewer's research workspace, not in this tree. Each expression was
checked on the local candidate-0 **456156e7** before being recorded. Line numbers below are the local ones;
where they differ from the relayed ones the divergence is named.

| # | defect | relayed finding | local 456156e7 | status |
|---|---|---|---|---|
| 1 | **planner-goal omission** | candidate `agent.js:4103` uses `run.history[1]?.content`; supplied-file content or prior notes occupy that slot, so the planning request carries no goal. The scratch fix includes `run.goal` explicitly; all three context variants then retain it | **present at `agent.js:4109`** (line divergence, same expression): `${run.history[1]?.content \|\| ('GOAL: ' + run.goal)}` — the goal is appended only when the slot is empty | CONFIRMED on the local tree. This is a different finding from the draft's "no ledger / no workspace state" (COORD 8160); both stand, separately |
| 2 | **UI writeScope omission** | confirmed; but "every UI run is B0" does not follow — a missing scope and governance being OFF are different conditions. A governed request without a scope may refuse all writes; it is not the writes-off baseline | `client/src`: 0 occurrences, both trees | CONFIRMED; **the B0 inference above is withdrawn**. Correct statement: a UI run never declares a scope; under `AGENT_GOVERNED_WRITES=1` that is a scope-less governed run (behaviour to be measured), under OFF it is B0 |
| 3 | **worker `.ok` bug** | `governance.js:89` checks `if (!(await workerAvailable()))`; the function returns `{ok:false,…}` on failure — truthy — so the early check passes and git initialisation proceeds before evaluation fails. Checking `.ok` refused before that mutation | **present at `governance.js:89`** exactly; `worker.js:63/65` returns `{ok:true,…}` / `{ok:false,…}`; `governance.js` is the only non-test caller | CONFIRMED on the local tree. Note: A-4's E1 "409 WorkerUnavailable" therefore did not come from this check; it came through the evaluator's own `WorkerUnconfirmed` path — the two are distinct and only one of them works |

Acceptance condition for repair 3, recorded now so it is not weakened later: E1 establishes that an
unavailable-worker refusal exists; it does NOT validate the broken early check. The repair passes only if
refusal happens **before workspace mutation** — the target digest before `prepareGoverned` equals the digest
after the refusal (no `git init`, no start commit). A repair that returns 409 after the mutation would pass a
naive status test and change nothing.

None of the three is repaired here. They stay separate from PRODUCT-0A by design: 0A's claim is "admission
leaves existing behaviour unchanged", which is only measurable if the before-arm and after-arm differ by 0A alone.

## Draft, as written (2026-10-06, chat) — preserved verbatim in substance, not corrected in place

INTEGRATED (hub tree): controller; finish gate; preservation; receipts; restart persistence; workspaceStamp;
approval modes; supervisor; task ledger; Agent/Code/History/Settings/Terminal pages; Google; ops.
STARTED: governed writes; acceptance; authority calculus; cid1; ancestry; promotion receipts; host-event; EH1;
SIM-0; fuzz; recovery; finish verdicts; cost; load sweep; Docker worker; run_tests; mutants; Modal; free
providers; fine-tunes; all legasus/* subsystems; assets; training factory; ~35 launchers; replay rig; engine era.
NOT STARTED: 0A/0B/0C; 13-writer ruling; note/download via governWrite; evaluator-failure distinction;
event-log restore; LegaScreen hookup; watcher; phone; ask-why; FULL/AUTHORIZE; orchestrator; retention;
router; comparison vs fixed methods; farming milestone; FIM-BOUNDARY-1; coder14b deploy; keep-awake; server.
Tally: ~22 / ~60 / ~15. "The not-started column contains the product."

Overstatements in that draft, corrected above: composition "everywhere"; "nothing names the subject";
evaluator-failure "unresolved"; "zero retention"; syntax sweep "started"; LegaScreen "absent"; count-graded
rows called INTEGRATED; the tally.

## The supported conclusion

There is an existing hub, substantial implemented machinery, and **demonstrated partial governance composition
on a configured path** (A-3). The ordinary launcher does not expose that path: a concrete, named deployment and
integration gap. The intended unified product still needs deployment of the governed path, complete effect
coverage (A-5 R1–R8), and the missing user surfaces.
