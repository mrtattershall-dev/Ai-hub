# AUTODIAG-2 — definition, frozen before any generation

2026-09-25. **$5 authorized (see Spend). Not launched until deploy.**

## The question

**Does AUTODIAG-1's result recur?** Nothing else. No new feature, no new arm, no changed
measure.

AUTODIAG-1 observed 8 treatment-only accepted repairs across 14 complete pairs, with 0 control
repairs in 15 runs — and lost 31 of 60 planned units to a single 99-minute overrun, so it has
one replicate and no repeat rate. This run exists to find out whether the productivity result
holds when the campaign is allowed to finish.

## Identical to AUTODIAG-1

The same 15 external tasks, the same seeds, the same arms:

    CONTROL        the seed exactly as BENCH-1/2/3 ran it, BENCH_GUIDANCE verbatim
    AUTODIAG_ARM   THE SAME seed and guidance; the Hub runs the graded cases and delivers the
                   result before the first model call and whenever the target's content changes

Same model (Qwen2.5-Coder-7B-Instruct, A10G), sampling, worker image, isolation, route
bounding, acceptance policy, independent evaluator, repeat guard, 300s per task, no retries,
interleaving with alternating arm order, 2 replicates, and the same mechanical run/summary
join. Same measures, same reporting rules: **success is accepted repairs**, with case gains,
regressions, costs and delivered diagnostics reported separately and never summed into a win.

## Changed: the operational fixes, and nothing else

    the per-task bound now holds regardless of any await - a wall-clock race the awaits
      cannot escape, rather than a condition tested only between them
    every runner HTTP request carries a 30s timeout
    runDiagnostic's docker exec carries a host-side timeout
    after the bound: the hub is SIGKILLed, its exit awaited under a bound, and the worker
      asked to CONFIRM no attempt is still running
    if exit or confirmation fails, the campaign HALTS with an explicit reason rather than
      starting the next unit on top of live execution
    every unexecuted queue entry gets its own UNATTEMPTED row carrying the reason it never ran

Proven through the real campaign entry point, by two separate tests:
`deadlineRecovery.test.mjs` 14/14 (recovery via the Hub's inner deadline, against a backend
that never settles) and `outerDeadline.test.mjs` 15/15 (the outer wall itself, against an
injected uncancellable never-settling await).

The first establishes recovery through the Hub's INNER per-call deadline, and says plainly in
its own output that it does not exercise the outer wall.

**The outer wall is demonstrated by the second** — `outerDeadline.test.mjs`, 15/15. It does
not try to reproduce AUTODIAG-1's backend failure; it injects that failure's relevant
condition, an operation the campaign runner awaits that never settles and cannot be cancelled,
and leaves the real outer timer, SIGKILL, bounded exit wait, `confirmNoneRunning`, halt path,
UNATTEMPTED rows and report untouched:

    the outer deadline FIRED          the unit records hitHardWall=true; the campaign finished
                                      in 67s instead of never
    the hub exited after SIGKILL      hubExited=true
    worker shutdown CONFIRMED         executionConfirmedStopped=true - confirmed, not assumed
    no next task while unresolved     the later unit is recorded only after that confirmation
    full accounting                   all 4 planned units have rows; UNACCOUNTED 0

So the fallback intended to prevent another 99-minute wait has direct evidence, rather than
waiting for a paid run to discover whether it works.

## Pre-registered readings

- **8-vs-0 recurring** would make the productivity result a two-replicate observation rather
  than a single one. It would still be about this model, these tasks, and supplied test
  results — never held-out generalization.
- **Whatever AUTODIAG-2 shows, it does not erase AUTODIAG-1's observed 8-versus-0.** That
  result happened and stands as an observation.

  **No interpretation is pre-assigned to any outcome.** What the report must do is set the two
  experiments side by side - paired by task, with their denominators, their operational
  failures and their costs - and assess them, including the uncertainty, rather than sorting
  the result into a category chosen in advance. Specifically:

    - **A smaller difference is not automatically weaker evidence.** Two runs both favouring
      the treatment can be more evidence than one, even when the margins differ. Whether the
      evidence strengthened, weakened or did neither depends on the paired outcomes and on how
      much they could have varied - not on whether the second number is lower than the first.
    - **An apparent task or ordering pattern does not by itself establish
      condition-dependence.** With 15 tasks and 2 replicates, patterns will appear by chance.
      A pattern is a hypothesis worth naming and testing separately; it is not a finding.
    - **"Failed to reproduce" is a claim that needs its own support.** Two runs differing is
      also what noise looks like at this sample size, and this design has no repeat-rate
      estimate to distinguish the two.

  An earlier draft of this line said a repeat would "withdraw" the first result, and a later
  draft offered a menu of three predetermined readings. Both were wrong: a second experiment
  cannot un-observe a first one, and the interpretation has to come from the data.

- **BOTH EXPERIMENTS ARE REPORTED PROMINENTLY**, with matched task results and costs side by
  side - never AUTODIAG-2 alone, and never a pooled figure that hides which run produced what.
  Matched pairing is by task, so a task repaired in one run and not the other is visible as
  that, not absorbed into a total.
- **Any result at all requires the campaign to complete.** If units are lost again, the
  productivity numbers are reported with their denominators and the operational failure is
  reported beside them, exactly as in AUTODIAG-1. Neither cancels the other.
- Two replicates remain a variance floor, not a significance test.

## Both outcomes of AUTODIAG-1 are carried forward, not just the headline

    PRODUCTIVITY   8 treatment-only repairs across 14 complete pairs; 0 control repairs in 15
                   runs; 3 treatment regressions, all restored, none surviving
    OPERATIONAL    a severe task-budget failure prevented completion; 31 of 60 units never
                   started; integrity false for that reason and no other

## Spend

**AUTHORIZED: $5 total, including startup, execution, idle time and shutdown** (2026-09-25,
for this new run; the earlier $5 covered AUTODIAG-1 and is not reused).

    fixed runtime bound    AUTODIAG_TOTAL_SEC=9000 (2.5h), enforced in the runner, which stops
                           active work rather than only new starts
    no added retries       unchanged
    ESTIMATE (planning)    AUTODIAG-1 completed 28 units in ~48 minutes once its one hung unit
                           is set aside - about 1.7 min/unit. 60 units at that pace is ~1.7h
                           ~ $1.90. At the 2.5h bound, ~$2.75.
    CONDITIONAL figure     the above holds only if the runner's wall clock stops active work,
                           `modal app stop --yes` succeeds, and no request remains in flight.
                           Automatic scaledown releases an IDLE container and is a backstop
                           against a missed stop, not a spending ceiling.

Every figure is an ESTIMATE and stays labelled as one until actual charges are available.
