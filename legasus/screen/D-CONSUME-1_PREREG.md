# D-CONSUME-1 — does ambient repository identity reach an authoritative output?

Frozen 2026-10-01, before the probe was written. D stays UNREPAIRED throughout. No Git-specific
patch to D is designed until this result exists (tatte, 2026-10-01: "A5 changed the problem").

## The frozen question

> Can changing ONLY the ambient repository identity, while holding candidate bytes and task
> inputs constant, change any downstream authoritative behavior?

## Why it is asked

D'-1 (be215f46) showed with A5 that `candidateTree()` (evaluator.js:58-63) reports an identity that
is a function of the ENCLOSING repository when the evaluated directory has no `.git` of its own.
It classified that PROVENANCE_RECEIPT_DEFECT **on a static regex over batch.js**, and stated that a
static scan cannot settle whether anything consumes the identity authoritatively. This experiment
replaces that static reading with execution.

## What the source reading predicts (a PREDICTION, recorded so it can fail)

Every production path found so far gives the evaluated directory its OWN repository before
identity is read: batch.js:273 (`git init` per task workspace), governance.js:92 (`git init` when
no `.git`), agent.js:6070 via `ensureRepo` (workspaceGit.js, already repaired for this class: it
once "landed every later commit on the hub's source tree"). Prediction: on production paths the
parent repository changes NOTHING, receipts included. The A5 leak is reachable only through callers
that `evaluate()` a directory with no `.git` (experiment scripts, e.g. inc1bRun.mjs:79 before its
:151 init, benchClassify.mjs:65, pilotEvalTerminal.mjs:44 - not yet checked for an init).

A static prediction does not close the question. Every arm below runs the shipped modules.

## Construction (A5, lifted onto real paths)

    candidate bytes        SAME
    task / checks / inputs SAME
    parent repository      P1 vs P2 (different content, different HEAD tree)
    everything the code under test receives is rooted INSIDE the parent

Noise floor: P1a vs P1b — two parents with IDENTICAL content. Any field that differs there is
nondeterminism, not context, and cannot carry a conclusion.

## Arms (shipped code, unmodified; only `runTask` - the model - is stubbed)

    B  BATCH       runBatch(chain:true), workspacesDir + auditDir + journal inside the parent.
                   t1 RETAIN (requested+protected pass), t2 RESTORED (deletes a protected file),
                   t3 RETAIN building on the t1 baseline. Then RESUME: runBatch again on the
                   same journal.
    G  GOVERNED    prepareGoverned -> (stub writes) -> concludeGoverned on a workspace inside the
                   parent that starts with NO .git (the production first-run state).
    D  D2          ensureRepo -> captureState(start) -> observeTargets -> stub writes ->
                   captureState(candidate) -> treeOf(start) check -> evaluateD2, inside the parent.
    E  EVALUATE    evaluate() DIRECTLY on a directory with no own .git (the A5 shape, the
                   non-production callers). Parents: P1, P2, P1a/P1b, P0 = no enclosing repo,
                   Pc = commitless enclosing repo.
    M  EVIDENCE    mechanismAudit.mjs (CLI, unmodified) over a campaign root assembled from arm B's
                   own results under each parent: does its labelAgrees / labelDisagreements change?

## Observables, declared now

AUTHORITATIVE (decides, licenses, advances, or is reported as a finding):
verdict (and requested/protected verdicts), disposition, state, termination, promotable,
countsAsCompletion, halt/halted, BYTES of the accepted baseline after each task, BYTES each next
task starts from, final workspace BYTES, resume actions, governed ok/reason/disposition/
workspaceRestored, d2 violated/invalid, mechanismAudit treesEqual/labelAgrees/labelDisagreements.

RECEIPT (records, does not decide): candidateTree, survivingTree, baselineTree, startTree.

MASKED before comparison, and only these: ISO timestamps, the parent's absolute path, attempt/run
ids, commit SHAs (they embed time; TREE ids are kept, they are the subject).

## Classification (frozen)

    Controls fail                                          -> NOT_EVALUATED, nothing concluded
    Noise floor shows a difference in a field              -> that field excluded, stated
    B/G/D/M authoritative identical, receipts identical    -> NOT REACHABLE ON PRODUCTION PATHS
    authoritative identical, receipts differ               -> PROVENANCE_RECEIPT_DEFECT supported
    verdict/acceptance/replay/authorization differs        -> AUTHORITY-AFFECTING, sub-classed:
        MISBINDING    the wrong identity is USED to license or refuse
        AVAILABILITY  context makes an identity exist or not, and the fail-closed path decides
    mechanismAudit output differs                          -> EVIDENCE_BINDING_DEFECT
    nothing consumes it authoritatively                    -> D repair may be scoped to identity/provenance

Arm E is reported SEPARATELY from B/G/D: it is reachable only through non-production callers, and
a difference there must not be reported as a production authority defect. Whether those callers
produced RECORDED evidence (e.g. INC-1B's checkOnDisk) is a follow-up, named, not assumed.

## Controls (must hold or the run is NOT_EVALUATED)

    READINESS     the digest-pinned worker runs; a trivially passing check returns PASS
    MUST-FIRE     same parent, DIFFERENT candidate bytes (t1 subject fails its check):
                  the authoritative comparison MUST report a difference
    MUST-NOT-FIRE P1a vs P1b, identical content: authoritative fields identical

## Not tested, stated

The full agent loop (agent.js drive()) is not executed - arm D drives the same d2.js functions the
agent calls, with ensureRepo, but not the HTTP/model loop around them. Historical-evidence
contamination (re-auditing past campaign roots) is not attempted here.
