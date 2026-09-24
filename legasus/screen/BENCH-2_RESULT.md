# BENCH-2 RESULT — BENCH-1's definition on hub ec71665 (earlier warning + supplied file)

Ran 2026-09-24 13:47:40Z → 14:33:00Z, **45m 17s of a 2-hour budget**; queue exhausted early.
Unattended from launch to final report; interventions: none. GPU app stopped with
`modal app stop --yes` at 14:33:15Z and confirmed `stopping...`; ~47 min A10G ≈ under $1 of
the $10 cap (estimate from rate; Modal's CLI exposes no balance).

**NO COMPARISON ARM.** One configuration, n=1, two changes bundled. BENCH-1 figures beside each
count are a before/after on the same model, not an attribution to either change.

## Operation

| | |
|---|---|
| stopped cleanly, nothing left running | **YES** |
| every queued task accounted for | **YES** — 20/20, `UNACCOUNTED: 0` |
| final report automatic, integrity + reconciliation | **YES / true / true** |
| status | `COMPLETED 16 · BLOCKED 4 · INTERRUPTED 0 · UNATTEMPTED 0` |
| target file supplied in the opening context | **15 / 15** external tasks (all under 8192 bytes) |

## EXTERNAL — 15 QuixBugs bug fixes, three counts kept separate

                                          BENCH-2      BENCH-1
    edit attempts on the target file       7 / 15       4 / 15
    accepted (verified) repairs            0 / 15       2 / 15
    candidate regressions produced         3            1
    candidate regressions surviving        0            0
    first tool = outline/read of target    3 / 15     >=12 / 15
    re-read the file already supplied      3 / 15       n/a
    terminated by the repeat guard         7 / 15      10 / 15
    terminated by the 300s limit           6 / 15       1 / 15
    model calls / tokens / task seconds    107 / 662,926 / 2605     102 / 579,018 / 867

**Movement through the workflow, not productivity.** The outline-stall that dominated BENCH-1
(10 of 13 failures) is gone as the first move: 9 of 15 runs went straight to `run_python` on
the supplied file, and 2 went straight to `edit_file`. More runs edited (7 vs 4). None of the
edits produced a verified repair, and three broke protected behaviour (`bucketsort`, `kth`,
`next_palindrome`) — all three captured and restored, so none survived. Both BENCH-1 successes
(`flatten`, `gcd`) failed this time; `flatten` edited three times and looped, `gcd` ran the file,
declared `task_done` twice and was stopped by the repeat guard.

### Classification by first evidenced obstacle (`benchClassify.mjs`, then one correction)

The classifier's own tally: `6 BUDGET_EXHAUSTED · 4 NO_EDIT_ATTEMPTED · 3 UNCERTAIN · 2 EDIT_WRONG`.

**Four of the six "budget" cases are not model behaviour.** In `find_in_sorted`,
`is_valid_parenthesization`, `lcs_length` and `lis` the run's last event is a model request
that **never returned** — an empty reply recorded 193–295 s after the previous turn, then the
runner's stop. The first three had made 0–1 calls; nothing the model did explains a 300 s
silence. Whether the server was still generating (a runaway to the 16384-token window at
~27 tok/s takes ~10 min) or the request was lost cannot be settled: Modal retained only the
last 12 of ~110 requests in its log. Recorded as **MODEL_CALL_UNRETURNED (4)**, an
infrastructure-or-generation class, separate from the 2 real budget exhaustions
(`get_factors`: 42 calls, 32 edits, target unchanged; `next_palindrome`: 8 edits, unparseable).

So, for the 15:

    4   MODEL_CALL_UNRETURNED     last model request produced nothing within the budget
    4   NO_EDIT_ATTEMPTED         kheapsort (outlined x5), longest_common_subsequence
                                  (search_file loop), max_sublist_sum (run_python x5),
                                  gcd (ran, declared done twice, stopped)
    3   EDIT_WRONG / UNCERTAIN    bucketsort, kth (left the file unparseable -> restored),
                                  pascal (one edit, file unchanged at the end)
    2   BUDGET_EXHAUSTED          get_factors, next_palindrome
    2   EDIT_LOOPED               flatten, mergesort (same edit returning the same answer x3)

## SEQUENTIAL — chain stopped at step 1 again (0 / 5, BENCH-1: 0 / 5)

Step 1 (`count`) never executed a tool. All three replies asked for **`verify_project`** — a
route that bounding removes — and the hub answered each with *"Could not parse an action"*
rather than *"that tool is not available"*, then stopped it as three identical responses. This
is a Hub message defect on the bounded path: a removed tool is reported as unparseable input.
Steps 2–5 BLOCKED, untested.

## What this settles and what it does not

SETTLED: the supplied file changed the model's first move (outline-first 3/15 vs >=12/15) and
raised edit attempts (7 vs 4). The earlier warning is present in 10/15 runs; runs still
terminate on identical replies, now on `run_python`, `search_file` and `edit_file` instead of
`outline_file`. **The stall moved; it did not go away.**

NOT SETTLED: any productivity change. 0/15 vs 2/15 is within what n=1 can show either way, and
two of the fifteen tasks flipped from pass to fail with no change in their seeds.

NEW, separate from the model: (1) four runs lost to an unreturned model call — the serving path
needs its own request log and a per-call deadline shorter than the task budget before the next
paid run; (2) the bounded path reports a removed tool as a parse failure.

Records: `BENCH-2_REPORT.json`, `BENCH-2_summary.jsonl`, `BENCH-2_console.log` (whose final
header still reads "BENCH-1 RESULT" — a hard-coded string in the runner, fixed after the run;
the report file and every record say BENCH-2).
