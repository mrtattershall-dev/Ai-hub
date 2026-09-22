# Journal lineage — result. L1..L8 against `JOURNAL-LINEAGE_PREREG.md`.

    8 arms, all green.  151 -> 159 tests in this directory.  5 mutants run, 5 caught.
    Plus U8, added to the previous suite to answer a question that result had not measured.

## First: the boundary check U8 owed

The unattached-governance result reported *no admissions returned*. That is not the same observation
as *no usable authority escaped*, and the probes call `derive()`, which mints. **U8 measures the
second directly**: under the `INVALIDATE` default the store handed to the run is **untouched** — not
one entry filed, no issued address anywhere in the result — with a control showing the same journals
do mint and file when governance attaches. A mutant that runs everything and suppresses the results
afterwards is caught by **U8 alone**, which is what makes the two observations distinct rather than
rhetorical.

## Who may establish continuity

A journal may carry `{ predecessor, content }`. That **identifies** and authorizes nothing (L1): the
successor inherits no obligation, and the obligation stays unattached — which the frozen
`INVALIDATE` default refuses on. **A journal can identify; it can never authorize itself.**

Authorization comes from the governor and names what it authorizes: the **merger-assigned origin**
the successor must sit under, the **content** it must have, and **whether governance transfers at
all**.

## The decisive pair, across a fresh process boundary

**L2 — the positive control held.** An authorized continuity operation preserved the intended
`DESIGNATED` obligation across **reordered inputs**, in a separate `node` process with only bytes
crossing: `kind: CONTINUED`, `governedBy: GOVERNING_BY_AUTHORIZED_CONTINUITY`, attached to the
successor's own occurrence — identifier *and* object. With a **necessity control**: without the
authorization the same journals do not inherit, and the run refuses.

**L3 — the paired attack held.** A replacement copying the ref, the origin label and the entire
continuity assertion inherited nothing; the run refused, naming *identifying a predecessor is not
being authorized to continue it*. Under an authorized diagnosis the impostor is visibly **ungoverned**
rather than inheriting.

**And my prediction about L3 was wrong in its reason.** I predicted it would hold *because of the
origin*, and said that if it held for any other reason I had mis-measured it. The mutation table
settles it: the *origin ignored, content alone continues* mutant is **not** caught by L3 — it is
caught by **L6**. L3's impostor is a revision, so what L3 actually measures is the **content** check.
The origin's necessity is established by L6, not by L3. Recorded rather than re-narrated.

## The three permissions are three

**L7** is the clearest result in the run. With `transferGovernance: false` the history **is**
continued — `kind: CONTINUED`, and the finding says *continuing a history and inheriting its
obligations are different permissions* — while the successor inherits **no** obligation and the
predecessor's obligation stays unattached. The same journals with the permission set do inherit. A
mutant that makes continuity always transfer governance dies here and nowhere else.

**L4** is where continuity and governance visibly come apart in the other direction: an
authorization naming the **old** content does not reach a revision. Only an authorization naming the
**new** content covers it.

## Two findings that narrowed the arms

**A claimant in another origin is not a competing successor.** Naming the origin means an
unauthorized claimant elsewhere creates no ambiguity at all — it simply does not qualify.

**The fork the preregistration anticipated is not constructible under this contract.** Within one
origin, two records that both satisfy one authorized content cannot exist: content includes the ref,
and merge collapses byte-identical entries under one origin (M7), so two distinct records under one
origin necessarily differ in content. The refusal path exists and behaves — *NEITHER inherits, an
ambiguous authorization is not resolved by insertion order*, identical under both orders, nothing
admitted — but it is exercised against a **directly constructed** merged set, labelled synthetic and
not presented as a natural fixture.

## One implementation defect, found by L5 and preserved

The fork **decision** was order-invariant; its **message** was not. Claimants were listed in record
order, so the same refusal read differently under a permutation. *A refusal that changes with input
order is not a refusal anyone can compare.* The list is sorted now. This is the same species as T5,
one layer up: the outcome was stable and its account of itself was not.

## Arm by arm

| arm | outcome |
|---|---|
| **L1** identification ≠ authorization | **held** — inherits nothing, and the obligation is reported unattached |
| **L2** authorized reorder, cross-process | **held**, with a necessity control |
| **L3** copied-label replacement, cross-process | **held** — for the content reason, not the origin reason |
| **L4** revision | **held** — only an authorization naming the new content covers it |
| **L5** fork | refusal **held**; the natural construction is **impossible**, and that is recorded |
| **L6** identical content, separate histories | **held** — the copy inherits nothing by being identical, and this is where the origin's necessity is proven |
| **L7** permissions separable | **held** — the sharpest result here |
| **L8** absent predecessor | **held** — an authorized transfer still attaches; without the transfer permission the same absent predecessor is simply unattached and `INVALIDATE` applies |

## Mutation table

| mutant | caught by |
|---|---|
| the journal assertion authorizes itself | L3, L4, L5, L6 |
| content not checked (labels suffice) | L3, L4 |
| continuity always transfers governance | L7 |
| a fork picks the first claimant | L5 |
| origin ignored, content alone continues | **L6 only** |

## What is still not shown

- **Continuity rests on the merger's origin assignment.** A6's hazard is unchanged: a merger that
  assigns origins by input position can still move what a label denotes, and continuity
  authorizations written against such origins inherit that instability.
- **No ownership scheme exists.** The threat model remains carelessness. Nothing here would stop a
  party that can write both the journal and the governance map, and no signature scheme was invented
  to pretend otherwise.
- `INVALIDATE` was **not** weakened to make continuity convenient: L1, L2's control, L3 and L8 all
  end in refusals under the frozen default.
- `COMPLETE` remains vocabulary without a mechanism. **S6 is untouched and still stands.** The
  registry is still **3 authored rules, 0/15**. F2 untouched. H-IDENTITY-AUTHORITY stays at **NONE**.
