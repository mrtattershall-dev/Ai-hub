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

    - RECOV-1 (frozen, not launched): whether fresh full feedback after an edit adds repair
      power at all, holding the opening report constant. If INIT_ONLY ≈ INIT_FULL, the
      controller's first job is the packet, not the loop.
    - a replay proof with scripted replies through the real Hub path: reject → restore →
      packet carries the rejection → next proposal differs → accept; and the negative control:
      identical diff refused.
    - the controller must be a DECIDING path, not an advisory sentence (every earlier Hub
      recovery was a sentence the 7B ignored).

Nothing above is implemented. `afterEditMode` and the RECOV arms are the only code that
exists for it, and they exist to run RECOV-1, not the controller.
