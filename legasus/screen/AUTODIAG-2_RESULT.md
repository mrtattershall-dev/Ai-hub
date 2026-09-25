# AUTODIAG-2 RESULT — the campaign completed, the direction held, the magnitude did not

Ran 2026-09-25 10:48:38Z → 12:22:03Z. **93m 25s of the 150m bound — the queue finished early.**
Unattended; interventions none.

    planned 60   completed 60   UNATTEMPTED 0   UNACCOUNTED 0
    integrity TRUE   reconciliation TRUE

**Spend: ESTIMATE ~$1.95** (1.75h A10G incl. warm-up at ~$1.10/hr). **Authorized $5.** Estimate,
labelled as one; actual charges to follow.

**GPU shutdown: see the operational section — the scripted stop did not fire, and I stopped the
app manually.** Confirmed `stopped` at 12:23:27Z.

**LABEL: repair with SUPPLIED TEST RESULTS.** The diagnostic runs the graded cases.

## Both experiments, side by side

                              AUTODIAG-1              AUTODIAG-2
    units completed            29 of 60                60 of 60
    CONTROL repairs             0 / 15                  0 / 30
    AUTODIAG repairs            8 / 14                 10 / 30
    complete pairs             14                      30
      only AUTODIAG             8                      10
      only CONTROL              0                       0
      both                      0                       0
      neither                   6                      20
    AUTODIAG regressions        3 (all restored)        9 (all restored)
    CONTROL regressions         0                       3 (all restored)
    runs that edited target    12/14 vs 3/15           25/30 vs 13/30
    diagnostics delivered      28                      69
    operational                99-min overrun;         none; all 60 units ran
                               31 units never ran

## The line that matters most: per replicate

    AUTODIAG-2   replicate 1   8 repairs / 15      replicate 2   2 repairs / 15
    AUTODIAG-1   replicate 1   8 repairs / 14      replicate 2   never ran

Replicate 1 of AUTODIAG-2 reproduced AUTODIAG-1 exactly: **8 of 15**. Replicate 2, same tasks,
same seeds, same configuration, same run: **2 of 15**.

**That 8-then-2 swing is within a single campaign**, so it is not a difference between
experiments, between hub versions, or between anything I changed. It is how much this
treatment's output varies when nothing varies. Any statement about "how often AUTODIAG
repairs a task" has to live with that spread.

## What the paired data supports

**Direction: consistent.** Across 44 complete pairs in the two experiments, **18 were repaired
only in the treatment arm and 0 only in control.** No control run in either experiment produced
an accepted repair — 0 for 45. The treatment also acted far more often (25/30 vs 13/30 edits
here), and produced more regressions when it did (9 vs 3), every one of which acceptance caught
and restored.

**Magnitude: unresolved.** Per-replicate repair counts of 8, 8 and 2 out of ~15 do not support a
rate. I am not going to convert them into one, and the 10/30 headline should not be read as
"about a third of tasks" — it is an average over two replicates that disagree by a factor of
four.

**Per-task, across both experiments** (`R` repair, `x` regression-restored, `o` neither):

    task                        A1: C1 A1        A2: C1 A1 C2 A2
    bucketsort                      o  R             o  R  o  x
    find_in_sorted                  o  x             o  x  o  x
    flatten                         o  R             o  R  o  o
    gcd                             o  R             o  R  o  R
    get_factors                     o  R             o  R  o  o
    is_valid_parenthesization       o  x             o  o  o  x
    kheapsort                       o  R             o  o  o  o
    kth                             o  R             o  R  o  o
    lcs_length                      o  o             o  R  x  o
    lis                             o  o             o  R  x  o
    longest_common_subsequence      o  R             o  o  o  x
    max_sublist_sum                 o  x             o  x  x  x
    mergesort                       o  o             o  R  o  R
    next_palindrome                 o  R             o  x  o  o
    pascal                          o  .             o  x  o  o

Only `gcd` and `mergesort` were repaired in both replicates of AUTODIAG-2. Several tasks
repaired in one replicate and not the other. **No interpretation is assigned to that pattern
here**: with 15 tasks and 2 replicates, patterns of this size appear by chance, and this design
has no repeat-rate estimate to tell a real task effect from noise. It is a hypothesis worth its
own test, not a finding.

**Cost.** The treatment used LESS wall clock than the control in total (1,970s vs 3,164s task
seconds) and fewer model calls (159 vs 233) — control runs tended to loop until the repeat
guard stopped them. The diagnostics' own container time is inside those treatment seconds.

## Operational reliability

**The bounding fixes held.** Across 60 units: `hitHardWall` 0, overruns 0, longest unit 299s
against a 300s bound, `executionConfirmedStopped` **60/60**. The campaign finished its whole
queue in 93 minutes with `integrity: true` and `UNACCOUNTED: 0` — the accounting failure from
AUTODIAG-1 did not recur, and every planned unit has a row.

**But one operational failure did occur, and it is mine.** The scripted `modal app stop --yes`
in the launch job never executed: the log ends at `AUTODIAG-1 COMPLETE` with no `STOP ISSUED`
line and no app-state line. The app was still `deployed` with a live container when I checked,
about 45 seconds after the campaign finished. I stopped it manually and confirmed `stopped`.

The cause is in how I launched it, not in the runner: the shell chain that runs the campaign
and then the stop did not reach its second command. **The scripted-shutdown guarantee I have
been reporting after every run did not hold this time**, and it was caught by looking rather
than by any mechanism. The exposure was small (~45s of idle GPU, inside the estimate) but the
property was not what I said it was.

## What this settles, and what it does not

SETTLED: the operational repairs work — a campaign that previously lost half its queue ran all
60 units, bounded, confirmed stopped, fully accounted.

SETTLED: the direction is consistent across two experiments and 44 complete pairs — 18
treatment-only repairs, 0 control-only, 0 control repairs in 45 runs.

NOT SETTLED: how large the effect is, or how often it recurs. 8/15 and 2/15 in the same
campaign is the central fact, and it is a spread this design cannot resolve.

NOT SETTLED, unchanged: generalization. The diagnostic runs the graded cases.

NOT CLAIMED: that the 8-then-2 swing reflects anything about task order, replicate order, or
backend drift. Those are untested.

Records: `AUTODIAG-2_REPORT.json`, `AUTODIAG-2_summary.jsonl`, `AUTODIAG-2_console.log`.
