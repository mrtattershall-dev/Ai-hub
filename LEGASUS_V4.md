# LEGASUS v4 — ORACLE REDUCTION

**Milestone specification. Written before any v4 work begins.** Vocabulary is defined in
[`LEGASUS.md`](LEGASUS.md); findings live in `measurements/`; intended direction in
[`LEGASUS_DIRECTION.md`](LEGASUS_DIRECTION.md).

---

## Success criterion

> **At least one of the three remaining oracle fields is replaced by a general, independently testable
> computation, without embedding the desired patch.**

**Not** a higher benchmark score. A v4 that raises pass rates by supplying better hand-written plans has
failed its own criterion, because the thing being measured would be the quality of my prose rather than
the capability of the architecture.

The scoreboard v4 moves:

    COMPUTED                          STILL ORACLE
    [x] scope facts                   [ ] site selection          <- v4 target
    [x] generation boundaries         [ ] site ordering / dependencies
    [x] ownership invariants          [ ] local semantic intent

---

## Ordered plan

### 1. Build a dedicated transaction substrate

Set H failed the gate-policy experiment because it never provided the combination LegaGate needs:
genuine multi-site topology AND mixed outcomes. Goal 67 had ideal variance (4/8) and one site; goals 64,
71 and 74 had chains and no successes.

The substrate is a small benchmark of **2-4 operation transactions**, with independently authored
contracts and oracles, explicit dependencies, and no hidden predecessor requirements.

**Goal 67 informs difficulty. It does not become the template to tune against.**

### 2. Site selection — the first planner migration

The planner derives candidate locations from symbols, ownership, control flow, references and the
requested behaviour. Success is proven by a containment property, not by a pass rate:

> the derived candidate set CONTAINS the reference site, without the reference site having been supplied

### 3. Operation topology

Once sites are known, compute whether the edit is one operation or a transaction, which operations
depend on which, and what order is legal. Ownership and dependency metadata become first-class LegaCore
data rather than prose in a comment.

### 4. Local semantic intent — LAST, because it is the easiest to cheat

"Insert after X" is often derivable structurally. "What should this branch mean?" is closer to genuine
reasoning. The success condition is that LegaCore derives **constraints** — available identifiers,
owner, required postcondition, forbidden side effects — **without encoding the implementation**.

### 5. Rerun behavioural generation

Give the unmodified 1.5B the derived ownership/site/order/intent contract and test whether the
behavioural delta finally appears. **This is the experiment that can begin separating "the 1.5B cannot
do this" from "we were still making it infer hidden global facts."** Until it runs, neither statement is
supported.

### 6. The scale curve

Same frozen tasks, same architecture, 1.5B → 7B → 14B → 30B. The question is no longer which model
scores higher. It is:

> **which pieces of Legasus remain necessary as model scale increases?**

---

## FROZEN: substrate construction procedure

Fixed **before any task is authored**, so tasks cannot be tuned toward an outcome. Recorded here rather
than in a commit message so that a later reader can check the tasks against the rules that were supposed
to produce them.

**Construction rules**

1. Each goal requires **2-4 genuinely distinct edit sites**. Distinct means separate insertion points,
   not one insertion with several statements.
2. At least one **real dependency** between operations — an operation whose correctness requires an
   earlier one (a definition before its call; state before its use).
3. **Every operation is necessary** for the final behavioural delta. A goal containing a decorative
   operation is rejected: it would let a partial chain score.
4. A **reference implementation** and its **negative witnesses** exist BEFORE any inference is run.
   Witnesses must include at least one that the delta probe alone cannot catch.
5. The delta probe must **fail on the no-op** and **fail on each single-operation-omitted variant**.
   This is the rule that would have caught the goal-64 dead-site defect at authoring time.
6. **No hidden predecessor requirements.** Every referenced-but-absent symbol is introduced by the goal
   itself or explicitly authorised as external — checked by the ownership invariant, not by reading
   prose.
7. Transaction structure is **declared**: `operations`, `dependencies`, `chain_length`. Never inferred
   from contract cardinality, which has already produced false positives twice.
8. A **held-out subset is reserved and never opened** during development.

**Anti-tuning rules**

9. Task difficulty is **not** adjusted toward any target pass rate. If the authored family turns out
   degenerate (all pass or all fail), that is reported as a substrate result and the *construction
   procedure* is revised — not individual tasks.
10. Difficulty calibration happens on the **development subset only**, and the procedure is re-frozen
    before the held-out subset is opened.
11. Reference implementations are authored **from the goal text**, not from any model output observed
    while writing them.

---

## Anti-cheating conditions, per migration

Each oracle field has a specific way it could be faked. Naming them in advance:

| field | the cheat | the guard |
|---|---|---|
| site selection | hard-code the reference anchors, or derive a candidate set so large it trivially contains them | report **precision AND recall**; a candidate set of "every line" fails |
| ordering / dependencies | encode the known-good order as a constant | derive order from symbol definition-before-use and ownership; test on a permuted task where the correct order differs |
| semantic intent | restate the reference implementation in English | the contract may name identifiers, owners, postconditions and forbidden effects; it may NOT name the statements to write. Witness: a human reading only the contract should be able to write a DIFFERENT correct implementation |

The last witness is the strongest available test for intent-cheating and should be applied literally.

---

## What v4 does not claim

  * v4 does not attempt to beat any larger model.
  * v4 does not assume the 1.5B will complete a behavioural delta. Step 5 is a test, not a plan.
  * A v4 that improves scores while all three oracle fields remain oracle-supplied has **failed**,
    regardless of the numbers.

---

## Methodological invariants carried forward

From the experimental log, because they are what makes results here trustworthy rather than narrated:

  * every evaluator has a positive-control path that FAILS if it accepts or rejects everything — and the
    control must be broad enough that the rule under test actually fires on it
  * outcomes are read from typed records, never grepped from logs
  * preserve every wire request and raw reply; recompute criteria post-hoc rather than re-running
  * rules, endpoints and analysers are frozen and hashed BEFORE the run that tests them
  * qualify the substrate before evaluating anything endpoint-sensitive
  * a metric with zero sensitivity is reported as such, never promoted into an endpoint claim
  * corrections are recorded forward; historical results are not retroactively edited
