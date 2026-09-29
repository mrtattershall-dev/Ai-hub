# CONSOLIDATION-1 — read-only inventory, pass 1

**Date:** 2026-09-29 · **Mode:** read-only. Nothing merged, nothing rebased, nothing checked out, `main`
not moved, no worktree deleted, no history rewritten. `server/agent.js` and the files under the active
session's claim were **not touched**.

## Why this was entered

Not because 703 commits ahead is inherently bad. Because fragmentation produced an **observed
coordination failure**: two sessions independently converged on the same integration boundary
(controller → governance in `agent.js`), and the second came close to staging the first's uncommitted
work. The protocol held — the tree was inspected, the foreign edits were seen, COORD was checked, and
the work stopped. A caught near-collision, not lost work. But it is no longer hypothetical debt.

---

## Finding 1 — the debt is four heads, not fourteen

Branch containment, computed with `merge-base --is-ancestor` rather than read off names:

```
integration/epistemic-admission (479)
  └─ consolidation/merge-integration-indent (487)
       └─ consolidation/connect-components (704)   ← candidate baseline
            └─ also fully contains phase1-host-event (120)

fix/unverified-finish-recorded (123)
  └─ fix/append-preservation (125)
       └─ integration/governed-slice (130)

phase1-host-event (120)
  └─ phase2-d2-intervention (359)                  ← the Legasus research line
```

Fifteen further branches are **0 ahead of main** — fully absorbed or abandoned.

## Finding 2 — relative to the candidate baseline, the outstanding work is tiny

| head | commits NOT in `connect-components` |
|---|---|
| `fix-rollback-bounded` | **0** — fully absorbed |
| `fix-interrupted-eviction` | 1 |
| `fix-ledger-taskdone` | 2 |
| `fix-tolerant-indent` | 2 (both records) |
| `integration/governed-slice` | 11 |
| `main` | 9 |
| `phase2-d2-intervention` | 152 |

So most of the "703 commits of debt" is **already consolidated**. What is scattered is small.

## Finding 3 — `main` is not an ancestor of anything active

`main` is at `ae1aeee9`, **2026-09-12 — seventeen days stale**, and every active branch is **9 commits
behind it**. Those nine are the set H / I / J / K measurement results and their preregistrations. They
are RESEARCH/EVIDENCE: the findings must survive, the implementation need not enter the product. They
are also the reason `main` cannot be treated as the baseline without deciding what to do with them.

## Finding 4 — the true conflict surface is THREE FILES

Every other file is one-sided: touched on one line and not the other, which merges without a decision.

| file | `phase2-d2-intervention` | `connect-components` |
|---|---|---|
| `server/agent.js` | 3 commits | 11 commits |
| `server/agentParse.js` | 1 | 1 |
| `server/agentPrompt.js` | 1 | 3 |

`phase2-d2-intervention` adds **119 new files under `server/`** that have no baseline counterpart, and
1252 under `legasus/` which are almost entirely records, bench corpora and run data.

## Finding 5 — THE ONE THAT MATTERS: the two lines are complementary, not competing

This was the surprise, and it changes what consolidation is for.

**`phase2-d2-intervention` — the three unmerged `agent.js` commits are the PRODUCT-0 milestone:**

| commit | what it is | milestone leg |
|---|---|---|
| `5c59cb3f` | `server/lessons.js` (153 lines) — the `lesson` tool, automatic CONFIRMED capture when a failed call is followed by a success on the same file, opening-context injection, recall at the moment a matching failure recurs, and a DETECT guard that refuses a matching edit before it reaches the files. Survives a restart. | *avoids a previously met mistake* |
| `575e4207` | the **play kind** — a browser game diagnosed, checkpointed, restored and judged like a module; `gameSnapshot()` is the target identity | *builds a playable game*, *survives restart* |
| `11c8efd0` | the farm as a **chain of playable increments** — `farm-i1..i4`, each a small request, every earlier step protected, `dependsOn` the previous, blocked on a failed prerequisite | *adds a feature without breaking earlier ones* |

**`connect-components` — its eleven `agent.js` commits are all governance and controller quality:**
A-4 governed writes through `governedEdit`; the consolidation bridge putting calculus and controller in
one tree; refusing an empty write instead of answering "OK: wrote 0 bytes"; handing a refused write the
file back; guards that act rather than only detect; tolerant-edit re-indentation; context window decided
by tokens.

**Neither supersedes the other.** The product capability the milestone needs is on one branch, the
governance is on the other, and neither session knew. The merge is a **union, not a contest** — which
is a very different job from the one "703 commits ahead" implied.

---

## What this does NOT yet establish

Pass 1 is topology and conflict surface. It does not yet answer the question that decides classification:

> **a mechanism with tests but no production consumer is not LIVE PRODUCT.**

Two read-only inventories are running to settle that, per mechanism and per unique commit:
canonical implementation, the evidence for it, the **non-test production consumer reachable from
`server/index.js`**, dependencies, and any competing implementation. Their results belong in pass 2,
and no branch is classified LIVE PRODUCT until a consumer is named.

The one already known: `governedEdit` is wired into `agent.js` at eight write sites and is
**unreachable on the ordinary path** — `AGENT_GOVERNED_WRITES` is set nowhere in the repository, and
`setRunAuthority` is called only by `classA-governed-child.mjs` and `chain-child.mjs`, both harnesses.
An active session is closing exactly that edge and **must not be disturbed**.

## Exit condition, unchanged

CONSOLIDATION-1 exits only when one candidate commit/tree can be named and the complete live path drawn
from an ordinary user request to a surviving filesystem effect **without jumping between branches**.

---

# Pass 2a — classification of the small heads

Read-only. Every row below was classified against the rule that decides everything: **a mechanism with
tests but no production consumer is not LIVE PRODUCT.** The two claims that carry weight were
re-verified by hand rather than taken on report.

## Finding 6 — THE X ALREADY EXISTS ON AN UNMERGED BRANCH

`integration/governed-slice` built the run-start authority issuance **weeks ago, into the real route**:

```
server/agent.js:4390   function startRun(..., { writeScope = null })
server/agent.js:4405     setRunAuthorities(writeScope ? issueWriteScope(writeScope) : [])
server/agent.js:4531   POST /agent/start reads writeScope from req.body
server/agent.js:4533     ...and rejects a non-array with 400
```

That is exactly *"owner-side code issues the permitted scope"* — the edge I was asked to close, and the
edge an active session is closing right now on `connect-components`. **Three independent lines have now
converged on the same boundary.**

Why it is inert, precisely — and it is NOT "unwired":

1. `AGENT_GOVERNED_WRITES` is set **only** in `governed-dispatch.test.mjs`. No shell script, no config,
   no env file. `STEP5_AUTHORITY_CONTINUITY_PREREG.md:160` states the intent explicitly: *"It does not
   authorize enabling the flag anywhere."* The flag being off is a deliberate, recorded decision.
2. **No client ever sends a `writeScope`** — zero hits under `client/`. So even with the flag on, every
   ordinary run would issue an empty authority set.

So the remaining product edge is smaller and more specific than "make the controller route through
governance": that routing exists on two branches. What is missing is **a requester that declares a
scope**, and a decision to turn the flag on.

## Finding 7 — two real product fixes are live-buggy on the baseline

| commit | head | status | evidence |
|---|---|---|---|
| `5c16708c` | `fix-interrupted-eviction` | **LIVE PRODUCT** | the bug is live on the baseline: `connect-components:server/agent.js:2892` still filters only `running`/`awaiting_approval`, so an `interrupted` run is still evictable, and `RESUMABLE_STATUS` has **0 hits** on the baseline. Consumer is the ordinary `POST /:id/resume` route plus four siblings, mounted un-gated at `index.js:472`, with a real client caller (`client/src/lib/api.js:129`). No flag. |
| `b3cee6c7` | `fix-ledger-taskdone` | **LIVE PRODUCT** | baseline `mark()` still has prefix-greedy `parseInt(which, 10)` and bare `includes(q)`; no carried-task refusal, no already-done guard. Consumer is the `task_done` tool on the ordinary loop. Distinct and unlanded. |

## Finding 8 — one duplicate, and one branch that does not contain its own namesake

- `d0011558` is **SUPERSEDED** — `620a069a` on the baseline makes the byte-equivalent change to `mark()`
  and ships equivalent coverage.
- `c96f21a0` (append-route duplicate refusal) is **SUPERSEDED** — its one functional line landed via
  `141b6342`. The benchmark half stands alone as evidence.
- `fix-tolerant-indent` contains **no fix**. Both unique commits are documents. The tolerant-indent
  mechanism the branch is named for is already on the baseline. Its own `AUDIT_2026-09-29.md` claim that
  "appendFix greps to zero on connect-components" is **now stale** — `141b6342` landed it.

## Finding 9 — a genuine semantic conflict, not a merge conflict

`f5ba97b8`, `5fdcd450`, `c952cbc9` carry `legasus/screen/PROTOCOL-1_PREREG.md` asserting
**"PROSPECTIVE — no PROTOCOL-1 evaluation has run."** The baseline already carries
`PROTOCOL-1_RESULT.md`: *ran 2026-09-23, ten runs, control 3/5, treatment 3/5* — plus `PROTOCOL-1_ORDER`,
`PROTOCOL-1_REPORT.json` and a whole `PROTOCOL-2_*` successor series.

Landing these puts a "not yet run" freeze into a tree containing that run's result. `PROTOCOL-1_PREREG.md`
is **absent** on the baseline, so there is no text to diff against, and the two trees' `legasus/screen`
corpora are near-disjoint (baseline ~103 records the branch lacks; branch 11 the baseline lacks).
**UNKNOWN/CONFLICT — must not be merged until a human says which document governed the 09-23 run.**

## Finding 10 — everything on `main` is measurement

All nine `main`-only commits are under `measurements/` — sets H, I, J, K, their preregistrations and
scoring tools. **RESEARCH/EVIDENCE.** One (`7fc4222a`) says in its own message that nothing automated
reads the copy it syncs. None of it is runtime.
