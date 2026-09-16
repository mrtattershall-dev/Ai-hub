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

    COMPUTED                          PARTIAL                     STILL ORACLE
    [x] scope facts                   [~] site selection          [ ] site ordering / dependencies
    [x] generation boundaries             derived for             [ ] local semantic intent
    [x] ownership invariants              analogy-specified
                                          tasks; abstention
                                          required elsewhere

`[~]` rather than `[x]` is deliberate. One class of site-selection oracle has been replaced by
computation, and a principled boundary around that computation has been found. Claiming the whole field
migrated would be false.

### The pattern both components are converging on

    LegaGate   uncertainty should alter AUTHORITY, not automatically become failure
    LegaParse  absence of analytical justification should produce ABSTENTION, not a confident guess

Two manifestations of one Legasus principle:

> **A component should know the limits of the authority its evidence earns.**

---

## Ordered plan

    1A  build the transaction substrate under the frozen construction rules
    1B  develop the site selector against the historical 64/74 challenge
            |
            v  FREEZE THE SELECTOR
    2   evaluate the frozen selector prospectively on the untouched substrate
    3   derive ordering and dependencies
    4   derive local semantic intent
    5   rerun 1.5B behavioural generation with a fully derived contract
    6   run the scale curve

1A and 1B proceed in parallel and do not compete: the selector is developed against sites that already
existed, while the substrate is authored without reference to selector behaviour. The selector is frozen
before it ever sees the substrate.

**Step 5 remains the decisive experiment. Everything before it exists to remove reasons the result could
still be attributed to hidden human or oracle work.**

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

#### Evidence chain — two different questions, two different sets

    HISTORICAL DEVELOPMENT SET   goals 64 and 74, taken TOGETHER
      question: can a general computation recover sites that were established independently, before
                that computation existed?
      status:   their reference sites predate the deriver by weeks, so they cannot have been authored
                to suit it. But once the deriver is tuned against them they are DEVELOPMENT DATA, not
                final holdout evidence.

    PROSPECTIVE VALIDATION SET   the new transaction substrate
      question: does the FROZEN computation generalize to tasks it was not tuned on?
      status:   construction procedure frozen before authorship; selector frozen before evaluation;
                tasks NOT changed in response to selector behaviour.

**Do not split 64 into "tune" and 74 into "holdout".** They share a file, a function and a development
history; treating one as a holdout for the other would not be convincing. They are one historical
development challenge.

#### LOCKED ENDPOINT — fixed before implementation

    report   recall                      reference sites recovered / reference sites
             precision                   reference sites / candidates proposed
             exact candidate-set match   candidates == reference set, no more and no less
             inflation ratio             candidates proposed / reference sites

    failure  a trivial superset does NOT count as success
             "every line" is an EXPLICIT FAILURE, not a degenerate pass

Recall alone is satisfiable by proposing everything, which is why precision and the inflation ratio are
reported alongside it and why the degenerate case is named as a failure in advance.

#### What the goal-64 result does and does not establish

**Established, narrowly:**

> For an **analogy-specified task**, a site set can be derived computationally from the relationship
> named in the task and the references in the source.

**Not established:** that LegaParse can derive sites for arbitrary behavioural changes.

The narrower claim is the honest one, and the 64/74 split makes the result *more* useful than a
suspicious 2/2 would have been, because it locates the boundary of applicability. The division of labour
is legitimate — the goal text specifies **which relation matters**, the code determines **where that
relation manifests**, and no anchor is supplied:

    task: new feature analogous to unordered lists
        -> resolve analogue: unordered-list state, operations, references
        -> source analysis: positions at which the analogous feature participates
        -> candidate edit sites

Goal 74 exposes the complementary operation the selector was missing entirely:

    task requests feature
        -> can LegaParse establish a valid structural analogue?
             yes -> derive sites
             no  -> ABSTAIN (insufficient structural basis)

#### PREREGISTERED ENDPOINT for the applicability detector

Fixed before implementation, as with the selector itself. The detector returns
`APPLICABLE(candidate_set)` or `ABSTAIN(reason)`, and three groups are reported **separately**:

    APPLICABILITY
      true-apply rate      on tasks possessing the supported relation
      false-apply rate     on tasks WITHOUT that relation      <- goal 74's failure mode
      abstention rate

    SITE QUALITY, conditional on APPLY
      recall, precision, exact candidate-set match, inflation ratio

    SYSTEM COVERAGE
      fraction of ALL tasks for which the method both applies AND returns an acceptable site set

**System coverage exists to block the obvious new cheat:** a planner that achieves beautiful precision by
refusing nearly everything. Conditional site quality alone would reward exactly that.

Goal 74 motivated the detector, so goal 74 is **development evidence for it too**. The real test is the
untouched substrate.

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

### CONSTRUCTION FREEZE — AMENDMENT A

> **Amendment A, before task authorship.** Prospective site-selection work exposed a substrate-design
> bias not anticipated in the original freeze. The substrate must contain both analogy-bearing and
> non-analogy tasks. **No substrate task had yet been authored when this amendment was made.**

The bias: goal 64's site derivation succeeded because its text says *"written like the unordered lists"*.
That phrase carries the relation the deriver consumes. A substrate composed only of analogy-bearing
tasks would make the selector look stronger than it is, and the bias would be invisible until after
validation.

12. The substrate contains **both analogy-bearing and non-analogy tasks**, deliberately represented.
    Their individual outcomes are still not tuned — rule 9 continues to apply.

The procedure is **re-frozen at twelve rules**. The audit trail matters more than the count: rule 12 was
added because of goals 64 and 74, **not** because of any outcome on the new substrate, which did not
exist.

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
