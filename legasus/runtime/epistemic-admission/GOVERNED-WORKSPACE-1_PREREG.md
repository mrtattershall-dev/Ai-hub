# GOVERNED-WORKSPACE-1 — an asynchronous governed workspace

**Status: FROZEN DEFINITION. Written before implementation. Nothing built yet.**

## The principle

> Do not make intelligence serial. Serialize only conflicting effects.

Legasus currently runs as a funnel: observe → choose one plan → generate → test → act. That is safe and
it bounds useful flow. This subsystem lets observers, planners, diagnostics, simulations and candidate
generators run asynchronously and publish append-only findings, while **only actions affecting the same
scoped target must synchronize**.

## What this is, and what it is not

**It is a coordination and authority experiment.** It measures whether versioned evidence plus local
authority lets parallel processes act without increasing unsafe or incoherent effects.

**It is not** evidence about model intelligence, capability, or repair quality. No model is involved and
no paid run is part of it.

## Where it lives, and why not elsewhere

`legasus/runtime/governedWorkspace/`, in the **`ai-coding-hub-consolidation`** worktree on
`consolidation/connect-components` — because this is where `governedEdit`, `legaknow`, and the E0/E1/E3
bindings actually exist.

It was **not** built in `ai-coding-hub-phase1`, where today's AUDIT-2 work lives. That worktree contains
no `governedEdit`, no `legaknow`, no admission layer and none of the E0/E1/E3 bindings. Building a
commit path there would have required writing a private executor — **exactly the bypass around
`governedEdit` this design forbids** — and any green suite over it would have proved nothing about
authority. The authority stack is deliberately **not** merged into phase1 to make this convenient.

**AUDIT-2, stage 3 and stage 4 code and records are not modified and their outcomes are not
reinterpreted.** This subsystem is separately versioned with its own tests and its own record.

## What it governs

| | |
|---|---|
| scopes | `workspace` and `file` only |
| effects | file edits inside a temp workspace root |
| commit path | `governedEdit({ authority, action, root, contract })` — the existing executor, unchanged |
| authority | supplied by the caller from the existing store; **never minted or widened here** |

## What it does NOT govern — stated so no result can be read as covering it

- **child-process and shell writes** — a `git` invocation, a spawned tool, any subprocess
- **external network effects** — HTTP, model backends, deployments
- **symlinks and Windows junctions** — not solved here; a target reached through one is out of scope
- **distributed clocks** — ordering is local, single-process, monotonic within one event log
- **real-world control** — no robot, conveyor, line or physical asset. The warehouse framing is the
  motivating analogy for scoped conflict, not a claim of coverage.
- **concurrency beyond in-process interleaving** — findings and packets may be produced concurrently
  within one Node process; multi-process or multi-host coordination is not implemented

## The authority boundary is unchanged

**Evidence establishes what may be believed. It does not create permission.** This subsystem adds a
coordination layer *in front of* the existing effect boundary and weakens nothing behind it:

- E0 target binding, E1 revision binding, E3 contract-declared evidence obligations all still apply,
  and are enforced where they already are — inside `governedEdit`, against the bytes on disk at commit
  time.
- An `ACTION_PREPARED` packet is **a proposal, not a permission**. Preparing one grants nothing.
- No controller code constructs, elevates, or re-scopes an authority token.
- A bare epistemic token authorizes no write, exactly as now.

## Event record

Append-only, with `OBSERVATION`, `HYPOTHESIS`, `PROPOSAL`, `EVALUATION`, `AUTHORITY`,
`ACTION_PREPARED`, `ACTION_COMMITTED`, `ACTION_REFUSED`, `INVALIDATED`. Every event carries an id,
timestamp, scope, provenance, dependency ids, and a content hash where one applies.

**Uncertainty is preserved as uncertainty.** A `HYPOTHESIS` never becomes an `OBSERVATION` by being
depended upon, and a packet citing a hypothesis records that it did.

## Freshness and conflict

Revision is **the digest of a target's current bytes**, which is what `governedEdit.revisionOf` already
uses — not an mtime and not a label, both of which can agree while content differs.

- a change to `a.js` invalidates packets depending on `a.js` at an older revision
- a change to `b.js` does **not** invalidate a packet scoped only to `a.js`
- two prepared packets on the same file and revision: **exactly one commits**; the other is refused as
  stale or conflicting, and the winner is decided by the real effect path, not by the coordinator
- one scope changing never halts unrelated scopes

## Refusal reasons

From `governedEdit`, unchanged and re-exported rather than reimplemented:
`ACTION_DENIED_TARGET_ESCAPES_ROOT`, `ACTION_DENIED_SCOPE_MISMATCH`,
`ACTION_DENIED_REVISION_MISMATCH`, `ACTION_DENIED_UNADMITTED_EVIDENCE`,
`ACTION_DENIED_NO_NORMATIVE_AUTHORITY`, `ACTION_DENIED_OPERATION_UNSUPPORTED`.

Added by this layer, named distinctly so they can never be mistaken for an authority decision:
`PACKET_STALE_DEPENDENCY` · `PACKET_EXPIRED` · `PACKET_LOST_CONFLICT` · `PACKET_DEPENDENCY_INVALIDATED`.

Every refusal must be explainable: which rule, which scope, which revision, which dependency.

## Success criteria

1. A valid owner-issued authority at the current revision with required evidence produces **the exact
   intended bytes**, written by `governedEdit`.
2. Changing only the target, only the revision, or invalidating a cited dependency each produces a
   refusal with **byte-level non-effect**.
3. An unrelated file changing leaves an eligible packet eligible.
4. Two conflicting packets produce **exactly one** effect.
5. No authority, or a bare epistemic token, produces no write.
6. A **positive control** proves the system does not refuse everything.
7. Replaying the event log into a fresh model reaches **the same admissibility decisions**.
8. Unrelated observers can publish while a packet is prepared; only the relevant revision dependency
   blocks commit.

Every negative test asserts **both** the refusal reason and byte-level non-effect. Every positive test
asserts real bytes changed **through the executor**.

## The claim this definition refuses to let the result make

**A green unit suite does not prove the controller uses this path.** Today, in the other worktree,
`acceptanceDecision` had 30 passing assertions while nothing consumed it. So:

- tests drive the **real** commit path, not a copy of the predicate;
- until a caller is shown routing through this subsystem, the result is "the layer behaves correctly in
  isolation" and **not** "Legasus coordinates through it";
- uncovered write routes are reported as uncovered, not omitted.

## Reported afterwards, separately

Observed parallelism · stale and conflicting actions prevented · legitimate independent actions allowed
· actual effects through the executor · **uncovered write routes** · apparatus defects found.
