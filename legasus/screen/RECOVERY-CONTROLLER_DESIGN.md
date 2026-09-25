# Recovery controller — design record (not built; nothing here has run)

2026-09-25. Direction from tatte after MECH-1: the evidence so far looks like a useful
problem-SPECIFICATION mechanism, not a reliable RECOVERY mechanism. Full diagnostics helped
produce repairs (13/30 vs 4/30); repeated editing after a poor first edit rarely recovered
(1/13 in the audit, not accepted; 2/13 in MECH-1, both accepted). The next design target is a controller
that decides, from verified facts, whether another attempt deserves compute.

## What already exists (facts the controller would use)

    checkpoints           the Hub commits after each edit; acceptance captures the candidate
    fresh evidence        autodiag.js runs the graded cases and binds the result to a sha256
    preservation          protected-behaviour check in the read-only worker (evaluator.js)
    restoration           byte-identical restore of the verified state (acceptance.js)
    localized editing     edit_file FIND/REPLACE; FIM path exists for the 1.5B (qwen FIM)
    provenance            run.diagnostics, run.calls, transcripts, rows with seeds/positions
    bounds                per-call deadline, per-task bound, outer wall, watchdog

## The loop, per attempt

    1  START from the last VERIFIED checkpoint (known code, recorded protected behaviour).
    2  BUILD a failure packet: failing input(s), expected vs actual, the code location when
       the evidence justifies one (not guessed), the preservation constraints, and a compact
       record of any rejected prior attempt (what changed, which check rejected it, what is
       still unresolved). Bounded in size; no transcript accumulation.
    3  REQUEST one localized patch. Use the FIM/local-edit path when the target region is
       identified; never regenerate working code.
    4  VERIFY immediately: requested improvement AND protected behaviour, in the worker.
    5  DECIDE from the evidence:

       result                                              action
       target fixed, protected passes                      ACCEPT, checkpoint
       some target progress, protected passes              PROVISIONALLY retain; bounded
                                                           continuation with fresh evidence;
                                                           the original verified checkpoint
                                                           stays available (more cases passing
                                                           is not "better overall")
       protected breaks                                    RESTORE the checkpoint; PRESERVE the
                                                           rejected patch and its evidence
       no measurable progress                              DISCARD; a DIFFERENT plan from the
                                                           checkpoint (the packet says what
                                                           was tried)
       same failed approach repeats                        STOP or escalate; do not spend the
                                                           remaining budget repeating it

## Initial policy (an engineering starting point, not an established optimum)

    one first attempt; one fresh-plan retry; further continuation ONLY while verification
    shows progress. Retries are counted and reported; the budget is the ceiling, never the
    signal.

## What "different plan" means mechanically

The next packet must carry the rejection: the diff that was tried, the check that rejected it
(requested / protected / parse), and the residual failing cases. The model is asked for a
proposal that does not repeat the rejected diff; a proposal that does is refused before it
runs (the repeat guard already keys on identical tool calls - this keys on identical DIFFS
against the checkpoint).

## Measures (fixed before any run that tests it)

    cost per RETAINED, VERIFIED repair   task seconds / RETAIN count, per arm
    regressions produced / surviving     from acceptance, never netted against repairs
    unresolved tasks                     with their last verified state and last rejection
    recovery after a bad first edit      descriptive subgroup (RECOV-1 rule)
    elapsed, calls, retries used         beside the above; "fewer calls" alone means nothing

## What must be established BEFORE this is claimed to work

    - RECOV-1 (frozen, not launched) INFORMS this design; it is not its sole gate. It tests
      one mechanism - continued feedback after an edit - holding the opening report constant.
      A near-even result means no advantage detected at that sample size, not that the loop
      is unnecessary; it would move priority toward the packet while the loop stays open.
    - rollback, fresh-plan retries and the stopping rules are SEPARATE mechanisms; each needs
      its own validation (replay proofs first, then a bounded live comparison), and RECOV-1
      says nothing about them.
    - a replay proof with scripted replies through the real Hub path: reject → restore →
      packet carries the rejection → next proposal differs → accept; and the negative control:
      identical diff refused.
    - the controller must be a DECIDING path, not an advisory sentence (every earlier Hub
      recovery was a sentence the 7B ignored).

## Status (2026-09-25, later the same day): IMPLEMENTED as an opt-in, REPLAY-VALIDATED, never run live

`server/recovery.js` (decision logic, pure) with hooks in `agent.js`, enabled per run by a
`recovery: { maxAttempts, maxRepeats }` field beside the diagnostic on the start request.
Off by default; no earlier campaign used it. `recoveryController.test.mjs`, 26/26, through the
real Hub path with scripted replies and the worker diagnostic:

    CONTROL (no controller)   a protected-breaking edit stays in the file and read_file shows it
    ROLLBACK                  three rejected changes (breaking edit, truncated rewrite, rewrite
                              that fails to import) each RESTORED byte-exact (sha256 equal);
                              every read_file after a rejection showed the restored bytes; the
                              later fix ACCEPTED and the checkpoint advanced to it
    FRESH-PLAN RETRIES        the packet names the rejecting check (case 3), the residual
                              failures (8 of 9, bounded to 6 shown, 2 withheld and said so) and
                              the refusal rule, and does not carry the rejected code; an
                              identical resubmission is REFUSED without spending a diagnostic;
                              partial progress (1 -> 2 cases, protected held) is kept
                              PROVISIONALLY, consumes no attempt, and the later fix is accepted
    STOPPING                  attempts exhausted (2 of 2 rejected candidates) and repeats
                              exhausted both END the run: the scripted fix that followed never
                              executed, the file is the checkpoint byte-exact, the run finalized

What is NOT established: any effect on a live model (no paid run has used it); the packet
carries no code LOCATION (only cases, expected vs actual and the rejection); the FIM/local
patch path is not wired in - the model still edits with edit_file; "bounded continuation"
after PROVISIONAL is bounded only by the attempt count and the task budget; the policy
numbers (2 attempts, 2 repeats) are the starting point, not measured. RECOV-1 (continued
feedback) and any live test of this controller remain separate, unauthorized experiments.
