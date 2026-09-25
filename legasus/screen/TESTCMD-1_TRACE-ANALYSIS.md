# TESTCMD-1 — trace analysis of the 27 treatment runs

2026-09-25. **Read-only**: no model calls, no generation, no GPU. Everything below comes from
run records and transcripts TESTCMD-1 already wrote (`server/testcmdTrace.mjs`).

**Scope.** Transcripts establish **what instruction reached the model and what happened
afterwards**. They do not establish *why*. Prompt position, comprehension and capability stay
causal hypotheses requiring their own tests; nothing here adjudicates between them.

## 1. The outgoing instruction: present, intact, and in the same place every time

    instruction present and intact          25 of 27 runs
    UNKNOWN                                  2 of 27  (bucketsort r2, is_valid_parenthesization r2
                                                       - these runs made no model turn at all,
                                                       so no request was captured; not "absent")
    position                                 message 4 of the opening context (the goal
                                             message) in every run where it was captured
    truncated or altered                     none observed
    run_tests.py source inlined in full      25 of 27 (the same 25)

**There is no delivery defect on the instruction side.** The sentence naming the command went
out, unaltered, in the same position, in every run that produced a request.

## 2. Execution, classified without inferring non-execution from syntax

The live detector already missed a valid invocation form, so "did not match my pattern" is not
treated as "did not run". Every `run_python` / `run_command` step is classified:

    CONFIRMED_RUNNER    8 steps   the step references the runner AND the result carries the
                                  runner's own signature - execution OBSERVED
    NAMED_NO_OUTPUT     7 steps   references the runner, no runner signature in the result -
                                  invoked; whether it executed usefully is UNKNOWN
    UNKNOWN_EXEC        1 step    neither names the runner nor is clearly something else -
                                  cannot be ruled in or out
    OTHER_ROUTE        32 steps   clearly something else (ad-hoc calls, doctest, bare imports)
                                 ----
                                  48 execution steps total

    runs with >=1 CONFIRMED_RUNNER      5 of 27
    runs with NAMED_NO_OUTPUT only      2 of 27  (flatten r1, and part of flatten r2)
    runs with no execution step at all  5 of 27

**Six executions confirmed is not the same as all other executions ruled out.** The 7
NAMED_NO_OUTPUT and 1 UNKNOWN_EXEC steps are *not* excluded: the runner may have executed in
some of them without leaving its signature in the captured result. The defensible statement is
**execution was observed in 5 runs**, with up to 2 more possible and the rest showing no
evidence either way.

## 3. What followed, per run

Full table: `server/testcmdTrace.mjs <root>`. The pattern across the 22 runs without confirmed
execution is uniform: the model ran **its own ad-hoc code** instead — a bare call, its own
asserts, or `doctest` — and 32 of the 48 execution steps are that. Eleven of those runs ended
on the repeat guard.

## 4. Confirmed-runner runs vs the rest — and a correction to the published result

**The published TESTCMD-1_RESULT.md table of "the 6 runs where it did execute" was wrong.** It
linked each run to the *first* summary row matching its task name, so both replicates of a
task showed replicate 1's outcome. Corrected by zipping runs to rows in execution order:

    run                            confirmed / named   delivered   next action        outcome
    longest_common_subsequence r2      4 / 0           4 requests  edited the target   6->10/10  RETAIN
    flatten r2                         1 / 4           1 request   edited the target   1->1/7    PRESERVE_INCOMPLETE
    kth r2                             1 / 0           1 request   edited the target   3->0/7    RESTORED (did not import)
    max_sublist_sum r1                 1 / 0           1 request   outline_file        2->2/6    PRESERVE_INCOMPLETE
    mergesort r1                       1 / 0           1 request   edited the target   1->1/14   PRESERVE_INCOMPLETE

So it is **1 success in 5 confirmed-runner runs**, not "2 of 6". The earlier figure came from
the linking bug. The treatment arm's other three successes used the runner **not at all**:

    flatten r1     0 confirmed, 3 NAMED_NO_OUTPUT, no delivery observed   1->7/7  RETAIN
    lcs_length r1  0 confirmed, other route only                          1->9/9  RETAIN
    lcs_length r2  0 confirmed, other route only                          1->9/9  RETAIN

**The single most visible difference** between the one confirmed-runner success and the four
confirmed-runner non-successes is **repetition**: `longest_common_subsequence r2` invoked the
runner 4 times with output delivered on 4 separate requests, and edited between them. The other
four invoked it once, received one report, and then either edited once without re-checking or
went elsewhere.

**This does not show the runner caused the repair.** One run against four, on different tasks
of different difficulty, with the arm's other three successes achieved without it. It is a
place to look, not a finding.

## 5. The five missing units, reconstructed from recorded scheduling evidence only

The original report stands as written — `UNACCOUNTED: 5`, planned 60, recorded 55. That record
is preserved, not relabelled. What the scheduling evidence adds:

    ext-mergesort@TEST_PACKAGEr2        0 journal events, no workspace directory
    ext-next_palindrome@CONTROLr2       0 journal events, no workspace directory
    ext-next_palindrome@TEST_PACKAGEr2  0 journal events, no workspace directory
    ext-pascal@CONTROLr2                0 journal events, no workspace directory
    ext-pascal@TEST_PACKAGEr2           0 journal events, no workspace directory

    run start                  2026-09-25T03:22:07.977Z
    deadline (9000s - 180s)    2026-09-25T05:49:07.977Z
    last recorded unit ended   2026-09-25T05:49:14.221Z   (6s AFTER the deadline)
    r2 workspaces created      CONTROL 13 (through mergesort), TEST_PACKAGE 12 (through max_sublist_sum)

**Reconstruction: all five were NOT STARTED.** No journal event, no workspace, no attempt id
exists for any of them — the evidence is absence of any record of beginning, plus a deadline
that had already passed when the previous unit finished. They are `UNATTEMPTED` in the sense
the definition intended, and the runner's failure to write that row is the defect (it breaks
on the deadline without recording). The UNACCOUNTED reconciliation is what caught it.

## 6. What this bounded analysis produces as the next concrete defect

**The workflow requires the model to discover and choose the diagnostic, and it mostly does
not.** Instruction delivery is not the defect: the sentence and the runner's full source
reached the model, intact, in the same position, in 25 of 25 capturable runs. What follows is
that in 22 of 27 runs the model executed ad-hoc code of its own instead, and in 11 of those it
looped until the repeat guard stopped it.

That points at making the diagnostic run automatically and supplying its result, rather than
offering a command — **but note what this analysis cannot support**: it does not show that
automatic supply would be used any better than the file contents already supplied in the
opening context were. The same model received `run_tests.py` in full, unprompted, in 25 runs,
and that did not cause it to run the tests. An automatic-supply design should be judged against
that observation, not against the hope that availability was the blocker.

Not built. Recorded for the decision.
