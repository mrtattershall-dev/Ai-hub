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

---

# AMENDMENT 1 (2026-09-29) — appended, nothing above is edited

Three additions from the owner's close-out. None changes the proposition or authorizes work.

## A1. A SIXTH RUNG. THE LADDER WAS ONE SHORT.

    authority was once granted
      != authority crossed this boundary                  Step 5
      != authority source still exists                    Step 6, R6
      != the identifier resolves to the INTENDED source    exposed by Step 6, UNATTACKED
      != the source's authority remains valid              P6
      != AUTHORITY VALID WHEN CHECKED IS NOT AUTHORITY VALID WHEN THE EFFECT OCCURS

The last rung is new here and is **not established**. §4's Q3 is what attacks it, and this reframes Q3
from a hard edge case into the rung's own experiment: P6 may well establish validity **at resolution**
while establishing nothing about validity **at effect**. Those are different guarantees and must be
reported as different guarantees.

**And Q3 is not to be closed by checking twice.** That produces

    check -> check again -> [still a window] -> effect

which moves the window rather than closing it. Closing it may eventually require validation and effect
to be one atomic authority-consuming operation, or an explicitly bounded and stated race. Both are
downstream speculation: the frozen experiment decides first whether the distinction is load-bearing.

## A2. "INVALID" HAS SEVEN MEANINGS, NOT FIVE, AND THEY ARE NOT INTERCHANGEABLE

§3 enumerated five candidate representations. The owner's enumeration is wider, and the framing matters
more than the count: **these are different propositions about WHY permission ceases to be justified,
not interchangeable implementations of revocation.**

    1  the underlying repository changed                            (§3 candidate b)
    2  time elapsed                                                 (§3 candidate c)
    3  the issuing authority explicitly withdrew permission          (§3 candidate a)
    4  an ancestor permission ceased to exist                        (§3 candidate d)
    5  evidence supporting the permission became stale               (§3 candidate e)
    6  the permitted operation was ALREADY CONSUMED                  NEW - this is E4 single-use, which
                                                                     governed-edit records as not
                                                                     implemented
    7  the world changed such that the original scope no longer      NEW - referential drift. The grant
       corresponds to the INTENDED OBJECT                            still names `a.py`; `a.py` is no
                                                                     longer the thing it named

(7) is the one worth flagging, because it is the same shape as the identifier dependency Step 6
created. A grant pins a path; a continuation pins a queue id. In both cases the *name* survives while
what it denotes may not, and nothing currently checks the correspondence. Recorded as a connection,
not investigated — there is no observed misresolution.

Reality is to force which of the seven Legasus actually needs. None is adopted here.

## A3. WHAT THE FIRST FINDING ALREADY COSTS THE WORD "AUTHORITY"

Stated plainly because it is the most consequential thing in this document:

> Legasus currently has authority **issuance, transport, attenuation and source continuity** — and no
> reachable lifecycle in which issued authority becomes invalid.

The lifecycle today is ISSUED -> CROSSED -> ATTENUATED -> CONTINUED -> valid indefinitely, unless the
source item itself disappears. Step 6 handles that last case, and that is **source continuity, not
authority freshness.** Any use of the word "authority" in this project's records should be read against
that limit until P6 changes it.

## A4. UNCHANGED

The proposition, the reachability finding, all six worlds, the four must-fire controls, the warning
against revision binding, the identifier debt left alone, and the separation from the CONSOLIDATION-1
session. The next session on this line begins by trying to make each candidate definition of invalidity
contradict reality — not by coding.

---

# AMENDMENT 2 (2026-09-29) — an eighth meaning of "invalid", from read prior art

Appended; nothing above is edited. Source: `PRIOR_ART_2026-09-29.md`, which reads in-toto directly
rather than recalling it.

§3 enumerated five candidates; Amendment 1 widened the owner's enumeration to seven. One more exists
and it is the one an audited field system actually chose:

    (f) SUPERSESSION    the authorization was REPLACED by a newer authorization. No revocation lookup
                        and no external state consulted at verification time - the old authorization
                        simply is not the current one.

in-toto's own verification docstring (`in_toto/verifylib.py:1512-1522`) states that it does not rely on
"the creation time, revocation status, and usage flags" for keys, because not doing so "ensures that
verification can be performed in isolation", and that "to revoke or otherwise affect the usage of a
key, the supply chain owner must sign a new layout with the corresponding changes."

So its validity model is **expiry (E6-shaped) plus supersession**, and it rejects revocation lookup for
a stated architectural reason rather than for want of effort. That reason transfers directly: a
continuation resolved at install time that had to consult external revocation state would no longer be
decidable from the item and its source alone.

**Not adopted.** Enumerated only, exactly like (a) through (e) and the owner's two additions. It is
noted as the only one of the eight known to be load-bearing in a system audited in the field, which is
a fact about prior art and not an argument for choosing it.

One caution, recorded so it is not lost: supersession answers "which authorization is current" and says
nothing about *why* the earlier one stopped being justified. It is therefore not a substitute for
candidates (d) ancestor revocation or (e) evidential staleness, and adopting it would leave the
distinction between "replaced" and "no longer warranted" unrepresented.
