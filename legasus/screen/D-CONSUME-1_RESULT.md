# D-CONSUME-1 — RESULT

Prereg: `D-CONSUME-1_PREREG.md` @ 582f3ef2, frozen before the probe existed. D UNREPAIRED.
Probe: `server/dconsume1.probe.mjs`. Evidence: `legasus/evidence-runs/`, two EH1 runs, both SEALED.

    run 1  67cea7eb  NOT_EVALUATED - apparatus fault (mine), preserved, carries no conclusion
    run 2  22bd589b  VALID - every control held; the result below is this run

## Answer to the frozen question

> Can changing only the ambient repository identity, holding candidate bytes and task inputs
> constant, change any downstream authoritative behavior?

**On the production paths executed: NO - and the receipts do not change either.**
**In the no-`.git` shape: YES, through AVAILABILITY, not misbinding.**

    arm                          P1 vs P2: authoritative / receipt
    B  batch (+ resume)          0 / 0
    G  governed run              0 / 0
    D  d2 functions              0 / 0
    M  mechanismAudit (evidence) 0 / 0
    E  evaluate(), no own .git   0 / 1    candidateTree = the PARENT's tree (b5adeeec vs 6c872d36)
       P1 vs P0 (no repo)        4 / 1    PASS -> EVALUATION_ERROR
       P1 vs Pc (commitless)     4 / 1    PASS -> EVALUATION_ERROR

Classification from the frozen table:
- Production paths (B/G/D) and the evidence consumer (M): **NOT REACHABLE ON PRODUCTION PATHS.**
  The source prediction held: each path gives the evaluated directory its own repository before
  identity is read, so the parent is shadowed.
- No-`.git` shape (E): **AUTHORITY-AFFECTING, sub-class AVAILABILITY.** Between two parents with
  commits, only the receipt moves (A5 reproduced dynamically; PROVENANCE_RECEIPT_DEFECT supported).
  Between a parent with commits and no/commitless parent, the VERDICT moves: identical candidate,
  PASS in one context and EVALUATION_ERROR in the other. The fail-closed branch decides; the wrong
  identity is never USED to license anything, so MISBINDING is not demonstrated.

Per the frozen consequence row: nothing on a production path consumes the context-derived identity
authoritatively, so **the D repair may be scoped to identity/provenance** - with one obligation
added by arm E: the replacement identity must exist for every candidate, or it inherits the
AVAILABILITY dependence (judgeability decided by where the candidate sits).

## Controls

    READINESS      evaluate() on a passing candidate with its own repo -> PASS
    MUST-NOT-FIRE  P1a vs P1b (identical parents) -> 0 / 0 / 0. No noise-floor fields.
    MUST-FIRE      P1 vs POS (different candidate bytes) -> 122 authoritative differences

## Two findings outside the frozen question, both about CONTENT identity, not context

**1. D-PROP-1's defect reaches an evidence consumer.** Arm M, under every parent: t2 is a correct
restore (protected FAIL, reset, recheck PASS, bytes identical to start), yet mechanismAudit reports
`treesEqual=true, labelAgrees=false` - a published "label disagreement" for a restore that worked.
Cause: `candidateTree` is `HEAD^{tree}`, and the stubbed model never commits, so the damaged
candidate and the restored workspace carry the same recorded identity.
Scope, checked against real records: MECH-1, OVERNIGHT-1 and PILOT-1 audits (192 units) show **0**
label disagreements; all 24 RESTORED units have `treesEqual=false`. The real agent auto-commits
destructive steps, so HEAD was the candidate. The defect is reachable whenever a candidate goes
uncommitted (a failed auto-commit, a stale index.lock - set D had one for the whole run); no
published audit was affected.

**2. The baseline copy is not identity-preserving (source observation, NOT yet executed).**
batch.js:189 and :269 filter with `!src.includes(sep + '.git')` - a SUBSTRING match. It drops
`.git`, and also `.gitignore`, `.gitattributes` and everything under `.github/`. A candidate holding
any of these is evaluated with them and advanced without them. Untested here; D-ID-1 carries it as
a metamorphic case.

## Apparatus faults, both mine, both caught before a conclusion

1. Run 1's READINESS evaluated a repo-free directory - the one shape evaluate() refuses by design -
   so readiness could never hold and run 1 classified itself NOT_EVALUATED. Preserved, not deleted.
2. Run 1 read arm G's verdict from `.verdict`; acceptance.js names it `.overall`, so G's verdicts
   read null. Dispositions were read correctly. Fixed for run 2.

## Not established

- The full agent loop: arm D drives the d2.js functions agent.js calls, with ensureRepo, not the
  HTTP/model loop around them.
- Stubbed model: runTask writes bytes and never commits; the real agent auto-commits. This is why
  finding 1 appears here and not in the real audits.
- One parent pair of each type, one machine (Windows), one worker image digest.
- Historical evidence contamination was not re-audited beyond the three mechanism audits named.
- Non-production evaluate() callers checked by source: inc1bRun (own repo, committed before every
  check - INC-1B verdicts unaffected), pilotEvalTerminal (preserved copies carry .git), benchClassify
  (agent workspace, ensureRepo) - read, not executed.

## The pattern this joins (recorded, not promoted to a law)

    A  reported: find            actual: inspection authority survived mutating semantics
    B  reported: path resolution actual: writes escaped physical containment
    D  reported: wrong Git tree  actual: candidate identity is a function of ambient context

Three times, repairing the reported mechanism would have produced a reasonable-looking patch that
left the violated property intact. Here: recording `write-tree` instead of `HEAD^{tree}` passes
D-PROP-1 and still fails A5; and this run shows the A5 dependence was never on a production path
while two CONTENT-identity defects (findings 1 and 2) are. Counterexamples are generalized into
invariants before repairs are designed.
