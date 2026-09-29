---
name: governed-ui-runs-and-two-leaks
description: 2026-09-24: acceptance path now governs UI runs via /agent/start governed.checks (protection NONE label otherwise); two leaks found by the tests - finish gate ran model code on the HOST under bounding since PILOT-1, and autocrlf made every RESTORED workspace git-normalised not byte-identical
metadata:
  type: project
---

2026-09-24 (phase1 worktree, commits 6947984 / e9e1ebd). Call ledger + per-call deadline below the task budget (DEADLINE_LOCAL_ABORT, serverOutcome UNKNOWN, empty reply = COMPLETED_EMPTY); removed tools answered "TOOL UNAVAILABLE in this configuration" with run_python/run_command; `governance.js` reuses evaluate()+applyAcceptance() for hub runs that declare checks; every run carries `protection: NONE | BEHAVIORAL_ACCEPTANCE | FAILED_TO_APPLY` and the UI shows it.

Two leaks the new tests found: (1) the finish gate (`verifier.verify` in agent.js) executed `python <entry>` on the HOST under AGENT_BOUND_ROUTES=1 in every campaign that reached a finish - ROUTE-BOUNDING_QUALIFICATION's "host execution closed" was incomplete; now closed under bounding (`route_closed` step, finish UNVERIFIED by hub, judged by evaluator). (2) core.autocrlf: every RESTORED workspace matched by tree id and recheck but had CRLF where LF was verified; repos now set autocrlf=false.

**Why:** tatte: the protection demonstrated in campaigns must govern the entry point actually used; silent failures are the class - both leaks reported OK while the property claimed was false.

**How to apply:** governed runs need AGENT_WORKER_EXEC=1 + AGENT_BOUND_ROUTES=1 or the start is BLOCKED (never downgraded). System prompt still tells the model to run verify_project (agentPrompt.js:172,285) - a prompt change, left for a measured run. Next paid benchmark is allowed only now that "call never completed" is distinguishable from "model failed" ([[bench2-stall-moved-not-gone]]).

**CHECK-1 (2026-09-24, $10 cap, ~$0.20 spent, 8m41s):** all four repair readings positive on the six defect tasks — 0 timeouts where BENCH-2 lost 4 to unreturned calls, one live DEADLINE_LOCAL_ABORT correctly recorded (UNKNOWN, unconfirmedRemoteCalls 1), 0/90 replies named a removed tool, the one finish carried CLOSED_UNDER_BOUNDING. Outcomes (1 RETAIN, 2 RESTORED) are n=1 and non-attributable.
