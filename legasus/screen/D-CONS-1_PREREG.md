# D-CONS-1 — the judged state stays the same state for the whole judgment

Frozen 2026-10-01, BEFORE evaluator.js changes and before any D-CONS probe exists. D-COPY is closed
(ad850a15). D-BIND (what the RECEIPT names) and the COMMIT boundary are NOT in scope and stay red.

## The question (tatte)

    D-COPY  Did we construct the state we intended to judge?        (closed)
    D-CONS  Did that state remain the same state for the entire judgment?

## WHICH CLAIM - frozen before M18's behaviour under any repair is seen

Two different claims (tatte):
    ENDPOINT STABILITY   cid1(live before) === cid1(live after)
    IMMUTABLE JUDGMENT   the evaluator judged ONE immutable object throughout evaluation

**This experiment tests IMMUTABLE JUDGMENT.** Endpoint stability on the live workspace cannot see
mutate -> restore: a check can read transient bytes while both endpoints agree. No detector closes
that; CONSTRUCTION does. So the mechanism under test is:

    1  C0 = cid1(workspace)                      refused -> EVALUATION_ERROR, no subject
    2  construct a PRIVATE snapshot of the workspace with the D-COPY rule (shared predicate), and
       require cid1(snapshot) === C0             else EVALUATION_ERROR (copy raced a writer)
    3  mount the SNAPSHOT read-only at /candidate - never the live workspace
    4  run the checks
    5  S1 = cid1(snapshot)   (the judged object; must still be C0)
       C1 = cid1(workspace)  (the live object the caller will act on)
    6  verdict.subject = C0. The verdict AUTHORIZES only if S1 === C0 AND C1 === C0. Otherwise the
       overall verdict is EVALUATION_ERROR - "a judgment of C0 cannot authorize C1" - and the checks'
       own results are kept as an audit record about C0, explicitly non-authorizing.

The endpoint comparison (C1 vs C0) is kept, but as the HAND-OFF guard: the caller acts on the live
workspace, so a verdict about C0 must not reach a workspace that is no longer C0.

Side effect, stated: the judged object no longer contains `.git`. D-ID-1 listed "a check CAN read
/candidate/.git" as a blind spot of the identity; judging the snapshot makes the judged object and
the identity's object the same thing. Checks that depended on /candidate/.git will break - the
consumer regression is where that shows.

## The property (tatte, verbatim intent)

> A verdict may authorize downstream state only when the exact candidate identity named at
> evaluation admission is still the candidate identity present when evaluation completes.
>     verdict.subject = C0;   C1 != verdict.subject  =>  the verdict cannot authorize C1

## Adversarial rows (frozen), with what the CURRENT evaluator is predicted to do

    row  mutation (host, during the check unless stated)      required             current predicts
    K0   none                                                  admissible, subj=C0  PASS (no subject)
    K1   a file's bytes change                                 NOT authorizing      PASS, check saw new bytes
    K2   a file is added                                       NOT authorizing      PASS
    K3   a file is removed                                     NOT authorizing      PASS (or check FAIL)
    K4   rename, bytes equivalent (cid1 distinguishes)         NOT authorizing      PASS
    K5   mutate -> RESTORE before the post-check               admissible; the check   PASS, and the check
         (the check reads the file twice, seconds apart)       saw ONLY C0's bytes     SAW THE TRANSIENT BYTES
    K6   the check tries to write /candidate                   write fails; subject    write fails already
                                                               unchanged               (mount is read-only)
    K7   mutation, then the check times out / crashes          no authoritative     EVALUATION_ERROR already
                                                               verdict (EVAL_ERROR)  (timeout path)
    K8   mutation AFTER evaluate() returns, before acceptance  D-CONS does NOT catch  RETAIN of the mutated
         commits (the next boundary)                           this - MUST STAY RED   workspace
    Evaluator-created artifacts: checks can write only to /scratch (tmpfs), which is outside the
    identity by construction; K6 shows /candidate is not writable. No other artifact path exists.

Must-fire: the UNREPAIRED evaluator must authorize at least one of K1-K4 and must let K5's check
observe transient bytes. If not, the mechanism is not built.

## Staged evidence required

    BEFORE  probe K0-K8 on the shipped evaluator           MUST FIRE (K1-K5)
    REPAIR  evaluator.js: steps 1-6 above
    AFTER   probe: K0 admissible with subject; K1-K4 NOT authorizing; K5 admissible AND the check saw
            only C0's bytes; K6/K7 unchanged; K8 STILL RED (the commit boundary)
    SUITE   cid1 mode: M18 GREEN; M17 still green; M19 STILL RED (D-BIND); identity rows hold
    CONSUMERS  baselined BEFORE the change: evaluator, acceptance, batch, batchAcceptance,
            batchReport, statusContract, enduranceRecovery, governedRun, d2Integration (repo root)

## Explicitly NOT claimed

- That C0 === C1 proves the thing later COMMITTED is C0 (K8 - verdict -> identity -> commit binding
  is the next boundary).
- That the RECEIPT names the subject (M19 - D-BIND). candidateTree stays HEAD^{tree} in this step.
- Atomicity of step 2 against a hostile host writer: a write racing the copy is caught by
  cid1(snapshot) != C0 OR by C1 != C0 unless it lands and reverts entirely inside the copy window -
  the same traversal limit recorded in D-ID-1 A1, now confined to the copy rather than the judgment.
- Protection of the private snapshot from a privileged host process; it is unreferenced by any agent
  path, and S1 re-checks it.

## Consumer baseline, recorded BEFORE evaluator.js changes (repo root)

    evaluator 17/0  acceptance 27/0  batch 24/0  batchAcceptance 27/0  batchReport 18/0
    statusContract 29/0  enduranceRecovery 28/0  governedRun 24/0
    d2Integration 46 passed, 2 FAILED - PRE-EXISTING, before any D-CONS change:
      FAIL  ARM A kept ordinary hub status 'done' (got stopped)
      FAIL  ARM B status 'refused_d2' (got stopped_d2_restored)
    Status-naming expectations in the d2 arms, not evaluator behaviour. Neither credited nor blamed here;
    the AFTER run must show the same two and no others.
