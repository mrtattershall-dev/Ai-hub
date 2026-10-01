# CONT-2 — the continuation contract: outcome -> CONTINUE / HOLD, and what authorizes the effect

Frozen 2026-10-01 after the CONT-1 characterization (EH1 9a33779c; corrected re-run sealed before this
file is committed) and BEFORE agent.js or queue.js change. Repair is made only under this freeze.

## OBSERVED (CONT-1, real hub, supervisor armed, chain A -> B after A)

    A ends as              A's item   B auto-started   B ran to   B observed A's state
    verified               done       yes              done       (stream offset: unobserved in run 1)
    unverified-no-work     done       yes              done       YES: read out.js = module.exports = {}
    forced                 done       yes              done       (no read landed)
    unverified (bounded)   done       yes              done       (stream offset)
    stopped (control)      stopped    no               -          retry spliced (loop = machine failure),
                                                                  retry stopped, chain halted - as read
    error (control)        UNMEASURED

The hypothesis held on every measured unverified kind: continuation authority is reconstructed from
termination. A's kind survives on its index and trace rows and is recoverable via item.runId (X2); no
item carries a kind, and every chain reads done>done (X3).

## CONTRACT DISCOVERED

The system has TWO continuation concepts and conflates neither with verification today:
    TRIGGER     may the next goal start?        keyed on status === 'done' (item for `after`; run for the supervisor)
    AUTHORITY   what may the next goal write?   item.authority -> inheritedAuthority at startRun; STEP6: derived from
                                                the work it continues, never greater. Failure may create work; creating
                                                work does not create authority.
Policy with CONTINUE / RETRY / HOLD / HALT distinctions exists ONLY on the failure path (failQueueItem):
machine failures retry once via a repair item; a human stop or an interruption never retries; a retry of a
retry halts and waits. The success path has no policy at all: `done` is the whole test.
So the defect is not "finishKind unchecked"; it is that the EPISTEMIC verdict feeds neither continuation
concept. VERIFIED is not consulted for TRIGGER, and AUTHORITY is inherited from the item regardless.

## THE CONTRACT (frozen)

    TERMINATED  run.status terminal                       -> records written, workspace released (unchanged)
    COMPLETED   item status 'done' when run.status 'done' -> unchanged: termination completes the WORK ITEM
    CONTINUABLE (autonomous)  the hub may start a dependent/next goal BY ITSELF only when the
                predecessor's verdict is in CONTINUABLE = { verified, screen_checked }
    HOLD        any other kind that reached 'done' (unverified-no-work, forced, auto_clean_tests, unverified):
                the next item is released back to 'queued' with a note naming the predecessor's verdict,
                exactly as supervisorBrake already does for its caps. Nothing is discarded; a HUMAN may start
                it from the queue panel (POST /agent/queue/run) - the human's act is the authorization.
    RETRY / HALT  the failure path, unchanged.
Distinctions preserved: HOLD is not HALT (the chain is resumable by a person, not stopped); COMPLETED is not
CONTINUABLE (the item is done; autonomous advancement is withheld); a human override is explicit.
What authorizes the effect: for an autonomous start, the predecessor's recorded verdict being CONTINUABLE
(evidence: finishVerdict(run), the same value the index row carries); for a manual start, the human.
RECORD: queue.complete() stores finishKind on the item, so X3's "kind on item: none" closes and a chain's
label can be read from the items alone.

THE CONTINUATION DECISION IS ITSELF A RECORD (tatte, before this freeze was committed). Whenever a
dependent starts after a non-CONTINUABLE predecessor, the dependent's run and index row carry
    continuation: { predecessorItem, predecessorKind, decision: 'AUTHORIZED_BY_OVERRIDE', by: 'human' }
and when it is withheld, the predecessor's run carries decision 'HELD'. The predecessor's own verdict is
NEVER rewritten: the only way an unverified predecessor acquires a dependent is through an explicit,
recorded override - never by being reclassified. History must be able to read
    G1: unverified-no-work   continuation: AUTHORIZED_BY_OVERRIDE (human)   G2: started
and must never be able to read G1 as a success because G2 ran. (Startup routes: autoStart carries
entrance 'supervisor'; POST /agent/queue/run is the human entrance - the record is written where the
dependent is started, from the predecessor item's stored finishKind.)

Open to the owner, stated: the bounded configuration ('unverified' by construction, judged afterwards by
the independent evaluator in campaigns) is HELD under this contract. Campaign runners do not use the
supervisor chain, so campaigns are unaffected; an autonomous bounded chain would need the evaluator's
verdict fed back, which is not built. Recorded, not decided here.

## THE REPAIR (smallest; exact sites)

    queue.js completeLocked   accepts and stores `finishKind` (record only)
    agent.js ~5611            workQueue.complete(..., { status: 'done', runId, finishKind: finishVerdict(run) })
    agent.js ~5617 branch     before dequeue: `const kind = finishVerdict(run); if (!CONTINUABLE.has(kind))` ->
                              dequeue `next`, release it, note "Held: the previous goal ended <kind>, not verified;
                              start it from the queue panel to continue." - the brake's own pattern.
    finishVerdicts.mjs        exports CONTINUABLE = new Set(['verified', 'screen_checked'])
    NOT changed: `after` resolution (completedQueueIds), the failure path, status semantics, the UI.

## PREDICTIONS (unchanged probe, CONT1_PHASE=after)

    C1 verified              A done; B auto-starts; B done            (positive control, must hold)
    C2 no-work               A done; B NOT started; B item 'queued'; a note on A names unverified-no-work
    C3 forced                A done; B NOT started; note names forced
    C4 bounded unverified    A done; B NOT started; note names unverified
    C5 stopped               unchanged: retry spliced, halted
    X2                       kinds still on index/trace; AND now on A's item
    OVERRIDE (new row C7)    after C2's hold, POST /agent/queue/run starts B; B runs - the human authorizes
Falsifiers: C1's B not starting (over-refusal); any of C2-C4's B auto-starting (no repair); C5 changing
(leak into the failure path); the item lacking finishKind. Consumers: supervisorChain, queueChain,
queuedAuthority, repairAuthority, repairChain, generationChain, autoStart, supervisorTick, runLifecycle,
unverifiedFinishRecorded, forcedFinish - baselined BEFORE the change.

## Consumer baseline, recorded BEFORE any change (repo root)

    supervisorChain 7    queueChain 7    queuedAuthority 29/0    repairAuthority 16/0    repairChain 14
    generationChain 2/0    autoStart 4    supervisorTick 5/0    runLifecycle 9/0
    unverifiedFinishRecorded 10/0 (+1 known-open)    forcedFinish 3/0
    plus the ten finish-gate consumers at their FG-5 counts

## Amendment 1 - 2026-10-01 - a trace gap, an over-reach, and the rule moved onto the dependency EDGE

Found by the first AFTER chain (CONT-1 AFTER EH1 24667b17, C7 AFTER b5daf159, consumers):

1. TRACE GAP (mine). CONT-1 enumerated two autonomous entrances - the terminal branch (~5623) and
   POST /agent/queue/run - and missed the third: supervisorTick() (~5906), a timer that dequeues with the
   same completedIds and autoStarts when the workspace is idle. The first repair held only in the terminal
   branch, so CONT-1 AFTER showed C2/C3/C4's dependents still starting: the branch released B, the tick
   picked it up. C7 AFTER "held" because the probe read B seconds after A ended and then started B itself -
   partly a race, recorded as such. The run 1/2 probe projection "kind on item: none" never read
   item.finishKind (C7 shows it present); a probe projection, not a finding.

2. OVER-REACH (mine). runLifecycle.test 9/0 -> 7/2: its queued follow-up has NO `after` - an independent
   goal, not a dependent - and the first repair keyed the hold on the FINISHING RUN's verdict for any next
   item. CONT-1 measured dependents (B after A); nothing measured authorizes holding independent work.

RULE, frozen now: autonomous continuation is judged on the DEPENDENCY EDGE. At every autonomous
entrance (terminal branch AND tick), after dequeue: if next.after names a predecessor item whose stored
finishKind is not in CONTINUABLE, the item is released with a note/record (HELD); otherwise the brake
decides as before. Independent items (no after) start as today. POST /agent/queue/run records the
override on the dependent as already frozen. One helper, heldByPredecessor(next), used by both entrances.

OPEN, recorded, not decided (CONT-3 candidate): an INDEPENDENT successor still observes the workspace an
unverified predecessor left behind (X1). Whether workspace sharing is itself a dependency is a contract
question for the owner, not this repair.

Predictions under the edge rule (probes unchanged): CONT-1 C2/C3/C4 - B NOT started, item queued, A done;
C1 unchanged; C5 unchanged. C7 - held, then started by the human with the override record. runLifecycle
back to 9/0; every other consumer at baseline.
