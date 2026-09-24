# CHECK-1 RESULT — the repaired execution path, on the six tasks where the defects appeared

Ran 2026-09-24 16:28:09Z → 16:36:50Z. **8m 41s of a 2-hour budget.** Unattended; interventions
none; 6/6 accounted, integrity and reconciliation true. GPU stopped 16:37:07Z, confirmed
`stopping...`; ~11 min A10G ≈ $0.20 of the authorized $10 cap.

**This reads mechanisms, not productivity** (n=1 per task, declared in the frozen definition).

## The four declared readings — all four went the "repair acting" way

| repair | declared reading | observed |
|---|---|---|
| per-call deadline + ledger | no run ends as TIMEOUT with an empty reply; a hung/late call shows a ledger outcome | **0 timeouts** (BENCH-2: 4 of these 6). Every call in every run has a ledger outcome. One `DEADLINE_LOCAL_ABORT` fired live (find_in_sorted, call 41: the per-call deadline had shrunk to 4.1s at the budget's edge, 0 chars arrived, serverOutcome UNKNOWN, `unconfirmedRemoteCalls: 1`) |
| prompt from effective tool set | no reply names a removed tool | **0 of 90 replies** named verify_project / see_screen / verify_godot / spawn_subtask (BENCH-2's seq-1-count: 3 of 3 replies asked verify_project) |
| removed-tool feedback | fires only if a removed tool is requested | not exercised — nothing requested one (consistent: the prompt no longer tells it to) |
| finish-gate closed | any finish carries CLOSED_UNDER_BOUNDING, no host verdict | the one finished run (lcs_length) carries **`finishVerification: CLOSED_UNDER_BOUNDING`**; no "Verified (…)"/"does not run" text anywhere; nothing executed on the host |

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

- find_in_sorted's persisted run file reads `status: running`: the runner kills the hub
  (SIGKILL) after collecting the terminal API state, and the last persist predates the flip.
  The journal and summary record ENDED/RESTORED; the API state was collected first. Cosmetic,
  runner-side, noted.
- One task became a verified repair that failed in BENCH-2, one edited that had frozen, one
  went from an edit-loop to RESTORED. **None of this is attributable**: same model, n=1,
  and BENCH-1→BENCH-2 already showed tasks flipping both ways with no code change.
- seq-1-count now *acts* and breaks protected behaviour where it previously looped on a
  removed tool. Movement through the workflow again, caught by acceptance again.

Records: CHECK-1_REPORT.json · CHECK-1_summary.jsonl · CHECK-1_console.log
