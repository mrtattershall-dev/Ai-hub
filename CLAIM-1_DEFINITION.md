# CLAIM-1 — does the manager beat a competent simpler process at matched budget?

**Status: FROZEN DEFINITION. Not yet run.** Written before any evaluation page exists.

## The question

> Within a fixed budget, on unfamiliar pages, does the complete manager produce more
> independently verified completions than a competent simpler process using the same model —
> while preserving required behaviour, and counting every failed attempt?

Every result this project has so far is a *separate* success: observation selects adapters from
evidence, the gate blocks a live candidate, the planner sites an edit, acceptance refuses an inert
button. None of them is a comparison. This is the comparison.

## What CLAIM-1 can and cannot establish

It measures **one manager configuration, on one task family, with one model**. Specifically it
varies **automatic planning and extracted guidance** — and nothing else.

It does **not** establish:

- that every Legasus component helps. The emitter, the check harness and the acceptance rules are
  **shared apparatus** here, used identically by both arms. They are not under test; without them
  there is no common evaluator and no common requirement, and the comparison has no meaning.
- that the result transfers to other task families, other pages, or other models.
- anything about memory or accumulated learning. Neither arm has any.

A win here is a claim about *this* manager on *this* family. A null here is not a claim that
managers do not help.

## The two arms

Both arms receive **the same** starting file, the same requirement in the same English, the same
model, the same decoding parameters, the same call budget, the same feedback after a failed
attempt, and are judged by the same evaluator. Neither arm's own opinion of its work counts.

### Arm A — MANAGER

`server/managerRun.mjs` frozen at the commit recorded below. Observe → plan → extracted guidance →
scaffolded slot → contain to slot → gate → acceptance.

### Arm B — DIRECT

A **competent** alternative, not a straw man. Same model and decoding. It receives:

- the complete page as it stands,
- the requirement, rendered in the same English Arm A's instruction uses,
- after each failed attempt, **the same gate output** Arm A gets as feedback: the failing step
  numbers, those steps' names as written in the emitted spec, and any captured error text.

It returns a complete page. It gets no automatic planning, no extracted facts, no scaffold, and no
slot containment — those are the treatment. It is **not** burdened with a protocol only the manager
can satisfy: Arm B is never refused for the *shape* of its answer, only for what the answer does.

> Recorded risk: Arm B returning a whole file invites the echo failure already on record (a 1.5B
> handed its own page returned it unchanged 5/5). If that happens it is **Arm B's result**, not an
> apparatus defect to be fixed mid-experiment — but it must be reported as the mechanism, because
> "the manager won" and "the control could not use its interface" are different findings.

## Calibration, then freeze

1. Generate **10 development pages**. Calibrate *both* arms' wording on them — Arm A's instruction
   and Arm B's prompt get equal attention. The INC4-1 finding stands: a harness's own text has moved
   a result from 0/5 to 3/3, so a null from an uncalibrated control establishes nothing.
2. **Freeze both arms.** Record the SHA of every file either arm reads, and the exact prompt
   templates, in `CLAIM-1_RESULT.md` *before* step 3.
3. Only then generate the **20 evaluation pages**. They are opened once.

**Changing only the control after seeing a disappointing result invalidates the run.** If either arm
is changed after freezing, the run is abandoned and restarted with a new name.

## Eligibility

A page enters the evaluation set only if `emitTaskAuto.mjs` emits a task for it — which requires the
observation to be CONFIRMED_BEHAVIOUR, the carried-forward checks to pass on the delivered page, and
every addition check to fail there. Pages that fail this are reported as **not eligible**, with the
reason, and are not silently dropped. Eligibility is a property of the page and the emitter, and is
reported separately from either arm's success.

## The evaluator

One evaluator, outside both arms: `playCheck` over the emitted `diagnostic.spec`, plus the protected
set, plus the acceptance disposition. It is run on each arm's final artifact by the harness, not by
the arm. An arm's internal belief that it succeeded is recorded and ignored.

## Budget and the resource ledger

Equal **call limits** per page (the frozen budget: 12 calls, 4 rounds, seeds 1-3). Equal calls are
not equal cost, so every run records:

| Recorded per page, per arm |
|---|
| prompt tokens and output tokens, per call |
| generation milliseconds, per call |
| checking milliseconds (observation, emission, gate, acceptance) |
| attempts made, and how many were refused before reaching the gate |
| total wall clock |
| human interventions |

Local execution is **$0 in new cloud charges** and is not free. Modal stays off; the spend limit is
$0; no GPU arm is part of CLAIM-1. A model comparison needs authorization recorded in a frozen
definition before it is deployed, and none exists.

## What is reported

Per arm, over **all 20 assigned tasks** — never over a filtered subset:

1. **Verified completions / 20.** Verified by the common evaluator.
2. **Regressions produced, and regressions surviving.** Produced and surviving are separate columns:
   a regression that the recovery path restored is not the same event as one that survived.
3. **Total resources, including every unsuccessful attempt.** The ledger above, summed.
4. **Human interventions.** Expected 0. Any intervention makes the result "the policy plus N rescues"
   and is reported in the headline, not a footnote.

Additionally, from the attempt corpus: the distribution of MET / PARTIAL_EFFECT / NOTHING_WORKED /
BROKE_WHAT_WORKED / NOT_JUDGED per arm. This is **descriptive**. A partial effect is a failure of the
task and is counted as one in line 1.

## Power, declared in advance

20 paired pages is a small experiment, and this project's observed completion rates are low (2 of 13
accepted on one sweep; 0 of 20 on another). **CLAIM-1 can detect a large difference and cannot detect
a small one.** With 20 paired tasks, a difference of roughly 5 or more completions is distinguishable
from chance; a difference of 1-3 is not.

So the outcomes are declared now:

- **A materially ahead of B** (≥5 more verified completions): evidence that automatic planning and
  extracted guidance help *this model on this family*.
- **B materially ahead of A**: the manager is costing completions, and the planning layer is on trial.
- **Neither materially ahead**: *no difference was detected at this sample size.* This is **not**
  "the manager does not help" and must never be written as such. It is a statement about what 20
  paired pages can resolve.
- **Both near zero**: the family is too hard for this model and CLAIM-1 answers nothing about the
  manager. Report as an uninformative run, not as a null.

## Frozen inputs

| | |
|---|---|
| Model | `qwen2.5-coder:1.5b`, local ollama, temperature 0.2, num_predict 400, seeds 1-3 |
| Arm A | `server/managerRun.mjs` + planner + emitter + containment, at the commit recorded at freeze |
| Arm B | to be written; frozen at the same moment |
| Evaluator | `server/playCheck.js` + `server/acceptanceDecision.mjs`, shared, unmodified by either arm |
| Spend | $0. Local only. Modal off. |
| Interventions permitted | none |
