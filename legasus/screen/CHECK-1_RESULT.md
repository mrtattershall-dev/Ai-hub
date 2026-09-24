# CHECK-1 RESULT — the repaired execution path, on the six tasks where the defects appeared

Ran 2026-09-24 16:28:09Z → 16:36:50Z. **8m 41s of a 2-hour budget.** Unattended; interventions
none; 6/6 accounted, integrity and reconciliation true. GPU stopped 16:37:07Z, confirmed
`stopping...`; ~11 min A10G ≈ $0.20 of the authorized $10 cap.

**This reads mechanisms, not productivity.** Outcome counts are descriptive only: they do not
establish a repeatable or attributable improvement.

## The four declared readings - three positive, one unexercised

| repair | declared reading | observed |
|---|---|---|
| per-call deadline + ledger | no run ends as TIMEOUT with an empty reply; a hung/late call shows a ledger outcome | **0 task-level timeouts** (BENCH-2: 4 of these 6). One MODEL CALL did time out and was recorded as exactly that. Every call in every run has a ledger outcome. One `DEADLINE_LOCAL_ABORT` fired live (find_in_sorted, call 41: the per-call deadline had shrunk to 4.1s at the budget's edge, 0 chars arrived, serverOutcome UNKNOWN, `unconfirmedRemoteCalls: 1`) |
| prompt from effective tool set | no reply names a removed tool | **0 of 90 replies** named verify_project / see_screen / verify_godot / spawn_subtask (BENCH-2's seq-1-count: 3 of 3 replies asked verify_project) |
| removed-tool feedback | fires only if a removed tool is requested | not exercised — nothing requested one (consistent: the prompt no longer tells it to) |
| finish-gate closed | any finish carries CLOSED_UNDER_BOUNDING, no host verdict | the one finished run (lcs_length) carries **`finishVerification: CLOSED_UNDER_BOUNDING`**; no "Verified (…)"/"does not run" text anywhere. This supports THAT ROUTE's closure; it alone does not prove nothing anywhere executed on the host |

Per-call deadlines were armed on every call in every run (≈295s at dispatch, shrinking with
the remaining budget — exactly the declared derivation).

## Outcome counts (recorded separately; this design cannot read them)

    ext-find_in_sorted    ENDED    req FAIL  prot FAIL  RESTORED    39 edits, 42 calls
    ext-is_valid_paren…   ENDED    req PASS  prot PASS  RETAIN      verified repair
    ext-lcs_length        ENDED    req FAIL  prot PASS  PRESERVE_INCOMPLETE  (finished via closed gate)
    ext-lis               ENDED    req FAIL  prot PASS  PRESERVE_INCOMPLETE  0 edits
    ext-pascal            ENDED    req FAIL  prot PASS  PRESERVE_INCOMPLETE
    seq-1-count           ENDED    req FAIL  prot FAIL  RESTORED    edited this time (BENCH-2: 0 tools)

    accepted 1/5 external, 0/1 sequential · regressions produced 2, surviving 0

The four tasks lost to unreturned calls in BENCH-2 all terminated normally and produced
classifiable records — including one verified repair. Whether the earlier losses were the
server's or the calls' is still unknown; what changed is that the hub no longer waits past its
budget and now says what it knows.

## Notes, kept honest

- **CORRECTED (tatte): not cosmetic.** find_in_sorted's persisted run file reads
  `status: running` - a contradictory durable record: completed, dispositioned work whose
  on-disk state says active. Cause: the hub is killed after the terminal state is observable
  over the API but before it is persisted. For unattended operation, recovery must never
  mistake completed work for an active run. Fixed same day: terminal state is persisted
  BEFORE the run is released, the runner waits for the finalization acknowledgment, and
  recovery of a genuinely unfinalized record is explicit (persistTerminal.test.mjs).
- One task became a verified repair that failed in BENCH-2, one edited that had frozen, one
  went from an edit-loop to RESTORED. these observations are **descriptive**: same model, n=1,
  and BENCH-1/2 already showed tasks flipping both ways with no code change, so they
  establish no repeatable or attributable improvement.
- seq-1-count now *acts* and breaks protected behaviour where it previously looped on a
  removed tool. Movement through the workflow again, caught by acceptance again.

Records: CHECK-1_REPORT.json · CHECK-1_summary.jsonl · CHECK-1_console.log
