# BIND-1 apparatus notes — written during the run, before the real matrix was read

Findings about the INSTRUMENT, preserved as found. None of these were fixed after seeing a
real result; the two code changes below were made on the synthetic self-check subject only.

## 1. Coverage instrumentation inflates witness runtime, and the frozen budget is judged on instrumented time

DISCOVER runs each witness under `NODE_V8_COVERAGE`. Suites that spawn hubs inherit it, so
every child process collects coverage too. Observed on the first files:

    apiErrors.test.mjs        40.2s   (normally a few seconds)
    appendFragment.test.mjs   58.1s
    appendSyntax.test.mjs    187.1s   -> UNOBSERVABLE at the 180s budget
    assertEvidence.test.mjs  180.5s   -> UNOBSERVABLE
    auth.test.mjs             62.3s   -> would be over BIND's 60s case-level budget

Consequence: BIND's frozen "< 60s" granularity rule is applied to instrumented durations,
so witnesses that are cheap uninstrumented may be classed UNOBSERVABLE (budget). The rule
stands as frozen. A later protocol should budget on uninstrumented time, measured separately.

## 2. The in-process tracer zeroes the exit-time coverage dump

`Profiler.takePreciseCoverage` RESETS V8's counters. The tracer calls it on every per-case
line, so by process exit the `NODE_V8_COVERAGE` dump - which file-level witnesses are read
from - shows count 0 for everything the cases already consumed. Seen on the self-check
baseline as `fn=0` beside `cases=5`. Fix (self-check stage, before any real run): the tracer
is attached to case-level witnesses only; file-level witnesses keep their exit dump.

## 3. A mutant that throws kills every later case, and they must not be credited

First self-check pass credited `propagate catch` with 2 discriminations: the case that was
running, AND `untouched`, which never calls the subject and simply never got to print. Rule
3 (witness executed the affected block) cannot hold for a case that never ran. Fix: only the
first missing case is an observation, and only when the process's stack names the served
subject; every later missing case is UNOBSERVABLE ("process died before this case ran").

## 4. Equivalent mutants exist by construction and the instrument must not flatter them

The self-check subject contains `out = out + 0`; dropping it changes nothing observable, so
`drop else` is discriminated by nobody. That is correct: NO_DISCRIMINATION_OBSERVED for this
family, and no claim that the branch carries no obligation. The same will be true of any
equivalent mutant on the real subject, and the report labels them that way, not as dark
regions of the code.

## 5. Every mutation in the family parsed on both subjects

34/34 valid on `segments`, 20/20 on the toy. EXCEPTION had no applicable site in `segments`
(no try/catch) and is recorded as not applicable rather than silently absent.

## 6. DISCOVER attempt 1 was contaminated by a concurrent experiment - and I mis-attributed it first

At 12:56, with 8 of 97 files done, the machine had 142 node processes. My first reading was
"my timeouts leak process trees" - a real bug (child.kill() on Windows does not kill
grandchildren), fixed with taskkill /T - but NOT the cause. The inventory showed ~189 of
those processes were `node --import .../ai-coding-hub-indent/legasus/legascreen/witness-
register.mjs <witness>`: a separate Legasus experiment, from a worktree, witnessing tests at
scale. My own leak was at most one orphaned hub.

So attempt 1's durations measured the machine's load, not the witnesses: apiErrors 40s,
appendFragment 58s, auth 62s, and appendSyntax / assertEvidence / batchActions /
checkpointResilience all at the 180s ceiling. Under the frozen 60s granularity rule those
would have been classified by contention. I STOPPED attempt 1 at 10/97 (my tree only, by
command line, nothing foreign touched) and preserved its log as discover.attempt1.log. The
converse holds too: my run loaded the machine the other experiment was timing, from ~12:15
to 12:57; its owner has been told.

Lesson, same family as every other one today: I blamed the instrument I could see before
inventorying the environment. "Check the checker first" needs a corollary - check what ELSE
is running before reading a duration.

Attempt 2 will run only when the machine is otherwise idle, and the report will say so.

## 7. The foreign load is mostly HUNG witnesses, not a run in progress (13:20, read-only)

    legascreen processes:  216 (168 at 13:00, 189 at 12:56 - growing)
    age min/median/max:    0 / 8 / 76 min
    < 2s CPU ever:         197 of 216
    memory:                1.75 GB
    fork failures:         observed ("Resource temporarily unavailable" spawning node)

Reported to the owning session (local_08aedebc, "Unclear session"), untouched. Relevant to
BIND-1 twice over: it is why attempt 1's durations were meaningless, and it is the same
failure class the whole day has been about - an instrument that produces nothing and does not
say so. A witness process that never exits is indistinguishable, from the runner's side, from
one that is still working; DISCOVER's 180s ceiling is the only thing that would have named it.

## 8. Finding 3 is an independent replication of LegaScreen's TRANSFER-1 defect

Recorded as such at the owner's request. LegaScreen (session 0d) hit the same class one level
up: its observer shared process lifetime with the subject, the hub's test files call
process.exit, and it died on the second file having reported NOTHING - indistinguishable
from a subject with no effects. BIND-1's version: a mutant that throws kills the witness, and
every later case is missing - indistinguishable from discrimination unless the difference is
made explicit. Two sessions, two apparatus sharing no code, same class, found independently.

Their repair transfers, and is adopted before attempt 2: the tracer now writes an ARMED phase
record before the witness runs a line. A trace with ARMED and no cases = died between arming
and the first case; a trace without ARMED = died during load. Neither is an observation of
the region, and the classifier now refuses to credit the first missing case unless the tracer
was armed AND the stack names the subject. Self-check re-run after the change.

## 9. Reconciliation with LegaScreen: independent replication, not a fold - for a reason

BIND-1 MUTATES the subject and asks which witnesses discriminate the change (witness
adequacy). LegaScreen deliberately never mutates the subject; it perturbs pre-authority facts
and rebuilds through production constructors, asking what the subject's authority behaviour
depends on (subject semantics). Different questions. Folding them would conflate the two,
and 0d has measured how a frame that absorbs a neighbouring question gets harder to refute
(coverage 42% -> 83% -> 97% while the discriminating set shrank 15 -> 6 -> 1). So: two
instruments sharing no code, and a fold only if a specific claim ever needs both, argued then.

## 10. Contamination confirmed by a third session's independent measurement

Session 75 (Session A), a few minutes after my inventory: pure-computation tests unaffected;
the only two tests that spawn a subprocess went 2.3s -> 81.1s and 2.2s -> 96.4s (35-44x),
both timing out at a 120s producer budget. Machine at 13:0x: 181 node processes, 108 of
them witness-register, on 8 logical CPUs - ~22x oversubscription. They classified their two
as UNOBSERVABLE, not FAILED, on the same reasoning as attempt 1 here: under contention,
"my code regressed" and "the machine was loaded" cannot be told apart.

Ownership settled: legascreen is session 0d's, not Session A's; I had implied otherwise and
was corrected. Three independent sessions were running experiments on one checkout - 0d
(legascreen / TRANSFER), 75 (external-producer boundary), and this one (BIND-1) - and none
knew the others' load. That is the actual finding: a timing rule is only as good as the
machine's quiet, and nobody was keeping the machine's ledger.

## 11. First real use of the PHASE marker: a witness that died during load was NOT credited

Self-check re-run with the ARMED marker in place, still under the foreign load: 8/8
expectations, but candidates 15 -> 14. The missing one is M010 (BOUNDARY, `10 := 11`).
Every case under it reads UNOBSERVABLE: "process died before the tracer was armed (during
load)" - the witness process produced no ARMED record at all, so it never reached the point
of running a case. Under the old classifier that run would have credited the first case as
DISCRIMINATED_BY_ERROR. Under the new one it credits nothing, which is correct: nothing was
observed.

Cause is almost certainly the machine, not the mutant: M010 is a one-character literal change
that parsed and passed `node --check`, and the box has been refusing to spawn node
("Resource temporarily unavailable") since the foreign witness count passed ~150. So even the
synthetic self-check cannot run cleanly right now, and one row of it is honestly blank. The
self-check must be re-run on a quiet machine before attempt 2, and that re-run's candidate
count is the one to trust.

## 12. Load ceiling wired in, and the machine is still climbing (13:42)

Both runners now sample node process count at start, before every unit, and at end, and
store the samples with the result. Ceiling 40, preregistered. The sampler's first reading:
270 node processes - and `tasklist` itself took 17s to answer, on a call that takes under a
second on a quiet box. The count has risen monotonically all afternoon: 142, 189, 216, 224,
270. Whatever 0d's run is doing, it is not draining.

Verdict logic is a pure function of the samples and the frozen ceiling. A breached attempt
writes its raw records to matrix.json, labelled, and REPORT.md leads with UNOBSERVABLE
(load); BIND refuses to run on a DISCOVER that breached. The self-check is being re-run under
this load precisely so the rule is seen to fire against its author before it is trusted to
fire against anyone else.

## 13. Quiet-machine self-check: 8/8, and the M010 row came back (13:43)

The foreign batch drained between 13:42 and 13:43 (270 node processes -> 9; legascreen
witnesses 0). A self-check run in that window: attempt OBSERVED, worst load 10/40 over 22
samples, 8/8 expectations, candidates 15. M010 - the mutant whose witness process could not
even spawn under load in note 11 - is now DISCRIMINATED_BY_FAIL / NOT_EXECUTED / BASELINE_INVALID
across its five cases, i.e. exactly what its known answer says. So the blank row in note 11
was the machine, as suspected, and the instrument on a quiet box reproduces every known
answer. This is the self-check the prereg requires before attempt 2; it is done.

Background on the quiet machine: the live hub, vite, Session A's fuzzForever + fuzzLoop,
one mock model. ~9-10 node processes. The ceiling of 40 leaves room for a witness's own hub
and fake model on top of that, and no room for another batch.

DISCOVER attempt 2 is NOT started: 0d asked for an explicit go, and a quiet reading is not a
go. Waiting.

## 14. The load rule fired live, against its author, on the first run after it was wired (13:46)

The quiet window closed as fast as it opened: 9 node processes at 13:43, 103 at 13:46
(88 of them `--import` witnesses under 0d's run-backward.mjs again). A self-check launched
into that got as far as mutant M009, sampled 43 > 40, and stopped by rule:

    load verdict: UNOBSERVABLE_LOAD - aborted at "M009-DROP_EFFECT x ...toy_witness.mjs":
    43 node processes > preregistered ceiling 40; the attempt is not a result

REPORT.md leads with NOT A RESULT; matrix.json keeps the eight mutants' raw records,
labelled. That is the rule doing exactly what it was frozen to do, on the first occasion,
and against my own run. Had DISCOVER attempt 2 been started on the 13:43 quiet reading, it
would have run into the same batch three minutes later - which is why a quiet reading was
never treated as a go.

The self-check's expectation script was then wrong in a small way: it ran its known answers
against the aborted, partial matrix and printed five FAILs that read as "apparatus broken".
It now checks the attempt status first and reports NOT APPLICABLE for a discarded attempt.
Same family as everything else: an instrument must say when it cannot answer.

Two hardening rules from Session 75's tasklist/MSYS finding are also in, before any real run:
a failed sample is null and never 0; a zero is treated as instrument failure because the
sampler itself is a node process; and a null aborts exactly as a breach does, with its own
reason - an unmeasured machine is not a quiet one.

## 15. A run of my own that should not have happened (14:05) - preserved, not used

I ran `discover.mjs` on the real subject to PROVE the start screen aborts under load. The
machine went quiet at that moment (start=10 processes), the screen correctly passed, and
DISCOVER ran for real - seven witness files, ~40s - without 0d's go and without the COORD
"timing-sensitive" line I had committed to posting first. I caught it and stopped my own
process tree. The log is preserved as discover.attempt2a-UNAUTHORIZED-stopped.log and its
discover.json is not used for anything.

The error was mine and it is the day's family again: I asserted what an instrument WOULD do
("expect immediate abort") instead of arranging for the outcome I wanted regardless of what
it did. A test of the abort path must not be able to become a real run; the honest way to
test it is against a ceiling set below the current load, not by hoping the load is there.

What the forty seconds DID measure, and it is worth having because it was taken on a quiet
machine (9-14 node processes throughout):

    unloaded calibration baseline   749ms   (min of 754, 749, 800, 802, 790)
    apiErrors.test.mjs               5.7s   (attempt 1 under load: 40.2s   -> ~7x)
    appendSyntax.test.mjs           14.2s   (attempt 1: >180s, UNOBSERVABLE -> >13x)
    assertEvidence.test.mjs         14.5s   (attempt 1: >180s, UNOBSERVABLE -> >12x)
    auth.test.mjs                    0.9s   (attempt 1: 62.3s              -> ~70x)

So the frozen 4500ms cap is ~6x the unloaded baseline, not 3x as the amendment's text
estimated from loaded readings. The cap stays as frozen; this note corrects the estimate.
None of the seven files executed segments() - a fact, but from an unauthorized run, so it
waits for attempt 2 to be said again.

## 16. The calibration rule fired where the count screen did not (14:06)

Self-check with Amendment A1 in force: baseline 840ms (min of 5 at start), then at mutant
M006 a calibration sample read 2542ms - over 3x the baseline (2520ms) - and the run aborted
by rule while the node process count stayed well under 40 the whole time. That is exactly
Session 75's dangerous direction: contention with few processes, invisible to a count,
visible to a measurement.

The contention was partly mine: the unauthorized DISCOVER of note 15 was running on the same
machine at the same moment, so two of my own runs were measuring each other. The rule does
not care whose load it is, which is the point. The abort is correct and the attempt is not a
result; expect.mjs reported NOT APPLICABLE rather than failing.

Both instruments have now each caught a case the other missed: the count caught 43 at
13:46 (calibration would likely have passed - the extra processes were idle), and the
calibration caught 2542ms at 14:06 (count under 40). Neither alone would do.

## 17. Amendment A2 adopted and self-checked (19:05-19:12)

Session 75's three objections to A1 were right and were adopted BEFORE attempt 2, as a
preregistered amendment (BIND-1_PREREG.md A2): (1) a 2e8-iteration calibration before every
witness was synchronised self-load - it is now 1e7 iterations, min-of-5 per sample, ~0.2s;
(2) a start-of-attempt baseline can itself be saturated, and the 4500ms cap came from a loaded
day - the reference is now a FROZEN CONSTANT, 35ms, captured at 18:58:43Z on a machine both
instruments called quiet (count 11 before and after; 0d had just reported its own processes
at 0), limit 3.0x = 105ms applied to every sample including the first; (3) `failed` ->
`unmeasured`. The start baseline and the absolute cap are withdrawn.

Toy self-check under A2: 8/8, attempt OBSERVED, 22 samples, calibration 31.5-41.7ms, count
9-10. The run itself was noticeably faster than under A1 (the A1 self-check spent most of
its wall time in its own calibration - the instrument was a visible share of the run, which
was 75's point).

Falsifier on record: if a quiet machine (both instruments) ever reads >105ms min-of-5, the
reference was not quiet when captured and A2 is wrong, not the machine.

## 18. 0d's fall-through defect checked against this preload (19:12)

0d's leak (261 processes) came from a runner whose child branch ended in process.exit(0):
removing the exit let every child fall through into the parent's code and start a run of its
own, recursively. Checked here: legasus/preload.mjs is `--import`-ed into the WITNESS process
and contains no driver code and no process.exit; the driver (bind.mjs / discover.mjs) is a
separate file that is never imported by a child. Fall-through is unrepresentable in this
layout, which is the same repair 0d landed on. What this preload does NOT yet distinguish is
0d's three emptinesses - (a) died during load, (b) loaded but never let go, (c) ran to the end
and caused nothing. ARMED separates (a) from the rest; the BUDGET timeout plus `exit dump
present` separates (b) from (c) at file level only. Recorded as a known limit, not changed
before attempt 2 - changing the classifier after A2 is frozen would be a third amendment
and it is not needed for BIND-1's four conditions.

## 19. Independent replication of the A2 reference (Session 75, crossed in transit)

75 measured the short workload at 1.2e7 iterations on the same quiet box at 18:55:03Z, count 9,
JIT-warmed, min of 5 = 43.3ms. Scaled to my 1e7 that is 36.1ms; my frozen constant is 35
(min of 20 = 34.97, count 11, 18:58:43Z). Two sessions, two instruments' worth of quiet, three
minutes apart, agree within 3% — the constant is not a one-off. 75's 2e8 figure, 808.5ms, also
says my A1-era "~1.5s" was ~1.85x load-inflated, which is the quantified form of the objection
A2 answered.

75 also reports the short workload is noisier in RELATIVE spread (1.38 vs 1.19 for 2e8). Noted
and not acted on: A2 is frozen, the 3.0x limit leaves 2.2x of headroom above the unloaded max,
and min-of-5 discards the outliers including a cold first run (min is immune to warmup by
construction, which is why calibrate() does not warm separately). If a quiet machine ever
false-aborts, that is the falsifier already on record, and min-of-9 is the named remedy.

## 20. 75's shared sampler built to A2 (ef00025, on fix-tolerant-indent)

Same lim shape, `unmeasured`, calibration inherits the three refusals (null/undefined/NaN never
read as fast), and a "dangerous case" test: 8 processes + 500ms calibration - count silent,
calibration fires. Third independent quiet reading: 31.0ms. Not on this worktree; the adapter
prefers it when present, and since both implementations measure the same thing the swap
should not move the numbers. Estimator mismatch (min-of-20 reference vs min-of-5 samples)
annotated in the prereg, not changed.
Follow-up: 75 removed a 5e6 warm-up burn from its calibrate() (d35af35) — min-of-N makes a
cold run the max, never the min, so the warm-up was self-load inside the self-load fix. 75's
estimator note stands as a note; both of us agree not to act on it.

## 21. Adapter composition defect (75, 49d64da): two correct instruments paid twice

My adapter spread 75's sample() - which calibrates by default - and then layered my own
calibration on top: one burn discarded per sample, 342ms vs 175ms measured. Neither module is
wrong alone; the defect lives only in their composition. Adapter now calls
shared.sample({ where, calib: false }) - count from the shared module, calibration from here,
exactly one burn - and records the source as such. Latent, not live: the shared module is not
on this worktree, so attempt 2 runs on the stand-in for both instruments regardless.

## 22. Bound stated BEFORE the real matrix (0d's point, 19:31)

The discriminator has only been exercised on the synthetic subject (toy.js, 20 mutants, 5
cases, every answer known). Its sensitivity on the real subject is therefore UNBOUNDED going
in: the toy proves the machinery classifies correctly when the answer is known; it says nothing
about what fraction of segments()'s 34 mutants the 93 policy_test cases can reach. Whatever
that fraction turns out to be is a measurement of the witnesses (P3 predicts at least one
executed-undiscriminated mutant), not a verdict on the apparatus - unless a mutant is
discriminated by NOTHING while a case demonstrably executes its site and asserts on its
output, in which case the apparatus is suspect first. Written before discover.json exists.

## 23. DISCOVER attempt 2 — OBSERVED, with one apparatus anomaly recorded before BIND runs

97 files, 99 load samples, count worst 10 (one reading of 7), calibration worst 52.2ms
against the 105ms limit. Tally: EXECUTED 1 (server/policy_test.mjs, 93 case lines, 142ms),
NOT_EXECUTED 90 (incl. selftest.mjs with 40 case lines that never reach segments),
WITNESS_ERROR 3 (realChain/realGame/realModel, exit 2 - need a live model), UNOBSERVABLE 3
(batchActions.test.mjs at budget; resumeAfterRestart exit 0xC0000409 stack-buffer-overrun
in 1s; runLifecycle.test.mjs).

ANOMALY: runLifecycle.test.mjs is recorded at 3,226,565ms - 53 minutes against a 180s budget.
The budget fired (timedOut=true) but the `close` event, which waits for stdio to drain, did
not arrive for ~50 more minutes: something holding the child's stdout/stderr pipes survived
`taskkill /T /F` (a process started after the tree walk, or one taskkill could not reach).
Consequences: (a) the per-file budget bounds the SUBJECT's run, not the wall clock - the
attempt took ~70 min, not ~15; (b) the load samples say the machine stayed quiet throughout,
so the attempt is still OBSERVED by rule; (c) the file's status, UNOBSERVABLE, is right either
way. Fix belongs in killTree/`close` handling (resolve on `exit` + a drain timeout), AFTER
BIND-1 - not changed mid-attempt. Written before bind.mjs was started.

## 24. BIND-1 on segments(): P1,P2,P3,P5 confirmed; P4 confirmed only degenerately

Result record: legasus/out/segments/BIND-1_RESULT.md. The one prediction that misfired was
mine, not the subject's: P4 assumed comparison-swap/invert pairs "on the same condition"
existed in quantity; one pair exists and its boundary site is never executed. A prediction
that cannot be cleanly scored is a prereg defect, recorded as such. Open item for BIND-2:
M022/M023 at 7238 are executed by output-asserting cases and discriminated by none - the
apparatus-vs-equivalent-mutant question is decidable by hand and was not decided here.

## 25. Why the 53-minute `close` happened, and the fix design (from 0d's reciprocal, not applied)

0d's runner is immune to note 23's bug by accident: it spawns with stdio 'ignore', so there are
no pipes for a survivor to hold. discover.mjs needs the witness's stdout (PASS/FAIL lines,
the "passed" regex), so it pipes - and `close` waits for every holder of that pipe, including
whatever taskkill /T did not reach. Fix design, recorded now and NOT applied tonight (the
attempt is frozen and there is no second run scheduled): direct the child's stdout/stderr to
a FILE descriptor instead of a pipe, resolve on `exit` rather than `close`, read the file
afterwards. Then the budget bounds wall time, and a survivor holds a file, not our event loop.
0d's own gap is the reciprocal: its sweep kills children, not grandchildren, and its
signature-filtered verification could not see a hub-spawned server - recorded by 0d as
structural and unexercised. Also from 0d's full enumeration: four node processes on this box
predate today by days (mockModel.mjs Sep 10, index.js Sep 11, fuzzForever.mjs + child Sep
12). Not mine, not 0d's; for tatte.

## 26. Evidence about this apparatus from 0d, recorded as evidence (20:58)

(1) M002's 1 error + 92 UNOBSERVABLE is an independent replication of 0d's TRANSFER-1
missing-case repair on an apparatus 0d did not write and a real subject - the first such
confirmation for either of us. (2) The short-circuit separation (test @6997 executed by 12,
its right operand by 0) is a distinction 0d's stack-frame ancestry structurally cannot make;
0d has recorded function-level granularity as a bound on its own participant claims from this
matrix. (3) 0d's own 1-of-4 miss turned out SYNTACTIC (arrow-wrapped re-exports dropped by an
Identifier filter before any threshold ran), having looked semantic from the result. That is
the shape of the 7238 question here: equivalent mutant and apparatus blind spot are
indistinguishable from the result and distinguishable from the mechanism. Still not deciding
it tonight - the hand run that decides it is BIND-2's first step and needs its own prereg so
the answer is not fitted to the four specimens that raised it, which is also why 0d is not
widening its filter. `benchmarks/taskkill-survival.mjs` in the -indent worktree is most likely
Session 75's, from the offer in note 25; not mine.

## 27. The 53-minute close: 75's measurement narrows it, and the record narrows it further

75 measured (benchmarks/orphan-probe.mjs, taskkill-survival.mjs): with the parent exiting
normally, DETACHMENT decides whether a leaf survives; piped vs inherited stdio makes no
difference. Scope limit stated by 75: parent exiting, not parent force-killed.

Facts from this side: runLifecycle.test.mjs starts hubs through testHarness.startHub, which
spawns `node server/index.js` with stdio ['ignore','pipe','pipe'] and NO detached flag; the
test itself uses execFileSync and an in-process http server; no `detached: true` exists
anywhere under server/. The DISCOVER record shows exitCode 1, signal null, timedOut true,
96 coverage files (many hub spawns), and a tail of normal `ok` lines - the test was still
running healthily at 180s; nothing hung. So the surviving holder was not a detached
descendant of ours. Remaining candidates, none decided: (a) the force-killed half 75 has not
measured - taskkill /F on a root whose grandchild hub holds the inherited pipe ends; (b) a
process from another lineage holding the same handle; (c) the test's own hub, which
testHarness kills on teardown, but teardown never ran because the root died first. (c) is
consistent with everything above and is the cheapest to test: kill a root mid-test and see
whether its hub child outlives it. Not run tonight.

## 28. Question (c) answered by 75: taskkill /T /F reaches the piped grandchild; the holder was outside the tree

75's forcekill-probe (taskkill's own SUCCESS lines naming the grandchild as a child of the
mid; precondition all three alive) closes the kill half: no better kill of this tree would
have helped. The fix is identification, not force. Two candidates remain, both places to
look rather than answers: (i) 75's - a process from an earlier lineage holding the same
handle; noted with the physical constraint that a pipe end is only ever acquired by
inheritance at spawn, so any holder outside the tree was spawned BY something in the tree
with the handle inherited; (ii) a race - taskkill /T enumerates the tree once, the hub under
test spawns commands continuously (runs, git, python), and a child created between the
enumeration and the kill survives holding the inherited pipe ends until its own command
ends. Both resolve the same way: snapshot node pids at file start and at the 180s timeout,
diff against the recorded descendant set, and name the pid that disappears when `close`
finally fires. 75 offered a `pids()` export in its sampler; accepted, to be wired together
with the file-descriptor fix (note 25) after tatte's commit call, not before.
Follow-up to 28: 75 built pids()/newSince() (9202c1e; null on failure, never [] - an empty
diff is the passing value one level up). 75's "earlier lineage" candidate is dead: discover.mjs
spawns each test file directly with fresh pipes, so the killed root IS the test process and
nothing older can hold its ends. The race candidate stands, decidable by the pid diff on the
next occurrence; 75's cadence probe deferred until the diff names a pid.

## 29. BIND-2 on segments(): discrimination + observed outputs (2026-09-21 00:25)

One run, OBSERVED, C1-C5 held. 87 recorded calls / 57 distinct inputs / 36 served files. H1
CONFIRMED - four of seven identical-discriminator clusters split under the output instrument
(bit vectors manufactured sameness); three survived (S6 {M006,M018}, S7 {M007,M019,M020},
S11 {M016,M017}) with two independent lines of evidence each. H2 FALSIFIED - all four dark
mutants are output-identical to the subject on every recorded input (blind for M022/M023):
dark because of INPUTS, not assertions; BIND-1's open 7238 question settled that far and no
further. H3 CONFIRMED (0 incidental). H4 FALSIFIED AS WORDED by my own conflation of
execution status with discrimination - second prereg-wording defect in two experiments, same
species as P4; post-hoc discrimination-only view: 0 conflicts. H5 FALSIFIED (trim hides
nothing). H6 CONFIRMED (BIND-1's site counter corroborated independently). 568 licensed edges
with full provenance; 1385 typed refusals. Result record: legasus/out/bind2-segments/BIND-2_RESULT.md.
Lesson for the next prereg: score each prediction against a dry-run artefact BEFORE freezing,
so a wording that cannot be scored cleanly is caught by the apparatus, not by the result.
