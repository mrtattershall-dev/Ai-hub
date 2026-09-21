# Journal merging — result. M1..M9 (+M10) against `MERGE_PREREG.md`.

    12 arms, all green.  102 -> 114 tests in this directory.
    6 mutants run: 5 caught by the frozen arms, 1 survived all of them.

## The answer to the question asked

> Can two individually valid histories produce an authority neither history justified?

**Not under these arms.** Conservation held in the form the preregistration demanded: for the one
claim that became established only after merging (M5), there is a specific record, from a named
origin, that (a) was demonstrably not available before, (b) independently admitted on its own
evidence, and (c) satisfied the witness by the frozen reference semantics — reported in the
outcome's own `supply` field as `B/CLAIM/COVERAGE(F4:derivation0:premise0, SAMPLE)`. Nothing was
established by the act of combining files.

## The design change the arms forced, in the open

The addendum said records replay "once, in dependency order within their own origin". **M5 failed
against that.** A consumer in journal A whose supplier lives in journal B was reached *before* the
supplier, reported open, and the same two journals gave different answers depending on which was
passed first — M5 and M7 in direct contradiction.

The fix was to choose the **order by readiness**, not by input order. Both invariants that stop a
cycle are unchanged: every record is admitted **at most once**, and a cross-origin supply may only
come from a record **already replayed in this pass**. A record's *declared* claim is now consulted
to decide **order only** — if a still-pending record declares the claim a consumer needs, that
consumer waits — so the answer cannot depend on which journal was passed first. Two histories that
each need the other's conclusion never become ready, make no progress, and both end open (M6). A
mutant that removes exactly this waiting is caught by M5.

## Arm by arm

| arm | outcome |
|---|---|
| **M1** merge without replay | **held** — a pure data operation: four records locatable, no store touched, `locateIn` has no `token` property, an address from another origin is simply not found |
| **M2** disjoint histories | **held** — each consumer rests on **its own** history, `supply = [A/REFERENCE]` and `[B/REFERENCE]`, not merely "both succeeded" |
| **M3** same address, different origins | **held under both input orders** — `auth:1:same` in A and in B are two different records and two different authorities; a `REFERENCE` never crosses an origin |
| **M4** conflicting records under one identity | **held** — reported, `locateIn` refuses, the record is `UNRESOLVED`, and the consumer pointing at that identity gets nothing rather than one of the two |
| **M5** dependency supplied by the other journal | **held, with two controls** — see below |
| **M6** cross-journal cycle | **held** — neither mints; structural, not a check |
| **M7** order and duplication | **held** — `[A,B]` and `[B,A]` give identical semantics; an identical journal twice is duplication, not ambiguity |
| **M8** scope mismatch | **held** — a newly available relation does not bind for a consumer whose repository moved |
| **M9** F2 preservation | **held** — offered every record in the merged set, F2's ordinary derivation still stops at `no closed alternative` |
| M-APPARATUS | `outcomeFor` throws, naming origin and ref, when its subject was never produced |
| M-ORIGIN | a journal that names its own origin is refused; a journal with no assigned origin is refused |
| **M10** | added after mutation testing — see below |

## The mutation table, which is the part worth reading

| mutant | caught by |
|---|---|
| remap keyed by bare ref (origin dropped) | M3, M6 |
| merge equates addresses across origins | M3 |
| first-wins on a conflicting identity | M4 |
| supply from a record that did not establish | M5 |
| readiness ignores pending suppliers | M5 |
| **several records establish the claim: pick the first** | **nothing** |

The sixth mutant survived all twelve frozen arms. The refusal it removes **existed in `merge.mjs`
and no arm ever reached it**, because no arm made two *distinct* records establish the *same* claim.
The prereg named conflict at the level of **identity** (M4) and never named conflict at the level of
the **proposition**. M10 was added to exercise it, labelled as added after the fact; with M10 the
mutant dies. The code was right and the experiment was blind — which is the only reason this is
recoverable rather than a silent hole.

## Three apparatus defects, preserved

**1. A mutation control that silently failed to apply.** The first `key()` used a literal NUL byte
as its separator. That made the module a *binary file* to `grep`, and made a string-replacement
mutant fail to match — so the harness reported "mutant survived, the suite is insensitive" when
**nothing had been tested at all**. I drew and briefly held that wrong conclusion. Fixed twice over:
the separator is now `JSON.stringify([origin, ref])`, and every mutant run now **asserts that the
mutation applied** before running the suite. Same family as the commit-hook's recorded occurrence 2,
a patch script that printed "threshold tightened" and changed nothing.

**2. M3 was order-lucky.** Its first version ran only `[A, B]`, where A's consumer is reached before
B's colliding record is processed at all — so a merger that dropped the origin from its key passed
it. The arm's required observation never changed; the apparatus could not observe it. It now runs
both orders. Same class as R6.

**3. M5's first control was too weak.** Making the supplier's evidence lose evidential force means
it never mints *at all*, so it cannot distinguish "did not establish" from "did not exist". Control
2 is the sharper one: a supplier that **does** mint a token carrying **exactly** the needed claim,
while its request is `CANDIDATE` (`licensed_relation: NONE`). A merger selecting by "a token exists
with the right claim" would hand that over. It supplies nothing.

## What is still not shown

- Merging is tested with **two or three journals of one or two records each**. Nothing here says
  what happens at a scale where readiness waves interact with many claim-level candidates.
- Origin assignment is trusted to the merger. Nothing establishes what a *wrong* origin assignment
  does beyond M4's same-origin collision — and the prereg deliberately refused to add a content
  digest to make origins unique, because the failure mode addressed here is carelessness.
- The registry is still **3 authored rules, 0/15**. No rule was added, no freshness rule exists.
- H-IDENTITY-AUTHORITY stays at **NONE**. Cross-origin supply is by *claim identity*, which is
  string equality of a proposition in one world — it never crosses an identity boundary, so no
  equivalence proposition was needed and none was smuggled in.
- **The claim-level ambiguity refusal is now exercised but never wanted.** M10 shows the system
  refusing when two independent histories establish the same thing. Whether that is right — two
  agreeing witnesses ought perhaps to be *corroboration* rather than ambiguity — is a real question
  this experiment does not answer, and it should not be answered by quietly picking one.
