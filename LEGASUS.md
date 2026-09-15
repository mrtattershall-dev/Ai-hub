# LEGASUS

**Canonical identity and architecture document.** This is the current-facing definition of the project's
vocabulary. Historical measurement logs, commit messages and frozen experiment artifacts deliberately do
NOT use this vocabulary, and are not rewritten to — history stays history.

Read this first if you are new to the repository. Findings live in
`measurements/2026-09-13-setH-1p5b/README.md`; intended direction lives in `LEGASUS_DIRECTION.md`. This
file defines the terms both use.

---

## What Legasus is

**LEGACY + PEGASUS = LEGASUS.**

`LEGA` is *legacy* — but not in the sense of "old software we are stuck with". It names the central
architectural principle:

> **Preserve what already works. Understand the state that already exists. Extend it without
> unnecessarily regenerating or destroying it.**

Legasus treats working software as **accumulated knowledge**. Existing correct behaviour is
*authoritative state*. A model does not earn authority over that state merely by being asked to make a
change.

The philosophy in one line:

> **Build forward without breaking what came before.**

The same principle stated technically:

> Move everything reliably computable out of the model. Give the model only the uncertainty. Verify
> before commit.

Legasus is therefore not a coding-model wrapper. It is intended to become a **software-engineering
runtime around models**.

### The research question

> **How much neural scale remains necessary once software-engineering responsibilities that do not
> inherently require neural generation are externalized into deterministic, testable machinery?**

The project is currently investigating **whether deterministic software structure can substitute for
some neural parameter scale** by externalizing planning, preservation, program semantics, authority and
verification.

---

## Components

Names are PascalCase. `Lega-` marks membership in the Legasus ecosystem. **Architecture first, name
second** — a subsystem earns a name only when it is genuinely distinct.

### LegaCore — orchestration and reasoning

Owns global understanding of the task and project: project state, task decomposition, edit-plan
construction, site selection, dependency and order derivation, semantic ownership, routing decisions,
context construction, and the decision of what can be deterministic versus generative.

LegaCore's job is to convert global software semantics into small, explicit local operations.

> **LegaCore must not become an oracle wearing a different hat.** If it encodes the desired
> implementation into the plan rather than deriving constraints from the program, the research claim is
> meaningless.

Honest externalization demonstrated so far — computed from the program, not supplied as answers: scope
facts, generation boundaries, ownership invariants.

### LegaGate — risk estimation and authority control

Not a binary allow/deny filter. It answers: **how much authority should this operation receive?**

It separates **RISK ESTIMATION** (what does this step look like?) from **AUTHORITY POLICY** (what should
be done about that, given the state of the whole transaction?).

Measured: a useful step-level classifier became harmful when every suspicious prediction was converted
into a hard veto across a multi-step transaction. LegaGate is therefore expected to evolve toward
transaction-aware graded authority — admit, admit under stronger verification, retry, reroute, decompose
further, consume a transaction risk budget, escalate, or refuse only when necessary.

LegaGate operates across a transaction, not one isolated generation.

### LegaVerify — truth and commit authority

The model may *propose*. LegaVerify decides what becomes authoritative: structural contracts, parse/load
validation, behavioural regression proofs, requested-delta verification, preservation checks, dependency
checks, outside-span checks, intermediate-state verification, rollback, byte-exact restoration, and
rejection of vacuous proof conditions.

> **ATTEMPT AUTHORITY != COMMIT AUTHORITY.** A model may try what it may not commit.

LegaVerify is what protects accumulated legacy behaviour.

### LegaParse — deterministic program analysis

Owns facts extractable from source without asking a model to guess them: symbols, scopes, owners,
references, local versus foreign identifiers, control-flow relationships, branch ownership, insertion
boundaries, structural dependencies, exports, members, and eventually AST/CFG facts.

    source code -> deterministic facts -> LegaCore planning constraints

rather than

    source code -> ask the model to rediscover obvious program structure

**Status, stated honestly:** LegaParse currently names a *layer*, not a shipped module. Its existing
implementations — scope analysis and ownership analysis — live as experiment artifacts under
`measurements/2026-09-13-setH-1p5b/results-feasibility/` (`scope.mjs`, `ownership.mjs`). Consolidating
them into a real subsystem is future work.

### LegaLabs — the research and measurement system

Separates model capability, architecture capability, measurement quality and benchmark validity. Owns
the discipline developed across these experiments: preregistration, frozen analysis plans, provenance,
raw-wire preservation, seed control, controls, known-good and known-bad witnesses, counterfactual
replay, substrate qualification, sensitivity checking, failure taxonomy, measurement-boundary auditing,
and distinguishing apparatus failure from model failure.

LegaLabs exists because a benchmark score is meaningless if the apparatus cannot observe the claimed
capability.

> **Preserve first. Score second.**

### LegaEngine — AI-native creative development environment

Where this architecture can eventually be used to build games and interactive software.

**Not to be confused with LegaCore.** LegaCore is the intelligence and orchestration architecture;
LegaEngine is a product environment that *consumes* LegaCore, LegaGate, LegaVerify, LegaParse and models.

**Status:** LegaEngine names work that lives in a **different repository** (the AI-native engine
project), not in this one. Recorded here for vocabulary consistency only.

---

## The model's role

Legasus is **model-agnostic**. The model is not the entire software engineer; it is a generative
executor whose scope depends on what it can reliably handle.

    deterministic operation           -> 0B, no model
    tiny structural generation        -> small model
    bounded statement / local edit    -> small model
    branch-level semantic edit        -> contrast plan + bounded generation
    multi-site edit                   -> ordered transaction
    ambiguous / nonlocal problem      -> decompose, escalate, or refuse

The model under current research is **Qwen2.5-Coder-1.5B, unmodified** — not task-fine-tuned, with no
Legasus-specific weight training. It is the instruct model; do not describe it as a "raw base model".

**Current evidence supports strong local-executor capability. Full autonomous behavioural software
evolution remains undemonstrated.** Both halves of that sentence matter.

---

## Oracle -> Computed scoreboard

The difference between an architecture and a demonstration is how much human intelligence has been
removed from the loop. This is the scoreboard.

    COMPUTED                          STILL ORACLE
    [x] scope facts                   [ ] site selection
    [x] generation boundaries         [ ] site ordering and dependencies
    [x] ownership invariants          [ ] local semantic intent

The three remaining fields are the current LegaCore planner problem. Success means converting them into
general computed structure **without encoding the desired implementation directly**.

---

## Two different failure boundaries — do not collapse them

### Wrong model/system boundary

The system asks the model to infer or control something that should have been externalized. Found so
far: missing task instruction, colliding prompts, inappropriate FIM geometry, unbounded generation
authority, under-specified semantic contrast, undeclared semantic ownership.

These make the model *appear* less capable than it is.

### Wrong measurement boundary

The experiment cannot observe what it claims to. Found so far: unreachable reference code, probes unable
to expose a defect, vacuous endpoint metrics, control records mistaken for model records, unsuitable
experimental substrate, checker over-restriction.

These do not change model capability — they change whether it can be measured.

**Legasus addresses the first category. LegaLabs and LegaVerify address the second.**

---

## Relationship to the AI Coding Hub

This repository contains **two distinct things**, and conflating them causes confusion:

  * **The AI Coding Hub** — a standalone multi-provider coding UI (React + Express + SQLite), documented
    in `README.md`. A real product that predates Legasus and still exists under that name.
  * **Legasus** — the software-engineering architecture and research programme developed here, using the
    hub and its goal sets as experimental substrate.

Legasus did not *rename* the hub. Where historical material says "AI Coding Hub" as the name of the
whole research architecture, that usage evolved into Legasus; where it names the hub product, it remains
accurate.

---

## Brand and visual identity

    LEGACY     accumulated correct state; knowledge worth preserving; history that should not be
               regenerated unnecessarily
    PEGASUS    lift, speed, reach; capability beyond the apparent limits of the base system
    LEGASUS    preserve the foundation and build intelligence through it

    white / ivory          preserved foundation, authoritative existing state
    gold                   verified intelligence, trusted transformation
    branching circuitry    routing, computation, verification, model paths
    central core           LegaCore
    nodes / checkpoints    LegaVerify, LegaGate
    wings                  capability extending beyond the native model

---

## What Legasus has NOT shown

Stated explicitly so no reader has to infer it:

  * Legasus has **not** been shown to beat a 7B or 14B model.
  * Autonomous behavioural software evolution is **not** solved.
  * One measured observation, treated as a single data point and not a scaling law: in the
    whole-function behavioural replacement condition with the exact goal text supplied, the tested 7B
    showed **no observed advantage** over the 1.5B (0/16 verified at both, with broadly similar failure
    topology). This is one task shape, one pair of models, one machine.

Evidence for every claim in this section lives in `measurements/2026-09-13-setH-1p5b/README.md`.
