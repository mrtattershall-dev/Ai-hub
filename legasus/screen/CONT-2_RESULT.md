# CONT-1 / CONT-2 — RESULT: termination was continuation authority; now the dependency edge is judged

CONT-1 prereg 8a27d453 (characterization). CONT-2 prereg 0f6b1f44 (contract, revised with tatte's
override framing before commit) + Amendment 1 645deaf2 (frozen before the revised repair). Probes
`server/cont1.probe.mjs`, `server/cont2.probe.mjs` @ 3351faed, byte-identical in every run.

Research question (tatte): what fact authorizes continuation to the next goal?
Invariant: ENDING an attempt, SUCCEEDING at a task, VERIFYING a claim, and AUTHORIZING subsequent work
are four different facts unless the system explicitly establishes their relationship.

## OBSERVED (real hub, supervisor armed, chain A -> B after A; EH1 9a33779c run 1, 825b2036 corrected)

    A ends as              A item   B auto-started   B ran to   B observed A's state
    verified               done     yes              done       -
    unverified-no-work     done     yes              done       YES: read out.js = module.exports = {}
    forced                 done     yes              done       -
    unverified (bounded)   done     yes              done       -
    stopped (control)      stopped  no               -          retry spliced (loop), retry stopped, halted
    error (control)        UNMEASURED
    C7 (5f001ed9)          an unverified predecessor's dependent auto-starts; no hold, no record, no kind on
                           the item

Two apparatus faults in run 1, both mine, preserved: C1/C4 read A's kind from the run view (which carries
finishKind only when a route stamps it) against the prereg's named source, the index row; and A's spare
replies leaked into B's stimulus through the shared reply stream. Corrected, re-run on the unchanged tree.

## CONTRACT DISCOVERED

    TRIGGER     whether the next goal starts: status === 'done' - the item for `after`, the run for the
                supervisor's hand-off, and (missed in the first trace) the supervisor TICK. finishKind never
                reached the queue.
    AUTHORITY   what the next goal may write: item.authority -> inheritedAuthority (STEP6: derived, never
                greater; failure may create work, creating work does not create authority).
    POLICY      CONTINUE / RETRY / HOLD / HALT exists ONLY on the failure path (failQueueItem). The success
                path was a boolean: done -> continue.
The epistemic verdict fed neither trigger nor authority. Termination was being used as continuation
authority: every kind that reaches 'done' advanced the chain identically, and the dependent consumed the
unverified predecessor's state as a premise (X1).

## DEFECT ESTABLISHED

A downstream effect (starting B) was authorized by a representation (status 'done') carrying none of the
knowledge it stood in for. Same family as K8 (a PASS exists, therefore these bytes may be retained) and
FG-5 (a kind the reader did not know, therefore 'ok').

## REPAIRED (this commit) - files: server/finishVerdicts.mjs, server/queue.js, server/agent.js

    finishVerdicts.mjs   CONTINUABLE = { verified, screen_checked }
    queue.js             completeLocked stores finishKind on the item (the run file is reaped; the item is not)
    agent.js ~5611       workQueue.complete(..., finishKind: finishVerdict(run))
    agent.js             heldByPredecessor(next): on the DEPENDENCY EDGE - a dequeued item with `after` whose
                         predecessor item's stored verdict is not CONTINUABLE is released back to the queue
                         with a note naming the verdict, and the predecessor run records
                         continuation: { decision: 'HELD', predecessorKind, next }. Used by BOTH autonomous
                         entrances: the terminal hand-off and supervisorTick.
    agent.js /queue/run  a person starting a dependent whose predecessor was not continuable is recorded ON
                         THE DEPENDENT: continuation: { decision: 'AUTHORIZED_BY_OVERRIDE', by: 'human',
                         predecessorItem, predecessorKind }, with a note. The predecessor's verdict is never
                         rewritten. Trace and index rows carry `continuation`.
    UNCHANGED            `after` resolution (completedQueueIds), the failure path, status semantics, the UI,
                         independent queued items (no `after`).

AFTER (probes unchanged), first repair - terminal branch only, keyed on the finishing run (EH1 24667b17 /
b5daf159): C2-C4 STILL advanced (the tick started the released dependent), C7 "held" by a race, and
runLifecycle 9/0 -> 7/2 (an INDEPENDENT queued goal held on the finishing run's account). Amendment 1 moved
the rule onto the edge and into both entrances.

AFTER (probes unchanged), Amendment 1 (EH1 384fc23c / ae71baf4):
    C1 verified            A done, B auto-started, B done           positive control holds
    C2 no-work             A done, B NOT started, B queued           held
    C3 forced              A done, B NOT started, B queued           held
    C4 bounded unverified  A done, B NOT started, B queued           held (policy choice, open to the owner)
    C5 stopped             unchanged (failure path)
    X2                     A's kind on index and trace; item carries runId and (C7) finishKind
    C7                     held with "Held: the previous goal (<item>) ended 'unverified-no-work', not
                           verified"; POST /agent/queue/run started B; B ran to done

## CONTROL EFFECT

Positive (C1): a verified predecessor still advances its dependent under the ordinary workflow.
Anti-overrefusal: an independent queued goal is NOT held (runLifecycle back to 9/0); the failure path's
retry/halt distinctions untouched (C5 identical in every run). Anti-strengthening: C2-C4's records still
say what they are after B; the override is a record on the dependent, not a reclassification of A.

## Consumers (repo root, baseline -> repair 1 -> Amendment 1)

    supervisorChain 7 -> 7 -> 7   queueChain 7 -> 7 -> 7   queuedAuthority 29/0 x3   repairAuthority 16/0 x3
    repairChain 14 x3   generationChain 2/0 x3   autoStart 4 x3   supervisorTick 5/0 x3
    runLifecycle 9/0 -> 7/2 -> 9/0   unverifiedFinishRecorded 10/0 (+1 known-open) x3   forcedFinish 3/0 x3
    ten finish-gate consumers: identical to their FG-5 counts in every run

## UNCHANGED

What `done` means for the item (COMPLETED - the work item is finished). The failure path. The UI. Historical
items (no finishKind; absent means predates). tochat's R1b attribution (FG-5, still not claimed).

## UNMEASURED

C6 (a genuine machine-failure error) - no fault injection here. screen_checked and auto_clean_tests
predecessors (need a browser). The CONT-1 probe's X3 column never read item.finishKind (a projection; C7
shows the field present). B's "observed" column was blank in C1/C3/C4 for stream-offset reasons; X1 rests
on C2, where B read A's untouched file.

## NEWLY DISCOVERED (recorded, not absorbed)

1. supervisorTick is a third autonomous entrance I did not enumerate in CONT-1's trace (now covered).
2. INDEPENDENT successors (no `after`) still observe the workspace an unverified predecessor left behind
   (X1) - whether sharing a workspace is itself a dependency is a contract question for the owner. CONT-3
   candidate; not decided here.
3. C4: the bounded configuration is 'unverified' by construction and is HELD under this contract; campaign
   runners do not use the supervisor chain, so campaigns are unaffected; an autonomous bounded chain would
   need the evaluator's verdict fed back (not built). Open to the owner.

## NOT CLAIMED

That HOLD is the right policy for every unverified kind forever - it is the frozen default pending the
owner's contract; the override exists so continuing under explicit uncertainty is possible and recorded.
That the model acts on the hold note. ESCAPE, the symbol check and the loop guard: not started, per the
standing instruction to stop and report after this boundary.
