# r4 — producer #3. Selection rule and predictions, frozen BEFORE any candidate is named.

This file is committed **alone**, before the candidate table exists, so the rule cannot be retro-fitted to
a candidate and the predictions cannot be retro-fitted to an outcome. The candidate declarations and the
selection run land in a *later* commit.

## Why there is a producer #3 at all

The quiesce check (Entry 10) found this the **only** justified open investigation: the other three are
blocked by the platform, by information destroyed in the past, and by sequencing. It passed all four of
law 7's conditions, and the fourth is the one that matters here — **some outcome of it falsifies a claim
currently being relied on.**

The claim being relied on is the producer #2 repair:

> a coordinate the producer cannot establish is **ABSENT** rather than invented

That was derived from exactly **one** counterexample, and the quiesce check found evidence that it may
have **moved** the failure rather than removed it:

    declared scope dimensions                 repository, environment, history, criterion,
                                              invocation, implementation   (6, a CLOSED set)
    production modules using admitDimension    NONE — imported only by its own test

So producer #2 answered *"what if the producer has FEWER coordinates than Legasus names?"* Producer #3
asks the harder question:

> **what if the producer has a coordinate Legasus has NO NAME FOR?**

Three outcomes are possible and only one of them is acceptable: the coordinate is **carried** with an
explicit admission, it is **refused** with a named reason, or it **silently vanishes**. The third is
UNKNOWN collapsing into absence, which is the same defect producer #2 found wearing the opposite sign.

## P3-SELECTION — eligibility

A candidate is eligible iff **all** hold. None requires observing what it says about any subject.

1. An **independently implemented external authority** already present or installable here.
2. Establishes a **real software fact Legasus has reason to consume** — not one invented to be consumed.
3. Differs from **both** doctest and git on at least 3 of the seven P2 axes.
4. Machine-readable output, without Legasus reimplementing its semantics.

## P3-SELECTION-ORDERING — a rule that actually discriminates

**The P2 ordering clause failed and this replaces it.** In P2 all five eligible candidates differed from
doctest on all seven axes, so "most axes differing" tied everywhere and the **lexicographic tiebreak made
the choice**. A saturating criterion is not a criterion. It is recorded as
P2-SELECTION-ORDERING = UNDISCRIMINATING and is not reused.

Among eligible candidates, rank by:

> **FOREIGN-COORDINATE COUNT** — how many of the producer's native scoping coordinates have **no
> counterpart** among repository, environment, history, criterion, invocation, implementation.

Descending; ties broken by the count of P2 axes on which the candidate differs from **git** (not from
doctest — git is the more recent authority and the less-tested direction); remaining ties lexicographically.

Each candidate's coordinates are declared from its **documented design**, in the selection script, before
any of its output is observed.

**This ordering is ADVERSARIAL BY DESIGN and that asymmetry is declared in advance.** It deliberately
selects the candidate most likely to break the boundary. Therefore:

- a **failure is expected** and is weak evidence — it tells us the boundary bends under a coordinate
  chosen to bend it;
- a **pass is strong** — it means the boundary survived a producer picked to break it;
- and the failure MODE is predicted below, so "it broke" cannot be the only possible reading.

If no eligible candidate has a foreign-coordinate count above zero, the rule selects **nothing** and that
is the result: the six dimensions would then be unfalsified by anything available here, which is a
statement about this environment and not about the ontology.

## Predictions, frozen

Run against the **existing** boundary first, so any shape change is DISCOVERED rather than pre-empted.

| | prediction |
|---|---|
| **P3-1** | the selected producer emits at least one native scoping coordinate with no counterpart among the six — i.e. the selection did what it claimed |
| **P3-2** | **THE HYPOTHESIS.** Passing that coordinate through scope() **silently drops** it: no error, no record, no UNKNOWN. Falsified if it is preserved, or refused with a reason. |
| **P3-3** | admitDimension can be asked about that coordinate and can answer admitted:true, and that answer changes **nothing** — scope() still drops it. Demonstrated by **execution**, not by grepping for importers: a gate can have a consumer that never runs, and an import-count is not a decision path. |
| **P3-4** | the adapter does not squeeze the foreign coordinate into the nearest declared dimension. Dropping and inventing are *different* failures and the repair must not trade one for the other. |
| **P3-5** | **NON-VACUITY CONTROL.** A coordinate that IS one of the six survives scope() intact. Without this, "dropped" is unfalsifiable and P3-2 passes for free. |
| **P3-6** | producer failure remains non-knowledge: no records, no evidential force about the subject. |
| **P3-7** | doctest and git evidence are **byte-unchanged** through any repair — E1–E10 continue to hold. |
| **P3-8** | **AFTER REPAIR.** A foreign coordinate is either carried **with an explicit admission record** or refused **with a named reason**. Silently vanishing must become impossible, pinned by a test that fails if the drop path returns. |
| **P3-9** | **THE HARDEST, and the one most likely to fail.** After repair, an **unadmitted** foreign coordinate must **not** be able to defeat a comparison. Two claims differing only in an unadmitted coordinate must still be COMPARABLE. This is the anti-overfitting invariant of admissibility.mjs, and the obvious repair — making scope() open-ended — violates it. |
| **P3-10** | the repair does not widen authority: nothing that was refused before becomes admitted merely because a new dimension exists. |

## What a NULL result looks like

If P3-2 is falsified — the coordinate is already carried, or already refused with a reason — then the
producer #2 repair generalized further than its one counterexample justified, admitDimension's lack of
importers is not reaching the deciding path, and **no repair is warranted**. That outcome is recorded as a
falsified hypothesis of mine, not smoothed into a smaller finding.

## Out of scope

- Whether {observability, assertion} are the right two fields. Two producers fit them; that is not
  evidence that a third will, and this experiment does not test it.
- Repo D. Still blocked by sequencing, and every change made here extends that block.
