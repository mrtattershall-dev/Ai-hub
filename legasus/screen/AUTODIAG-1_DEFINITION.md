# AUTODIAG-1 — definition, frozen before any generation

2026-09-25. **Not launched. No paid run until one is authorized and I choose to launch it.**

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
    after a SUCCESSFUL edit to the  re-run it and deliver the fresh result BEFORE the next
    target file                     model call - so the model sees the consequence of its own
                                    change before deciding what to do next
    budget                          never runs with under 30s of task budget left; a skip is
                                    recorded as a skip, not hidden
    binding                         every result names the sha256 and line count of the file
                                    it judged; a result that cannot name what it judged is not
                                    a result, and a stale one presented as current is worse
    bounded                         at most 6 failing cases shown, and if any are withheld the
                                    message states how many and says not to assume otherwise
    infrastructure                  DIAGNOSTIC_UNAVAILABLE is distinct from a failing case and
                                    says plainly that NOTHING is known about the code
    acceptance                      UNCHANGED - the evaluator materialises its own checks at
                                    evaluation time and mounts the candidate read-only

## Proven without compute — `server/autodiag.test.mjs`, 28/28

The scripted sequence deliberately includes a wrong edit and an unchanged file, because a test
that only drove a correct repair would pass even if the Hub echoed "all pass" at every step:

    failing seed        opening report: 9 attempted, 1 passed, 8 failed, bound to the seed sha
    INCORRECT edit      fresh report: 9 attempted, 2 passed, 7 failed - truthful, different
                        numbers, different sha, not a repeat of the opening report
    unchanged file      NO fresh report (list_dir changes nothing)
    failed edit         NO fresh report (the file really is unchanged)
    CORRECT edit        fresh report: 9 attempted, 9 passed, 0 failed
    terminal            acceptance untouched

Plus: infrastructure failure reported as infrastructure with no counts and no pass claim;
withheld failures counted out loud.

Regression sweep after the change: repeatWarning 15, suppliedFile 16, removedTool 12,
callDeadline 34, governedRun 24, finishGateHost 10, persistTerminal 9, effectivePrompt 9.

## The comparison, when it runs

    CONTROL     the seed exactly as BENCH-1/2/3 ran it, BENCH_GUIDANCE verbatim.
                NOT the TESTCMD-1 treatment arm - that arm is a different thing and is not
                the baseline here.
    AUTODIAG    the same seed, and the Hub runs the diagnostic and delivers its result. The
                model is not told to run anything and is given no runner source.

Same model, sampling, limits, worker, isolation, acceptance policy, evaluator, repeat guard.
Interleaved with alternating arm order. Measured exactly as TESTCMD-1 measured:
`verifiedRepairs` and the acceptance disposition first, then `newlyPassing` / `newlyFailing`
per task as case numbers, never netted and never pooled across tasks.

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

Not launched. No figure is authorized for it yet. When launched: the same mechanisms as
TESTCMD-1 - a fixed runtime bound enforced in the runner, no retries, `modal app stop --yes`
in the same job with the stopped state confirmed, and every cost figure labelled an estimate
until actual charges are available.
