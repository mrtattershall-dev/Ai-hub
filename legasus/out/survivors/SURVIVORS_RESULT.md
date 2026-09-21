# BIND-CJS step 12 result — all five deciders are unsound; only ONE death is an evidence limit
2026-09-21 06:45. Preregistration `legasus/BIND-CJS_SURVIVORS.md` (442963c), frozen before the
hostile worlds existed. Step-11 deciders used **verbatim**. Mechanism unchanged. Hygiene: 3 + 3
pids recorded across both phases, 0 alive at sweep.

## Phase 1 — the frozen criterion

| attack | proposition | decider(hostile) | decider(must-fire negative) | verdict |
|---|---|---|---|---|
| S1 pre-seeded request channel | P1 a request was issued | **true** | false | DIES |
| S2 resolve without loading | P2 module M was served | **true** | false | DIES |
| S3 witness self-labels as worker | P3 an external execution occurred | **true** | false | DIES |
| S4 operation begins before the request | P4 the execution followed the request | **true** | false | DIES |
| S5 impostor self-reports MUTANT | P5 every observed execution used M | **true** | false | DIES |

Every must-fire negative held, so this is not a decider that says *true* everywhere. **M1–M5
confirmed: all five step-11 deciders affirm their proposition in a world where it is false.**

## Phase 2 — post-hoc classification, and it materially narrows the claim

Reported separately and labelled post-hoc, because "the decider is unsound" and "the evidence
cannot tell" are different claims and conflating them would be the over-correction the step-11
preregistration warned against.

For each proposition a genuinely-true world was run and its normalized bundle compared with the
hostile one:

    P5   bundles IDENTICAL   -> EVIDENCE LIMIT: no decider over these fields separates them
    P1   bundles differ      -> decider weakness only
    P2   bundles differ      -> decider weakness only
    P3   bundles differ      -> decider weakness only
    P4   bundles differ      -> decider weakness only

**So exactly one of the five deaths is about the evidence. Four are about my deciders.**

### And the four "decider weakness" labels are weaker still

Inspecting *why* those bundles differ, rather than accepting the label:

- **P1** differs only in the **rank** of the request event — the pre-seeded record was written
  before the run, the genuine one during it. A hostile writer seeding the channel mid-run would
  erase that difference. Nothing in the record identifies the *issuer*.
- **P3** differs only in the **count** of execution events (one vs two). Nothing in the record
  establishes that two roles are two processes; the role is a self-reported env string either way.
- **P4** differs because the hostile world **emits a record type the genuine world does not**
  (`operation-start`). That is an artifact of my construction, not a discriminator the evidence
  offers on its own.
- **P2** differs because the resolve-only world produces no execution marker at all — the one
  case where a stronger decider over existing fields plausibly exists.

So the honest three-way position is:

    decider is unsound                    ESTABLISHED for all five
    death is an evidence limit            ESTABLISHED for P5 only
    a SOUND decider exists                ESTABLISHED for NONE

Claiming the middle row for P1, P3 or P4 would overstate; claiming the third row for any of them
would be inventing a rescue. Both are declined.

## What S4 forced, without settling

"Followed the request" turned out to name at least four different events — operation start,
module load, marker emission, and observation — and step 11's decider silently used the last.
The distinction has consequences: the worker's operation began before the request and its load
came after, and the decider called that *followed*. **Which reading is correct is not decided
here**, per the preregistration. Only that the sentence was underspecified.

## A theme, recorded as an observation and nothing more

Three of the five attacks succeeded by exploiting a **self-reported field**: the role label
(S3), the identity string (S5), and the request record's provenance (S1). The fourth exploited
an **artifact of the channel** rather than of the world (S2: a resolution logged as a serve).
This is written down because it recurs, not because it is a principle. Per the charter it earns
nothing until it predicts a new failure prospectively.

## Where the map stands

    six candidate membership rules        dead, none replaced         (steps 7-10)
    single-run boundary, first pass       5 in / 2 out                (step 11)
    those five under a second attack      all five deciders unsound   (step 12)
    of those, evidence limits             ONE (P5)

The boundary did not contract to nothing. It contracted to: *one proposition is not identifiable
from these fields; four have no sound decider yet and were not shown unidentifiable.* That is a
smaller, more accurate statement than either "five propositions hold" or "five propositions
died", and it is the one the evidence supports.

## Next falsification, not started

Re-run S1, S3 and S4 with the incidental differences removed — seed the request channel mid-run,
give the hostile world the same record types as the genuine one, equalise event counts. If the
bundles then become identical, those deaths convert from decider weakness to evidence limit and
the boundary genuinely contracts. If they stay distinguishable, the next question is whether a
sound decider can actually be written over the existing fields — which must itself be attacked,
not assumed.
