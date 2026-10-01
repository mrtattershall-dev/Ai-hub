# COMMIT-1 — the terminal-state authority boundary, frozen before any repair

Frozen 2026-10-01 after D-BIND (e268036f) and before any edit to acceptance.js, batch.js or
governance.js. K8 is red by design in D-CONS-1_RESULT and D-BIND-1_RESULT; both hand this boundary
off as "next, independently". Claim 6b655812. Nothing is repaired in this step.

## Why the boundary is the whole transaction, not applyAcceptance

K8 currently manifests in applyAcceptance. Scoping the property to RETAIN would let that function be
proved correct while batch.js or concludeGoverned later persists different bytes - the exact class
of mistake the D-series keeps uncovering: local correctness without end-to-end identity continuity.

So the property belongs to EVERY transition that turns provisional bytes into authoritative bytes.

## THE PROPERTY

> **Every state that becomes authoritative must carry an authorization for that exact identity.
> An accepting verdict authorizes only `verdict.subject`; rejection or restoration preserves the
> previously authoritative identity. If equality cannot be established at the point state becomes
> authoritative, the transition fails closed.**

In the symbols D-CONS fixed (C0 = cid1(workspace) at judgment = verdict.subject):

    C0 = verdict.subject
    at every authoritative transition, with S = the exact state about to become authoritative:
        cid1(S) == C0      -> authority may pass
        cid1(S) != C0      -> MUST NOT become authoritative under C0's verdict
        cid1(S) unavailable -> MUST NOT become authoritative (fail closed)

The second clause is deliberate. "Every terminal state must equal verdict.subject" is WRONG: a
rejected candidate must not survive. What needs continuity is AUTHORITY, and on the rejection side
the authorized identity is the previously authoritative one, not the failed proposal's.

## What this is NOT, so it cannot be confused with its neighbours

    D-CONS   continuous immutability of the JUDGED object across the judgment interval.
    COMMIT   identity EQUALITY at the AUTHORITATIVE transition.

They answer differently on the ABA case (below). D-CONS refuses a judgment whose object moved
mid-interval even if it returns; COMMIT permits a commit whose state really is C0 again, because
the verdict is about an immutable snapshot of C0 and it does not matter that the mutable staging
workspace wandered in between - PROVIDED equality is established at the transition.

    D-COPY   the copy preserves whatever it copies: cid1(ws) === cid1(baseline).
             This is NOT a binding to C0. If ws has drifted to C1, D-COPY faithfully preserves C1.
             batch.js:193's comment "cid1(ws) === cid1(baseline)" therefore does NOT close K8 at
             the baseline transition, and must not be read as if it did.

## The transitions, each named to its code site

    #   transition                                  site                                  required invariant
    T1  evaluator -> applyAcceptance RETAIN          acceptance.js PROTECTED-PASSED block   retained workspace identity == verdict.subject
                                                    (`after = evaluate(ws)` then RETAIN on
                                                    `req === PASS` from the ORIGINAL verdict;
                                                    after.subject recorded, never compared)
    T2  RETAIN -> accepted baseline                  batch.js finalise, cpSync(ws, baseline)  baseline identity == the retained subject
    T3  accepted baseline -> next task's start       batch.js task start, cpSync(baseline,ws) start identity == the accepted baseline identity
                                                    then git init/commit -> startRef
    T4  governed conclusion -> surviving state       governance.js concludeGoverned ->       surviving state identity == authorized subject
                                                    applyAcceptance(workspace, ..., g.startRef)
    T5  RESTORE                                      acceptance.js PROTECTED-FAILED block    restored state identity == PREVIOUSLY authoritative
                                                    git reset --hard startRef; clean -fd;    identity, NOT the failed proposal's subject
                                                    bytesIdentical(ws, startRef)
    T6  refusal / error (HELD, PRESERVE_INCOMPLETE,  acceptance.js                            NO new authoritative identity established.
        RESTORE_FAILED, EVALUATION_ERROR)                                                     promotable stays false; baseline does not move.

### T5's anchor, measured not assumed

The "previously authoritative identity" must itself be a cid1, or T5 is checked against git's idea of
the start rather than the start.

    governed path   prepareGoverned runs evaluate(workspace) on the start state. Since D-BIND that
                    verdict carries subject = cid1(start); it is transported as
                    startVerdict.candidateTree (the deprecated alias, equal to subject by
                    construction). So a cid1 of START EXISTS and T5 is MEASURABLE there.
    batch path      task start is git-only (batch.js: init, add -A, commit, rev-parse). There is NO
                    cid1 of START in this path. T5 cannot be checked against a cid1 here, and
                    bytesIdentical(ws, startRef) checks against a git ref whose content was itself
                    produced by T3. If T2/T3 drifted, the restore anchor drifted with them.
                    RECORDED AS A GAP. Not repaired here.

## THE MUST-FIRE COUNTEREXAMPLE: K8, reused verbatim from dbind1.probe.mjs:136-141

    judge C0 -> PASS(C0) -> receipt.subject = C0
    mutate the live workspace -> C1
    applyAcceptance(ws, task, verdict-of-C0, { startRef })
    BEFORE REPAIR:  disposition RETAIN, cid1(ws).id !== verdict.subject    <- authorized(C0), retained(C1)
    AFTER REPAIR:   that transition must be impossible

If K8 does not fire unrepaired, the probe is broken, not the system, and the result is NOT_EVALUATED.

## THE ABA CASE, which must SUCCEED after repair

    judge C0 -> PASS(C0)
    mutate -> C1
    restore -> C0 (bytes identical to the judged snapshot)
    applyAcceptance
    EXPECTED after repair: RETAIN is permitted, because the state becoming authoritative IS C0.

This is the row that separates COMMIT from D-CONS. A repair that refuses ABA has implemented
immutability-at-the-boundary, not identity-equality, and would reject legitimate commits. It is as
much a failure as K8 surviving.

## Each hand-off attacked separately

    C0 judged -> receipt C0 -> workspace C0 [mutate here]      -> RETAIN            (T1)
                            -> accepted baseline [mutate/copy wrong here]            (T2)
                            -> next task start [substitute here]                     (T3)
                            -> governed surviving state [substitute here]            (T4)
                            -> RESTORE [restore to the proposal, not the start]      (T5)

If any arrow can turn C0 into Cx while carrying C0's authority, the property fires at that arrow -
and the result names the ARROW, never "the commit boundary" as one thing.

## Outcome classification, fixed before running

    per transition:
      HOLDS            authority transfers only to an identity equal to the authorized one
      FIRES            an identity != the authorized one became authoritative under its verdict
      FAILS_OPEN       identity unavailable and the transition proceeded anyway
      UNMEASURABLE     no cid1 exists for the required anchor (batch-path T5)
      NOT_EVALUATED    the apparatus did not reach the transition (must-fire did not fire, etc.)
    ABA:
      PERMITTED        correct
      REFUSED          over-refusal: immutability implemented where equality was required

## Predictions, frozen

    unrepaired   T1 FIRES (K8)   T2 FIRES (baseline = live bytes)   T3 FIRES-by-inheritance
                 T4 FIRES (same applyAcceptance via concludeGoverned)
                 T5 governed: HOLDS or FIRES - NO PREDICTION (bytesIdentical is a real byte check,
                    but against a git ref; whether that ref equals cid1(start) is what the arm measures)
                 T5 batch: UNMEASURABLE
                 T6 HOLDS (promotable=false on every non-RETAIN path - predicted, must be shown)
                 ABA: PERMITTED trivially, because nothing checks (so ABA is only informative AFTER repair)

## Rules

    - NO REPAIR in this step. acceptance.js, batch.js, governance.js, evaluator.js untouched.
    - every arm through EH1, ORIGINAL class, sealed. A crashed arm is INCOMPLETE, never absent.
    - the K8 must-fire runs FIRST; if it does not fire, stop and report NOT_EVALUATED.
    - repair, when it comes, is written against THE PROPERTY, and the regression must fail
      unrepaired on every transition it covers - a transition the unrepaired code already passes
      proves nothing about the repair.
    - the repair must leave ABA PERMITTED. A green K8 with a refused ABA is not accepted.
