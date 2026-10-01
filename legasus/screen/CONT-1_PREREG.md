# CONT-1 — what fact authorizes continuation to the next goal?

Frozen 2026-10-01, before any probe exists and before agent.js or queue.js change. A NEW experiment,
not an FG-5 extension; FG-5's results and commits (93eb8896, 7618c1d8) are preserved unchanged. tochat's
R1b attribution defect is left untouched. Independent of the recovery work.

## Research question (tatte)

> What fact authorizes continuation to the next goal?

NOT assumed: that the answer is `finishKind === 'verified'`; that every unverified outcome must halt.
Four facts, not assumed equivalent:

    TERMINATED    the current attempt/run ended                      run.status is terminal
    COMPLETED     the requested work reached a terminal workflow state queue item status
    VERIFIED      the relevant claim was actually judged successfully  run.finishKind / finishSubject
    CONTINUABLE   policy permits subsequent work to begin              dependents unblock; supervisor starts next

Core hypothesis under attack: `status === 'done'` does not, by itself, establish authority to advance
the queue. The experiment determines whether the current system silently RECONSTRUCTS continuation
authority from termination.

## CONTRACT DISCOVERED FROM SOURCE (read, not assumed) - to be confirmed by execution

    agent.js ~5553   terminal statuses: done, error, stopped, refused_d2, stopped_d2_restored (+ interrupted,
                     awaiting_approval elsewhere). Records (trace, index) written here with finishKind.
    agent.js ~5611   `if (run.status === 'done' && !run.depth && run.queueItemId)` ->
                     workQueue.complete(id, { status: 'done', runId })   - finishKind is NOT passed
    queue.js :200    completeLocked stores status, runId, summary, finishedAt - NO finishKind
    queue.js :186    dequeueLocked: an item with `after` is eligible when completedIds includes it
    agent.js ~5733   completedQueueIds() = items whose status === 'done'  - finishKind never read
    agent.js ~5617   supervisor: `if (supervisorEnabled && run.status === 'done' && !run.depth)` -> dequeue,
                     then supervisorBrake (generation cap, auto-starts-per-hour cap) - finishKind never read
    agent.js ~5565   NON-done terminal statuses take the failure path: escalate() + failQueueItem(): item
                     marked with the run's status; ONE automatic retry only for a genuine 'error' that is a
                     machine failure; 'stopped' and 'interrupted' never retry; a retry of a retry stops the
                     chain and waits for a human.
    So, from source: continuation has exactly two gates - item status 'done' (for dependents) and run
    status 'done' (for the supervisor) - and both are TERMINATION facts. The only policy with CONTINUE /
    RETRY / HOLD / HALT distinctions lives on the FAILURE path, keyed on run.status and the failure cause.

## Finish kinds that can reach status 'done' (enumerated from the writers)

    kind                   route                                                 reachable in a probe?
    verified               finish gate passed the verifier                       yes (scripted write + finish)
    screen_checked         sawScreen stood in for the verifier (web)             needs a browser - UNMEASURED
    forced                 3 gate blocks, 4th finish steps aside                 yes (crashing file, finish x4)
    auto_clean_tests       test_web auto-finish, no gate at all                  needs a browser - UNMEASURED
    unverified-no-work     FG-3: refused once, second finish ends UNVERIFIED     yes (finish x2, no write)
    unverified             done without verified/sawScreen: the BOUNDED finish   yes (AGENT_BOUND_ROUTES=1 +
                           (CLOSED_UNDER_BOUNDING) or a swallowed evaluator throw   WORKER_EXEC=1; Docker)
    unknown kind           finishVerdict() writes only KNOWN values              UNREACHABLE from the writer
    no verdict             rows predating finishKind                             UNREACHABLE for a new run
    explicit verification  a blocked finish never reaches 'done' by itself;       takes the FAILURE path
    failure                the run ends 'stopped' (budget/loop) or forced          (characterized via 'forced')
    evaluator error        verify() throws -> caught -> finish proceeds ->        reachable only by fault
                           'unverified'                                            injection - UNMEASURED

## The decisive experiment (hold everything constant, vary only A's terminal semantics)

Real hub (testHarness startHub, fakemodel replies), AGENT_SUPERVISOR=1, approval 'build', unbounded except
the 'unverified' row. Two queue items via /agent/queue/chain: A (the varied goal), B after A. B's goal is a
check-and-report goal on a file A is asked to write (`cat /candidate/out.js`-style reading) so B's own
output shows what it observed of A's state.

    row  A ends as          A's queue item   B starts?   B observes A's file?   A's kind recoverable?
    C1   verified           (predict) done   yes         yes                    index row by item.runId
    C2   unverified-no-work (predict) done   yes         n/a (no file)          index row: unverified-no-work
    C3   forced             (predict) done   yes         yes (partial file)     index row: forced
    C4   unverified (bound) (predict) done   yes         yes                    index row: unverified
    C5   stopped (control:  (predict) stopped no         -                      item status stopped
         model stops itself / budget)
    C6   error (control: a  (predict) error  retry once  -                      repair item spliced
         genuine machine failure)            then halt

Prediction, from source: C1-C4 identical in every continuation observable. If so, the hypothesis is
confirmed: continuation authority is reconstructed from termination. C5/C6 are the anti-overrefusal and
contract controls: the failure path's distinctions must be observed as they are, not assumed.

Contamination rows (measured, not fixed here):
    X1  B observes state produced by an unverified A          (C2/C3/C4 "B observes" column)
    X2  can later success make A's outcome disappear? After B ends verified, is A's finishKind still in
        the index and trace, and does the queue item still carry runId -> that row? (reap cap = 40 runs;
        the run FILE may go, the index row must not)
    X3  chain label: /agent/queue (or list()) - does anything summarize the chain as successful? Record
        what each item shows: status and summary only (predicted: no kind anywhere on the item)
    X4  predecessor identity: item.runId -> index row -> finishKind + finishSubject (FG-5) - recoverable?

## Controls

    POSITIVE        C1 - a genuinely verified goal must still advance B under the ordinary workflow
    ANTI-OVERREFUSAL  no repair may be proposed that turns C2-C4 into a global halt unless the frozen contract
                    (to be written AFTER characterization) requires it
    ANTI-STRENGTHENING  C2-C4's records must still say what they are after B ran (X2)
    APPARATUS       each row's A kind is confirmed from A's index row BEFORE its continuation is read; a row
                    whose A did not end as intended is NOT_RUNNABLE, never a finding

## What this freeze does NOT do

It proposes no policy. After the characterization is sealed, a SEPARATE freeze states the contract
(outcome -> CONTINUE / RETRY / HOLD / HALT, preserving distinctions that exist), exact predictions,
falsifiers and success criteria; only then is the smallest repair made and the unchanged probe re-run.
New boundaries found on the way (X1-X4) are recorded, not fixed.
