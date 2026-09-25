# AUTODIAG-2 RESULT — the campaign completed, the direction held, the magnitude did not

Ran 2026-09-25 10:48:38Z → 12:22:03Z. **93m 25s of the 150m bound — the queue finished early.**
Unattended; interventions none.

    planned 60   completed 60   UNATTEMPTED 0   UNACCOUNTED 0
    integrity TRUE   reconciliation TRUE

**Spend: ESTIMATE ~$1.95** (1.75h A10G incl. warm-up at ~$1.10/hr). **Authorized $5.** Estimate,
labelled as one; actual charges to follow.

**GPU shutdown: the scripted stop DID fire, ~5 minutes late; I had already stopped the app
manually at 12:23:12Z.** See the operational section — my first account of this was wrong and
is corrected there.

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

### Shutdown: the real finding, after I got it wrong once

**CORRECTED.** My first account of this said "the scripted `modal app stop --yes` never
executed" and blamed the shell chain for not reaching its second command. **That was wrong.**
The chain did continue, and the scripted stop did run — it ran LATE. The full timeline:

    12:22:03Z   campaign printed COMPLETE (93m25s)
    12:22:42Z   I checked: the app was still `deployed` with 1 live container
    12:23:10Z   I issued a manual stop
    12:23:12Z   the app actually stopped (Modal's own record)
    12:27:13Z   the SCRIPTED stop finally ran, reporting "App is already stopped"

So the defect is **shutdown latency, not shutdown failure**: ~5m10s between the campaign
finishing and the scripted stop being issued. I reached a worse conclusion than the evidence
supported, from a log I read before its last lines had been written — the same mistake as
reading a running campaign through a filter and concluding the treatment was absent.

What is true either way:

- **The "scripted shutdown" guarantee is weaker than I have been reporting it.** After every
  prior run I described the GPU as stopped by the job immediately afterwards. In practice
  there is a multi-minute window between completion and the stop taking effect, during which
  the container is live and billing.
- **Actual idle exposure this run: ~69 seconds**, because I intervened. Without intervention
  it would have been ~5m10s, with `scaledown_window=900` as the backstop behind that.
- **Nothing but looking caught it.** No mechanism reports the gap; the log's own `STOP ISSUED`
  line appears only once the stop has already run.

The honest statement for future runs is: *the job issues a stop after the campaign, typically
within several minutes; the app state must be checked directly to know it has taken effect.*

## What this settles, and what it does not

SETTLED: the operational repairs work — a campaign that previously lost half its queue ran all
60 units, bounded, confirmed stopped, fully accounted. The remaining operational gap is
shutdown LATENCY (~5 minutes), not shutdown failure, and it is outside the runner.

SETTLED: the direction is consistent across two experiments and 44 complete pairs — 18
treatment-only repairs, 0 control-only, 0 control repairs in 45 runs.

NOT SETTLED: how large the effect is, or how often it recurs. 8/15 and 2/15 in the same
campaign is the central fact, and it is a spread this design cannot resolve.

NOT SETTLED, unchanged: generalization. The diagnostic runs the graded cases.

NOT CLAIMED: that the 8-then-2 swing reflects anything about task order, replicate order, or
backend drift. Those are untested.

Records: `AUTODIAG-2_REPORT.json`, `AUTODIAG-2_summary.jsonl`, `AUTODIAG-2_console.log`.
