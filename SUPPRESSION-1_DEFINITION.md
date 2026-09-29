# SUPPRESSION-1 — how much of a small model's failure is missing competence, and how much is an interface that never let it act?

**Status: FROZEN DEFINITION. Nothing run. $0 — local 1.5B only, no authorization needed.**

## The question

> On harmless coding tasks, with the same weights, tasks and token budget: how much performance is
> missing competence, and how much is task framing, a missing tool contract, or an interface that never
> lets the model demonstrate what it has?

Explicitly **not** an attempt to weaken, evade, or probe safety training. Every task is a benign edit to
a local HTML page. Nothing here tries to make a model less safe, and a refusal that is a legitimate
safety behaviour is recorded as such and is not counted as an interface failure.

## Why this model, and why this family

AUDIT-2 measured the **1.5B at 0 accepted** on the filter family across four apparatus configurations.
It is not true that the 1.5B has never succeeded at anything: NARROW-1/2 took it from no artifact →
complete artifact → **first accepted increment** on the farm family, by narrowing the generation
boundary and stating the interface verbatim.

So the subject is deliberately **a model on a family where it has never succeeded**. That is where
suppression and incapacity are hardest to separate, and therefore where separating them is worth doing.

## The four arms

Same weights, same pages, same requirement text, same seeds, same call budget, same token budget, one
shared evaluator outside every arm.

| arm | role given to the model | output asked for | who executes |
|---|---|---|---|
| **A** chat | a chat assistant: "explain how to do this, or give the updated page" | the complete page | the harness |
| **B** operator | "you may make this change" — a declared tool contract, `edit_file(path, contents)` | a tool call carrying the complete page | the harness, from the call |
| **C** contract | "return only the lines to insert at this exact point" — declared target, output shape, success criterion | one bounded insertion | the harness |
| **D** full Legasus | the frozen manager | one bounded insertion | `managerRun`, unchanged |

**A → B varies role and tool contract only.** Same page, same words for the requirement, same output
shape, same extractor. Nothing else moves.

**C** is the load-bearing arm: a bounded artifact contract with a declared target and success criterion,
**without** observation selection, extracted facts, renderer guidance, gate feedback, retries, or
retention. **D** adds those.

## Extraction is a treatment, and is therefore declared in advance

A and B produce a page; C and D produce an insertion. Turning any of it into a candidate is a step that
can decide the result, so:

- **A and B share `directRun`'s extractor, unchanged** — already built and tested: strip a fence, take
  from the first doctype to the last `</html>`, refuse an echo. A generous extractor would credit A and
  B for my parser; a strict one would fail them for shape, which is the straw-man error AUDIT-2 avoided.
- **C and D share the slot machinery, unchanged** — `containToSlot`, including the language gate.
- **New outcome: `NO_EXTRACTABLE_CHANGE`** — the reply contained no change this declared extractor can
  apply. Counted as an **interface outcome**, never as a coding failure, for the same reason
  `OUTPUT_CAP_EXHAUSTED` is counted as capacity.
- **New outcome: `DECLINED_TO_ACT`** — the model answered with advice and no artifact where an artifact
  was asked for. Recorded separately from an empty completion, because "explained instead of acting" is
  the behaviour under study, not noise.

### The confound this design cannot remove, stated plainly

A/B and C/D use **different output shapes**, so they necessarily use different extractors. Any A/B vs
C/D difference is therefore a difference of **method**, not of framing alone. Only **A vs B** and
**C vs D** are clean single-variable contrasts. The cross-boundary comparison is descriptive and is
reported as such.

## Pre-registered readings

| observed | reading |
|---|---|
| **B > A** | role and tool contract were suppressing expressible capability. The gap was permission-shaped. |
| **C > B** | narrowness itself is the lever — a bounded target and declared output shape, before any loop |
| **D > C only** | the external loop — observation, feedback, testing, retention — is where the value is, and the contract alone is not enough |
| **none rise** | on this family, for this model, the missing competence is more fundamental than framing |
| **all four equal and non-zero** | framing is irrelevant here, and AUDIT-2's 0/4 was an apparatus artefact that survived four fixes |

## Power, computed rather than asserted

The 1.5B's observed rate on this family is **0 of 4**. With `n` paired pages, an exact McNemar test needs
**6 discordant pairs in one direction** to clear p<0.05 — 5 gives p=0.0625. So:

- **12 pages** are generated, giving each contrast up to 12 discordant pairs.
- A contrast is called only when it reaches **≥6 discordant pairs in one direction with none against**.
- Anything smaller is reported as **"no difference detected at this sample size"** and never as "framing
  does not matter."
- If every arm scores 0, the run is **uninformative about framing** and is reported that way — not as
  evidence for fundamental incapacity, which would need arms that can succeed at all.

## Reported

Per arm, over all 12 pages: verified completions · `DECLINED_TO_ACT` · `NO_EXTRACTABLE_CHANGE` ·
`ECHOED_THE_INPUT` · refusals by reason · regressions produced and surviving · calls, tokens, wall
time · interventions (expected 0).

Plus, for A and B specifically: **how often the reply was advice rather than an artifact.** That number
is the direct measure of the behaviour this experiment exists to detect.

## What it cannot establish

- Anything about a larger model. The 7B is not an arm here.
- Anything about tasks outside this family.
- That a rise in B or C is *safety* suppression rather than ordinary distribution mismatch. It
  distinguishes "was never given a usable way to act" from "cannot"; it does not attribute the cause to
  any particular stage of training.
- That the 1.5B is at a capability floor. AUDIT-2's falsification stands: the manager is unproven, and
  this experiment tests a different claim.
