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

## Amendment 1 - 2026-10-01 - the repair, split and its exact claims, frozen BEFORE implementation

BEFORE (EH1 2d82b379) fired as predicted: R1a and R1c read ok; R2 has no judged; R6 shows the real writer
stamping unverified-no-work and the real reader rendering ok. Research question (tatte): can an outcome
the gate refuses to verify acquire verified semantics downstream? Invariant: a downstream consumer may not
strengthen an upstream epistemic result.

The smallest production boundary responsible for the strengthening is runIndex.mjs verdictOf (line 63):
the ONLY site that maps an unrecognised finish kind to ok, plus its unverified count (line 80), with the
vocabulary in finishVerdicts.mjs lacking the kind FG-3 introduced. tochat.mjs consults the same vocabulary
and is repaired by the vocabulary alone (R1b). The subject-naming half (judged / finishSubject, rows
R2-R5) is a DIFFERENT mechanism (what the receipt names, not how strong it is read), so the step is split:

    FG-5a STRENGTHENING  finishVerdicts.mjs: UNVERIFIED gains unverified-no-work; a KNOWN set lists every
                         value finishVerdict() writes. runIndex.mjs: verdictOf -> the kind when known, the
                         literal unknown when not (never ok); the unverified count uses the same set; a new
                         unknown count is reported beside noVerdict so an unrecognised kind is VISIBLE, not
                         absorbed. tochat.mjs: unchanged (the vocabulary repairs R1b). No other file.
    FG-5b NAMING         as frozen at b965558e items 3-4 (verify() judged; agent.js note, run.finishSubject,
                         saveTrace and the index row). Built only after 5a has its AFTER run.

Exact claims for 5a, judged by the UNCHANGED probe: R1a, R1b, R1c, R1d, R6 HOLD; R2, R3, R4, R5 STILL RED
(they belong to 5b). The probe's after-verdict object will therefore print r2r3 false and r4r5 false after
5a - expected, and the probe is not edited for it. Consumers: tracesIsolation.test (6/0) and the nine gate
consumers, re-run after each half.

Not changed by either half: what status done means (a run ENDED), the hub UI, the evaluator's authority
chain (campaignReport reads accepted/disposition from acceptance, not finishKind), rungoals (it carries
finishKind through unchanged).

## Amendment 2 - 2026-10-01 - R1b did NOT hold under 5a; the prediction was wrong, recorded as such

Amendment 1 claimed "tochat.mjs: unchanged (the vocabulary repairs R1b)". AFTER 5a (EH1 0e1ed513) shows
R1b still "skipped by block count only". Cause, read from tochat.mjs:70-79: the block-count skip runs
BEFORE the verdict skip, and a no-work finish always carries exactly one block (FG-3 refuses once before
the UNVERIFIED end), so the verdict branch is never reached for this kind. The row IS dropped - the corpus
does not gain it - so this is a mis-ATTRIBUTION of the skip reason, not a strengthening, and it is NOT
repaired in FG-5: reordering tochat's checks is a change to a file this step froze as unchanged, and the
invariant under test (no downstream strengthening) is not violated by it. R1b stays red through FG-5 and
is reported NOT CLAIMED; the probe is not edited to match. The probe's r1 verdict will therefore print
false after 5b as well; R1a/R1c/R1d/R6 are the strengthening rows and they hold.
