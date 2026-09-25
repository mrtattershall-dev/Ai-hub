# RECOV-1 — definition, frozen before any generation. NOT LAUNCHED. No spend authorized.

2026-09-25. Modal stays off until spending is authorized for this run.

## The question

**Does the automatic diagnostic help chiefly by supplying a better INITIAL specification, or
does fresh feedback after an edit add repair power of its own?** MECH-1 showed the full opening
report is where the advantage travels (13/30 vs 5/30 counts-only vs 4/30 control) and that
recovery after an unproductive first edit is rare (2 of 13 there, 1 of 13 in the audit).
Those are two different capabilities — problem specification and recovery — and MECH-1 could
not separate them because every diagnostic arm changed both at once.

## Design: same opening report everywhere, vary only what follows an edit

    arms      1  INIT_ONLY     full opening report; after every edit the diagnostic is RE-RUN and
                               RECORDED (delivered:false) but nothing is sent to the model
              2  INIT_COUNTS   full opening report; after an edit only the counts are delivered
              3  INIT_FULL     full opening report; after an edit the full result is delivered
                               (identical to MECH-1's AUTODIAG_ARM)
    held      the opening message (byte-identical across arms for the same seed), seed files,
    constant  guidance, model, sampling seed, worker, acceptance, evaluator, repeat guard,
              300 s per task, no retries; the diagnostic RUNS after every edit in all three
              arms, so the diagnostic PROCEDURE and the first-edit MEASUREMENT are the same
              everywhere. This does not equalize container time or the actual first edit:
              later model behaviour differs by arm and changes execution time and resources
    tasks     the same 15 QuixBugs tasks (reused; no generalization claim)
    seeds     2, sent per replicate (AUTODIAG_SEEDS), e.g. 303 and 404
    order     the 3-arm rotation by (task index + replicate − 1) mod 3, position on every row
    units     15 × 3 × 2 = 90
    isolation INIT_ONLY: at most ONE diagnostic message in any request (measured per row);
              INIT_COUNTS: zero case-detail lines after the first message (measured per row)

Implemented and tested locally before this file was written: `afterEditMode` on the
diagnostic spec ('full' | 'summary' | 'silent'), the three arms in `autodiag1.mjs`, and the
per-row isolation fields — `recovArms.test.mjs` through the real entry point.

**MECH-1's two accepted recoveries** show that recovery after a poor first edit HAPPENED
there; whether fresh feedback CAUSED them is exactly what this run asks.

## Primary outcome and comparisons

**Primary: accepted repair (RETAIN).** Paired by (task, seed):

    INIT_FULL   vs INIT_ONLY    does fresh full feedback add repairs beyond the opening report?
    INIT_COUNTS vs INIT_ONLY    does merely being told "still N fail" add anything?
    INIT_FULL   vs INIT_COUNTS  does the CONTENT of fresh feedback matter?

Reported as discordant-pair counts with both/neither/incomplete, per seed and pooled, an exact
two-sided sign test as a descriptive figure, and the task-level view (both seeds / one / none).

**Also primary-adjacent, reported beside repairs, never summed into them:**
protected-behaviour regressions produced and surviving (per arm), and **recovery after an
unproductive first edit** — units whose first edit did not raise the passing count and whose
LATER state passed more cases than the best of the first two measurements, and separately
whether such a unit ended RETAIN. **This subgroup is pre-declared DESCRIPTIVE:** each arm can
produce different first edits, so the subgroup is not randomized and its denominators differ.

**Cost per retained repair**: task seconds ÷ retained repairs, per arm, with regressions,
unresolved tasks and elapsed beside it. Fewer calls alone are not efficiency — they can mean
giving up earlier.

## Pre-registered readings

- **No advantage of continued feedback detected** if INIT_FULL and INIT_ONLY finish with
  near-even discordant pairs. That is what it means: no advantage detected AT THIS SAMPLE
  SIZE. It does not establish equivalence and does not prove the loop unnecessary. It would
  shift engineering priority toward how the first problem statement is built, while the
  loop's value stays open.
- **The loop adds power** if INIT_FULL-only clearly exceeds INIT_ONLY-only, AND the recovery
  subgroup shows recoveries in INIT_FULL that INIT_ONLY lacks. Both are needed: more repairs
  without recoveries would suggest the after-edit report helps some other way (e.g. stopping a
  regression), which is reported as what it is.
- **Counts alone after an edit** are expected, from MECH-1, to add little; a clear
  INIT_COUNTS-over-INIT_ONLY excess would contradict that and is reported as such.
- **No interpretation is pre-assigned to a null or to a mixed result.** Two seeds give a
  spread, not a rate; 15 tasks are 15 tasks.

**Missing data.** A unit that never ran, or a pair with a unit that has no completed model
call, is listed as incomplete for the affected contrast, never imputed; denominators printed.

## Budget and stopping (to be filled in at authorization; no figures are committed here)

Per unit, MECH-1 averaged ~89 s (all arms); 90 units ≈ 2.2 h plus deploy and shutdown. With
the same watchdog, bound (AUTODIAG_TOTAL_SEC 12600), min_containers=0 and 900 s scaledown,
the maximum exposure is the MECH-1 figure (~$7.3 conservative, ~$5.2 GPU-only) and the planned
spend ~$2.5–3.5, ESTIMATES until invoiced. No early stop on favourable results; no automatic
rerun.

## Procedure

`server/mech1Launch.sh` with `AUTODIAG_EXPERIMENT=RECOV-1`,
`AUTODIAG_ARMS=INIT_ONLY,INIT_COUNTS,INIT_FULL`, `AUTODIAG_SEEDS=303,404`; the seed probe
before the campaign; `mech1Analyze.mjs` and `mechanismAudit.mjs` after.
