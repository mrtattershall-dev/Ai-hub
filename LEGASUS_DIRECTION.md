# LEGASUS_DIRECTION

**This document records architectural direction and testable predictions. It is not a findings summary.
Claims below are separated into DEMONSTRATED, PROVISIONALLY SUPPORTED, and PROJECTED.**

Written 2026-09-15, before any 14B or 30B measurement exists on this architecture. The blank rows in
section 3 are deliberate: they make later filling-in visibly prospective rather than retrospective.

Evidence lives in `measurements/2026-09-13-setH-1p5b/README.md` and the raw bytes under
`results-*/`. Where a number appears here it is quoted from there, not recomputed.

**Vocabulary is defined in [`LEGASUS.md`](LEGASUS.md)** — Legasus, LegaCore, LegaGate, LegaVerify,
LegaParse, LegaLabs, LegaEngine. This document uses those terms; the historical measurement log does not,
and is not rewritten to.

Mapping this document's layers onto the named components:

    0B DETERMINISTIC LAYER   -> LegaParse (facts) + LegaVerify (proofs, rollback)
    PLANNER LAYER            -> LegaCore
    AUTHORITY / ROUTING      -> LegaGate
    GENERATIVE LAYER         -> the model, as executor
    MEASUREMENT DISCIPLINE   -> LegaLabs

---

## 1. What is already earned

### DEMONSTRATED

**Deterministic externalization can replace work previously delegated to the model.**
`scope.mjs`, `boundToSite` and `ownership.mjs` each moved a previously implicit inference into
deterministic software, and each produced a measurable change in system behaviour:

    scope facts          identifies foreign identifiers (codes, links are locals of _inline)
    generation boundary  empty snippets 6/26 -> 0; run-ons bounded; step-1 recovery 11/16 -> 16/16
    ownership invariant  explains the recurring duplication as a control-flow property, statically

**Localized structural generation is demonstrated for the unchanged 1.5B coder.**
On the frozen, untouched 41-60 holdout, verified goal attainment moved from **3/20 to 11/20**, with
whole-file rewrites falling 12/13 -> 0/13 and 1068 -> 0 lines deleted. Same model, same call budget, no
extra parameters: the environment changed, not the generator.

### EXPLICITLY NOT DEMONSTRATED

**Behavioural software evolution by the 1.5B executor.**
Behavioural delta completion remains **0/16** in the relevant experiments (B1, B2, B3, B4), and an
unresolved edit-plan/ownership-specification defect still confounds attribution to model capability.
Failures have moved substantially downstream; capability has not been isolated.

This boundary is stated first so the local-executor result cannot be read as more than it is.

---

## 2. The architectural hypothesis

> **Legasus hypothesis:** software-engineering capability can be decomposed into deterministic and
> generative components. Tasks that can be derived, constrained, preserved, or verified reliably by
> software should be externalized from the neural model. The model should receive only the smallest
> operation whose content cannot be derived deterministically.

### The emerging stack

    0B DETERMINISTIC LAYER      scope, ownership, boundaries, contracts, verification, rollback
    PLANNER LAYER               site selection, dependency and order derivation, local semantic
                                contract construction
    GENERATIVE LAYER            the smallest irreducibly generative code fragment
    VERIFICATION LAYER          preservation, requested delta, integration, byte-exact rollback

### The central danger

> **A planner that embeds the desired implementation rather than deriving constraints is an oracle
> disguised as architecture.**

This is not hypothetical. Every B-condition result in this project so far was produced with
oracle-supplied sites, ordering and per-site intent, and is labelled `ORACLE_LOCALIZATION_FEASIBILITY`
for exactly that reason. `ownership.mjs` is the first counterexample: a global semantic fact computed
from the program itself and handed to the model as a local constraint.

---

## 3. Parameter-architecture tradeoff prediction

### PROJECTED - preregistered before 14B/30B exist

> Increasing parameter count will improve some local generative operations, but will **not necessarily
> eliminate** the need for preservation, localization, ownership, boundary and verification machinery.
> For task shapes requiring those properties, architecture may dominate scale.

This deliberately does **not** predict "larger models need less scaffolding", because the existing
evidence already challenges that.

### The one measured point

Whole-function behavioural replacement, with the exact goal text supplied through a real instruction
channel:

    1.5B   0/16 verified   0/16 preserving old behaviour
    7B     0/16 verified   0/16 preserving old behaviour

Failure topology broadly similar: both lose paragraph line-joining - the oldest accumulated behaviour in
the file - in 14/16 and 13/16 respectively. A roughly 5x parameter increase bought nothing on this task
shape.

### The table, with blanks left blank

                                    1.5B        7B          14B     30B
    whole-function replacement      0/16        0/16        ---     ---
    localized structural (41-60)    11/20       ---         ---     ---
    bounded local behavioural       0/16        1/16        ---     ---
    full Legasus path               ---         ---         ---     ---

`1/16` at 7B is the only verified end-to-end behavioural edit observed anywhere in this project. n=1;
nothing rests on it.

### The hypothesis that would matter most

> If 14B and 30B continue to fail under the same poorly structured task geometry, while all sizes improve
> under Legasus-style decomposition, the principal result is **not** that 1.5B is unusually capable. It is
> that architectural structure addresses a bottleneck scale alone does not remove.

That is a substantially larger claim than "a tiny model punches above its weight", and it is falsifiable:
a 14B that solves whole-function replacement from the post-60 seed refutes it directly.

---

## 4. What remains oracle, and therefore unproven

    COMPUTED                          STILL ORACLE
    [x] scope facts                   [ ] site selection
    [x] generation boundaries         [ ] site ordering / dependencies
    [x] ownership invariants          [ ] local semantic intent

### v4's success condition, stated so a handcrafted planner cannot satisfy it

> **v4 succeeds architecturally only when one or more remaining oracle fields are replaced by general
> computation whose correctness is demonstrated independently of the model output.**

"Independently of the model output" is the load-bearing clause. A planner tuned until the model happens
to pass is not a derivation, and its apparent success would be partly an artifact of the tuning.

### Known substrate constraint

The gate-policy question cannot currently be evaluated on Set H: under the measured configuration it
contains no demonstrated multi-site lane with enough outcome variance. Goal 67 has ideal variance (4/8)
and a single site; goal 71 has a two-site chain and 0/8. **Benchmark topology must match the subsystem
under test** - a single-shot benchmark cannot validate a transaction-aware policy at any pass rate.

---

## The long-term question

> **How much neural scale remains necessary once software-engineering responsibilities that do not
> inherently require neural generation are externalized into deterministic, testable machinery?**

That is the research programme. Everything above is either a step toward answering it or a record of an
attempt that did not.

---

## Standing methodological invariants

Carried from the experimental log, because they are what makes the above trustworthy rather than
narrated:

  * every evaluator has a positive-control path that FAILS if the evaluator accepts or rejects
    everything - and that control must be broad enough that the rule under test actually fires on it
  * outcomes are read from typed records, never grepped from logs
  * preserve every wire request and raw reply; criteria are recomputed post-hoc, never re-run
  * rules, endpoints and analysers are frozen and hashed BEFORE the run that tests them
  * qualify the substrate before evaluating anything endpoint-sensitive
  * a metric with zero sensitivity is reported as such and never promoted into an endpoint claim
  * corrections are recorded forward; historical results are not retroactively edited
