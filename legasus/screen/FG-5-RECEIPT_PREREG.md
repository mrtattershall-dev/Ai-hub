# FG-5 RECEIPT — the hub's `Verified` note names what was judged, and the records agree

Frozen 2026-10-01, before any of agent.js, verifyProject.js, finishVerdicts.mjs, runIndex.mjs or
training-data/factory/tochat.mjs change for this step. Repairs FG-1 row F5 and closes the loop FG-3 opened
in the records. The D-BIND discipline applied to the hub's own receipt.

## The property

> A `Verified` finish names the subject it is about - the entry judged, the scoped files, and a
> content identity over exactly those files - on the run, in the trace record and in the run index.
> Every record consumer reads the SAME finish vocabulary, treats an unknown value as NOT clean, and
> `unverified-no-work` is in that vocabulary.

## Read, not assumed (the records today)

    agent.js finishVerdict()  returns run.finishKind if set, else verified / screen_checked / unverified / not_finished
    agent.js saveTrace()      writes finishKind: finishVerdict(run) at the top level of each trace row
    agent.js ~3710            the run-index row carries finishKind the same way
    finishVerdicts.mjs        UNVERIFIED = {forced, auto_clean_tests, unverified}. Its own comment: "a value a
                              reader does not recognise is NOT treated as clean"
    runIndex.mjs:63           verdictOf = finishKind ? (UNVERIFIED.has(k) ? k : 'ok') : '?'  -> an UNKNOWN kind
                              reads as 'ok'. That violates the comment one import away. FG-3's
                              'unverified-no-work' therefore indexes as clean today.
    tochat.mjs:70             skips rows with finishBlocks > 0 or forcedFinish. A no-work finish has one block, so
                              it is skipped - by the block COUNT, not by its verdict. The vocabulary import
                              (UNVERIFIED) exists there; whether it is consulted for the kind is checked by row R1b.
    The Verified note today   "Verified (node): all N source file(s) pass a syntax check (this goal's scope); ..."
                              - names the entry inside the evidence prose and a COUNT of files; no identity.

## The mechanism (frozen)

    1  finishVerdicts.mjs  UNVERIFIED gains 'unverified-no-work'; a new KNOWN set lists every value
                           finishVerdict() can write. Data only, as before.
    2  runIndex.mjs        verdictOf: known-and-not-unverified -> the kind; unverified -> the kind;
                           UNKNOWN -> 'unknown' (never 'ok'); absent -> '?' as today.
    3  verifyProject.verify returns `judged: { entry, files, id }` - files = the scoped set actually swept
                           (whole workspace when the goal names nothing, bounded like the sweeps),
                           id = identityOf(entries over those files, exact bytes) from cid1.mjs - the
                           cid1 encoding and domain, over a SUBSET, so it is labelled "cid1 over N files"
                           and never presented as the workspace's cid1. A refused identity -> id null,
                           stated in the note; it does not block (RECEIPT does not change verdicts).
    4  agent.js branch 4   on Verified: run.finishSubject = v.judged; the note becomes
                           `Verified (kind) [entry <e>; <N> file(s); cid1-over-files <id12>]: <evidence>`
                           saveTrace() and the index row carry finishSubject alongside finishKind.

## Rows (frozen), with the CURRENT tree's predicted behaviour

    row  construction                                               current                    required
    R1a  runIndex.verdictOf({finishKind:'unverified-no-work'})       'ok'                       'unverified-no-work'
    R1b  tochat on a trace row with finishKind 'unverified-no-work'   skipped (by block count)    skipped, and the skip
         and finishBlocks 1                                                                     reason names the verdict
    R1c  runIndex.verdictOf({finishKind:'something-new'})            'ok'                       'unknown'
    R1d  verdictOf({finishKind:'verified'}) / absent                 'ok' / '?'                 'verified' / '?' (unchanged)
    R2   verify() on the F6+ workspace, goal names s1_library.js     no `judged`                judged.entry = s1_library.js,
                                                                                               judged.files = the scoped set,
                                                                                               judged.id starts "cid1:"
    R3   same, after changing one byte of s1_library.js              -                          judged.id differs (fidelity)
    R4   hub: scripted model writes s1_library.js and finishes        note names entry + count   note carries entry, N files,
                                                                                               cid1-over-files; run.finishSubject
                                                                                               present; its id === the probe's own
                                                                                               identityOf over the same files
    R5   hub: trace row and index row for R4's run                    finishKind only            finishKind AND finishSubject
    R6   hub: the FG-3 A5 run (no-work finish)                        finishKind 'unverified-    index verdict 'unverified-no-work'
                                                                      no-work'; index 'ok'       (R1a through the real writer)
    A6/A7/S6, F2/F3 controls                                                                    unchanged verdicts

Must-fire: R1a and R1c ('ok' for the unknown) must reproduce on the current tree, and R2 must show no
`judged`.

## Consumers

The nine gate consumers (FG-4 baseline) plus every test importing runIndex.mjs, finishVerdicts.mjs or
training-data/factory/tochat.mjs (listed with counts in the result, baselined BEFORE the change).

## Not claimed

That the identity-over-files is the workspace's cid1 (it is not; it names the judged subset, which is
the point). That historical rows gain a subject (they do not; absent means predates). That the note's
text is read by the model in any useful way - a campaign question.

## Consumer baseline, recorded BEFORE any change

    tracesIsolation.test.mjs 6/0 - the only test importing runIndex.mjs, finishVerdicts.mjs or tochat.mjs
    plus the nine gate consumers at their FG-4 counts
