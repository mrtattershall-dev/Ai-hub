# BIND-1 — predictions and falsifiers (written 2026-09-20 13:35, before DISCOVER attempt 2, before any real matrix)

Additive to BIND-1.md, which is frozen and unchanged. LegaScreen's protocol rule - every
prediction names its falsifier, and must-fire controls are demonstrated before the detector
is trusted - is adopted here. Nothing in this file may be edited after the matrix is read;
wrong predictions are recorded as wrong.

## Must-fire control (demonstrated)

The synthetic subject `legasus/selfcheck/toy.js` with known answers. The apparatus reproduced
8/8 expectations (`selfcheck/expect.mjs`), including: a case that never calls the subject is
NOT_EXECUTED under every mutant; a baseline-failing case counts for nothing; RETURN_EMPTY is
discriminated by exactly the three cases that call the subject; swallowing a catch is seen
only by the case that reaches it; a mutant that throws credits only the case that was running.
Two classifier defects were found by this control and fixed BEFORE any real run.

## Predictions about segments() — each with what would falsify it

P1. RETURN_EMPTY will be discriminated by at least one witness.
    FALSIFIER: no witness changes outcome when segments() returns []. That would mean every
    witness that executes segments is blind to it returning nothing, which is the "430 tests
    stay green against return null" failure this whole line of work exists to detect.

P2. The 8 direct `segments(...)` cases in policy_test.mjs will, between them, discriminate more
    distinct mutants than any single indirect (classifyCommand) case does.
    FALSIFIER: some single indirect case discriminates at least as many distinct mutants as the
    union of the 8 direct cases. That would say the indirect path is the stronger witness of
    segments' behaviour, and the direct tests added this month are redundant with it.

P3. At least one valid mutant will be EXECUTED by some witness and DISCRIMINATED by none.
    FALSIFIER: every valid, executed mutant is discriminated by at least one witness. That
    would be the first region on this project where a generic family found no dark spot -
    and it would still not make the region characterized.

P4. BOUNDARY mutants on comparison operators will be discriminated less often than
    INVERT_COND mutants on the same conditions.
    FALSIFIER: boundary swaps are discriminated at least as often. Reasoning being tested:
    the witness cases were written from incidents (a missing `&`, a `;` inside quotes), not
    from boundary analysis, so off-by-one edges are the likeliest gap.

P5. No file-level witness outside policy_test.mjs will discriminate anything at case
    granularity, because none prints per-case lines; any that discriminates does so at file
    level only.
    FALSIFIER: a non-policy_test witness yields case-level records. (Apparatus prediction:
    tests the granularity rule, not the subject.)

## What is NOT predicted

How many mutants exist per family (already known: 34, EXCEPTION not applicable), which
specific witnesses discriminate which specific mutants, or any obligation's meaning. Those
are outputs, not predictions.

## Load ceiling — frozen 2026-09-20 13:55, before attempt 2 (added on Session 75's argument)

Contamination without a baseline is invisible and presents as a true positive: a witness
that takes 81s under load reads as a slow witness, and the 60s rule then classifies it by
the machine's state while looking like a rule about the witness. Attempt 1 was exactly this.
So the load is sampled DURING the run and stored WITH the result, and the ceiling is fixed
now, not after a number is seen:

    SAMPLE   node.exe process count: at run start, before every witness file, at run end
    CEILING  40 node processes
    RULE     any sample > 40  =>  the whole attempt is UNOBSERVABLE (load). Not a result.
             Its log is preserved, labelled, and never cited as evidence about segments().

Why 40: a quiet machine here carries ~10-20 (the live hub, vite, a few idle session helpers);
each catalogued witness spawns at most a hub and a fake model. Attempt 1 ran at 140-220.
The number is chosen to fire against contention, and it fires against me as readily as
against anyone: if attempt 2 crosses it, attempt 2 is discarded by rule, not by judgement.

A COORD "timing-sensitive run" line is ALSO posted before attempt 2 starts. That line reduces
collisions; it does not make the result trustworthy. Only the samples do.

## Amendment A1 — contention is measured, not counted (frozen 2026-09-20 13:58, before attempt 2)

Session 75 measured the same test at 81.1s with 108 node processes and 13.0s with 110. A
process count screens; it does not measure contention - idle processes cost nothing and eight
CPU-bound ones saturate eight cores under a ceiling of 40. So, additive to the count rule:

    SCREEN   node process count, ceiling 40, unchanged - it fails safe (wasted runs, never bad data)
    MEASURE  a fixed single-threaded calibration workload timed alongside EVERY sample:
             2e8 iterations of x = (x + i*7) % 1000003  (deterministic; ~1.5s on this box under
             today's load, unloaded time unknown and NOT assumed)
    BASELINE the MINIMUM of 5 back-to-back calibration runs taken at attempt start, after the
             count screen has passed
    RULE     any later calibration sample > 3.0 x baseline      => abort, UNOBSERVABLE (load)
             any calibration sample, including at start, > 4500ms => abort, UNOBSERVABLE (load)

The absolute cap exists because the baseline is taken on whatever machine exists at start: if
the start is already CPU-saturated under a low count, the ratio rule is blind and only the
cap can fire. 4500ms is 3x the slowest reading taken today; it catches gross saturation only,
and that limitation is stated here rather than discovered later.

Instruments rejected, with the reason: Windows `typeperf` reads the right counter but took
2.1-7.7s per sample under load, so the sampler would be a meaningful share of the thing it
samples. Session 75's shared sampler (benchmarks/load-sampler.mjs) is not on this worktree yet;
the stand-in in legasus/loadSample.mjs answers, and every sample records which one did.

## Amendment A2 — the calibration must not be the load, and the reference must not be loaded (frozen 2026-09-20 19:05, before attempt 2)

Proposed by Session 75 after reading A1; adopted with one measured constant. Three changes:

1. WORKLOAD. 2e8 iterations (~0.8s) run before every witness, in every runner, is itself
   synchronised load on the machine it measures - and a 3x ratio does not need 0.8s to
   resolve. The workload becomes 1e7 iterations of the same loop, and ONE SAMPLE is the
   MINIMUM of 5 back-to-back runs (~0.2s per sample in total). Min-of-5 is the sample
   because the quantity of interest is "how fast can this core go right now", and every
   interruption only ever makes a run slower.

2. REFERENCE. A1 compared later samples to a baseline captured at attempt start, and the
   4500ms cap came from a loaded day. A baseline captured on a saturated start makes the
   saturation the thing everything is compared to. So the reference is a CONSTANT, captured
   once on a machine verified quiet by BOTH instruments and frozen here with its provenance:

       CALIB_REFERENCE_MS = 35   (min of 20 runs of 1e7 iterations: 34.97ms; median 43.2ms;
                                  max 53.5ms; node count 11 before and after; 2026-09-20
                                  18:58:43Z; Session 0d had just reported its own processes
                                  at 0 and node.exe at ~10; this laptop, mains power)

   RULE  every calibration sample, INCLUDING the first at attempt start, must be
         <= 3.0 x CALIB_REFERENCE_MS = 105ms, or the attempt aborts UNOBSERVABLE (load).
   The per-attempt start baseline and the 4500ms absolute cap are withdrawn: one constant,
   one ratio. The reference is machine-specific by construction; a run on any other machine
   is RELATIVE-ONLY and must say so, and the constant is re-captured under the same
   procedure, never adjusted after a result is seen.

   Falsifier for the constant itself: if, on a machine both instruments call quiet, min-of-5
   exceeds 105ms, the reference was not quiet when captured and A2 is wrong, not the machine.

3. VOCABULARY. A sample that could not measure is reported as `unmeasured`, not `failed`:
   an unmeasured sample makes the attempt UNOBSERVABLE, and "failed" invites reading it as a
   result. Same semantics; the verdict already treats null as never-ok.

The count screen (ceiling 40) is unchanged. Everything else in A1 stands. Attempt 2 has not
run; the self-check will be re-run under A2 before it does.

Note to A2 (2026-09-20 19:22, annotation, not a change): the reference is min-of-20 and each
sample is min-of-5. Min-of-20 sits systematically at or below min-of-5, so the ratio carries a
small offset that makes a quiet machine read slightly slow - conservative, and noise against
3.0x (self-check samples 31.5-41.7ms straddle the 35 reference). Written down so the reader
knows the estimators differ. Two independent re-measurements on the same box, minutes apart:
Session 75's module 1e7 min-of-5 = 31.0ms; 75's 1.2e7 min-of-5 = 43.3ms (36.1 scaled).
