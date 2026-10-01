# FG-5 RECEIPT — RESULT

Prereg `FG-5-RECEIPT_PREREG.md` @ b965558e; Amendment 1 (split 5a/5b, exact claims) @ f977e761; Amendment 2
(R1b prediction wrong) @ 1341c8e3. Probe `server/fg5.probe.mjs` @ 37a41cbd, byte-identical in every run.

Research question (tatte): can an outcome the finish gate explicitly refuses to verify acquire verified
semantics downstream through receipt / index / history transformation?
Invariant: a downstream consumer may not strengthen an upstream epistemic result.

## OBSERVED (BEFORE, EH1 2d82b379, sealed, verified)

    R1a  runIndex on finishKind 'unverified-no-work'      rendered 'ok'
    R1b  tochat on a no-work row with 1 block             skipped - "finish gate blocked 1x" (block count, not verdict)
    R1c  runIndex on an unknown finishKind                rendered 'ok'
    R1d  runIndex on 'verified' / absent                  'ok' / '?'
    R2   verify() result                                  no `judged`
    R4   a Verified hub finish                            note names the entry only; run has no finishSubject
    R5   its trace row and index row                      finishKind only
    R6   the FG-3 no-work finish, real writer -> real     writer stamped 'unverified-no-work'; reader rendered 'ok'
         index reader

The frozen falsifier fired as predicted (R1a, R1c, R2). Yes: an outcome the gate refused to verify was
rendered 'ok' by the index reader - the one record that outlives the run - and any kind the reader did
not recognise was rendered the same way. The corpus builder did NOT gain the row, but only because the
no-work route always carries one gate block, which its block-count filter catches before its verdict
filter runs.

## ESTABLISHED

The strengthening had exactly one production site: `runIndex.mjs:63` (`UNVERIFIED.has(kind) ? kind : 'ok'`)
plus the vocabulary it consults (`finishVerdicts.mjs`), which lacked the kind FG-3 introduced. No other
consumer negates UNVERIFIED or equates `done` with success for accounting: campaignReport reads the
evaluator's acceptance (a separate authority chain); rungoals carries finishKind through unchanged; the
experiment scripts pass it through; the client UI reads status only.

## REPAIRED

FG-5a (93eb8896) - files: server/finishVerdicts.mjs, server/runIndex.mjs
    UNVERIFIED gains 'unverified-no-work'; a KNOWN set lists every value finishVerdict() writes.
    verdictOf: a known kind renders as itself; an unknown kind renders as 'unknown' - never 'ok';
    the trend report counts and prints "(verdict not recognised)" beside "(no verdict recorded)".
FG-5b (this commit) - files: server/verifyProject.js, server/agent.js
    verify() returns judged { entry, files, id }: the scoped files actually swept and identityOf over
    exactly their bytes (cid1 encoding and domain over a SUBSET, labelled "cid1-over-files", never the
    workspace's cid1; a refused identity is null and said so; naming never changes a verdict).
    agent.js: run.finishSubject = v.judged; the Verified note carries
    `[entry <e>; <N> file(s); cid1-over-files <id>]`; saveTrace() and the index row carry finishSubject.

AFTER (probe unchanged):  5a EH1 0e1ed513 - R1a, R1c, R1d, R6 hold; R2-R5 red (5b's rows, as frozen).
                          5b EH1 1151b9ae - R2, R3, R4, R5 hold; R1a, R1c, R1d, R6 still hold.
    R4: the subject on the run equals an identity the probe computed INDEPENDENTLY over the same files.
    R6: the real writer and the real reader now agree: unverified-no-work.

Commands:  FG5_PHASE=before node server/fg5.probe.mjs   /   FG5_PHASE=after node server/fg5.probe.mjs

Consumers (repo root), baseline -> 5a -> 5b, all identical:
    tracesIsolation 6/0   finishGateEntry 5/0 (+3 known-open)   finishGateGoalEntry 4/0   finishGateHost 10/0
    gateSoundness 8/0   loadSweep 12/0   verifyExportsGoal 6/0   writeExportNote 6/0   goalScope 16/0   goalEntry 9/0

## UNCHANGED

What `status: 'done'` means (the run ENDED). tochat.mjs (see NOT CLAIMED). The evaluator's authority chain.
Historical rows: they gain no subject; an absent finishKind still reads '?' (predates the field).
The probe's own after-verdict prints `r1 false` in both after-runs because it folds R1b in; the probe
was not edited to match (Amendment 2).

## UNMEASURED

A Modal-side index (modal_rungoals.py carries finishKind; its readers were not run). Windows only.

## NEWLY DISCOVERED (recorded, not absorbed into FG-5)

1. CONTINUATION keys on status alone. agent.js:5604 completes the queue item (`workQueue.complete(..., { status:
   'done' })`) and :5617 lets the supervisor dequeue the NEXT goal when `run.status === 'done' && !run.depth`,
   with no finishKind read. An unverified-no-work finish, a forced finish and a test_web auto-finish all
   advance the queue exactly as a verified one does: COMPLETED ≠ CORRECT in the continuation path. A
   separate boundary with its own prereg.
2. tochat's skip ATTRIBUTION: the block-count filter precedes the verdict filter, so a no-work row is
   dropped for the wrong stated reason (Amendment 2). Dropped, so no strengthening; the reason is wrong.

## NOT CLAIMED

R1b (above). That the model reads the subject in the note. That the identity-over-files is the
workspace's cid1. ESCAPE, the symbol check and the loop guard: not started; the frozen FG-1 plan lists
them, and the standing instruction is to STOP and report after FG-5.
