# Journal merging — M1..M9. Frozen 2026-09-21, before any merge code exists.

## The question

> Can two individually valid histories produce an authority **neither history justified**?

## The reference semantics, frozen first

> **Combining journals adds available records. It does not itself mint authority, equate
> references, select between conflicting records, or establish claims.**

Four separate prohibitions, and each gets its own arm, because they fail in different ways: minting
(M1), equating (M3), selecting (M4), establishing (M2/M5).

## The dangerous case, named before it is built

Two processes can issue the same address string. `nextRef` is a module-level counter plus six random
characters, and **the counter restarts at zero in every process** — `auth:1:…` is the first address
every run ever issues. So a bare ref string cannot identify *which* history a dependency meant. A
merger that re-pointed it at whichever record appeared first would **manufacture a dependency**, and
it would do so silently, in the case that looks most ordinary.

### Therefore: a reference is `(origin, ref)`, and origin is assigned by the merger

The merger knows where each journal came from — a path, a fetch, a caller's label. **The journal
does not get to name its own origin.** Letting it would be the same defect as letting a producer
declare its own `requires`: the artefact choosing the identity under which it will be believed.

A dependency reference resolves **only within its own origin**. Cross-origin references do not exist
in this contract; there is no syntax for one, which is the point.

**Named hazard, recorded now:** if the merger assigns the *same* origin key to two journals, their
references become ambiguous. That must be **reported**, not resolved (M4). I am not adding a
content digest to make origins unique — that would be inventing an identity before measuring
whether one is needed, and the failure mode here is carelessness, not forgery.

## The conservation requirement

Merging *may* legitimately close a derivation that was open, by supplying evidence that was missing.
That is the whole point of having more records. The requirement is:

> **Every new establishment traces to newly available, admissible support — never to the act of
> combining files.**

Operationally, for any claim established after a merge that was not established before it, there
must exist a specific record, from a specific origin, that (a) was not available before, (b)
independently admits on its own evidence, and (c) matches the frozen reference semantics of the
witness it satisfies. M5 asserts all three and carries a control where (b) fails.

## The arms

| arm | required observation |
|---|---|
| **M1** merge without replay | combined records remain **locatable**; merging alone produces no authority, no store is touched, nothing mints |
| **M2** disjoint histories | both histories replay, each with its **original dependency relationships** preserved — not merely "both succeeded" |
| **M3** same address, different origins | neither record silently captures the other's references |
| **M4** conflicting records under one identity | **no first-wins or last-wins**; the ambiguity is reported, naming both |
| **M5** dependency supplied by the other journal | a previously open record closes **only** when the supplied record matches its frozen reference semantics **and independently admits**. Control: a supplied record that does not admit leaves it open |
| **M6** cross-journal cycle | two previously open histories cannot bootstrap one another into authority |
| **M7** order and duplication | reversing input order, or merging an identical journal twice, preserves semantic outcomes — ignoring newly minted address values, which are expected to differ |
| **M8** scope mismatch | a newly available relation still cannot bind outside its licensed world |
| **M9** F2 preservation | additional records alone do not erase its undecidable premise |

## An apparatus requirement, from the seventh wrong-referent defect

R6's first version read the wrong record's outcome and produced `'ESTABLISHED' != 'ESTABLISHED'`,
because the record it meant to measure had never been produced at all. A correct refusal upstream
kept a downstream assertion looking meaningful when it had never run.

**Requirement for this suite:** every assertion names the record whose outcome it measures, and
**fails if that record was never produced.** Concretely, outcomes are read through

    outcomeFor(result, origin, ref)   -> throws, naming origin and ref, if absent

and never by index, never by `find(...)` with an optional result, never by `[length - 1]`. An arm
that cannot locate its subject must fail loudly rather than measure a neighbour.

## Predictions, committed now

- **M1, M9** pass by construction — merging is a pure data operation and F2 has no closed
  alternative regardless of what else is on disk.
- **M3 is where I expect the first failure**, because the existing `replayJournal` keys its remap by
  bare `ref`. A merged journal will collide on `auth:1:…` and the first origin's record will capture
  the second's reference. I expect to see it, and it is the reason origin-scoping is frozen above
  rather than discovered afterwards.
- **M4** I expect to need new code: nothing today reports ambiguity, because nothing today has two
  candidates.
- **M5** I expect to hold, but the **control is the load-bearing half** — an arm that only shows a
  blocked derivation closing would be indistinguishable from a merger that closes things.
- **M7** duplication is the sneaky one: merging a journal with itself gives every reference two
  identical candidates. Whether that reads as *ambiguous* (M4) or as *the same record twice* is a
  real question and I am not deciding it in advance. Whatever it does, it must do the same under
  both input orders.

## Forbidden in this run

No new registry rules (still **3 authored, 0/15**). No freshness rule. No repair of the F2 boundary.
No content digest added to manufacture origin uniqueness. No path by which combining files produces
a token. And the F2 pair stays in the fixtures exactly as it is.

## ADDENDUM, added during implementation and BEFORE any arm was run

The arms above say M5 closes "only when the supplied record matches its frozen reference semantics".
Writing the code exposed that the prereg never said **by what** a supplied record matches, and the
answer is not free, so it is recorded here rather than discovered after an outcome.

**Addresses are origin-scoped. Satisfaction is by CLAIM, not by address.** A reference in journal A
can never name a record in journal B — there is no syntax for it. What crosses is the proposition: a
witness needing `COVERAGE(s, o)` is satisfied when some record, from any origin, **independently
replays into authority for exactly that claim**, and the existing `resolveEvidenceRoot` then applies
its own world checks to it. Candidate selection is by claim identity only; **whether it binds stays
with the machinery that already decides that**, so world identity is not reimplemented here — a
second implementation would be a second place to be wrong.

If more than one record establishes the needed claim, that is ambiguity and is reported (M4's rule),
not resolved by order.

**No fixpoint iteration.** Records replay once, in dependency order within their own origin, and a
cross-origin supply may only come from a record **already replayed in this pass**. That is what
makes M6 structural rather than a check: two histories that each need the other's conclusion both
reach their turn with the other not yet established, and both stay open. Iterating to a fixpoint
would be exactly the mechanism by which a cycle bootstraps itself.
