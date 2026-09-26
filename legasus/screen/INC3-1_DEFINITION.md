# INC3-1 DEFINITION — can a bounded EDIT extend the accepted page where a replacement file could not?

Frozen 2026-09-26 before any run. **$0: local ollama only. No paid run is authorized, and none is
launched.** The 7B cells stay AUTHORIZED at $3 but HELD and unlaunched (`NARROW-1_DEFINITION.md`).

## The question

INC2-1: handed its own accepted increment-1 page and asked to return the complete new version,
the local 1.5B returned the same file on all five seeds. A from-scratch probe with the same
instruction produced new code 3 of 3 and reached planting once, so the obstacle looks like the
generation interface for a later increment rather than the feature itself. **Does asking for one
bounded edit instead of a replacement file let it extend work it already got accepted?**

## Held identical to INC2-1

The model (`qwen2.5-coder:1.5b`, local), the machine, the task (`farm-i2`), the starting file
(`NARROW-2_accepted_index.html`, the increment-1 page the gate retained), the requested steps
(1-5), the protected steps (1-3), the declared play, the independent evaluator and the acceptance
policy. The last three now run through a **shared** `judgeCandidate.mjs` used by both harnesses
rather than a copy, so the two protocols cannot be judged by two standards;
`narrowArtifact.test` 34/34 over that extraction is the evidence that moving it changed nothing.

**Changed: only what the model is asked to emit.**

## Two cells, differing in ONE thing: who chooses where the edit goes

    cell        what the model emits                         who chose the site
    anchor      FIND/REPLACE blocks over the current file     the MODEL
    fim         the middle of a hole cut in the file          the HARNESS

## Assistance ledger — stated up front, recorded in every result

Both cells:

    the edit FORMAT is given by the harness (block shape, or the hole)
    the feature is NOT split into implementation steps - one increment, as requested
    the observability seam already exists in the starting file (it is what got it accepted)

The `fim` cell only:

    the harness chooses the REGION: from `function plantSeed() {` through the last
    `document.addEventListener(...)` line - 42 of the file's 114 lines, the span that contains
    every defect increment 2 has to fix
    the harness inserts an INSTRUCTION COMMENT at the top of the hole, recorded verbatim

**The region was chosen by me after reading the page and diagnosing it** (`p` and `t` are bound as
if they were event names, planting never spends a seed, time never grows anything). That is my
decomposition, not the model's. **The `fim` cell therefore measures the model PLUS that
assistance and must never be reported as autonomous decomposition.** The `anchor` cell is the one
that asks the model to locate its own edit.

## Recorded separately, per the four boundaries asked for

    E1  editProduced        the reply parses into at least one well-formed edit
    E1b editContractClean   nothing outside the edit blocks
    E2  editApplicable      every FIND matched exactly once (anchor) / a non-empty infill (fim)
    E3  editApplied         the harness wrote the edited file
    E4  changedProgram      the result DIFFERS from the starting file   <- INC2-1 failed here
    E6  passedProtected     movement and existing behaviour still pass (steps 1-3)
    E7  passedDiagnostic    planting and growth work as well (steps 1-5)
    E8  accepted            RETAIN
    plus tokens, time, and natural stop versus watchdog truncation

E6 and E7 stay apart: "did not break what worked" and "added what was asked" are different
claims, and an edit protocol can buy the first by doing nothing.

## No fuzzy matching, by construction

A FIND must match the current text **exactly once**. Zero matches is NOT_FOUND, more than one is
AMBIGUOUS, and **no block is applied unless every block is applicable**, so a partial splice can
never reach disk. A tolerant matcher that splices at the model's own indentation is a recorded way
to destroy working code; this protocol refuses instead of guessing.

## The positive control, run before the model

A hand-written correct edit reaches **RETAIN through both protocols** (`localEdit.test` 29/29,
cells 2 and 7). So a score of zero in either cell would be a fact about the model, not a protocol
that could never have passed.

## Pre-registered readings

- **The interface was the obstacle** if E4 rises well above INC2-1's 0 of 5 and any attempt
  reaches E7. Then extending existing work becomes a capability to build on, and the next question
  is whether it holds for increments 3 and 4.
- **The interface was part of the obstacle** if E4 rises but E7 stays at zero: it will change the
  program without implementing the feature. That is still progress over copying, because a wrong
  edit is diagnosable and a copy is not, but the game does not advance.
- **The interface was not the obstacle** if E1 or E2 collapse - it cannot produce an applicable
  edit at all. Then the failure has moved to emitting the edit format, and a smaller unit of work
  (one key, one function) is the next thing to try, not a bigger model.
- **A difference between the cells localizes the difficulty.** `anchor` failing where `fim`
  succeeds would say the model cannot find its own edit site while it can write the code. The
  reverse would say the format is the problem.

Whatever happens, **none of this establishes that the game got built.** It measures whether the
system can extend its own accepted work by one increment, five attempts per cell.

## Plan

Five seeds (1-5) per cell, `--deadline-sec 900 --max-tokens 4000`, temperature 0.2, the same
seeds in both. Records to `legasus/screen/INC3-1_{anchor,fim}_seed*.json`.
