# Replay / reconstruction — result. R1..R8 against `REPLAY_PREREG.md`.

    9 arms + 1 contract arm, all green.  93 -> 102 tests in this directory.

## The finding

> The process forgot every grant of authority, retained the evidence, and recovered exactly the
> authority that re-execution justified — **including the same unresolved F2 boundary.**

A real second `node` process, fresh module graph, fresh WeakSet, reading nothing but a JSON file:
every address the parent issued resolved to nothing (R1/R2), every record was still *findable*, and
re-execution produced authority under **new** addresses. The child's own control reports
`liveIsAuthority: true` and `cloneIsAuthority: false` — it genuinely minted, and a JSON round-trip of
the token it minted is still not authority. R8 replayed F2's relation successfully and F2's ordinary
derivation still stops at `stage: DERIVE`, `no closed alternative`, `bound: []`.

## Arm by arm

| arm | outcome |
|---|---|
| **R1** fresh process | **held** — a fresh store refuses every ref it did not itself issue, including the prereg's named hazard (the counter restarts at zero, so same-shaped addresses are regenerable) and a hand-written `auth:1:aaaaaa`. `locate()` has no `token` property *at all*, not a null one |
| **R2** valid replay across a process boundary | **held** — separate pid, both entries `ESTABLISHED`, consumer re-bound `COVERAGE`, new refs, store size 2, boundary control passed |
| **R3** verdict-only | **held** — the writer refuses to serialize a journal with no evidence ("a list of assertions"); a verdict-only entry reaching the replayer returns `UNRESOLVED` / *a saved outcome is not a reason*; and a record carrying a `token` key is refused at write time rather than silently stripped |
| **R4** changed evidence | **held**, in two forms. The weak form (break the dependency's evidence) passes partly because the dependency then goes missing, which is R5's business — so a **sharper form** was added: dependency intact, only the *consumer's own* evidence opened, record still saying `ESTABLISHED`. It does not survive |
| **R5** missing dependency | **held, and OPEN not REFUSED** — `FRONTIER_OPEN`, naming the relation and the address it was recorded under. Unresolved is not disproven |
| **R6** changed scope | **held** — a recovered relation does not bind for a consumer whose repository or claim domain has moved |
| **R7** circular records | **held** — the cycle is named and every entry in it mints nothing: *a cycle has no evidence at its root, only more records* |
| **R8** primary preservation | **held** — replay manufactured nothing |
| R-CONTRACT | a journal written under another contract version is refused rather than reinterpreted |

## Two design decisions, discharged as frozen

**An old handle identifies a record, never authority.** `locate(journal, ref)` takes no store,
returns `{ ok, record }`, and has no code path to a token; `store.resolve(ref)` only knows refs that
store issued in this process. Loading a file is not a minting operation, and R1 asserts this by
property *shape*, not by value.

**Reproduction is not currency.** Replay shows the same evidence, re-executed, still justifies the
same claim. It does not show the claim is true now. **There is no freshness rule in the registry**,
recorded before the run and unchanged after it; a claim recovered by replay carries exactly the
currency its evidence carried when recorded. No freshness rule was invented after seeing replay
succeed.

## What the mutants actually show

Two mutants were run against `replay.mjs` to find out what the suite senses.

| mutant | caught by |
|---|---|
| trust `record.state === 'ESTABLISHED'` and skip re-execution | **R4 only** |
| keep the dead address instead of re-pointing the witness | **R2 only** |

**Read correctly** (this replaces a wrong reading in the first version of this document): one arm
catching a mutant is sufficient to kill it. The seven arms that survived each mutant are not seven
failures — they test other properties, and an arm that does not sense a defect outside its subject
is behaving correctly.

What the table does establish is narrower and worth keeping: **R4 is the sole demonstrated
protection against verdict laundering.** Every other arm passed with a replayer that trusted a saved
`ESTABLISHED` and skipped re-execution, because an ordinary journal entry carries no `state` field
for it to trust. That is a fact about where the guard lives, not a count of failures — and its
generality is untested here. Testing it belongs in its own frozen experiment, not in an arm added to
this one after the fact.

## One apparatus defect, preserved

R6's first version mutated the **relation's** world. That makes the consumer fail to bind in the
*live* run too, so no consumer entry is ever journaled, and `outcomes[outcomes.length - 1]` silently
read the relation's own outcome — which was `ESTABLISHED`, producing the unhelpful
`'ESTABLISHED' != 'ESTABLISHED'`. The arm is about a *recovered authority meeting a consumer whose
world has moved*, so the consumer is what must change. Seventh instance of the same species: **a
measure reading something other than what it meant to.** The construction note stays in the test.

## What is still not shown

- Replay recovers what re-execution justifies **in this process family**. Nothing here crosses a
  language boundary, and the bridges remain a research instrument, not transport.
- The registry is still **3 authored rules, 0/15** against the spent historical declarations. Replay
  did not touch it and no rule was added.
- H-IDENTITY-AUTHORITY stays at **NONE**. Replay re-executes within one world identity; it never
  needed an equivalence proposition and none was smuggled in.
- A journal is append-order only as far as its `consumed` edges go. Nothing here establishes what
  happens when two journals from different runs are merged — that is the next place a dead address
  could quietly become a live one.
