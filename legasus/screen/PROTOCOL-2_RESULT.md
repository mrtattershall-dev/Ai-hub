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

6 vs 7 of 15. **Inconclusive.**

**CORRECTED**: I described this verbally as "a coin-flip difference". That asserts a
distribution nothing here measured. The supportable statement is that this design does not
distinguish 6 from 7, and the variable cells show why.

## What three replicates DID show: the variability, directly

Same task, same arm, different replicates:

    t2 CONTROL    +  −  +
    t4 CONTROL    −  −  +
    t3 TREATMENT  −  +  +
    t4 TREATMENT  +  −  +

**CORRECTED COUNT.** I first wrote "six of ten cells are unstable". Recounted directly from the
report: **4 of 10 cells are VARIABLE, 6 are STABLE.** I overstated the instability, in the
direction that flattered the point I was making.

    t1 CONTROL    + + +   stable        t3 CONTROL    - - -   stable
    t1 TREATMENT  + + +   stable        t3 TREATMENT  - + +   VARIABLE
    t2 CONTROL    + - +   VARIABLE      t4 CONTROL    - - +   VARIABLE
    t2 TREATMENT  - - -   stable        t4 TREATMENT  + - +   VARIABLE
    t5 CONTROL    - - -   stable        t5 TREATMENT  - - -   stable

Two tasks are stable in BOTH arms - t1 always accepted, t5 never - which is 4 of the 6 stable
cells. The other two stable cells are t2 TREATMENT and t3 CONTROL. All four variable cells sit
in t2, t3 and t4.

This is still the thing PROTOCOL-1 could not see and that I previously asserted without
measuring. Three replicates is a **chosen budget, not a statistical threshold**, and this supports no
significance claim.

**CORRECTED.** The flips demonstrate variability. They do **not** establish that single-run
comparisons "can tell you nothing" — they show that a single outcome is an **unreliable
estimate of repeatable performance**. A single run still reports what happened in that run.

Two cells were stable: **t1 accepted in all six runs** (both arms, every replicate), and **t5
accepted in none**. The interesting variation is entirely in t2, t3, t4.

## Question 2 — what each arm spent

    model calls       82 vs 102     treatment −20%
    tokens       459,143 vs 561,472 treatment −18%
    seconds          517 vs 584     treatment −11%
    tool executions   44 vs 101     treatment −56%

**CORRECTED**: "persisted at 3x the sample" implies a replication. **v1 and v2 are different
treatments** - v2 admits the testing tools in VERIFY and rewrites the VERIFY instruction - so
PROTOCOL-2 is not a repetition of PROTOCOL-1. What is supportable: an activity reduction
appeared in **both** experiments, under two related but distinct controllers.

The tool-execution gap is the largest: the treatment arm did its work with **fewer than half** the executed
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
- No efficiency *advantage*. An activity reduction was measured in two experiments running
  DIFFERENT controller versions, which is not a replication. Whether it is repeatable, and
  whether it costs work on other tasks, is open.
- Nothing about held-out performance. These five tasks remain development cases.
- No claim that the controller prevents regressions. It did not prevent the one in its own arm.
