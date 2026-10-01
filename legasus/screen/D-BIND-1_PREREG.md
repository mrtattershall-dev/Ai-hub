# D-BIND-1 — the evidence names the exact object that was judged

Frozen 2026-10-01 07:2x CDT, BEFORE evaluator.js changes and before the probe exists. D-ID, D-COPY and
D-CONS are closed (8a062953, ad850a15, 28b58d59). The COMMIT boundary (K8) stays red and is frozen
separately afterwards - never folded in here.

## The property (tatte, verbatim intent)

> Every authoritative receipt must identify the exact verdict.subject whose immutable snapshot produced
> that verdict. No identity may be recomputed, inferred from Git state, substituted from the live
> workspace, or inherited from another object downstream.

    receipt.subject === verdict.subject === C0
    NOT   receipt.subject === cid1(workspace now)
    NOT   receipt.candidateTree === HEAD^{tree}

D-CONS already established WHICH object the verdict belongs to. D-BIND TRANSPORTS that authority; it
reconstructs nothing.

## Where receipts are produced (read, not assumed)

    evaluator.js:133-135   the ONLY site that COMPUTES an identity: candidateTree = git rev-parse
                           HEAD^{tree}; refuses when there is no git tree. Since D-CONS it also sets
                           base.subject = C0 (cid1). The two can disagree - that is M19.
    acceptance.js:92,131,149   copy candidateVerdict.candidateTree / after.candidateTree  (TRANSPORT)
    batch.js:195           acceptedBaselineTree = survivingWorkspaceVerdict.candidateTree  (TRANSPORT)
    governance.js:124      startVerdict.candidateTree = startVerdict.candidateTree          (TRANSPORT)
    batch.js:281, governance.js:123   startTree = git rev-parse HEAD^{tree}  - NOT a verdict receipt:
                           it is the restore anchor (git reset --hard startRef). COMMIT boundary; out of scope.
    d2.js captureState / treeOf   d2's OWN refs for its own comparison - a separate mechanism; out of scope.

## The repair, frozen

1. evaluator.js: delete candidateTree() (the git call) and the "no git tree" refusal. The subject is
   computed ONCE at admission (already, since D-CONS) and the receipt is built from it:
       receipt.subject       = C0
       receipt.candidateTree = C0   DEPRECATED ALIAS, equal by construction, kept so transport sites
                                    and consumers (acceptance, batch, governance, mechanismAudit,
                                    autodiag1, bench1, testcmd1, pilot) carry the subject unchanged
   When cid1 refuses: subject = null, candidateTree = null, EVALUATION_ERROR. NEVER a git fallback.
   Git is no longer consulted by evaluate() at all.
2. acceptance.js: each of the three receipt objects additionally carries `subject`, copied from the
   verdict it summarises. Transport only - no cid1 call is added to acceptance.js.
3. Nothing else changes. batch.js's baselineTree keeps its name; its VALUE becomes the surviving
   verdict's subject by transport.

## Adversarial rows (frozen), with the predicted behaviour of the CURRENT code

    row  construction                                   required AFTER                    CURRENT predicts
    B0   ordinary PASS, own repo, committed             receipt.subject === verdict.subject === C0;   subject = C0 but
                                                        candidateTree === subject          candidateTree = git tree ≠ subject
    B1   D-PROP-1 REVERSED, inputs unchanged: commit C, receipt.subject names K (the bytes   receipt names C_tree -
         then uncommitted bytes K; the check prints      the check printed), ≠ identity of C  the tree never judged
         what it sees                                                                      (M19) - VIOLATION
    B1i  ignored file present, everything committed     receipt.subject includes it         receipt = HEAD tree,
                                                                                            excludes it - VIOLATION
    B2   D'-1 A5 REVERSED, inputs unchanged: identical   identical receipt.subject under P1  P1/P2: receipt = each
         no-.git candidate under parents P1, P2, P0, Pc  P2 P0 Pc; all admissible (PASS)     PARENT's tree; P0/Pc:
                                                                                            refused "no git tree"
    B3   identical working bytes, HEAD at X vs HEAD at Y receipt.subject identical          differs with HEAD
         (second commit touches nothing the snapshot
         sees: an empty commit; and HEAD moved by a .git-only change)
    B4   live candidate mutated AFTER the verdict        receipt.subject still C0; and       holds for the value;
                                                        cid1(live now) ≠ receipt.subject   demonstrates "not
                                                        (the receipt is about the JUDGED     workspace-now"
                                                        object)
    B5   subject UNAVAILABLE (lone surrogate + lookalike) EVALUATION_ERROR; receipt.subject   subject null BUT
         in a candidate that HAS a git repo with HEAD    null AND candidateTree null - no     candidateTree = git tree:
                                                        git fallback                         FALLBACK - VIOLATION
    B6   consumers: applyAcceptance then runBatch        candidateVerdict.subject ===        transported value is the
         (chain, t1 RETAIN)                              verdict.subject; survivingWorkspace- git tree, so baselineTree
                                                        Verdict.subject === the re-check's   ≠ cid1(baseline dir)
                                                        subject; baselineTree === that
                                                        subject === cid1(.accepted-baseline)
                                                        (D-COPY makes the last equality
                                                        possible)
    B7   D-CONSUME-1 finding 1 REVERSED: a batch whose   mechanismAudit labelDisagreements    1 (the recorded finding)
         t2 damages the protected file WITHOUT           = 0: RESTORED has treesEqual=false
         committing, then is RESTORED
    K8   mutation between verdict and acceptance commit  STILL RED: RETAIN of C1 with          red
                                                        receipt.subject = C0 ≠ cid1(live)

Must-fire: the CURRENT code must show B1, B1i, B2, B5 as VIOLATIONS and B7 = 1. Otherwise the probe is
not measuring the defect and the repair is not made.

## What the original probes do when re-run UNMODIFIED after the repair (recorded, not predicted)

    dprop1.probe.mjs   calls evaluate() and compares r.candidateTree with C_tree (git). Re-run after;
                       whatever it prints is recorded as-is. Its construction is ALSO row B1, where the
                       judgment is made under the frozen property.
    dprime1.probe.mjs  reproduces the git line VERBATIM and never calls evaluate(). It CANNOT reverse
                       by construction; its A5 construction is row B2. Not re-run as evidence.

## Consumer baseline (the tree at b96343d6, identical to D-CONS's AFTER run - no code changed since)

    evaluator 17/0  acceptance 27/0  batch 24/0  batchAcceptance 27/0  batchReport 18/0
    statusContract 29/0  enduranceRecovery 28/0  governedRun 24/0  d2Integration 46/2 (pre-existing,
    status naming)
PREDICTED CHANGES, frozen: exactly TWO assertions in evaluator.test.mjs encode the old receipt contract
and must be rewritten to the new one in the same commit -
    :50   "/^[0-9a-f]{40}$/.test(candidateTree)"  ->  candidateTree === subject, cid1-shaped
    :95-97 a repo-less candidate is REFUSED       ->  a repo-less candidate is JUDGED (availability)
Every other assertion in every file must be unchanged and green; d2Integration must show the same two
failures and no others. governedRun.test.mjs:104 ("both verdicts name different trees") must still
pass with cid1 values.

## Staged evidence required, in order

    BEFORE   probe on the shipped evaluator            MUST FIRE (B1, B1i, B2, B5; B7 = 1)
    REPAIR   evaluator.js + acceptance.js as frozen; the two test assertions rewritten
    AFTER    probe: B0-B7 as required; K8 STILL RED
    SUITE    cid1 mode: M19 GREEN; M17, M18 still green; identity rows hold
    PROBES   dprop1.probe.mjs re-run unmodified, output recorded
    CONSUMERS re-run; counts identical except as predicted above

## Explicitly NOT claimed

- K8 / the commit boundary: a correct receipt does not make the retained state the judged state.
- startTree / startRef (git) are untouched: the restore anchor is the commit boundary's business.
- d2's own tree ids are untouched.
- Historical receipts (journals, audits already on disk) are not rewritten; they name git trees and
  say so by their 40-hex shape. Readers can tell the two eras apart: cid1 subjects carry the "cid1:"
  prefix.
