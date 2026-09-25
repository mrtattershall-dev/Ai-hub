# MECH-1 RESULT — the cases carry the effect; the notification alone does not

Ran 2026-09-25 13:54:04Z → 16:07:00Z (**2h 12m 55s of the 3.5 h bound**), unattended, no
interventions, no retries, no rerun. Definition frozen at fb9ae19; hub commit 717ed8b.

    planned 90   completed 90   UNATTEMPTED 0   UNACCOUNTED 0
    integrity TRUE   reconciliation TRUE   isolation HELD in 90/90 (measured per row)
    label/bytes disagreements 0 of 90   hard-wall hits 0   execution confirmed stopped 90/90

**Spend: ESTIMATE $2.49 GPU-only** (app live 13:51:48Z → 16:07:22Z = 8,134 s × $0.000306/s),
**up to ~$3.50** at the conservative rate that adds CPU and memory. Against the assignment's
$10 cap; planned target was ≤ $8. Estimates until invoiced.

**GPU shutdown: OBSERVED stopped 22 s after COMPLETE** — by the external watchdog, on the
campaign's DONE file, with Modal's own `stopped_at`. Timeline in §6.

**LABEL: repair with SUPPLIED TEST RESULTS.** Tasks reused; no generalization claim.

## 1. Primary outcome — accepted repairs (disposition RETAIN)

    arm                          seed 101    seed 202    pooled
    A  CONTROL                    2 / 15      2 / 15      4 / 30
    B  NOTIFY (counts only)       3 / 15      2 / 15      5 / 30
    C  AUTODIAG_ARM (full)        5 / 15      8 / 15     13 / 30

## 2. The three pre-registered contrasts, paired by (task, seed)

    contrast        X-only   Y-only   both   neither   sign test (descriptive)
    C vs B            10        2       3       15      p = 0.039
    C vs A            13        4       0       13      p = 0.049
    B vs A             4        3       1       22      p = 1.000

    per seed        101: C-only/B-only 3/1     202: 7/1
                    101: C-only/A-only 5/2     202: 8/2
                    101: B-only/A-only 3/2     202: 1/1

**Task level** (15 tasks are 15 tasks, not 30):

    C over A   wins under BOTH seeds: gcd, get_factors, longest_common_subsequence,
               next_palindrome (4); one seed: is_valid_parenthesization, kth, lcs_length,
               pascal (4); A over C one seed: 3; mixed 1; neither 3
    C over B   both seeds: gcd, get_factors (2); one seed: 6; B over C both seeds:
               longest_common_subsequence (1); neither 6
    B over A   both seeds: longest_common_subsequence (1); one seed: bucketsort,
               next_palindrome (2); A over B one seed: 3; neither 9

## 3. Reading, against the pre-registration

**H1 (semantic content) — SUPPORTED.** The predicted signature was C > B ≈ A. Observed:
C-only 10 vs B-only 2 in the C-vs-B pairs, and B-vs-A near-even (4 vs 3). Every one of
those figures is descriptive; the sign tests are reported as pre-registered, not as a
threshold that was crossed.

**H2 (notification alone) — its proposed mechanism did NOT appear.** H2 predicted that being
told "N cases fail" at the same moments would move the first action to `edit_file` and lift
repairs to C's level. The first action in B stayed where A's is:

    first tool called     A CONTROL    B NOTIFY    C AUTODIAG_ARM
    edit_file                 4            8            25
    run_python               18           10             1
    other                     8           12             4

and B's repairs (5/30) sit beside A's (4/30), not C's (13/30). So the counts-only message
changed little about what the model did first, and nothing measurable about what it
repaired. **The effect travels with the full message, not with the fact of being told that
tests were run.** CORRECTED (after review): "semantic content" is a BUNDLE. The full
diagnostic supplies concrete examples, expected outputs, some localization and a more
actionable task description at once; the counts-only arm removes all of those at once. Its
near-control result weakens a notification-only explanation. It does not isolate which of
the richer components carries the advantage.

**Not claimed.** That B has no effect at all (4 vs 3 discordant pairs is as consistent with
a small effect as with none); a repair RATE for any arm; anything about tasks outside these
fifteen.

## 4. Secondary measures

    per arm                        A CONTROL    B NOTIFY    C AUTODIAG_ARM
    runs that edited the target      11            15            25
    first-edit effect (B, C)          -      up 6 / down 4 /   up 11 / down 8 /
                                              flat 4 / n-a 16   flat 5 / n-a 6
    recovery after a bad first edit   -             0             2 (BOTH accepted)
    seconds per retained repair     611           418           216
    regressions produced / surviving  1 / 0        4 / 0          7 / 0
    Hub end-of-run parse rollback     1             2             6
    model calls                     144           196           168
    task seconds                   2442          2091          2804
    median unit seconds              34            37            52
    termination: repeat guard      19            22            24
                 finish             7             5             2
                 call deadline      4             2 (+1 zero-call)  2 (+1 zero-call)
    diagnostic messages sent          0            86            86
    case-detail lines sent            0             0           174
    repairs by order position     2 / 1 / 1     3 / 1 / 1      5 / 4 / 4   (first/second/third)

**The first-edit pattern from the audit held in C** (up 11 → all RETAIN; down/flat 13 → 2
recoveries, and CORRECTED: both of those ended RETAIN — is_valid_parenthesization 2→1→3 and
next_palindrome 4→4→5 under seed 202. An earlier draft said "neither accepted"; that was
carried over from the audit's single unaccepted recovery and was wrong here) **and appeared in B in miniature** (up 6, all RETAIN — but B
edited in only 15 units and half of those went nowhere).

**NOTIFY churns.** Two B units ran 28 and 20 edits, each edit re-triggering a counts-only
diagnostic (26 and 19 messages), and ended RESTORED / PRESERVE_INCOMPLETE. Told only that
"N fail", the model kept editing; told which cases, C edited fewer times per unit.

**Infrastructure failures, per arm** (a call that never returned, or a backend error):
deadline aborts A 4, B 3, C 4; call errors A 2, B 3, C 3; units with NO completed model call
at all: B 1 (kheapsort, seed 202), C 1 (kth, seed 101). Both are recorded as non-repairs
in the primary table; a sensitivity view that drops the two zero-call units changes C vs A
to 13-vs-4 over 29 pairs and C vs B to 10-vs-2 over 28 — the same reading.

**Nine case-measurement errors** ("candidate does not import": B 3, C 6) are unparseable
candidates that the Hub's own rollback layer handled; the primary outcome is unaffected
because acceptance judged the candidate directly.

**Three units were taken apart at the per-task bound while their run status was still
`running`** (find_in_sorted B/101 → RESTORED; flatten C/202 → RETAIN; lcs_length C/202 →
RESTORED). Acceptance evaluated the captured candidate regardless of run status, which is
correct, and the rows say ENDED; the row does NOT carry the outcome's `terminationReason`
("per-task limit"). Instrumentation gap, recorded, not fixed here.

## 5. Seeds

    seed probe (before the campaign)   seeded pair byte-identical: TRUE; unseeded differs: TRUE
    BUILD PLAN identical across the three arms within a seed (planner input is identical):
                                       16 of 22 triplets with all three plans present;
                                       6 differed; 8 triplets missing a plan in some arm
    BUILD PLAN identical across seeds (same task, CONTROL):   0 of 13

So the seed reproduces the sampler most of the time on this backend but not always (vLLM's
per-request seed is not a bit-exact guarantee across timing and batch composition). The
arms are matched at the plan stage in most triplets, and the two seeds are genuinely
different draws. **Within-arm spread with seeds sent: C 5 vs 8, B 3 vs 2, A 2 vs 2.** Two
seeds still do not yield a rate; the AUTODIAG-2 swing (8 vs 2) is not "explained away" by
seeding — it is simply what two draws look like here as well.

**CONTROL repaired 4 of 30 in this run after 0 of 45 across BENCH-3/AUTODIAG-1/AUTODIAG-2.**
Same seed files, same guidance, same model; new: a sampling seed sent, and `min_containers=0`.
No explanation is assigned. It is recorded because the earlier "0 control repairs" line must
not be quoted as a constant.

## 6. Operational record

    13:51:48Z  deployed (min_containers=0, scaledown 900 s); watchdog detached, deadline 13800 s
    13:53:35Z  model answered /api/tags (cold start ~2 min); 13:53:46Z seed probe passed
    13:54:04Z  campaign START, hub 717ed8b, seeds 101/202, order rotation recorded per row
    16:07:00.831Z  report written     16:07:00.840Z  COMPLETE printed and DONE file written
    16:07:11.6Z    watchdog trigger = sentinel
    16:07:17.5Z    `modal app stop --yes` issued (exit 0)
    16:07:22Z      Modal `stopped_at` (11:07:22-05:00)
    16:07:38.7Z    watchdog OBSERVED state=stopped, tasks 0 → CONFIRMED_STOPPED, exit 0
    16:12:00.773Z  the campaign PROCESS exited - exactly 5m00s after COMPLETE; see below

**Shutdown no longer depends on the client process exiting.** After AUTODIAG-2 the scripted
stop ran ~5 minutes late for exactly that reason; here the app was stopped 22 s after
COMPLETE while the campaign process lingered for another five minutes.

**Root cause of the lingering process, found from this run and fixed afterwards:** every
unit's wall-clock race left its timer pending (`setTimeout` of per-task + grace seconds, never
cleared), so the process stayed alive until the last timer fired — up to ~345 s after the
last unit. That is the "shutdown latency" of AUTODIAG-2 and the exit delay here. Fixed by
clearing the timer after the race; `threeArm.test.mjs` now asserts the process exits within
15 s of COMPLETE (observed 0.003 s), 38/38. The fix is committed AFTER the campaign and did
not run in it.

**Every bound held.** 0 hard-wall hits, 0 overruns, longest unit 301 s against a 300 s
bound (+45 s grace), execution confirmed stopped 90/90, the campaign used 63% of its wall
clock, and the $10 cap was never approached (maximum exposure had been computed at ~$7.3;
actual estimate ≤ $3.5).

Records: `MECH-1_REPORT.json`, `MECH-1_summary.jsonl`, `MECH-1_arms.json`,
`MECH-1_ANALYSIS.json` (mech1Analyze.mjs), `MECH-1_MECHANISM-AUDIT.json`
(mechanismAudit.mjs), `MECH-1_console.log`, `MECH-1_stage1.log`, `MECH-1_seedprobe.json`,
`MECH-1_watchdog.log`, `MECH-1_gate.log`. Campaign root on disk: `autodiag1-QV4C55`.

## 7. What this run settles, and what it does not

SETTLED, for this model / these tasks / supplied test results: the full diagnostic beats
the counts-only notification (10 vs 2 discordant pairs; both-seed wins on gcd and
get_factors) and beats control (13 vs 4). The counts-only notification does not move the
first action and sits beside control on repairs. What survives is that the full message,
in front of the model before its first action, is where the advantage is; which component
of that message (examples, expected outputs, localization, task framing) is not isolated.
First-action shift and first-edit improvement are associated with repair, not shown to
cause it. And note the shape of the evidence: this looks more like a better initial
PROBLEM SPECIFICATION than a working recovery loop — recovery after an unproductive first
edit was 2 of 13 here (both accepted) and 1 of 13 in the audit (not accepted). The two
accepted recoveries show recovery HAPPENED; whether fresh feedback caused them is not
established (RECOV-1's question). Task seconds per retained repair: control 611 s,
counts-only 418 s, full 216 s - about 2.8x less task time per repair for the full arm, an
AGGREGATE efficiency measure over this campaign, not end-to-end billed cost and not a
guaranteed future speedup.

SETTLED, operational: a 90-unit three-arm campaign completes bounded and fully accounted,
and the GPU stop is observed within half a minute of completion without depending on the
client process.

NOT SETTLED: any rate; why C's two seeds differ 5 vs 8; why control repaired 4 here and 0
before; whether any of this holds on held-out tasks (none were available offline).

NOT CLAIMED: that "the model localizes the bug from the cases" in any richer sense than
"its first edit is right more often when it has them" — the transcripts show what it was
sent and what it did next, not why.
