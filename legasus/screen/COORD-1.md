# COORD-1 — concurrent experimental ownership depends on operator discipline

Recorded 2026-10-01 as a mechanism problem, not a reprimand. Not worked now; D continues.

## The event

COORD's standing rule is to compare before writing more, so only the delta lands rather than two
independent implementations of one thing.

On 2026-10-01 two sessions worked D-ID-1 concurrently:

    88e831f1  04:57  another session  D-ID-1 regression: where HEAD^{tree} breaks the contract
    3e7db019  ~05:0x this session     D-ID-1: cid1 implemented and ACCEPTED

Both wrote a suite that characterises the SHIPPED identity against the frozen M-rows. I checked
for prior art **after** committing, not before.

## The consequence, which was luck

The two characterisations AGREE on the shipped identity's failure set — M1, M3, M4, M5, M7-M11,
M15, M16 — reached independently by different suites. So the overlap became corroboration rather
than conflict, and only one implementation of cid1 exists.

It could as easily have gone the other way. The same convergence hazard has already produced a
concrete defect in this repo: `GOVERNED_WRITES`, `governWrite` and `clearRunAuthority` were each
implemented twice on two branches, git merged them as non-conflicting because they sat at
different offsets, and only a duplicate-declaration syntax error surfaced it (CANDIDATE-0,
c16c59a6).

And it did partly go the other way here: the two sessions reached **incompatible conclusions on
M15** (see `D-ID-1_M15-DISAGREEMENT.md`) — one recording a REPRESENTABILITY violation, one
recording NOT_RUNNABLE — because one established the row's premise and the other assumed it.

## The mechanism problem

    the rule is prose           COORD.md is a file two sessions must both choose to read
    the claim is advisory       nothing prevents a second session editing a claimed file
    discovery is retrospective  I found the peer's commit by running `git log` afterwards
    agreement is unverified     two suites measuring "the same" rows can disagree silently

So concurrent experimental ownership is currently a RULE ONLY, in this project's own grading
sense: correct, understood, and dependent on someone remembering.

## What would close it, not designed here

Mechanically visible or exclusive ownership of an experiment — a claim that a second session
cannot miss and cannot silently override, checked at the point of writing rather than announced
in a file. Legasus already has the vocabulary for this: a claim is an authority over an object,
and two holders of the same authority is exactly the co-presence case its containment work
refuses elsewhere.

Deliberately NOT proposed as a design here. Recorded as an open mechanism gap with its concrete
event, so it is a finding rather than a memory.

## UPDATE 2026-10-01 (another session)

After this record was written, a second implementation (server/cid1.mjs, 8a062953) landed, so two
existed. D-ID-1_RECONCILE.md settled it by measurement: cid1.mjs survives, candidateIdentity.mjs is
SUPERSEDED (R4/R5: it collapses a lone-surrogate name onto its U+FFFD lookalike). That session also
built without checking COORD first - the mechanism problem above recurred within the hour.
