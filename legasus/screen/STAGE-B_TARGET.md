# Stage B target — SEALED (2026-09-21)

    repository      pytorch/pytorch
    commit SHA      9b6e45278f06...  (full SHA in legasus/out/stageb/selection.json)
    commit date     2026-09-21T05:41:25Z
    size            1,582,485 KB
    digest          0256cfe52fbc...  - smallest of 12 survivors under the frozen rule
    selected        BEFORE any case was selected and before any source was read

Both prior targets were excluded by rule: **Odysseus** was the detector-development corpus, and
**MoneyPrinterTurbo** produced the very case H-INFO was built from. Neither can serve as a
naturally occurring test of a theory it contributed to.

## What was inspected

Name, owner, language, size, push date, contributor count, licence, fork status, top-level
directory names, head SHA and date. **No file content, no issues, no pull requests, no commit
bodies.** Nothing about this repository's behaviour or defects is known to me.

## A stale field in the raw record, corrected here rather than edited there

`selection.json` carries `detectorStateAtSelection: "SCREEN-1 detectors only..."`. That string is
boilerplate left in the selector from the SCREEN-2 run and is **wrong for this selection**. The
actual state at selection:

    H-INFO frozen in its narrow, necessary-condition form (73ec3fd)
    H-APPLIC frozen separately, standing recorded as NONE
    Stage B protocol frozen (fc5932f), including the independent entitlement criterion
    NO case selected, no AST rule yet applied, no source read

The raw file is left as written; a screener that quietly edits its own provenance records is
worse than one that carries a correction.

## What follows, in order

    1  fetch Python source at the sealed SHA (partial clone, blob:none, sparse *.py)
    2  apply the FROZEN AST case-selection rule; rank by file path; take the first 3
    3  for each case freeze P, R, E and the direct channel D
    4  diagnose against the independent entitlement criterion
    5  evaluate B1, B2 and B3 - including whether any of the four shallower accounts predicts
       the same failures, in which case H-INFO is NOT discriminated

The selection rule may not be amended after seeing what it selects.
