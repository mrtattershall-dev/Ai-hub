# Does Legasus earn its place? — V1..V8. Frozen 2026-09-21, before either arm is built.

## The question

Not *"does the integration work"* — that is answered. **What does the additional machinery
improve, over the corrected adapter plus ordinary storage?**

## The arms — and the baseline is NOT handicapped

| arm | system |
|---|---|
| **B0** | eslint + the corrected adapter + **ordinary result storage**: a JSON cache keyed by file path, which is what a competent engineer writes first |
| **B1** | **B0 hardened by its own author to meet the identical requirements below.** Plain code, no Legasus. This is the arm that matters |
| **T** | the same components **plus** Legasus admission, provenance and replay |

**B1 exists because the comparison is worthless without it.** Handing Legasus protections while
forbidding the baseline from implementing the same requirements would measure a protected system
against an intentionally unprotected one. B0 is included only to show what the unhardened starting
point does, and is **not** the comparison.

## Identical requirements, stated before either arm is written

    R-a   a saved result must NOT be reused when the file's content has changed
    R-b   a saved result must NOT be reused when the configuration has changed
    R-c   a saved result that is still valid — same content, same configuration — MUST remain usable
    R-d   reuse must work across a PROCESS RESTART, from storage alone

Both arms get **identical evidence** (the same files, the same eslint, the same adapter output) and
**identical requirements**. Neither is given a requirement the other is denied.

## The workflow, identical for both arms

1. analyse a file; **save** the result
2. **restart** (a genuinely new process — only bytes on disk survive)
3. attempt to **reuse** the saved result — legitimate case, nothing changed
4. **change the file's content**; restart; attempt reuse
5. **change the configuration**; restart; attempt reuse

## What is measured

| measure | how |
|---|---|
| **unsafe acceptance** | does the arm reuse a result for the wrong content or wrong configuration? |
| **availability** | does legitimate unchanged evidence remain usable? |
| **implementation effort** | non-comment, non-blank lines written **by the arm's author** to meet R-a..R-d |
| **runtime cost** | wall-clock for the full workflow, same machine, same files |
| **human effort** | every decision the author had to make that the requirements did not determine |

## The extension test — the discriminator

Passing R-a..R-d is table stakes; both hardened arms should. The real question is whether Legasus is
**reusable enforcement** or whether the baseline's checks are just as extensible.

So after both arms pass, a **fifth requirement is added**:

    R-e   a saved result must NOT be reused when the TOOL ITSELF has changed
          (eslint version, or the selected rule's own definition)

**Incremental lines to satisfy R-e are counted for each arm.** If B1 needs roughly as little as T,
Legasus has not earned its place on this workflow. If T needs materially less because the property
is already structural, that is the first concrete evidence of reusable enforcement.

## Frozen expected outcomes — including the one I expect to lose

- **B0 accepts stale evidence after a content change, and after a configuration change.** Unsafe on
  both. This is not a finding about Legasus; it is what a path-keyed cache does.
- **B1 refuses both and preserves legitimate reuse.** I expect it to cost roughly **20–40 lines**:
  a content digest and a configuration digest, compared on load.
- **T refuses both and preserves legitimate reuse.**
- **I expect B1 and T to be equally safe on R-a..R-d, and I expect B1 to be SIMPLER** — fewer lines,
  less runtime, fewer concepts. On this workflow I expect **Legasus not to earn its place**, and its
  value to depend on properties this workflow does not exercise: multiple parties, merged journals,
  governance attachment, obligation modes.
- **R-e is where I am genuinely uncertain.** B1 must add a third digest and remember to; T may get it
  from rule identity it already carries. I do not know which way this goes, which is why it is the
  discriminator rather than a formality.

**If the corrected adapter achieves the same result more simply, that is the result**, and it will be
reported as Legasus failing to earn its place on this workflow.

## Rules for the run

- **Both arms are written by me**, so effort comparisons are *same-author* comparisons. That is a
  limitation, stated now: I know Legasus well and am writing its competitor. A hostile baseline
  author might do better. **Line counts are a proxy, not a measurement of difficulty.**
- **Failures are preserved.** If an arm fails a requirement, the failing version stays.
- **No requirement is added or dropped after seeing a result**, except R-e, which is frozen here.
- **Independent reproduction has not happened.** The comparison is packaged so someone else can run
  it; that is not a substitute for someone else running it, and the result will say so.

## Untouched

Registry still **3 authored rules, 0/15**. The corpus experiment is **closed**. **S6, F2,
`COMPLETE`, `INVALIDATE`** untouched. The preserved specimen adapter is not modified.
