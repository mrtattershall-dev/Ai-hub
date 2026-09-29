# P6 PREREGISTRATION — does previously granted authority remain valid over time?

Frozen before implementation. This commit contains nothing else. Step 6 is closed at `89c0faae` and
nothing here revises it.

## 0. WHY THIS IS A DIFFERENT QUESTION

Steps 5 and 6 both established continuity properties, and neither touched validity:

    Step 5   queue_task   parent authority        -> attenuated descendant authority
    Step 6   repair       failed-work authority   -> derived continuation authority
    both                  no new authority is created by the continuation mechanism

Step 6's R6 destroyed the source and the system refused with `SOURCE_ITEM_GONE`. That established
**source existence is required**. It did not establish that an existing source is still *entitled* to
authorize anything.

The hostile world, which practically writes itself:

    OWNER grants {a}
      -> F receives {a}
      -> F fails
      -> repair created, continuationOf F
      -> THE ORIGINAL AUTHORITY BECOMES INVALID
      -> F REMAINS PRESENT, carrying its historical {a}
      -> repair begins

Step 6 answers this with "source exists, therefore derive {a}". **P6 asks whether that is legitimate.**

## 1. THE PROPOSITION

> **Authority that was validly granted must not remain usable after what entitled it has ceased to be
> valid — and a continuation must not silently detach from what justified it.**

## 2. THE FIRST CONTROL, BEFORE ANY WORLD: IS INVALIDITY EVEN REPRESENTABLE?

This is preregistered as step one because the last two frozen worlds were vacuous by construction (W6
at `spawn_subtask`, R7 at repair depth) and both were discovered by asking reachability first.

Measured on this branch, before writing anything:

    E1  revision binding        IMPLEMENTED in governed-edit.mjs, but fires ONLY when the authority
                                pins a revision. `issueWriteScope` builds
                                `context: { repository, implementation }` and pins NONE. So E1 can
                                never fire for any authority this slice issues.
    E4  single use              NOT IMPLEMENTED (governed-edit.mjs header)
    E5  allowance               NOT IMPLEMENTED
    E6  expiry                  NOT IMPLEMENTED
    E7  ancestor revocation     NOT IMPLEMENTED
    E8  re-delegation policy     NOT IMPLEMENTED
    explicit revocation         NO MECHANISM ANYWHERE. Nothing in the hub or the calculus marks a
                                grant, a crossing record, or a work item as revoked.

**So the honest starting position is: there is currently no way for an authority in this system to
BECOME invalid.** P6's proposition is therefore not merely unproven, it is presently
**unrepresentable**, and the first result of P6 is that statement rather than a pass or a fail.

That has a consequence worth freezing now, because it will be tempting to skip: **P6 cannot be tested
without introducing a representation of invalidity, and choosing that representation is the
substance of the experiment, not a preliminary.** Whatever is introduced must be forced by the hostile
world rather than selected because it resembles machinery that exists elsewhere.

## 3. CANDIDATE REPRESENTATIONS — enumerated, none chosen

    (a) EXPLICIT REVOCATION        the owner marks a grant or a work item revoked; resolution refuses
        cheapest; answers the stated world directly; says nothing about WHY it was revoked
    (b) REVISION BINDING (E1)      already implemented but unreachable - make `issueWriteScope` pin the
                                   target's revision, so an authority dies when the bytes move
        reuses existing code; but it conflates "the file changed" with "the permission lapsed", and a
        repair exists precisely BECAUSE work was left half-done, so the bytes probably HAVE moved
    (c) EXPIRY (E6)                a grant carries a deadline
        bounds staleness without naming a cause; a long-queued legitimate repair dies for no reason
        related to entitlement
    (d) ANCESTOR REVOCATION (E7)   invalidating a grant invalidates everything derived from it
        the strongest shape, and the one that matches the delegation chain already recorded in
        `ancestry`; also the most machinery
    (e) EVIDENTIAL STALENESS       the authority rested on an assumption that no longer holds
        this is where the other session's ancestry/staleness work would meet this one - and it is
        deliberately NOT preferred here. It is listed because the world may force it, not because the
        diagram suggests it

Option (b) deserves the sharpest warning, because it is the cheapest to reach and would be the easiest
mistake: **a repair's whole reason for existing is that earlier work failed part-way**, so binding
repair authority to unchanged bytes would likely refuse every legitimate repair. If (b) is adopted it
needs a positive control proving a legitimate repair still proceeds.

## 4. THE FROZEN WORLDS

Expected column states what the PROPOSITION requires, not a prediction about any implementation.

    #   situation                                          proposition requires          tests
    ──────────────────────────────────────────────────────────────────────────────────────────────
    Q1  source exists; its authority is INVALIDATED;       REFUSED                       validity
        repair begins and writes within the old scope
    Q2  source exists; authority NOT invalidated;          ALLOWED                       specificity
        same write                                                                       (mandatory)
    Q3  authority invalidated AFTER the repair installed   REFUSED at the write, or the   E9-adjacent
        it but BEFORE the write                            window is stated as open
    Q4  an ANCESTOR grant is invalidated, not the leaf     REFUSED                       E7 shape
    Q5  a queue_task descendant (not a repair) whose       REFUSED                       generality -
        parent authority was invalidated                                                 not repair-
                                                                                         specific
    Q6  a forged "un-revocation" in model output           REFUSED                       P1 again
    ──────────────────────────────────────────────────────────────────────────────────────────────

**Q2 is mandatory.** Without it, marking everything invalid satisfies Q1, Q3, Q4, Q5 and Q6, which is
the refuse-everything shape this project has shipped before.

**Q3 is expected to be the hard one**, and `governed-edit.mjs` already says why: it "resolves once,
checks the CURRENT revision, and writes immediately — which narrows the window and does NOT close it.
Nothing here is a race proof." A negative result on Q3 is acceptable and must be stated as an open
window rather than repaired quietly.

    MUST-FIRE CONTROLS
    C1  the invalidation mechanism must be SHOWN to fire - a positive control that something observably
        changes state - or Q1 and Q4 are indistinguishable from a no-op
    C2  governance OFF: every world's write succeeds, so refusals are validity and not breakage
    C3  the frozen Step 5 result must survive unchanged: widening permission must still not widen
        acceptability
    C4  Step 6's R1 and SPEC must still pass: introducing validity must not break continuation

## 5. WHAT P6 MUST NOT DO

- **Not re-open Step 5 or Step 6.** Both are closed and their records are not reinterpreted under new
  semantics. If P6 contradicts them it is recorded as a contradiction, not as a revision.
- **Not adopt (e) because it is elegant.** The evidential/assumption route is preferred only if a world
  above cannot be decided without it. That is the difference between concepts meeting because reality
  forced them and concepts merged because the architecture diagram was suggestive.
- **Not fix the identifier debt.** `randomUUID().slice(0, 8)` is 8 hex characters - **32 bits** - and
  its role changed in Step 6 from locating a job to resolving an authority-bearing source. Status:
  **new authority-bearing dependency; collision properties UNESTABLISHED.** Not investigated and not
  replaced, because there is no observed failure and a retrospective architecture change without one
  is exactly what this project refuses.
- **Not enable the flag anywhere.** Isolated hubs only.
- **Not inherit anything from the CONSOLIDATION-1 session.** Separate artifact, separate evidence.

## 6. THE DISTINCTION LADDER THIS SITS ON

Recorded because it is the actual research output of the last two steps, and because a single field
called `authorized: true` would have collapsed every rung:

    authority was once granted
      != authority crossed this boundary                  (Step 5, queue_task attenuation)
      != authority source still exists                    (Step 6, R6)
      != the identifier resolves to the INTENDED source    (exposed by Step 6, UNATTACKED)
      != the source's authority remains valid              (P6, this document)

Each rung was forced by a hostile world rather than designed in advance. P6 attacks the last one and
newly exposes nothing beyond it that is yet known.

Nothing in this document authorizes an implementation or a run.
