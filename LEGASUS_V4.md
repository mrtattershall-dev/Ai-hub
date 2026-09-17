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

Stated across the whole stack, these stop being separate engineering problems:

    LegaParse    must not invent sites it cannot justify
    LegaGate     must not convert uncertainty directly into veto
    the model    must not write beyond the boundary it was granted
    LegaVerify   must not certify behaviour its probes cannot observe

**Abstention is a first-class correctness behaviour, not weakness.**

### The conceptual shift worth preserving

    earlier   failure meant "the model did the wrong thing"
    now       failure can mean "the architecture granted authority without sufficient evidence"

Every apparatus defect in the measurement log re-reads as the second kind. The model was penalised
throughout for exercising authority its evidence did not earn — writing past a site boundary, claiming a
line another branch owned, reaching for an identifier from a neighbouring scope — while the architecture
was asking it to self-limit on information it was never given.

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

### CONSTRUCTION FREEZE — AMENDMENT B

> **Amendment B, before task authorship.** Two disciplines added: applicability class must not be
> confounded with difficulty, and each task must carry a frozen local evidence package that the model
> never sees. **No substrate task had yet been authored when this amendment was made.**

13. **Applicability class must not be confounded with difficulty.** "Analogy-bearing" must not become a
    synonym for *easy*, nor "no valid analogue" for *hard*. Both classes are represented across
    **similar transaction lengths and structural complexity**. Their eventual model success rates may
    differ naturally; their *authored* difficulty must not differ systematically. Otherwise the
    substrate cannot distinguish "site selection did not apply" from "the task was harder".

14. **Each task is frozen with its own local evidence package, before any model generation**, containing:

        declared operation topology          operations, chain_length
        dependency edges                     which operation requires which
        reference implementation             authored from the goal text alone
        no-op failure proof                  the delta probe fails on the unmodified source
        single-operation-omitted failures    the delta probe fails for EACH operation removed
        preservation probes                  accumulated behaviour that must survive
        analogue classification              analogy-bearing or not, WITH its justification

    **The model sees only the task contract. It never sees the construction metadata.** Topology,
    dependency edges, the reference implementation and the classification are evaluation instruments,
    not inputs.

The procedure is **re-frozen at fourteen rules**.

### The analysis matrix this makes possible

                            analogy-bearing     no valid analogue
    multi-site viable             ?                    ?
    multi-site doomed             ?                    ?

The cells are not required to fill evenly. The point is that the substrate can reveal **whether
site-selection applicability and model-generation difficulty are independent** — a question Set H could
not even pose, because applicability and difficulty were perfectly confounded there (the one lane with
variance had one site).

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

### CONSTRUCTION FREEZE — AMENDMENT C

> **Amendment C, before task authorship.** The specification/evaluation boundary is made physical, and
> the authoring hazard is recorded as temporal rather than technical. **No substrate task had yet been
> authored when this amendment was made.**

15. **Author the entire family, seal every evidence package, verify class/complexity matching, freeze
    the substrate — and only then let the model or the applicability detector see any of it.** Running
    generations during authoring would let task 7 be unconsciously shaped by tasks 1-6 without anyone
    deciding to tune anything.

The procedure is **re-frozen at fifteen rules**. Schema in
[`legasus/legalabs/substrate/SCHEMA.md`](legasus/legalabs/substrate/SCHEMA.md), enforced by
`validate-task.mjs`.

### Permanent LegaLabs doctrine

> **Specification tells the system what must become true. Evaluation knows how you established that it
> became true. These are not the same artifact.**

Not a substrate-local rule. The contaminated-contract defect happened because one artifact fed both the
prompt and the checker, and its results were quarantined as VOID. The boundary is now physical —
`task.json` and `source/` are prompt-visible, `evidence/` never is — and mechanically enforced, including
a **substring-leakage check**: no identifier introduced by the reference implementation may appear in the
prompt-visible contract. That check catches the defect this project actually suffered, which no schema
key-list would have caught.

### The authority rule, stated across the stack

    LegaParse    earns authority to NOMINATE sites
    LegaCore     earns authority to ORDER them
    the model    earns authority to FILL a bounded hole
    LegaGate     MODULATES that authority when evidence is uncertain
    LegaVerify   alone earns authority to COMMIT

> **No component gets more authority than its evidence justifies.**

---

## RESULT: frozen detector on the sealed substrate — site selection does NOT migrate

Seal verified INTACT and the detector verified byte-identical to `DETECTOR.frozen` before the numbers
were read. The detector saw `task.json` and `source/` only.

    a01  applicable   ABSTAIN  target=null          no feature group resolved
    a02  applicable   ABSTAIN  target=null          no feature group resolved
    a03  applicable   ABSTAIN  target=valid_types   no feature group resolved
    b01  no-analogue  ABSTAIN  target=null          names no relation      CORRECT
    b02  no-analogue  ABSTAIN  target=parse_config  names no relation      CORRECT
    b03  no-analogue  ABSTAIN  target=tokens        names no relation      CORRECT

    true-apply 0/3    false-apply 0/3    abstention 6/6
    site quality      UNDEFINED - applied to nothing, no sensitivity
    system coverage   0/6

### What holds

**The abstention mechanism works.** `false-apply 0/3`: the detector never overreached on a task lacking
a supported relation, which is precisely the goal-74 failure it was built to prevent. Refusal is
functioning as a first-class behaviour.

### What fails

**System coverage 0/6. Site selection has NOT moved from `[~]` toward `[x]`.** A component that applies
to nothing is useless regardless of its conditional precision, which is why that metric was preregistered.

**Root cause, found prospectively:** `featureGroups` analyses a single module-level function body. Goals
64 and 74 were exactly that shape (`to_html`). None of the six substrate tasks are — a01 and a02 are
class-based, and a03's feature spans module level plus three functions. **The derivation principle was
developed on one structural shape and does not generalize beyond it.**

### A confound in my own construction procedure, disclosed

Rule 13 matched the two classes on **operation count** but not on **structural shape**. The analogy
tasks skew class-based and module-spanning; two of three non-analogy tasks are single-function. So
"abstains on all analogy tasks" is partly a shape effect rather than purely an applicability effect, and
the true-apply rate of 0/3 cannot be cleanly attributed.

This is a gap in the construction procedure, not in the tasks. Per rule 9 no task is edited in response.
A future amendment should match structural shape across classes as well as operation count — recorded
here rather than applied, because the family is sealed and the amendment would be post-outcome.

### What is NOT done in response

The detector is not modified. No case is added for class bodies or module-spanning features. Per the
frozen plan, a failure on a class is evidence about the limits of the derivation principle, and fitting
a second heuristic to these six would destroy the only prospective evidence the substrate can provide.

### Scoreboard, unchanged

    COMPUTED                  PARTIAL                              STILL ORACLE
    [x] scope facts           [~] site selection                   [ ] site ordering / dependencies
    [x] generation boundaries      derived for single-function      [ ] local semantic intent
    [x] ownership invariants       analogy tasks; abstains
                                   correctly elsewhere; applies
                                   to 0/6 of the sealed substrate

### Wording correction to the result above

"The abstention mechanism works" overstates it. The positive side never became observable, so the honest
decomposition is:

    specificity / non-overreach   supported prospectively      0/3 false applies
    positive applicability        NOT demonstrated prospectively 0/3 true applies
    site quality                  unmeasurable - no APPLY cases
    system coverage               0/6
    oracle migration              NO

The detector as a whole is **not validated**. All three analogy tasks fell outside the structural domain
the implementation can analyse, so what was learned is about coverage, not about positive discrimination.

The most useful sentence from the run:

> **The analogy principle generalized semantically farther than the implementation generalized
> structurally.**

Goals 64 and 74 taught `featureGroups` to reason about analogous behaviour inside one module-level
function body. The prospective family asked for the same reasoning across classes, methods and
module-spanning state. The concept may still be sound; the implementation boundary was narrower than I
knew.

### Why the negative result is trustworthy

    detector hash before the runner fix  ==  detector hash after the runner fix

Verified against `DETECTOR.frozen` before any number was read. The protection is not "I only touched
plumbing" as a claim - it is that the component under test is demonstrably byte-identical across the
fix, so the negative result cannot be explained by post-outcome modification of the thing being measured.

---

## MILESTONE: LegaParse Site Selection v2

**Rationale for staying on site selection rather than moving to ordering.** Site selection is upstream of
everything else:

    global request -> WHICH code participates?  <- site selection
                   -> HOW are those related?    <- ordering / dependencies
                   -> WHAT must happen there?   <- semantic intent
                   -> model fills bounded holes

Deriving ordering perfectly while locations remain hand-supplied leaves a human oracle sitting at the
entrance to the pipeline. And "what parts of this program participate in this behaviour?" is the
canonical case for the project's own thesis - symbols, scopes, call graphs, data flow, ownership and
references are exactly where deterministic software should beat a 1.5B guessing from context. **If
Legasus cannot eventually compute site selection, that is a ceiling on the architecture, not a missing
convenience.**

So: force the problem, do not force the result.

### Success condition

> **Site Selection v2 succeeds when candidate sites are derived from PROGRAM-LEVEL STRUCTURAL ROLES
> rather than a single-function feature-group assumption, while retaining calibrated abstention.**

What the negative result actually says is that the abstraction is wrong. `featureGroups` assumes a
feature lives inside one function. Real features do not: they live across a class's constructor and
methods, module state and several functions, producer/consumer pairs, parser state and its output path,
an entry point and its persistence path.

The replacement is a program-level concern graph - definitions, reads, writes, calls, branches, state
ownership, data flow - from which the structural ROLES participating in a concern are identified, and
candidate sites follow from the roles. That generalizes across classes and module-level functions
without being taught the answer to any particular task.

### Metrics unchanged

coverage, true-apply, false-apply, recall, precision, exact-set match, candidate inflation. **Coverage
remains the critical one**, or the outcome is the world's most cautious parser saying "I don't know"
beautifully.

### Status of the six sealed tasks: SPENT

Their prospective result is permanently frozen as *v1 applicability/site selector: 0/6 coverage*. From
this point they are **development and challenge data** - inspectable, debuggable, witness material. They
may never again be presented as fresh validation. A new holdout is authored only after v2 is frozen.

### What is explicitly forbidden

    if class:            ...
    if nested comments:  ...
    if date column:      ...

Any per-task special case fits the holdout and destroys the evidence. v2 must earn `[x]`; `[~]` is not
moved by decree.
