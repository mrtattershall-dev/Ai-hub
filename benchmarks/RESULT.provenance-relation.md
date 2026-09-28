# r4 — provenance as a relation. RESULT (pre-repair).

Predictions frozen in `554440f` (`PROVENANCE_RELATION_PREREG.md`), from the owner's observation.
Run against `4f93a79` unmodified. Written before the repair.

## Raw run

    ✔ PR-1 ATTACK  two legitimate histories for identical bytes are declared CONTESTED
    ✔ PR-2 ATTACK  the module cannot tell that case from a genuinely damaged record
    ✔ PR-3 CONTROL the same attribution bound twice is ONE attribution
    ✔ PR-4 CONTROL the ENTITLEMENT is already right: neither state attributes to one producer
    ✔ PR-5 CONTROL the seal still covers every attribution in the set (C8-b does not regress)

    tests 5  pass 5  fail 0

## Reading

The observation holds, and PR-4 bounds how much of it holds. What the C8-a repair got RIGHT stands:
the last-wins map is gone, both attributions are kept, and no lookup returns a single `producedBy`
for either state. The **entitlement** was correct. What it got wrong is the **relation it asserts
about them**: two production events with one content referent were labelled a contradiction.

PR-2 is the sharper half. The module cannot distinguish

    two tools that each legitimately emitted an empty file
    one artifact declared to have two producers, i.e. a damaged record

because the digest is the only identity and path is DESCRIPTION by decision - the decision that makes
the identity property work. So the module has no coordinate that could justify a conflict claim, and
was making one anyway.

## The class, and it is mine

`CONTESTED` is defined in `ledger.mjs` LAW 3: contradicting live claims, blocks reliance, **owes an
experiment**. No experiment separates "both tools emitted an empty file" - both statements are true -
so the label attached an unsatisfiable obligation to a state that may carry none.

That is composition attack C4 - a coordinate acquiring a declared dimension's authority because two
strings matched - committed by me, one module further out, inside the repair for C8. The session's
own finding, applied to the session's own work by the owner rather than by its author. Recorded that
way.

## What is NOT claimed

Nothing here is a live corruption. Measured before predicting: `PROVENANCE.json` holds 21 artifacts
with 21 distinct digests, so no historical attribution is or was mis-reported. The defect is LATENT,
and the triggering condition already exists in data this project measures
(`repoC/IDENTITY.json`: three pyparsing files share the empty-file digest).

## Repair

`MULTIPLY_BOUND`: these bytes carry N production events; no single producer is established. Stated as
a relation, with the reason the module cannot say more - identical content may have several
histories, and a digest-keyed ledger cannot tell that from a damaged record. Attribution is refused
exactly as before.

`CONTESTED` is removed from this module rather than renamed into it. A conflict claim needs evidence
that the content had ONE history; the digest is not that evidence, and inventing the check that would
have it - keyed on path, or on artifact identity plus declaration - is not started. Where it belongs
is UNKNOWN and is recorded as UNKNOWN. The word goes back to meaning only what `ledger.mjs` says.
