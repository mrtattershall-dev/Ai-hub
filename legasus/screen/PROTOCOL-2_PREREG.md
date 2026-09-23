# PROTOCOL-2 — the repaired controller, frozen before generation

Date: 2026-09-23. Status: **PROSPECTIVE.** No PROTOCOL-2 generation has run.
v1 and its result are kept intact (`server/protocolV1.js`, `PROTOCOL-1_RESULT.md`); this is a
new version, not an edit of the tested one.

## What changed, and only this

v1's phase vocabulary admitted **neither** `run_python` nor `run_command` in any phase, while the
shared instructions given to BOTH arms say *"use run_command or run_python to inspect and test
your changes."* Six of twelve refusals were `run_python`. And v1's VERIFY instruction said
*"nothing is required from you"*, which invited the model to wait — it invented
`wait_for_verification`, a tool the hub does not have, twice.

**v2:**
1. `run_python` and `run_command` are legal in **VERIFY**. Still bounded — not available in
   OBSERVE or DECIDE — but reachable, which under v1 they never were.
2. A test result advances the phase: a ran test returns the model to DECIDE **with the result**,
   whether it passed or failed. A failing test is information, not an apparatus problem.
3. The VERIFY instruction names the real tools and asks for a turn, instead of telling the model
   to do nothing.

**The rule this encodes:** a controller may bound *when* a promised tool is available. It may not
promise a tool in the shared instructions and then never admit it.

Verified through the real agent route (`protocolIntegration.test.mjs`, 23/23): `run_python`
executes, is not refused, VERIFY is reached, the controller responds to the test result with the
next phase, the run terminates, and no instruction names a nonexistent hub tool.

## The two questions, kept separate

1. **Does the revised controller change verified completion?**
2. **What does each arm spend** — calls, tokens, seconds — **across all attempted tasks,
   including failures?**

(2) is reported over every attempted task, not only successes, so a cheap arm cannot look
efficient by failing early.

## Design

| | |
|---|---|
| tasks | the same five frozen tasks |
| arms | CONTROL (no controller) vs TREATMENT (v2) |
| **runs per cell** | **3** — v1 used 1, which could not separate an effect from run-to-run variation |
| order | interleaved in adjacent pairs, leading arm alternating, recorded before the run |
| snapshots | each run from its task's own seed; `chain: false` |
| everything else | identical: model, backend, tools, worker, evaluator, acceptance policy |

Three runs per cell is the smallest number that lets run-to-run variation be **observed** rather
than assumed. It is still small, and will not support a significance claim.

## Budget and stopping rule, fixed now

- 300s per run, **60 minutes total**, 120s reserve.
- **No tuning during the run.** Not the controller, not the prompts, not the tasks, not the
  budgets. If something looks wrong mid-run it is recorded and the run continues or stops; it is
  not adjusted.
- If the budget truncates, it truncates on a **complete pair**, and remaining runs are recorded
  UNATTEMPTED.
- No retries and no rescue instructions for either arm.

## Reading rules, fixed in advance

- Equal completion counts would **not** establish that the controller makes no difference.
- Differing totals with n=3 per cell would **not** establish an effect either; they would
  motivate a fresh-task evaluation, not conclude one.
- Efficiency numbers are **measurements from these runs**, never estimates of repeatable savings.
- Whether any individual refusal cost a task requires looking at that task, not at the totals.

## Still a development comparison

The five tasks remain already-inspected development cases. Any result is labelled as such.
