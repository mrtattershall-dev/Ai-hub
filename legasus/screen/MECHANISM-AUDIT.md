# MECHANISM AUDIT — what the automatic diagnostic changed, and why the second replicate fell

2026-09-25. Read-only reconstruction from the durable records of AUTODIAG-1 and AUTODIAG-2,
plus the local fixes that followed. **No spend.** The instrument that produced every number
here is `server/mechanismAudit.mjs`, run over each campaign root; its JSON sits beside each
root as `MECHANISM-AUDIT.json`.

    AUTODIAG-1   root autodiag1-5PQbii   29 of 60 units (31 never ran)   commit eceb317
    AUTODIAG-2   root autodiag1-yvbirv   60 of 60 units                  commit 4c77a2a / 326a7e6

**AUTODIAG-1 is reported separately throughout.** It is one incomplete replicate. Nothing
below pools it with AUTODIAG-2.

## 1. The authoritative record

### 1.1 Records verified

Every commit named in the earlier reports exists; the working tree held one uncommitted file
(`modal_serve_vllm.py`, the SAMPLING-1 pass-through that WAS deployed for AUTODIAG-1 and 2 —
so the served code was not committed; it is now, see §5). Both campaign roots are intact:
`summary.jsonl`, `runs/<id>.json`, `runs/<id>.transcript.jsonl`, journals, workspaces, `arms.json`.

### 1.2 Labels agree with the surviving bytes

Acceptance's three labels are checked against the git tree hashes recorded on each row:

    label                requirement                       AUTODIAG-2      AUTODIAG-1
    RETAIN               candidate tree == surviving        10/10           8/8
    RESTORED             candidate tree != surviving        12/12           3/3
    PRESERVE_INCOMPLETE  candidate tree == surviving        38/38           18/18
    disagreements                                           0               0

RETAIN is set only when the independent evaluator's requested AND protected verdicts both PASS
on the candidate in the read-only worker; RESTORED when protected FAILs and the byte-identical
restore succeeds. Neither depends on anything the model said.

### 1.3 The five different "stopped" events, with clocks

    event                                 AUTODIAG-2                        source
    last UNIT finalized                   12:21:59.795Z                     run.finalizedAt
    last summary row written              12:22:06.332Z                     summary.jsonl
    report written / COMPLETE printed     ~12:22:03Z (console), UNTIMED     console line had no clock
    client process exit                   UNTIMED                           no line existed
    scripted `modal app stop` ran         12:27:13Z ("already stopped")     launch log
    provider-confirmed stopped            12:23:12Z (manual stop)           modal app list --json

The three untimed events are now timed (§5). The ~5-minute gap between COMPLETE and the
scripted stop was the client process's exit, which the stop waited on. AUTODIAG-1's shutdown
timeline is the same shape and is not repeated here.

### 1.4 Terminations, classified from the runs' own steps

An earlier ad-hoc classifier matched `/parse/` and so counted the Hub's end-of-run note
"X.py does not parse … restored" as a parse give-up. Re-done properly, a rollback note is a
note and the termination is the step before it:

    AUTODIAG-2                 AUTODIAG_ARM    CONTROL
    FINISH                          4             4
    REPEAT_GUARD_RESPONSE          16            14
    REPEAT_GUARD_TOOL               9             5
    CALL_DEADLINE (299s abort)      1             7
    parse give-ups                  0             0

The seven CONTROL call-deadline units are the backend hanging on a call (0 characters returned
at 299s), not the model failing; four of them sat on the second call of the run. The Hub's OWN
end-of-run parse rollback — a restoration layer that acts BEFORE acceptance ever sees the
candidate — fired in 6 treatment units and 1 control unit.

### 1.5 What the diagnostic arm actually received

    AUTODIAG-2 treatment: 69 diagnostic messages reached requests, 192 case-detail lines
    AUTODIAG-2 control:    0 diagnostic messages, 0 case-detail lines   (isolation held, 30/30)
    delivery consistency: run.diagnostics vs transcript agree in 28/30; the 2 "mismatches" are
      identical-sha dedupe (the model edited the file back to bytes already diagnosed)

The one instance of the same diagnostic differing between replicates (flatten) is Python
generator `repr` addresses (`<generator object flatten at 0x…>`) inside the actual-value text —
the counts and cases were identical. Harmless to the model; noted because it makes the
message's own hash unstable across processes.

## 2. Where matched outcomes first diverge

**At the first model action.** Both arms see byte-identical seed, guidance, system prompt and
workspace listing; the treatment additionally sees one diagnostic message before its first
action. What the model then does:

    first tool called          AUTODIAG_ARM (30)     CONTROL (30)       AUTODIAG-1: 11/14 vs 8/15
    edit_file                       25                    1
    run_python                       1                   24
    search/outline/other             4                    5

The treatment's first THOUGHT names a bug hypothesis and edits; the control's first THOUGHT
says it will run the code to see what it does. In control, that first `run_python` call is
usually a hand-written probe with no oracle, and the run proceeds to loop (repeat guard) or to
hang on the backend.

**The first edit decides the unit.** In the treatment, the result of the first edit as the
re-run diagnostic measured it:

    AUTODIAG-2   r1: up 8   down 3   flat 2   n/a 2        r2: up 3   down 5   flat 3   n/a 4
    AUTODIAG-1   r1: up 7   down 3   flat 1   n/a 3

Every unit whose first edit went "up" ended RETAIN; every "down/flat" unit ended RESTORED or
PRESERVE_INCOMPLETE — with ONE recovery in 13 such units (kth, r2: 3→0→4 of 7, not accepted).
After a bad first edit the pattern is the same each time: the after-edit diagnostic reports no
improvement, the model re-issues the SAME edit, the tool refuses it or the response repeats,
and the repeat guard ends the run within 2–4 more calls.

**So the "more retained + more restored + fewer calls + less elapsed" combination is
consistent with one account rather than four.** CORRECTED (2026-09-25, after review): the
earlier wording said "has one explanation" — too strong. First-action choice and first-edit
improvement are ASSOCIATED with the outcome; the records do not establish that they caused
the whole efficiency and regression pattern. A first edit that improves the cases could
equally mark an easier task or a better sampled plan. What follows is the account the
records support, not a demonstrated cause. The diagnostic moves the first action from
probing to editing.
Edits either fix (RETAIN) or break protected behaviour (RESTORED — 9 vs 3, all caught). Runs
end sooner because the repeat guard stops a model that repeats an edit faster than it stops a
model that repeats a probe, and because SEVEN control units burned their whole 300s on a hung
backend call. "Treatment used less time" is therefore mostly a control-arm artefact
(1,721+1,443s of which 7×299s were hangs), not efficiency.

## 3. Why 8/15 became 2/15

What differs between replicate 1 and replicate 2 of the SAME arm, from the records:

- **The model's own plan.** The first turn's messages are byte-identical in system prompt,
  supplied file, workspace listing and diagnostic — and differ in the assistant's BUILD PLAN
  (sampled at temperature 0.2, no seed sent) and therefore in the task ledger derived from it.
  Only 3/30 first-turn requests are byte-identical across replicates, all for this reason.
- **No seed was ever sent.** The hub sent `temperature: 0.2` and nothing else; the server
  seeded nothing. "Same seeds" in earlier records meant the same SEED FILES, never a sampling
  seed. Replicates were therefore two draws from the same distribution, distinguishable only by
  order.
- **The backend was faster in r2, not slower** (median call 9.2s→5.6s treatment, 4.2s→2.9s
  control), so a slowdown does not explain the drop.
- **Order, persistent state, contamination:** every unit ran in a fresh workspace under a
  freshly spawned hub; the `ws-*-r2` directories were created new; the CONTROL transcripts
  contain zero diagnostic text. Nothing in the records shows carry-over. This is absence of
  evidence in the records, not proof — the design had no way to show it positively.

**The records cannot distinguish sampling variance from a task-order or replicate-order
effect with two unseeded draws.** CORRECTED: the missing seeds explain why the replicates
were not controlled as intended; they do not by themselves explain the SIZE of the 8-to-2
swing. (MECH-1 later sent seeds and still saw 5 vs 8 within one arm.) The seed probe
establishes reproducibility only under the conditions it tested.

## 4. Hypothesis table

    #  explanation                          predicted signature              evidence AGAINST so far           cheapest discriminating check
    H1 "SEMANTIC" - a BUNDLE: concrete   C(full) > B(counts only) ≈ A     none - B never existed            arm B: same delivery, counts only
       examples, expected outputs,                                                                            (removes several things at once;
       localization, a more actionable                                                                        cannot isolate WHICH component)
       task description; the failing inputs and
       expected/actual values let the                                                                         (built, tested; MECH-1)
       model localize the bug
    H2 NOTIFICATION / WHERE-TO-ACT: being  B ≈ C > A; first action shifts   none - B never existed            same arm B; first-action and
       told "tests were run, N fail" is    to edit_file in B too                                               first-edit measures per arm
       what moves the first action
    H3 REPEAT-GUARD / COMPUTE: treatment   treatment ends faster; no        recovery 1/13 after a bad first    already visible in records; the
       wins because it acts before the     recovery after a bad first edit  edit; 7 control hangs             design cannot remove it, so it is
       guard fires, and control loops                                       (SUPPORTED as a co-factor)         reported per arm as termination class
    H4 DELIVERY/LABEL DEFECT: labels or    label/bytes disagree; diag       0 disagreements in 89 units;       done - closed by §1.2, §1.5
       freshness misreport                 count ≠ transcript               28/30 consistent, 2 dedupe
    H5 SAMPLING VARIANCE: 8 vs 2 is two    unseeded draws differ; plans     first turns identical only 3/30    seeds SENT per replicate, two seeds,
       draws at temperature 0.2            differ at the first turn         because the plan differs           the same seed across arms (MECH-1)
    H6 ORDER / STATE / CONTAMINATION       r2 differs systematically by     fresh ws + hub per unit; control   counterbalanced 3-arm rotation,
                                           position or shows leakage        sees 0 diagnostics                 position recorded per row (MECH-1)
    H7 BACKEND DRIFT (slower/worse in r2)  r2 calls slower; more deadline   r2 FASTER; 1 treatment abort       call latency per unit is on the row
                                           aborts in r2                                                        already
    H8 VERIFIER/RESTORATION/ACCOUNTING     accepted runs fail on re-eval;   RETAIN = evaluator PASS+PASS in    closed for these campaigns (§1.2);
       DEFECT                              restored ≠ bytes; units missing  worker; RESTORED byte-identical;   the instrumentation defects found
                                                                            60/60 accounted                    are listed in §5, none touches labels

Supported by the records: H3 as a co-factor and the first-action shift (§2). Closed: H4, H7,
H8. Open and discriminable next: H1 vs H2 (arm B), H5 vs H6 (seeds sent, order recorded).

## 5. Instrumentation defects found, and their status

    defect                                                          class            status
    runner printed/wrote "AUTODIAG-1" for AUTODIAG-2                instrumentation  fixed: AUTODIAG_EXPERIMENT names report/console/DONE
    report's comparisonArm/armDifference described the TESTCMD      instrumentation  fixed: built from the arm list
      package, not the diagnostic
    COMPLETE / report / exit lines carried no clock                 instrumentation  fixed: all three timestamped; DONE file written
    UNATTEMPTED row parser had lost its backslashes (/rd+$/)        instrumentation  fixed; asserted in outerDeadline.test (no live
                                                                                     campaign ever wrote such a row)
    ad-hoc termination classifier matched rollback notes as         instrumentation  fixed: mechanismAudit.mjs, rollback is a note
      parse give-ups
    no sampling seed sent; replicates unnamed                       behaviour        AGENT_SEED -> options.seed; server honours it;
                                                                                     run.sampling recorded (default unchanged: none)
    served code (SAMPLING-1) uncommitted while in use               provenance       committed with the seed change
    isolation asserted by arm name, not measured                    instrumentation  fixed: diagnosticMessagesSeen / caseDetailLinesSeen /
                                                                                     isolationOk on every row, from the transcript
    scripted GPU stop waited on client exit (~5 min late)           operational      fixed: gpuWatchdog.mjs, external, detached, sentinel
                                                                                     OR deadline, observes stopped state, bounded, tested
    generator repr addresses make diagnostic text unstable          cosmetic         recorded, not changed (counts/cases identical)

Behaviour changes are exactly two: the seed pass-through (off unless asked) and the new
`summary` diagnostic mode (used only when an arm asks for it). Everything else is
instrumentation or operational.

Tests: `autodiag.test.mjs` 36/36, `threeArm.test.mjs` 37/37 (three arms, seeds, order, naming,
clocks, accounting through the real entry point), `gpuWatchdog.test.mjs` 28/28 (completion,
deadline, transient failure, never-stops, orphaned), `outerDeadline.test.mjs` incl. the
UNATTEMPTED parse, `callDeadline` 34, `persistTerminal` 9, `effectivePrompt` 9, `removedTool` 12,
`finishGateHost` 10, `governedRun` 24.

## 6. What this audit does NOT establish

- Why the model's first edit is right ~half the time in one draw and a fifth in the next.
- Whether B (counts only) would move the first action. It has never run against a model.
- Anything about tasks the model has not seen: the 15 tasks are reused; the 7 further
  eligible QuixBugs programs are not vendored and fetching them needs a download I have not
  been authorized to make. No generalization claim is made or planned.
- Checkpoint continuation (arms branching from a preselected failure state): the Hub has no
  API to resume a run from a recorded history, and building one is not a small change. The
  next experiment is whole-run.
