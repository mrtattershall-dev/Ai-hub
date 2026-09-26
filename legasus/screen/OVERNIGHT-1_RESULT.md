# OVERNIGHT-1 RESULT — the controller held across 42 live units; same repairs, zero regressions, half the time

Ran 2026-09-25 20:03:54Z → 22:14:30Z (attempt 2; 2 h 10 m of the 2 h 10 m wall — the wall
ended it). Unattended after launch. Definition: PILOT-1_DEFINITION.md (overnight section,
amended bounds) at 3abcef2, which is also the hub commit.

    planned 88   completed 83   UNATTEMPTED 5 (wall clock)   UNACCOUNTED 0   integrity TRUE
    integrity flags raised 0 of 83   isolation violations 0   restores byte-exact 52 of 52
    hard-wall hits 1 (machine sleep, below)   execution confirmed stopped 83/83

**Spend: ESTIMATE ~$2.44 GPU-only** (app live 20:01:33Z → 22:14:42Z = 7,989 s × $0.000306/s),
**≤ ~$3.45** conservative, of the overnight's $5. About 19 minutes of that was the machine
asleep with the GPU idle. Estimates until invoiced.

**GPU shutdown: OBSERVED stopped 12 s after COMPLETE** (COMPLETE 22:14:30.326Z; process EXIT
22:14:30.334Z; watchdog trigger 22:14:37Z; stop issued 22:14:39Z; Modal `stopped_at`
22:14:42Z; observed 22:15:00Z).

## Three operational events, all recorded, two of them interventions

1. **Attempt 1 died silently (exit 127) one second into its second unit** (20:05:56Z), after
   unit 1 completed normally. No error text; the hub for unit 2 had just been spawned. Root
   `autodiag1-lmCYpf` preserved (1 row). I relaunched once (20:06Z, the campaign's first
   intervention) and armed a safety stop for a repeat; attempt 2 ran through. **Cause
   unexplained.** It is not the wall-timer defect (that was after COMPLETE) and did not recur
   in 83 units. It stays an open operational item.
2. **The machine slept** ~20:46Z → 21:04:51Z (Windows Power-Troubleshooter resume event).
   Unit 30 (AUTODIAG_ARM pascal, seed 606) had already fixed the task at 20:45:42Z; its run
   sat asleep, the outer wall fired late at 1,194 s (909 s past the bound) — the wall works
   by timers, and timers do not run while the machine sleeps — and the unit is recorded
   TIMEOUT / RETAIN (acceptance judged the captured candidate, correctly). GPU billed idle
   ~19 min. Intervention 2 (21:07Z): an application-level keep-awake request
   (SetThreadExecutionState; no power setting changed) for the rest of the run. No further
   sleep. The standing rule "never start a GPU window on battery, keep AC on" has a corollary:
   a campaign needs a keep-awake of its own, and the runner cannot bound a sleeping machine.
3. **The wall clock ended the queue with 5 units unattempted** (all seed 707, the last three
   held-out tasks) — 19 minutes of sleep is roughly the shortfall. Accounted as UNATTEMPTED
   rows; their pairs are INCOMPLETE below, never imputed. One more unit (RECOVERY sieve,
   seed 707) was cut by the campaign deadline before its opening diagnostic delivered: the
   controller never initialised there (state null), 1 edit ran without it; recorded.

## The behaviour that had to hold

    every restore byte-exact              52 of 52                                        HELD
    no integrity flag                     provisionalDeliveredAsAccepted 0;
                                          controllerAcceptNotRetained 0                  HELD
    every controller STOP ended the run   18 stops, no later action in any                HELD
    shutdown observed                     yes, 12 s after COMPLETE                        HELD
    campaign within bounds                wall clock respected (5 UNATTEMPTED); one unit
                                          overran while the MACHINE slept                 HELD, with
                                                                                          that caveat

## Per arm (22 tasks, 2 seeds; descriptive)

    arm             units   repairs          regressions   edits   calls   task s   s / repair
    RECOVERY_ARM     42     19  (r1 12/22,      0 / 0 surv.   39     173     2172      114
                             r2 7/20)
    AUTODIAG_ARM     41     18  (r1 13/22,     11 / 0 surv.   37*    331     4678      260
                             r2 5/19)

    * edits ON TARGET as counted per unit; the controller-off arm's per-unit edit counts run
      to 20–25 in its churn units (see the task table) - the "37" is the runner's
      editsOnTarget sum, which counts successful target edits and undercounts refused ones.

    original 15 tasks    RECOVERY 14/30 repairs, 0 regressions, 1529 s
                         AUTODIAG 13/30 repairs, 9 regressions, 3308 s
    held-out 7 tasks     RECOVERY  5/12 repairs, 0 regressions,  643 s
                         AUTODIAG  5/11 repairs, 2 regressions, 1370 s

**Paired by (task, seed), 41 complete pairs:** both repaired 14, neither 18, RECOVERY-only 5,
AUTODIAG-only 4 (sign test p = 1.0, descriptive). Task level: RECOVERY wins under both seeds
on 1 task, AUTODIAG under both on 0; each wins one seed on 2–3 tasks; 12 tasks neither.

**Controller account (42 units):** ACCEPT 19, RESTORE 13, DISCARD 9, REPEAT 30, PROVISIONAL 1;
end states ACCEPTED 19, STOPPED 18, ACTIVE 4 (ended by the hub's own guards), null 1 (cut
before init). Every one of the 52 restores was byte-exact.

## Reading

**Repairs: no detectable difference** (19 vs 18; 5 vs 4 discordant). Both arms repaired
mostly the same tasks, on the first edit. The controller neither added repairs nor cost them
in aggregate; at task level it cost a repair on kth (seed 606), lcs_length (606) and
possible_change (606), where the controller-off arm found the fix on a second or third edit
that the controller's DISCARD-then-STOP never allowed, and it gained one on
is_valid_parenthesization (707), flatten (both seeds) and powerset (707) where the
controller-off arm churned or broke protected behaviour. **This is the trade-off the design
predicted: strict limits on unproductive retries contain damage and forgo the occasional
late repair. With one seed per task per arm this run cannot say which outweighs which.**

**Regressions: 0 vs 11.** Every one of the 11 protected-behaviour breaks in the controller-off
arm was caught by end-of-run acceptance and restored (surviving 0), so nothing was lost
either way — but with the controller the broken state never persisted past the next
diagnostic, and the model never worked on top of it.

**Time: 2172 s vs 4678 s task time, 114 vs 260 s per retained repair.** Aggregate over this
run; not billed cost; not a guaranteed speedup. The difference is the churn the controller
refuses: 30 REPEAT refusals cost no diagnostic, and 18 stops ended runs that the
controller-off arm continued for up to 25 edits.

**The provisional path ran once live** (lcs_length, seed 707: PROVISIONAL → DISCARD →
DISCARD → STOP). On DISCARD the controller restored the VERIFIED checkpoint, not the
provisional candidate, so the partial progress (a provisional 2/9) was set aside and the unit
ended at the seed's 1/9. That is what the design says ("the original verified checkpoint
stays available"), but it means a provisional state is never the surviving state unless the
run ends while it is current. Worth a decision, not changed here.

**Held-out vs original:** the same picture on both sets (14/13 and 5/5 repairs; 0/9 and 0/2
regressions; roughly half the time). Seven held-out tasks with one to two seeds are
descriptive only.

## Measured cost per accepted repair (added after review; `costAccount.mjs`)

Phases from the campaign's own clocks, at the verified A10 rate ($1.1016/h GPU-only) and the
conservative rate ($1.55/h with CPU and memory); ESTIMATES until invoiced:

    startup (deploy -> model up)        109 s   $0.03 / $0.05
    probe + gate + failed attempt 1     243 s   $0.07 / $0.10
    baselines                            67 s   $0.02 / $0.03
    units (model work)                 5941 s   $1.82 / $2.56
    unit OVERRUN while asleep           909 s   $0.28 / $0.39   (pascal, controller-off, seed 606)
    per-unit overhead                   709 s   $0.22 / $0.30   (hub spawn, acceptance, case measurement)
    shutdown (COMPLETE -> stopped_at)    12 s   $0.00 / $0.01
    TOTAL                              7989 s   $2.44 / $3.44

    arm            repairs   own s   s/repair (own)   s/repair (incl. shared)   $/repair own       $/repair incl. shared
    controller ON    19      2172       114                 154                $0.035 / $0.049     $0.047 / $0.066
    controller OFF   18      3769       209                 282                $0.064 / $0.090     $0.086 / $0.121

With the 909 s of sleep taken out of the controller-off arm's time (it was not model work),
the own-time figure is 114 vs 209 s per retained repair (about 45% less), and 154 vs 282 s
with startup, overhead and shutdown attributed by share of unit time. Inference, diagnostics
and acceptance all run inside those seconds; they are not separately metered here.
Interventions cost wall-clock time on the GPU (the 243 s line includes the failed first
attempt) and are in the total.

## The claim, as reviewed

**In this QuixBugs campaign, Legasus's controller used roughly half the task time per
retained repair, with similar observed repair counts and reliable rollback and stopping.**

Two distinctions keep it defensible:

- Similar observed repair counts do not establish equivalent repair capability. This sample
  leaves uncertainty, and stopping demonstrably sacrificed some recoveries (kth, lcs_length,
  possible_change under seed 606).
- Both arms delivered zero surviving regressions. The controller's demonstrated advantage is
  earlier containment and less wasted work; the off arm's end-of-run acceptance also
  protected delivery.

The sleep-related overrun means this overnight execution did not fully validate reliable
unattended bounds, despite the controller's own checks holding. It compares the same model
with and without the controller; it says nothing about a larger model.

## What this run does and does not establish

ESTABLISHED, live, 42 controller units on 22 tasks: exact rollback (52/52), repeat refusal
without re-verification (30), attempt and repeat bounds ending runs (18), no unverified
state delivered as accepted (0 flags), zero surviving or persisting regressions, at about
half the task time of the same diagnostic without the controller.

NOT ESTABLISHED: a repair-rate effect in either direction; whether the late repairs the
controller forgoes outnumber the churn it prevents on other task sets; the provisional path
beyond one occurrence; robustness of the campaign process to whatever killed attempt 1.

Records: `OVERNIGHT-1_REPORT.json`, `OVERNIGHT-1_summary.jsonl`, `OVERNIGHT-1_arms.json`,
`OVERNIGHT-1_ANALYSIS.json`, `OVERNIGHT-1_MECHANISM-AUDIT.json`, `OVERNIGHT-1_console.log`,
`OVERNIGHT-1_attempt1-exit127.log`, `OVERNIGHT-1_stage1.log`, `OVERNIGHT-1_seedprobe.json`,
`OVERNIGHT-1_watchdog.log`, `OVERNIGHT-1_gate.log` (interventions with clocks). Roots:
`autodiag1-FVZVJG` (attempt 2), `autodiag1-lmCYpf` (attempt 1, 1 unit).
