# PROTOCOL-2 RESULT — v2 controller, 3 replicates

Ran 2026-09-23 11:04Z → ~12:04Z. **All 30 runs completed**; no truncation, no UNATTEMPTED, no
retries, no tuning during the run. **DEVELOPMENT COMPARISON** on already-inspected tasks.

## Paired outcomes by replicate

`+` = accepted improvement, `-` = not accepted.

| task | rep1 | rep2 | rep3 |
|---|---|---|---|
| t1-repair-node-average | C+ T+ | C+ T+ | C+ T+ |
| t2-repair-python-parse | C+ T− | C− T− | C+ T− |
| t3-add-node-median | C− T− | C− T+ | C− T+ |
| t4-add-python-slugify | C− T+ | C− T− | C+ T+ |
| t5-multifile-node-discount | C− T− | C− T− | C− T− |

## Aggregate, over ALL 30 attempted runs

| | CONTROL | TREATMENT |
|---|---|---|
| runs | 15 | 15 |
| **accepted improvements** | **6** | **7** |
| requested PASS | 6 | 7 |
| protected retained | 14/15 | 14/15 |
| **protected broken** | **1** | **1** |
| evaluation errors | 0 | 0 |
| model calls | 102 | 82 |
| tokens | 561,472 | 459,143 |
| seconds | 584 | 517 |
| **tool executions** | **101** | **44** |
| controller refusals | 0 | 32 |

Spend counts **every attempted run, successes and failures alike**.

## Question 1 — does v2 change verified completion?

6 vs 7 of 15. **Not answered.** A one-run difference at this scale is not a result, and the
replicate data shows why.

## What three replicates DID show: the variability, directly

Same task, same arm, different replicates:

    t2 CONTROL    +  −  +
    t4 CONTROL    −  −  +
    t3 TREATMENT  −  +  +
    t4 TREATMENT  +  −  +

**Six of ten task×arm cells are unstable across replicates.** This is the thing PROTOCOL-1 could
not see and that I previously asserted without measuring. Three replicates is a **chosen
budget, not a statistical threshold**, and this supports no significance claim — but it does
establish that single-run differences of this size are uninformative.

Two cells were stable: **t1 accepted in all six runs** (both arms, every replicate), and **t5
accepted in none**. The interesting variation is entirely in t2, t3, t4.

## Question 2 — what each arm spent

    model calls       82 vs 102     treatment −20%
    tokens       459,143 vs 561,472 treatment −18%
    seconds          517 vs 584     treatment −11%
    tool executions   44 vs 101     treatment −56%

The activity reduction from PROTOCOL-1 **persisted at 3× the sample**, and the tool-execution
gap is the largest: the treatment arm did its work with **fewer than half** the executed
actions, against 32 controller refusals.

These are **measurements from these runs**, not estimates of repeatable savings.

## The acceptance policy fired LIVE, and worked

**One protected-behaviour regression in each arm — both RESTORED:**

    rep1  t3-add-node-median          TREATMENT   protected FAIL -> RESTORED
    rep1  t5-multifile-node-discount  CONTROL     protected FAIL -> RESTORED

This is the first time the policy has acted inside a real campaign rather than on replayed
candidates. Candidate failures are preserved separately under `rejected/`; the restored
workspaces re-verified clean. **Detected damage did not survive in either arm** — the gap
PILOT-2 exposed is closed in live operation.

Note the symmetry: the treatment arm broke protected behaviour too. The controller did not
prevent that regression; the acceptance policy caught it. They are different mechanisms.

## Third reporting failure

The campaign completed all 30 runs and then **crashed writing its report**:
`ReferenceError: ORDER is not defined` — the schedule was renamed to `PAIRS` and one reference
in the report object was missed. `node --check` cannot catch an undefined reference on a path
that only executes at the end.

Recovered from the per-run console lines and the surviving run records. Tokens and tool
executions needed arm attribution the records do not carry, so they were recovered by
mtime-ordering the run records and **verifying** the mapping against each run's logged call
count: **30/30 agreement**. Verified, not assumed.

**This is the third time a completed run produced a broken report.** The pattern is now the
finding: reporting code runs once, at the end, after everything expensive has already happened,
and is never exercised by the tests that pass beforehand.

## Not established

- No claim that v2 helps or hurts completion. 6 vs 7 with six unstable cells settles nothing.
- No efficiency *advantage* — a consistent, substantial activity reduction was measured twice;
  whether it is repeatable, and whether it costs work on other tasks, is open.
- Nothing about held-out performance. These five tasks remain development cases.
- No claim that the controller prevents regressions. It did not prevent the one in its own arm.
