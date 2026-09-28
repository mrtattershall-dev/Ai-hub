# Natural relation production — result. N1..N8 against `NATURAL-RELATION_PREREG.md`.

    9 arms, 9 green, 0 red.  84 -> 93 tests in this directory, nothing else moved.

## The finding first, because it is the ugly one

**The frozen selection rule chose a case that cannot complete the loop, and the rule was not edited.**

The procedure said *the first qualifying fact in fixture order*. It picked
`COVERAGE(F2:derivation0:premise0, FUNCTION_PARAMETER)` from case F2 — census site #7, the
undecidable premise. The relation certificate F2 emits **is** admitted and **does** mint authority
(N2). But F2's *ordinary* certificate has no closed derivation, so `adapt` returns at stage DERIVE
and witness binding is never reached. The loop stops one step short.

That is a limitation of the rule, not of the machinery. The rule said "qualifying"; it did not say
"a fact some consumer can use". It could have said so and it did not, and I am not going to discover
that requirement after seeing which case it excludes. **N3 PRIMARY** now asserts the failure
positively: relation authority produced and filed, `minted: false`, `stage: DERIVE`,
`why: no closed alternative`, `bound: []`.

To score the arms that actually need consumption, `emit_natural.py` additionally emits a pair
labelled **SECONDARY** — the first qualifying fact whose case *also* has a closed derivation, by the
same producer code, no new evidence:

    case      F4, REACH-1 R2
    relation  COVERAGE(F4:derivation0:premise0, SAMPLE)
    consumer  F4, needing universal-from-exhaustive-coverage

Every arm that uses it says SECONDARY in its name or its comment. The frozen pair is still scored by
N1, N2, N3 PRIMARY and N8.

## Arm by arm

| arm | prediction | outcome |
|---|---|---|
| N1 | ordinary producer run emits a RELATION claim, no test-side retargeting | **held** — `POINTWISE`, predicate identical to the one the consumer needs, same instrument and repository, attribution `recorded by obligation.coverage[...]`, and no `relation_established` field anywhere in the JSON |
| N2 | the NORMAL admission path mints relation authority into the store | **held** — `ESTABLISHED`; the minted token's claim *is* the relation instance; filed under an issued handle |
| N3 SECONDARY | a later certificate referencing ONLY the handle consumes it and derives | **held** — `bound: ['COVERAGE']`, later derivation mints, `ESTABLISHED`. With a **necessity control**: the same certificate without the filed relation does *not* establish, so the arm is not scoring something the consumer would have done anyway |
| N3 PRIMARY | (not predicted) | **the frozen rule's limitation, recorded** |
| N4 | remove a necessary fact → ABSENT or REFUSED, never fabricated | **held** — both mutations (no evidential force; unsettled premise) refuse |
| N5 | same apparent relation in the wrong world → later consumption refuses | **held** — wrong `repository` and wrong `claim_domain` each admit in their *own* world and each fail to bind, with the world coordinate named in the refusal |
| N6 anti-refusal | authority reached by DERIVE rather than direct observation is still consumable | **held** — the stored token's constructor is `DERIVE` and it binds |
| N7 | another TRUE fact from the same evidence cannot substitute | **held** — `MEMBERSHIP` genuinely establishes, and the refusal names both claims: *establishes "MEMBERSHIP(…)" and this witness needs "COVERAGE(…)"* |
| N8 | if nothing qualified, terminate rather than add vocabulary | **discharged by selection** — something qualified; the arm is asserted in the suite so it stays visible |

## What was added on the producer side, and what was not

Added: `emit_relation()` in `certificate.py`, and `"RELATION": O.POINTWISE` in the QMAP.

Not added: no registry rule (still **3 authored, 0/15** against the spent historical declarations),
no new evidence record, no `relation_established` field, no producer-side notion of whether its own
relation holds. The producer reports the fact and requests the claim. Admission decides.

## One apparatus defect, preserved

The first `emit_relation` reused the case's evidence wholesale, so the relation inherited **F2's
undecidable premise** and came back `licensed_relation: NONE`. The relation does not rest on F2's
inference; it rests on the observation that recorded the coverage fact. Fixed by giving the relation
its own observation-based premise via `dataclasses.replace`. This is attribution, not fabrication —
and it is the same species as the other six: *a measure reading something other than what it meant
to*, here an obligation inherited from the wrong referent.

A second, smaller one: N3's first version resolved the handle against a *different* store instance
and read `FRONTIER_OPEN` as a machinery failure. A handle is only meaningful in the store that
issued it. The test now says so.

## H-IDENTITY-AUTHORITY

Standing **NONE**. This run did not test it. The producer→relation→consumer path here never crosses
an identity boundary: the same world coordinates carry through, so no equivalence proposition was
needed and none was smuggled. Not a sixth arrival, not a counterexample.

## What this does and does not show

It shows that ordinary producer work already contains the material the registry's rules demand, and
that the material survives the whole path — certificate, admission, store, handle, later obligation —
without any step being told the answer.

It does not show that the registry is adequate, that the selection rule was well chosen, or that a
consumer in a *different* world could use any of it. The first is still 0/15. The second is now on
record as a limitation. The third is the next thing that will break: **the store is process-local,
and nothing re-executes an admission record to regain authority.** Replay is next.
