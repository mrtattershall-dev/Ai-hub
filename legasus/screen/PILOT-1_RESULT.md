# PILOT-1 RESULT — the replay-tested protections held with a live model, in 14 supervised units

Ran 2026-09-25 19:36Z → 19:58:13Z (22 min 13 s of the 40 min bound), supervised throughout.
**Interventions: none.** Definition frozen at ac765d1 (also the hub commit).

    planned 14   completed 14   UNATTEMPTED 0   UNACCOUNTED 0   integrity TRUE
    integrity flags raised 0 of 14   isolation violations 0   hard-wall hits 0
    execution confirmed stopped 14/14   task-level timeouts 0 (two units ran to the 240 s
    per-task limit in the controller-off arm; two call-level deadline aborts there)

**Spend: ESTIMATE ~$0.42 GPU-only** (app live 19:33:41Z → 19:58:24Z = 1,483 s × $0.000306/s),
**≤ ~$0.65** conservative. Against the pilot's $5 cap. Estimates until invoiced.

**GPU shutdown: OBSERVED stopped 11 s after COMPLETE** (COMPLETE 19:58:13.255Z; process EXIT
19:58:13.265Z — the wall-timer fix holds live; watchdog trigger 19:58:17Z; stop issued
19:58:20Z; Modal `stopped_at` 19:58:24Z; observed 19:58:45Z).

## The behaviour that had to hold (pre-registered conditions for the overnight run)

    every restore byte-exact              7 of 7 (sha256 equal to the checkpoint)        HELD
    no integrity flag                     provisionalDeliveredAsAccepted 0;
                                          controllerAcceptNotRetained 0                  HELD
    every controller STOP ended the run   2 stops, no later action in either             HELD
    campaign within bounds                22 min of 40; longest unit 241 s of 240+45     HELD
    shutdown observed                     yes, 11 s after COMPLETE                        HELD

All five held. The overnight run is authorized by these conditions and by tatte's separate
$5 cap.

## Per arm (7 held-out tasks, one seed, descriptive)

    arm             repairs   regressions   edits   calls   task s   controller
    RECOVERY_ARM     3 / 7     0 / 0 surv.    12      21      248    restores 7 (7 exact),
                                                                    stops 2, states ACCEPTED 3
                                                                    STOPPED 2 ACTIVE 2
    AUTODIAG_ARM     3 / 7     1 / 0 surv.    68      82      941    (off)

    task              RECOVERY_ARM                        AUTODIAG_ARM
    possible_change   RETAIN  1 edit   48 s  ACCEPT       RETAIN  1 edit   52 s
    powerset          RETAIN  1 edit   22 s  ACCEPT       RETAIN  1 edit   76 s
    quicksort         PRESERVE 3 edits 38 s  DISCARD>REPEAT>REPEAT STOP   PRESERVE 20 edits 239 s
    shunting_yard     PRESERVE 3 edits 34 s  DISCARD>REPEAT>REPEAT STOP   RESTORED 25 edits 241 s
                                                                          (protected broke; end-of-
                                                                          run restore; candidate
                                                                          did not import)
    sieve             PRESERVE 3 edits 40 s  DISCARD (then hub guard)     PRESERVE 4 edits 46 s
    subsequences      PRESERVE 0 edits 34 s  no decision                  PRESERVE 3 edits 48 s
    to_base           RETAIN  1 edit   32 s  ACCEPT                       RETAIN 14 edits 239 s

**Same repairs (3 and 3, the same three tasks), one regression fewer, a quarter of the task
time, a fifth of the edits.** Both arms repaired the tasks the model fixed on its first edit;
neither repaired a task whose first edit failed. The controller's contribution in this pilot
was containment, not repair: on quicksort and shunting_yard it restored the checkpoint after
one unproductive edit, refused the same edit twice, and stopped — where the controller-off
arm spent 20 and 25 edits, and on shunting_yard broke protected behaviour and left an
unparseable candidate for end-of-run restoration.

**Held-out note.** These seven tasks had never been seen by any arm or by the controller. Both
arms repaired 3 of 7 on the first attempt; descriptive only (7 tasks, 1 seed).

## First observations outside the replay

- **Live REPEAT refusals happened** (4, in two units): the 7B did resubmit byte-identical
  rejected candidates after the packet told it not to. The refusal cost no diagnostic.
- **No PROVISIONAL decision occurred live**: no unit made partial progress with protected
  behaviour held. The provisional bound is therefore untested against this model.
- **No UNVERIFIABLE restore and no import-error restore occurred** in the controller arm.
- **sieve** ended by the hub's own repeat guard after one DISCARD (the controller was still
  ACTIVE with one attempt left): the two termination mechanisms coexist; which one fires
  first depends on what the model repeats.

## What this pilot does and does not establish

ESTABLISHED: under live conditions, in these 14 units, the controller restored exactly,
refused repeats, stopped runs, and never delivered an unverified state as accepted; the
campaign, watchdog and shutdown behaved as in MECH-1.

NOT ESTABLISHED: any repair-rate effect (3 vs 3 on 7 tasks is not evidence of one either
way); the provisional path live; behaviour on the original 15 tasks; anything about
2 seeds. The efficiency figures are this pilot's aggregates, not billed cost or a speedup.

Records: `PILOT-1_REPORT.json`, `PILOT-1_summary.jsonl`, `PILOT-1_arms.json`,
`PILOT-1_MECHANISM-AUDIT.json`, `PILOT-1_console.log`, `PILOT-1_stage1.log`,
`PILOT-1_seedprobe.json`, `PILOT-1_watchdog.log`, `PILOT-1_gate.log`. Root: `autodiag1-8jxGIY`.

## Overnight run, as launched (amended bounds)

The definition planned a 9000 s wall and 9900 s watchdog; at the conservative rate that
maximum (2.75 h + 45 min) is ~$5.4, over the $5 cap. Launched instead with per task 240 s,
wall 7800 s, watchdog 8400 s: maximum ≈ 2.33 h + 45 min ≈ 3.1 h → ~$3.4 GPU-only,
**~$4.8 conservative** < $5; planned 88 × ~70 s ≈ 1.7 h → ~$1.9–2.7. Units the wall does
not reach are UNATTEMPTED rows, accounted. Everything else as defined: 22 tasks (15 original
+ 7 held-out, reported separately), 2 arms, seeds 606 and 707, policy unchanged, call cap 25.
