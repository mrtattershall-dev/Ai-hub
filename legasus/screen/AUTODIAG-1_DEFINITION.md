# AUTODIAG-1 — definition, frozen before any generation

2026-09-25.

## AUTHORIZATION, RECORDED BEFORE DEPLOYMENT

**Micheal authorized $5 total for AUTODIAG-1** (2026-09-25: "I authorize 5 dollar cap"),
covering startup, execution, idle time and shutdown, with the frozen runtime limit and no
added retries. This is a NEW authorization for a new run: the earlier $15 applied to TESTCMD-1
and is not carried over.

## The hypothesis, stated precisely

**Does delivering current behavioural feedback automatically help this model repair code?**

It does not assume feedback guarantees useful action, and it does not ask the model to
discover or invoke a diagnostic first.

## Why this and not more of TESTCMD-1

TESTCMD-1 established, from the records:

    instruction present, intact, same position      25 of 25 capturable runs
    run_tests.py source inlined in full             the same 25
    runner execution OBSERVED                        5 of 27 runs
    model ran its own ad-hoc code instead           32 of 48 execution steps

**Receiving the runner's SOURCE is not receiving the test RESULTS.** Those are different
inputs. TESTCMD-1 supplied the first; AUTODIAG-1 supplies the second.

## The change (built, `server/autodiag.js` + three sites in `agent.js`)

    before the first model call     run the pristine diagnostic against the starting candidate
                                    in the worker; push the result into the opening context
    whenever the target's CONTENT   re-run it and deliver the fresh result BEFORE the next
    actually changes                model call - so the model sees the consequence of its own
                                    change before deciding what to do next.
                                    FRESHNESS FOLLOWS CONTENT, NOT TOOL NAMES: the target's
                                    sha256 is compared before and after EVERY tool, so a write
                                    through run_python or run_command refreshes the report
                                    exactly as edit_file does. Watching edit_file alone would
                                    have missed every other write route - the same defect class
                                    as joining runs by task name. A tool that changes no bytes
                                    (a failed edit, a read, a listing) refreshes nothing, and
                                    the report the model already holds stays the current one.
    budget                          CHARGED TO THE TASK ALLOWANCE. The diagnostic runs inside
                                    the task's own 300s wall clock; there is no separate
                                    allowance, and its execution time is spent from the same
                                    budget the model has to work in. One that would start with
                                    under 30s left is skipped and RECORDED as skipped, never
                                    silently dropped.
    binding                         every result names the sha256 and line count of the file
                                    it judged; a result that cannot name what it judged is not
                                    a result, and a stale one presented as current is worse
    bounded                         at most 6 failing cases shown, and if any are withheld the
                                    message states how many and says not to assume otherwise
    infrastructure                  DIAGNOSTIC_UNAVAILABLE is distinct from a failing case and
                                    says plainly that NOTHING is known about the code
    acceptance                      UNCHANGED - the evaluator materialises its own checks at
                                    evaluation time and mounts the candidate read-only

## Proven without compute — `server/autodiag.test.mjs`, 36/36

The scripted sequence deliberately includes a wrong edit and an unchanged file, because a test
that only drove a correct repair would pass even if the Hub echoed "all pass" at every step:

    failing seed        opening report: 9 attempted, 1 passed, 8 failed, bound to the seed sha
    INCORRECT edit      fresh report: 9 attempted, 2 passed, 7 failed - truthful, different
                        numbers, different sha, not a repeat of the opening report
    unchanged file      NO fresh report (list_dir changes nothing)
    failed edit         NO fresh report (the file really is unchanged)
    CORRECT edit        fresh report: 9 attempted, 9 passed, 0 failed
    terminal            acceptance untouched

    write via run_python    fresh report delivered, recorded as diagnosticStaleBy: run_python,
                            bound to the new sha - a tool-name watcher would have missed it
    budget                  every diagnostic completed inside the declared task budget

Plus: infrastructure failure reported as infrastructure with no counts and no pass claim;
withheld failures counted out loud. **36/36.**

Regression sweep after the change: repeatWarning 15, suppliedFile 16, removedTool 12,
callDeadline 34, governedRun 24, finishGateHost 10, persistTerminal 9, effectivePrompt 9.

## The comparison, when it runs

    CONTROL     the seed exactly as BENCH-1/2/3 ran it, BENCH_GUIDANCE verbatim.
                NOT the TESTCMD-1 treatment arm - that arm is a different thing and is not
                the baseline here.
    AUTODIAG    the same seed, and the Hub runs the diagnostic and delivers its result. The
                model is not told to run anything and is given no runner source.

Same model, sampling, limits, worker, isolation, acceptance policy, evaluator, repeat guard.
Interleaved with alternating arm order. Runner: `server/autodiag1.mjs`, which reuses the
TESTCMD-1 runner unchanged and differs only in what the treatment arm receives.

### SUCCESS IS ACCEPTED REPAIRS

`verifiedRepairs` (acceptance RETAIN) and the disposition breakdown are the result. Everything
else is reported **separately and never summed into a win**:

    verifiedRepairs, dispositions          THE result
    newlyPassing / newlyFailing            per task, as case numbers, never netted against
                                           each other and never pooled across tasks
    regressionsProduced / surviving        the cost side
    runsWithDiagnosticDelivered,           delivered feedback - evidence the treatment was
    diagnosticsDelivered,                  actually applied, NOT evidence that it worked
    diagnosticsSkippedForBudget,
    diagnosticsUnavailable
    modelCalls, tokens, elapsedSec         cost

**More delivered feedback is not a win. More passing cases is not a win.** A run that gains
four cases and is still PRESERVE_INCOMPLETE did not repair anything, and an arm that delivered
sixty diagnostics and produced no additional accepted repairs has produced a null result.

**LABEL: the diagnostic runs the graded cases.** So any AUTODIAG result is **repair with
supplied test results** - not held-out generalization, and not comparable to a configuration
where the cases are unknown to the loop.

## Pre-registered readings

- AUTODIAG raising verified repairs over CONTROL is the outcome the hypothesis predicts, and
  would still be a result about **this feedback content, this model, these tasks**.
- AUTODIAG raising newly-passing cases without raising verified repairs is a partial effect
  and must be reported as such.
- **AUTODIAG changing nothing** would show that delivering current behavioural feedback
  automatically is insufficient for this model here. It would NOT show that feedback is
  irrelevant, and it would NOT license a claim about a different report format, a different
  cadence, or another model.
- Whatever the direction, two replicates do not support a repeat-rate estimate. TESTCMD-1's
  own arms differed 8/28 vs 4/27 with unequal coverage; that is the precision available.

## What it cannot settle

Why the model does or does not act on feedback. Prompt position, comprehension and capability
remain causal hypotheses requiring their own tests - the same limit recorded in
`TESTCMD-1_TRACE-ANALYSIS.md`.

## Spend

**Authorized: $5 total**, including startup, execution, idle time and shutdown.

    fixed runtime bound    AUTODIAG_TOTAL_SEC=9000 (2.5h), enforced in the runner, which stops
                           active work rather than only new starts
    no added retries       retries: none, unchanged
    ESTIMATE (planning)    60 units at TESTCMD-1's observed pace ~ 2.4h ~ $2.70, plus the
                           diagnostics' own container time, which is charged to the same task
                           budget and so does not extend the wall clock
    CONDITIONAL figure     2.5h plus warm-up ~ $2.90 - CONDITIONAL on the runner's wall clock
                           stopping active work, `modal app stop --yes` succeeding, and no
                           request remaining in flight afterwards

**Automatic scaledown is not a spending ceiling**: it releases an IDLE container, and one still
serving a request is not idle. It is a backstop against a missed stop, not a proof of a maximum.

Every figure is an ESTIMATE and stays labelled as one until actual charges are available.
