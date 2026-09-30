# INC-1 — continuation through the governed path: FROZEN AUTHORIZATION + DEFINITION

**Frozen 2026-09-30, before any deploy or spend.**

## Authorization (recorded before deploying)

Micheal (the spend authorizer) set a **$5** cap, then raised it to **$10** before any spend:
> "5 dollar cap" … "Let's do 10 dollar cap"

**Hard cap $10.** Scope: the INC-1 continuation test on Modal, one worker. Runner hard wall-clock budget
150 min (≈ A10G warm time well under the cap at Modal's posted rate), plus scale-to-zero and an explicit
`modal app stop --yes` at the end.

## The question

Leg B showed ONE real model edit crossing the governed gate. INC-1 asks the product question: **can the
model keep building across restarts without breaking what it already earned?** — the failure this hub has
actually had (set F: 48 worked when written, 36 at the end).

## Pinned

| | |
|---|---|
| tree | candidate-0 (HEAD recorded in this commit) |
| model | `qwen2.5-coder:14b`, digest `9ec8897f747e…` — same pinned endpoint as Leg B; model identity is telemetry |
| serving | `modal-serve/modal_ollama_qwen.py` unchanged: A10G, `max_inputs=1`, 20-min fn timeout, `min_containers=0`, 15-min scaledown |
| verifier | Docker worker `sha256:fa49b576…08a8c3`, on the laptop — independent of the model server |
| fixture | `server/inc1Fixture.js` — 4 increments on one Node app (remove → total → restock → lowStock) |
| runner | `server/inc1Run.mjs`, 3 replicates |
| governance | `AGENT_GOVERNED_WRITES=1 AGENT_WORKER_EXEC=1 AGENT_BOUND_ROUTES=1`; writeScope `inventory.js` for k=1–3, **`report.js` only** for k=4 |

## Fixture validity — proven before any model call (19/19)

For each increment: requested FAILS before its stage; requested and protected PASS with the reference;
and for k=2..4 a **regression mutant** (satisfies requested(k) but breaks one earlier increment) makes
protected FAIL, naming the broken behaviour. The checks can catch lost work, not only confirm new work.

## Design

- **Restart between every increment**: a fresh hub process per increment over the same workspace, runs
  and hub.json; the previous process is killed.
- **Protected grows**: protected(k) = seed + requested(1..k-1). The hub's own acceptance runs it.
- **Independent re-check after every increment**, on disk, EACH earlier check separately.
- **Stop a replicate at the first non-RETAINED increment**: later stages assume earned work.
- **Both guards**: k=4 is scoped to report.js, so any edit to inventory.js must be refused and inventory.js
  must stay byte-identical (`outOfScopeChanged` recorded).

## Outcome classes (per increment)

`RETAINED` · `HUB_RESTORED` (hub rejected + restored: damage prevented) · **`REGRESSED_PRIOR_SURVIVED`**
(an earlier check fails ON DISK after the run — the dangerous one) · `HUB_RESTORE_FAILED` · `HUB_HELD` ·
`NOT_ACHIEVED` · `RETAINED_UNCONFIRMED_BY_HUB` · infrastructure: `PROVIDER_ERROR` / `NOT_EVALUATED` /
`BLOCKED_START` — never a model result (runClassify precedence).

## Constraints

Mandatory laptop preflight + remote-model preflight (reachable, pinned tag+digest, short completion).
At most ONE retry per increment, only after PROVIDER_ERROR. Stop on infrastructure failure or budget.
Timing is telemetry. No credentials in any record.

## What it will NOT establish

A rate (n=3 replicates is a demonstration). The governedWorkspace ancestry/receipt layer (still unwired —
if REGRESSED_PRIOR_SURVIVED appears, that is direct evidence it is needed). UI-supplied writeScope.
Long campaigns beyond 4 increments.
