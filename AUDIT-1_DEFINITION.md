# AUDIT-1 — where does the manager actually stand, with a model that can use it?

**Status: FROZEN. Written before deployment, as the standing rule requires.**

## Authorization — recorded before anything is deployed

| | |
|---|---|
| Authorizer | **Micheal (tatte)**, this project's spend authorizer |
| Given | 2026-09-28, directly in chat, in his own words |
| Instruction | "run 7B coder with model with a five dollar cap to run an audit to figure out what works and what doesn't and what needs work … and use all the data recorders and all that that we have in place" |
| Cap | **$5 USD**, for **this audit only**. Not a standing authorization and not extendable without a new one. |
| Everything else | stays at $0. No other GPU work is authorized by this. |

The unverified "$10 / 5-hour" figure from an earlier conversation remains unverified and is **not**
the basis for this run. This authorization is separate, explicit, and from the authorizer.

### What this authorization does NOT cover

**The guidance ablation (`--guidance no-renderer | none`) is NOT authorized and has NOT been run.**

The switch is built and the default (`full`) is byte-identical to the frozen policy, so nothing about
an ordinary run changed. But the paid arm is held, for a process reason worth recording:

I offered the ablation as an **opt-out** - "say if you'd rather I hold it" - rather than asking for an
opt-in. That is consent-by-silence, and it is the precise pattern the standing rule exists to prevent:
a cap suggested, assumed, or merely not objected to by any voice other than the authorizer is not
authorization. The research and review voice in that exchange explicitly disclaimed spending authority,
and was right to.

Running it requires a new, explicit instruction from Micheal, recorded here before deployment, in the
same form as the one above.

### What each ablation switch removes, recorded before it is ever run

So that no arm can later be described as something it was not:

| switch | what is removed | what REMAINS supplied by Legasus |
|---|---|---|
| `full` | nothing | everything below |
| `no-renderer` | the single line naming the function the page updates through | site selection, scope-aware facts, handler facts, slot contract, instruction, containment, emitted task, evaluator |
| `none` | the planner's guidance block entirely | site selection, slot contract, instruction, containment, emitted task, evaluator |

**`none` is not "the model without Legasus."** It still receives a planner-chosen edit site, a slot
language contract, a machine-emitted requirement, containment, and an independent evaluator. A control
without Legasus is CLAIM-1's Arm B, which is a different thing and is not built.

## Why a cloud model at all

7B+ crashes this laptop — a firm standing constraint. The local arm is a 1.5B, and the question
below cannot be asked of it. This is the case the Modal policy reserves GPU for: *a question that
needs the larger model*.

## The question

The pilot has Arm A at **0 of 4** across three apparatus configurations (A0, A1, A2). Four apparatus
defects have been found and fixed. The open question is which of two things is true:

> Is the manager's guidance usable, and the 1.5B simply unable to use it —
> or is the guidance still malformed in a way no model can use?

A 1.5B returning empty 83% of the time cannot separate these. A capable model can.

## The four readings, fixed in advance

| What the 7B does | What it establishes | What becomes the work item |
|---|---|---|
| **Completes ≥1 task** | The guidance is usable. The 1.5B was the binding constraint. | Model choice — CLAIM-1's arms need rethinking |
| **Returns empty or document-closing garbage** | The prompt shape is still broken. Apparatus, not model size. | The slot and prompt shape |
| **Writes plausible code that fails the checks** | Guidance is usable but insufficient — it reaches the site and misses the effect. | The planner and its guidance |
| **Breaks carried-forward behaviour** | The site or the containment is wrong. | Site selection / containment |

These are not mutually exclusive across four pages; the *distribution* is the finding.

## What this is NOT

- **Not a controlled 1.5B-vs-7B comparison.** Seeds do not reproduce across backends and the ollama
  versions differ (established 2026-09-27). Any local-vs-cloud number here is descriptive, never a
  matched result.
- **Not CLAIM-1.** CLAIM-1 has no second arm here. This audit informs whether CLAIM-1 is worth
  running and with which model; it does not answer it.
- **Not a transfer result.** The four pilot pages were written for the pilot and are development
  pages. They are never evaluation pages, and running a cloud model on them does not change that.

## Configuration

| | |
|---|---|
| Model | `qwen2.5-coder:7b` — the size Micheal specified |
| Serving | `modal-serve/modal_ollama_audit.py`, A10G, `min_containers=0`, short scaledown |
| Arm | Arm A at the commit recorded in the result, unmodified for this run |
| Budget | the same frozen budget: 12 calls, 4 rounds, seeds 1-3, per page |
| Pages | the four pilot pages, unchanged and re-emitted from nothing |
| Decoding | temperature 0.2, num_predict 400 — identical to the local arm |

**Arm A is not tuned for this run.** Changing the guidance to suit a bigger model and then reporting
that the bigger model did well would measure nothing.

## Every recorder is on

The point of this audit is to use what is already built rather than to add anything:

- **Observation** — outcome, adapters selected, executed actions, coverage limits, unresolved
- **Emitter** — addition rule taken and why; what the baseline run did and did not establish
- **Planner proposal** — move, site, scope, evidence, uncertainty
- **The exact request** — full prompt and suffix, preserved per attempt
- **Containment** — verdict and reason for every refusal
- **Gate** — passing/failing step numbers and captured errors
- **Acceptance** — disposition and the retain decision
- **Classification** — MET / PARTIAL_EFFECT / NOTHING_WORKED / BROKE_WHAT_WORKED / NOT_JUDGED
- **Corpus** — the complete candidate and the complete completion for every attempt, kept
- **Resource ledger** — prompt and output tokens, generation ms, checking ms, wall clock

## Cost control, and how it is enforced

A dollar cap is not enforceable inside Modal by this project, so it is enforced by bounding the work
and by stopping the app:

1. `min_containers=0` — $0 while idle.
2. `scaledown_window` of 2 minutes, not 15 — the audit is a burst, and idle-warm is pure cost.
3. Bounded work: 4 pages × at most 12 calls = **at most 48 model calls**.
4. The app is **stopped explicitly** when the audit ends (`modal app stop --yes`, which is required —
   it prompts and aborts non-interactively otherwise) and the stop is **verified** with `app list`.
5. Balance is read before and after and both are recorded in the result.

Precedent, not a quote: the 2026-09-27 run of a 1.5B on A10G cost under $0.10 against a $2 cap.
Modal's rates move and nothing here is a price quote.

**If the run cannot be stopped or the spend cannot be read, that is reported as an unresolved cost
exposure, not rounded down to zero.**

## Reported

Per page: the classification distribution, the resource ledger, and for every attempt what the model
actually wrote. Plus, explicitly, **which of the four readings above the evidence supports** — and if
the distribution supports more than one, all of them, rather than the most flattering.
