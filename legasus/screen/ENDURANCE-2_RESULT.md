# ENDURANCE-2 RESULT — two hours unattended

Ran 2026-09-23 15:00:54Z → 16:59:03Z. **Elapsed 118m 9s of a 120-minute budget.**
The run **ended on the clock**, as designed — 131 of 208 attempts, 77 UNATTEMPTED.
No operator intervention at any point.

## The four criteria

| # | criterion | result |
|---|---|---|
| 1 | stops within budget, no active work left behind | **YES** — `confirmNoneRunning` asked the daemon |
| 2 | preserves accepted work / rolls back regressions | **YES — and fully exercised this time** |
| 3 | accounts for every attempt | **YES** — 208/208, including 77 UNATTEMPTED |
| 4 | final report produced automatically | **YES, with a caveat** — written unaided, but two of its own checks were wrong and needed human investigation |

## Criterion 2 was exercised properly, and by the model

ENDURANCE-1 could not demonstrate rollback because nothing broke. This run had **fourteen
protected-behaviour failures, and all fourteen were restored**:

    model runs that broke protected behaviour   9   ->  RESTORED 9/9
    scripted fault probes:  5 of 8 scheduled ATTEMPTED (3 unattempted, budget)
                            5 of 5 attempted RESTORED

The nine are the important ones: **real regressions, produced by the model, during unattended
operation, every one detected and rolled back** with the candidate preserved. The five probes
confirm the machinery fires on demand; the nine confirm it fires on the thing it exists for.

## Work produced

    attempts              131 of 208 (77 UNATTEMPTED - the clock, not a failure)
    model runs            126
    accepted improvements  54
    protected retained    117 / 126
    evaluation errors       0
    model calls         1,043
    tokens          5,926,831
    tool executions     1,067
    task seconds        6,345

The scripted probes are excluded from every number above; they are recorded under their own arm.

**CORRECTED WORDING.** These are **54 successful attempts on five repeated tasks**, not 54
distinct improvements accumulating in a project. Each ran from its own frozen seed and was
discarded afterwards; nothing built on anything. They are evidence of performance on THIS
workload. Generalisation is untested.

## Two reporting defects, both in MY checks rather than the campaign

**1. `integrity: false` was a false alarm.** All 77 flagged runs were UNATTEMPTED, which
correctly have no verdict. The required-fields check did not exempt them. **The check was wrong,
not the data** — and a check that fires on correct data teaches its reader to ignore it. Fixed:
UNATTEMPTED runs are skipped.

**2. "RESTORED 5/8" understated the result.** The console line counted three UNATTEMPTED probes
in the denominator. The truth is **5 attempted, 5 restored**. Fixed to report attempted probes.

Both were caught by reading the report rather than by the report announcing them, which is the
weaker position to be in.

## A defect that did NOT bite, recorded anyway

`endurance.mjs` writes its durable summary **after** `runBatch` returns, not incrementally — the
fix applied to `protocol2.mjs` was never applied here. Had the process died at minute 110, the
report's input would not have existed and criterion 4 would have failed, recoverable only by
hand from the journal.

It completed, so the criterion passed **with this weakness present, not because it was absent**.
Flagged mid-run rather than discovered afterwards, and not touched during the run.

## What this establishes, and what it does not

ESTABLISHED
- The integrated system ran **two hours unattended**, stopped on its own clock with nothing left
  running, accounted for all 208 attempts, and reported itself without help.
- **Detected damage did not survive**: 14 of 14 protected regressions rolled back, 9 of them
  genuine model output.

NOT ESTABLISHED
- Nothing about capability. The workload is five repeated, already-inspected tasks.
- Nothing about two days. This establishes two hours.
- Protected checks passing shows the **checked** behaviour survived — not that the model
  preserved everything, nor that the hub's guards contributed nothing.

---

# NARROWING: "clean, unaided reporting" was too strong

The report **was generated automatically** — that part stands, and it is the criterion that had
failed three times.

But it then required **human investigation and two check fixes** before it could be read
correctly: `integrity: false` was a phantom, and the probe line understated recovery. Automatic
generation and trustworthy output are different properties, and only the first was demonstrated
on the night.

**Both versions are preserved:**

    ENDURANCE-2_REPORT-AS-GENERATED.json   integrity.ok false, 77 runs flagged
    ENDURANCE-2_REPORT-corrected.json      integrity.ok true,   0 runs flagged

The arm totals are **byte-identical** between them. Only the checks changed.

## And the remaining flag is real

Replayed through the repaired path, the `requested`/`protected` false alarm is gone — but the
same 77 runs are still flagged, now for a missing **`reason`**. That is correct: the old row
writer never recorded WHY a run was skipped, so the historical records genuinely cannot say.
The check now reports a real omission instead of a phantom one, and the new writer records it.
