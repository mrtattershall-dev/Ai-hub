# PILOT-1 — short, supervised live pilot of the recovery controller. Frozen before launch.

2026-09-25. **Authorized by tatte: $5 cap for this pilot, and a separate $5 cap for a capped
overnight (3–4 h) run to follow only if the pilot behaves.** Recorded here before deploy.

## The question

**Do the replay-tested protections hold with a live model?** The controller enforced exact
rollback, repeat refusal, provisional bounding and stopping under scripted replay
(recoveryController.test.mjs 30/30; recoveryArm.test.mjs 13/13 through the campaign entry
point). That establishes mechanism behaviour, not behaviour against a live 7B.

## Design

    arms      RECOVERY_ARM   full diagnostic (opening + after every edit) PLUS the controller
              AUTODIAG_ARM   the same diagnostic, controller OFF (MECH-1's treatment arm)
              -> the only difference is the controller; both arms see the same messages
                 until the first rejection
    tasks     the 7 HELD-OUT QuixBugs programs (legasus/bench/quixbugs-heldout, selected by
              the same rule with the original 15 skipped; vendored from revision 4257f44 by
              benchSelect.mjs; seed/reference verified in the worker before this file was
              written): possible_change, powerset, quicksort, shunting_yard, sieve,
              subsequences, to_base. NEW to every arm and to the controller.
    seed      one sampling seed, 505; order rotation by task index; position recorded
    units     7 × 2 = 14
    policy    maxAttempts 2, maxRepeats 2, maxProvisional 3 (the design's starting point)
    limits    per task 240 s; campaign wall 2400 s (40 min) enforced by the runner; model
              calls per run capped at 25 (AGENT_MAX_STEPS); watchdog deadline 3000 s from
              deploy with the DONE-file trigger; min_containers=0, scaledown 900 s
    isolation fresh workspace and fresh hub per unit, as always; the original 15 tasks are
              NOT loaded (BENCH_DIRS names the held-out directory only)
    supervision  I watch every unit line as it lands; any intervention is recorded with its
              clock and reason in the result

## What is recorded, per unit and per arm

accepted repairs (RETAIN); protected-behaviour regressions produced and surviving; the
controller's decisions in order (RESTORE / DISCARD / REPEAT / PROVISIONAL / ACCEPT), restores
and whether each was byte-exact; runs stopped by the controller and why; **the two integrity
flags**: `provisionalDeliveredAsAccepted` (controller short of ACCEPT yet acceptance
RETAIN) and `controllerAcceptNotRetained` (controller ACCEPT yet acceptance not RETAIN) —
either raised is a defect, reported as such; interventions; elapsed; calls; deadline aborts.

## Readings, pre-registered

- The pilot "behaves" if: every restore is byte-exact; no integrity flag is raised; every
  controller STOP ended the run with no later action; the campaign completes within its
  bounds; shutdown is observed. Those are the conditions for the overnight run.
- Repair counts are DESCRIPTIVE: 7 tasks, one seed, two arms. No rate, no rate comparison.
- Anything the controller does that the replay did not cover (an UNVERIFIABLE restore, a
  decision on a diagnostic that came back unavailable) is reported as a first observation.

## Budget (pilot)

Pricing as verified for MECH-1 (A10 $1.1016/h GPU-only; $1.55/h conservative). Planned:
deploy + probe ~4 min, 14 units × ~90 s ≈ 21 min, shutdown < 1 min ≈ 0.45 h → **~$0.50–0.70**.
Maximum exposure: watchdog deadline 3000 s + 3 × 10 min verify + 15 min scaledown ≈ 1.6 h →
**~$1.8 GPU-only, ~$2.5 conservative** < $5. Gate before each paid stage as in MECH-1.

## Overnight run (separate $5; defined now, launched only if the pilot behaves)

    OVERNIGHT-1   same two arms; all 22 tasks (15 original + 7 held-out); 2 seeds (606, 707);
                  88 units; AMENDED BEFORE LAUNCH (the first figures put the conservative
                  maximum at ~$5.4, over the cap): per task 240 s; campaign wall 7800 s
                  (2.17 h); watchdog 8400 s; same policy and call cap. Planned ~88 × 70 s
                  ≈ 1.7 h → ~$1.9–2.7. Maximum exposure ≈ 2.33 h + 30 min + 15 min ≈ 3.1 h
                  → $3.4 GPU-only / **$4.8 conservative** < $5. Unattended; the same
                  records; original vs held-out tasks reported separately; units the wall
                  does not reach are UNATTEMPTED rows.

Procedure: `server/mech1Launch.sh` with CAMPAIGN_* variables as above; seed probe before;
`mech1Analyze.mjs` and `mechanismAudit.mjs` after. Everything that runs is committed first.
