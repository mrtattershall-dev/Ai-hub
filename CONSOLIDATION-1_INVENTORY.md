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

## Finding 11 — PROTOCOL-1: prospectivity IS established. Treat as history, preserve the prereg.

Resolved by chronology, not by preferring the newer document. The question asked was the only one that
matters: **was the preregistration frozen before the run recorded in `PROTOCOL-1_RESULT.md`?**

The run: **2026-09-23 10:04:27Z → 10:11:06Z**. Commit dates are −0500, so the run is 05:04:27 CDT.

| artifact | authored (machine) | relative to the run |
|---|---|---|
| `f5ba97b8` archive the screen records | 2026-09-22 23:43:46 | **before** |
| `5fdcd450` Amendment 1 | 2026-09-22 23:44:29 | **before** |
| `c952cbc9` Amendment 2 | 2026-09-23 04:44:35 | **before, by 19m 52s** |
| `PROTOCOL-1_RESULT.md` (`15877496`) | 2026-09-23 05:35:29 | **after** the run ended |

**All three preregistrations predate the run.** The prospectivity claim holds.

**The corroboration matters more than usual here.** This project has a recorded incident of frozen
amendments being stamped with *invented* times, dated 2026-09-22 — the same window. So the git dates
(machine-generated) were checked against the documents' own self-stamps, and the self-stamps are
**date-only** — "Preregistered 2026-09-22", "Date: 2026-09-23. Status: PROSPECTIVE" — with no clock
times to invent. Self-report and machine record agree, and neither rests on the other.

**Disposition: PRESERVE as the governing historical artifact**, per the rule that a prereg established
as prospective survives even though the baseline currently lacks it. It is a *history* question and was
answered as one; nothing was cleaned up aesthetically, and the near-disjoint `legasus/screen` corpora
(baseline ~103 records the branch lacks, branch 11 the baseline lacks) are a union to be preserved, not
a conflict to be resolved.

**Not a TEST-0 blocker.** No runtime file is involved.

## Finding 12 — the notice to the active session

Posted to `COORD.md` on `consolidation/connect-components` (`5d3b2a2a`), because the active session
demonstrably reads that file and has no reason to read this one. It states the governed-slice discovery,
that the flag being off is a *recorded decision* rather than an oversight, and the one question that
should be answered before more code is written:

> **What does the active implementation establish that `integration/governed-slice` does not?**

…so that only the delta lands, rather than two independent implementations of run-start authority
issuance in one tree. Explicitly **not** a claim that the active work is redundant: it carries
`runWorkspace` / `runAncestry` / `runValidator`, which governed-slice does not.

## Standing constraint for pass 3 — recorded before the temptation arrives

`writeScope` has no requester. The obvious move is to have the client send the project's files, and
that must **not** be done here: it would smuggle a new authority policy into consolidation under cover
of a merge. The frozen authority-continuity work is already asking the harder question about autonomous
descendants and attenuation.

For TEST-0, find the **smallest owner-originated scope representation already justified by existing
work**. No generalized scope-discovery architecture unless TEST-0 actually requires one.

---

# Pass 2b — the mechanism map, and the rule that decides everything

Reachability root: `server/index.js:9` → `:472` `app.use('/api/agent', agentRouter(...))`. Ordinary
launch is `start-hub.bat` → `npm start`. **No env var is set anywhere on that path.**

## Finding 13 — five mechanisms are live product. Five are not, and three more are flag-dead.

**LIVE PRODUCT** — non-test caller, reachable from `index.js`, no flag:

| mechanism | canonical | production consumer |
|---|---|---|
| controller / run loop | `agent.js:3949 drive()` | `index.js:472` → `agent.js:6054` `/api/agent/start`; client `AgentPage.jsx:348` |
| executable verification | `verifyProject.js:200 verify()` | `agent.js:4535` finish gate inside `drive()` |
| preservation / restore | `agent.js:4821` destructive-write refusal + `:5275` syntax rollback | `drive()`, **unconditional** |
| receipts | `agent.js:3053 persist()`, `:3070` transcript, `:3546` run-index, `:3651` traces | `drive()` finally, from `/start` |
| persistence / restart | `agent.js:3079 loadRuns()`, `queue.js` `withLock` | runs at router construction |

**TEST-ONLY — green suites, no product at all:** governed writes; the authority calculus
(`delegate` has no caller outside two `*-child*` files and a `*probe*`; `observe`/`derive` have **no
server caller whatsoever**); ancestry/staleness (entirely inside `if (runWorkspace)`, set only by
`chain-child.mjs`); promotion receipts; **LegaScreen — zero importers under `server/` or `client/`.**

**FLAG-DEAD on a user-started hub**, verified by hand:
- a **governed run returns 409 BLOCKED**: `governance.js:84` refuses without `qualifiedPath`, i.e.
  `AGENT_WORKER_EXEC=1 && AGENT_BOUND_ROUTES=1`, set only in `bench1.mjs`, `autodiag1.mjs`,
  `endurance.mjs`, `qualify.mjs` and tests — never `start-hub.bat`. So `evaluator.js`,
  `acceptance.js:85 applyAcceptance` and its git restore **never execute** for a real user.
- `ProtocolController` needs `AGENT_PROTOCOL`; the whole `d2.js` preservation/quarantine apparatus
  needs `AGENT_D2_TARGETS`. Same verdict, same reason.

## Finding 14 — the flags are DECISIONS, not oversights

This must not be read as sloppiness. `STEP5_AUTHORITY_CONTINUITY_PREREG.md:160` records it outright:
*"It does not authorize enabling the flag anywhere."* Activation was withheld until the
authority-continuity work licensed it. **That is good discipline.** The error is only in how the
resulting state got described afterwards — including by me, in my own memory, which called the Phase-1
host-event integration DONE when `emitHostEvent` returns on line 1 with zero sinks and discards its
argument on every ordinary launch. `agent.js:45` says so in a comment I had not read.

## Finding 15 — composition status is UNESTABLISHED, and component evidence does not transfer

Recorded as a standing rule for the candidate, at tatte's instruction:

> **Do not inherit component evidence as evidence of system composition.**

Preserve every component result. The assembled candidate nonetheless begins at
**composition: UNESTABLISHED**. Many `Cᵢ` have evidence; the conjunction `C₁ ∧ C₂ ∧ … ∧ Cₙ` has none,
and composition is precisely where this project has repeatedly found new failure classes — information
lost between layers, two mechanisms disagreeing about identity, a refusal invisible upstream, a test
establishing the wrong proposition.

**And the honest correction to the optimistic reading:** it is not "components proven individually,
conjunction unproven." For five of the ten mechanisms it is *"proven in a harness and never connected
to the product at all."* Assembling PRODUCT-0 is therefore **not** merely a merge — it requires
connecting mechanisms to the ordinary path for the first time, which is new integration work with no
prior evidence, not the recovery of work already done.

## Finding 16 — what TEST-0 actually faces

The path the architecture claims —
`OBSERVE → ADMIT → DECIDE → AUTHORITY → PLAN → PROPOSE → GOVERN → EFFECT → VERIFY → PRESERVE → RECEIPT
→ PERSIST → RESTART → CONTINUE` — today has **live implementations only at** OBSERVE(partial), PLAN,
PROPOSE, EFFECT(ungoverned), VERIFY, PRESERVE, RECEIPT, PERSIST, RESTART. **ADMIT, AUTHORITY and GOVERN
have no production consumer on any branch.**

The first frozen composition candidate should therefore preregister, per transition: what it claims,
what evidence must appear if it really occurred, and what counts as a composition failure. A first
assembly that fails somewhere stupid is the expected and useful outcome.
