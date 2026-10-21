# PRECEDENT-3 — probe once, replay deterministically, and what that is actually buying

**Date:** 2026-09-29 · **Source:** user-supplied archive `MarieCP-main.zip`, read-only, nothing executed.

**Scope of this reading:** `mini_marie/kgqa/offline_runner.py` and the recording helpers. Not a
characterisation of the project.

## What I verified

`offline_runner.py` opens with one line: *"Deterministic offline replay (no LLM) after online probe."*
That is the design, and the code matches it:

- `_replay_workflow_offline` dispatches to a domain-specific `replay_workflow_offline(recording_path,
  offline_cap=...)`,
- which **produces a new recording path** — replay is an execution that emits its own record, not a read
  of the old one,
- under an `offline_cap` defaulting to **500,000**,
- and `replay_offline` resolves the domain from the recording itself (`recorded.get("workflow_id")`),
  never from a fresh interpretation of the question.

**Not verified:** the online probe's own row limit. The asymmetric naming (`offline_cap`, with no
matching online cap in the replay path) is consistent with the user's description of a bounded probe,
but I did not confirm it, and this record claims nothing about it.

## The idea that is genuinely new here

It is **not** "record what happened so you can check it later." It is a **split between who decides and
who works**:

> The model decides the *sequence* once, cheaply, against a bounded probe.
> A deterministic layer then re-executes that exact resolved sequence, at full scale, with no model in
> the loop.

The model is never asked a second time what it meant. Its output is a *resolved plan* — tool calls with
arguments already bound — and everything after that is execution.

That is different from what this project built today. `changeRecordRecompute.mjs` replays preserved
artifacts **at the same scale, to check agreement**: it answers "would an outside reader reach the same
verdict." MarieCP's replay answers a different question — "can the expensive, uncertain step be done once
on a sample and the real work done deterministically afterwards." One is verification; the other is a
cost and trust split.

Worth noting as convergence rather than borrowing: both arrive at the same underlying rule from opposite
directions — **do not reconstruct downstream what was established upstream.** Today's version of that
rule came out of finding an audit that rebuilt its own wires instead of reading the run's, and a checker
that paired requirement effects to test steps by array position. Same rule, found by failure.

## The translation, and where it stops

| MarieCP mechanism | what it would be here |
|---|---|
| online probe, bounded | observe the delivered baseline under bounded scope — **this exists** (`behaviorModel.observeBaseline`) |
| `call_trace` with resolved arguments | the change record's FACT events, with content-addressed artifacts — **this exists** |
| deterministic offline replay, no LLM | re-run verification from the record without re-asking the model — **exists for verification, not for doing the work** |
| replay at larger scale than the probe | **does not exist, and may not transfer**: a code edit is not a query with a row cap. There is no obvious "same plan, more rows" axis for a single-file change |

That last row is the honest limit. The probe-then-scale split is powerful where the work is *parameterised
by volume*. A governed code edit is not. The transferable half is the discipline — resolve once, execute
from the resolution — and the scale-up half may simply not have an analogue here.

## What none of the four precedents supplies

Stack-manager deploys and discovers. The derivation agent coordinates dependencies, freshness and
concurrent claims. The MCP tool layer types the surface and locks the protocol. MarieCP resolves once and
replays deterministically. **None of them gates an effect on evidence admitted for that specific target at
that specific revision, with a recovery path if the evidence does not hold.** That remains the part of
this that is not borrowed, and it is also the part that is not yet proven.

## The standing caution, stated once more because the evidence for it got stronger today

Four precedents now line up behind the architecture. That is exactly the condition under which a
hypothesis stops being falsifiable — it begins to feel established by analogy. The bar in
`INTEGRATION-1_DEFINITION.md` has not moved: **does an evidence-governed work-state produce more verified
progress per compute than the same generator in a linear loop?** Nothing in any of these four archives
moves it, because none of them ran that comparison for software change. Adopting a pattern *because it is
proven elsewhere* is how an architecture becomes unfalsifiable, and this project's own history says the
useful findings came from things breaking, not from things lining up.

## Named next work — unchanged, and still cheap

1. Weld the decoding parameters and test the weld hostilely (PRECEDENT-1).
2. Give the executor a stale-vs-denied axis, with the claim read-back as the model (PRECEDENT-2).
3. Dual-write a model-calling run into the change record.
4. Only then coordination, and only against a sequential baseline.
