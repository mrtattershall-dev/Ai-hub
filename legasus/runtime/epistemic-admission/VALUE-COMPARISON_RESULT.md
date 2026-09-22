# Does Legasus earn its place? — result. V1..V8 against `VALUE-COMPARISON_PREREG.md`.

    4 arms x 4 scenarios, every step in its own OS process.
    Frozen and committed at 911a81a before either arm was written.

## The answer

> **On this workflow, Legasus does not earn its place.** The hardened baseline meets every
> requirement in **42 lines**. The Legasus arm meets them in **144** — and a control shows **its
> safety came from 8 lines I wrote, not from Legasus.**

That is the outcome I predicted and recorded before running, including the part I expected to lose.

## The table

| arm | unchanged (must reuse) | content changed | config changed | tool changed (R-e) |
|---|---|---|---|---|
| **B0** ordinary storage | reused ✓ | **REUSED ✗** | **REUSED ✗** | **REUSED ✗** |
| **B1** hardened baseline | reused ✓ | refused ✓ | refused ✓ | refused ✓ |
| **T** + Legasus | reused ✓ | refused ✓ | refused ✓ | refused ✓ |
| **TC** Legasus **only** | reused ✓ | **REUSED ✗** | **REUSED ✗** | **REUSED ✗** |

**6 requirement violations: 3 by B0, 3 by TC.** B1 and T are equally safe.

## TC — the control that decides the question

**TC is arm T with the eight lines of explicit world comparison I wrote removed.** What remains is
Legasus replay plus production admission, and nothing else.

**It reuses stale evidence in every scenario** — changed file, changed configuration, changed tool.

So arm T's safety is **not** attributable to Legasus. It comes from the eight lines in
`arm-t.mjs:reuse()` that compare the saved observation context against the current world. Legasus
replayed the saved evidence faithfully and re-established the claim, because **the saved evidence is
internally consistent** — the certificates agree with each other whatever the file on disk now says.

**This is not a Legasus defect.** It is exactly what `REPLAY_RESULT.md` recorded and froze:
*reproduction is not currency*, and *there is no freshness rule in the registry*. This workflow needs
**currency**, and currency is precisely the property Legasus states it does not provide. The
comparison did not discover a flaw; it measured the consequence of a boundary that was already
written down.

## Effort

| | B0 | B1 | T |
|---|---|---|---|
| lines for R-a..R-d | 18 | **32** | 140 (71 driver + 69 certificate construction) |
| incremental for R-e | — | +10 | +4 |
| **total** | 18 | **42** | **144** |
| runtime, reuse step | ~1 ms | ~55 ms | ~57 ms |

**3.4× the code for the same safety.** Runtime is a wash between B1 and T — both are dominated by
eslint's own configuration calculation. B0's 1 ms is the cost of doing nothing.

### The R-e result does NOT favour Legasus, and saying otherwise would be the easy mistake

T needed +4 lines and B1 needed +10, which looks like the structural advantage the preregistration
was hunting for. **It is not.** The difference is how *I* structured each arm: T folds the tool into
an existing identity string that an existing comparison already covers; B1 adds a separate digest
*and* a separate comparison. **Had I written B1 with one combined context digest, R-e would have
cost it the same +4.** The extension test therefore found **no** reusable-enforcement advantage —
it found a difference in my own code layout.

### Human decisions required

| | decisions the requirements did not determine |
|---|---|
| **B1** | what counts as "the configuration" (rule id + effective options); what counts as "the tool" (eslint version + rule source) |
| **T** | **both of the above**, plus how to map content and configuration onto world coordinates (`repository`, `claim_domain`), plus the entire certificate shape |

**T required strictly more human judgement**, not less.

## Predictions

| prediction | outcome |
|---|---|
| B0 unsafe on content and configuration | **held** (and on the tool too) |
| B1 refuses both, preserves legitimate reuse, ~20–40 lines | **held** — 32 lines before R-e, inside the predicted range |
| T refuses both, preserves legitimate reuse | **held** — but see TC |
| B1 and T equally safe; **B1 simpler; Legasus does not earn its place here** | **held** |
| R-e genuinely uncertain | **resolved, and not in Legasus's favour** — the apparent advantage is my code layout |

The one thing I did **not** predict is TC. I expected to attribute T's safety to Legasus and argue
it was redundant; the control shows there was nothing to attribute in the first place.

## Limitations, stated rather than buried

- **Both arms were written by me.** I know Legasus well and wrote its competitor. A hostile baseline
  author might do better than 42 lines, or worse. **Line counts are a proxy for effort, not a
  measurement of difficulty.**
- **One workflow, one obligation, one file.** This exercises persistence and currency across a
  restart. It does **not** exercise the properties Legasus was actually built for — multiple parties,
  merged journals, governance attachment, obligation modes, authorized continuity. Nothing here says
  those are worthless; it says **they are not what this workflow needs.**
- **Independent reproduction has not happened.** The arms and the runner are committed so someone
  else can run them. That is not a substitute for someone else running them, and this document does
  not claim otherwise.

## What this means for Legasus

**Where it stands after this comparison:** for a single-party, single-file "analyse, save, restart,
reuse" workflow, a 42-line content/config/tool digest is the right tool, and Legasus is 3.4× the code
for the same result. **Its value, if it has one, must come from the properties this workflow does not
touch** — and demonstrating that requires a workflow with more than one party in it.

**Where it does not stand:** nothing here shows Legasus is wrong, unsound, or that its internal
results are invalidated. It shows that on *this* problem it is not the economical answer.

## Untouched

Registry still **3 authored rules, 0/15**. The corpus experiment stays **closed**. **S6, F2,
`COMPLETE`, `INVALIDATE`** untouched. The corrected adapter was used by all four arms **as
committed** and was not modified.
