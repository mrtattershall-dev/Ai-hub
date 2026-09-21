# BIND-CJS step 1 — the evidentiary properties the existing ESM transport DEMONSTRABLY provides
Frozen 2026-09-21 01:50, before any CommonJS mechanism exists.

## Mandate

Establish whether a CommonJS intervention mechanism can **independently satisfy the evidentiary
properties already frozen for BIND substitution, without changing BIND's interpretation rules.**
The existing ESM implementation is **evidence for the required properties, not code that must be
reused**. Failure to establish exact requested -> served -> executed identity must remain
non-evidentiary.

This document is step 1 of five: freeze the properties. No mechanism is built here.

## Why this document exists rather than "make the resolver understand CommonJS"

BIND conflates two things that coincided at its birthplace: *perform a controlled intervention*
(the capability Legasus needs) and *use an ESM `resolve` hook* (one implementation of it).
TRANSFER-BIND (db4f3d9) separated them by measurement: the mechanism substituted an ESM import
and left a CommonJS `require` on the original, in the same run. So the break is at the
intervention/evidence boundary, not inside any subject. Nothing in any subject is to be modified
to accommodate a transport.

## The chain BIND requires, and where each link's evidence comes from

    REQUESTED   mutant M for executable X          driver's own record
    SERVED      the exact replacement X'           transport's record
    LOADED      the subject identifies as X'       observation from inside the process
    EXECUTED    execution evidence belongs to X'   coverage keyed to X', not X
    OBSERVED    witness W produced result R        the witness's own native output

Any absent link: **NO EQUIVALENCE CLAIM, NO PRESERVATION CLAIM, NO BIND EDGE.**

## The properties, each with the observation that demonstrates it

Marked **D** = demonstrated by a recorded observation; **M** = read from the mechanism's source
and consistent with observations, but not independently demonstrated. A CJS mechanism must
satisfy the D rows by its own evidence; the M rows are stated so they are not mistaken for
demonstrated, and become D only when something measures them.

| # | Property | Status | Evidence |
|---|---|---|---|
| E1 | The requested replacement is the one loaded | **D** | probe arm D: requested `ESM_MUTANT`, executed identity `ESM_MUTANT` (load-time self-identification), witness exit 1, FAIL/FAIL — the mutant's behaviour reached the witness |
| E2 | Bypass is distinguishable from substitution | **D** | probe arms A/B vs D in the same run: A/B executed `SUBJECT` where `BASELINE`/`MUTANT` were requested and were recorded `interceptionObserved: false`, not as an absence of difference |
| E3 | Execution evidence is attributed to the served identity, never the original | **D** | `preload.mjs` matches coverage by `script.url === served`, where `served = MUTANT \|\| SUBJECT`; BIND-1's site-level counts separated an executed `if` (12 cases) from its never-executed right operand (0) |
| E4 | Substitution is scoped to exactly one executable identity | **M** + partial D | source: `resolve` redirects only on `r.url === FROM`, else passes through. Partial D: BIND-2 C1 — the recorder run reproduced the witness's baseline exactly, 93/93 per-case outcomes identical, so nothing else in the process was diverted |
| E5 | The witness is never modified | **D** | substitution is by environment only; across BIND-1 (93 cases x 36 served files), BIND-2 and TRANSFER-BIND, 0 witness files were edited |
| E6 | The subject tree is never modified | **D** | TRANSFER-BIND step 1: 0 files touched under the foreign root across 33 runs, measured by mtime snapshot |
| E7 | Both arms differ only by the perturbation | **D** | BIND-2 C2: an identity copy served through the same path landed in S0 with delta false on all 57 inputs |
| E8 | The baseline observation path is identical to the perturbed one | **D** | BIND-2 C1: recorded outputs byte-identical to a pristine replay on all 87 calls; same spawn, same env shape, same tracer |
| E9 | A must-fire perturbation is observed to fire | **D** | BIND-2 C3: `RETURN_EMPTY` showed a raw output delta in every case BIND-1 discriminated it, 71/71 |
| E10 | Each observation is process-isolated | **D** | one fresh process per (witness, served file) throughout; no shared module cache between arms |
| E11 | Arming is observable independently of outcome | **D** | the `ARMED` trace record, written before any case; BIND-1 used it to separate "died before arming" from "died after arming" |

## The property the ESM transport does NOT provide, and which must not be assumed free

**E2 was not provided by the mechanism.** The ESM hook, given a CommonJS `require`, did nothing
and said nothing: no error, no warning, no signal. The distinction between "substituted" and
"silently did not substitute" came from the *contract's* load-time self-identification (R11),
added around the transport, not from the transport.

Consequence, frozen: a CJS mechanism satisfies E2 only if bypass is **detectable from evidence
the run produces**, whether the mechanism reports it or an external marker does. It is never
satisfied by a mechanism that "should" have worked. Silence is not success anywhere in BIND.

## Frozen acceptance criteria for a candidate CJS mechanism (steps 2-5)

1. **Positive control:** requested X' is the executed identity, demonstrated by evidence from
   inside the process — not by the witness outcome.
2. **Negative control:** a deliberately broken substitution must score `CANNOT_ATTACH` or
   `SUBSTITUTION_UNOBSERVED`, and **never** equivalence, preservation, or a BIND edge. This must
   be run, not argued: break it on purpose and check the label.
3. **Scope control:** a second module in the same process, not requested, must be unaffected
   (E4 promoted from M to D for the new mechanism).
4. **Symmetry control:** an identity copy served through the new mechanism must be
   indistinguishable from the pristine subject (E7).
5. **Interpretation unchanged:** BIND's klass rules, refusal states and edge licensing are not
   modified to accommodate the mechanism. If they must change, that is a new experiment.

## Disqualifying outcomes, stated now

- **Modifying the foreign subject, its tests, or its layout to make the mechanism work is not a
  transport success.** It is evidence the mechanism is not generic. The whole value of the
  foreign engine is that Legasus adapts to reality rather than reshaping reality into
  Legasus-shape.
- Also disqualifying: a mechanism that only works when the subject is loaded a particular way,
  unless that condition is stated and detectable at run time.
- `server/agent.js` and every other hub file are out of scope; the failure is not there.

## What would earn the deeper abstraction, and what would not

If an independent CJS mechanism satisfies these same frozen properties, then **two
implementations satisfying one contract** is evidence for extracting an Intervention interface
with transports underneath it (ESM, CJS, later others). One implementation plus an elegant
diagram is not. Until then the interface is not built — the current evidence is exactly one
prospective failure showing that the ESM transport does not cross into CJS.

Next: step 2, the smallest independent CJS intervention mechanism capable of providing the D
rows. Not started.
