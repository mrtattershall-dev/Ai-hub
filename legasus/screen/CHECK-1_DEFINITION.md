# CHECK-1 — a small, frozen check of the repaired execution path

Frozen 2026-09-24 before any generation. **Not a benchmark and not a comparison.** It asks
whether the concrete repairs made since BENCH-2 act on real execution, on the tasks where the
defects were observed. Spend requires an authorized cap before launch.

## Tasks — six, chosen by where each defect was observed in BENCH-2

    ext-find_in_sorted             }  the four runs whose last model call never returned
    ext-is_valid_parenthesization  }  (recorded then as TIMEOUT with an empty reply)
    ext-lcs_length                 }
    ext-lis                        }
    seq-1-count                       asked for verify_project 3x, told "could not parse"
    ext-pascal                        the original outline-stall specimen; edited in BENCH-2

Same seeds, checks, guidance, limits and order as BENCH-1/2 (`bench1.mjs` with
`BENCH_TASK_IDS`, `BENCH_EXPERIMENT=CHECK-1`). 300s per task, no retries. Expected duration
under 35 minutes; the 2-hour bound still applies.

## Configuration

Hub at the commit recorded in the console header (after the round-3 fixes). Same model and
serving as BENCH-2 (Qwen2.5-Coder-7B-Instruct, A10G, `legasus-7b`, temp 0.2, no other
sampling knobs). Worker isolation ON, route bounding ON (now including the finish gate),
acceptance ON, d2 OFF, protocol controller OFF, supplied-file ON (8192). **The runner declares
`budgetSec: 300`, so every model call has a deadline below the remaining budget.**

Repairs under test, each with the reading declared now:

| repair | what would show it acting | what would show it not |
|---|---|---|
| per-call deadline + ledger | any hung call appears as `DEADLINE_LOCAL_ABORT` with dispatch/deadline recorded and `unconfirmedRemoteCalls ≥ 1`; **no** run ends as TIMEOUT with an empty final reply | a run ends on an empty reply with no ledger outcome |
| prompt rendered from the tool set | no reply names `verify_project`, `see_screen`, `verify_godot`, `spawn_subtask` | any such reply (then the removed-tool feedback must appear, not "could not parse") |
| removed-tool feedback | if a removed tool is requested anyway: `route_unavailable` step and the TOOL UNAVAILABLE message in the transcript delta | a "Could not parse an action" step for a well-formed action |
| finish-gate closure | any finished run carries `finishVerification: CLOSED_UNDER_BOUNDING` and no "Verified (…)" / "Project does not run" step | either host-verdict text |

Reported per task, separately, never summed: edit attempts on the target · accepted repairs ·
candidate regressions produced / surviving · termination reason · call-ledger outcomes ·
unconfirmed remote calls.

## What this can and cannot say

CAN: whether each repair's mechanism fired on a live model where the defect previously
appeared, and whether the four previously-lost runs now produce a classifiable record.

CANNOT: whether any repair improves task outcomes. n=1 per task; two of six were fixed or
broken by chance in earlier runs. Zero verified repairs here would not contradict the repairs
working, and six would not show them working — the outcome counts are recorded because the
user asked for them separately, not because this design can read them.

## Spend bounding

Only the A10G container; stopped with `modal app stop --yes` and confirmed after the run;
scaledown 900s; 2-hour wall clock in the runner. Expected ≈ 40 minutes of GPU ≈ $1. **Cap:
to be authorized before deploy.**
