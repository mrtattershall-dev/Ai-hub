# BIND-CJS step 7 — repeated-evaluation contradiction (frozen 2026-09-21 03:55, before the fixture exists)

## The question, kept extremely narrow

**Can one contradictory execution among repeated evaluations of the same requested target be
erased by the current scalar intervention representation?**

Not "is the representation elegant". Not "design a better event model". One question, one
representation, one possible information loss.

## What is under test, and what is not

Under test: the **step-5 scalar classifier**, unchanged — `executed` = the last marker identity,
`served` = the last served record for the aimed module, and the state function derived from the
triple. It is applied verbatim.

Not under test: `legasus/cjs-preload.mjs` (frozen at e41c1e3). The mechanism is not accused of
anything here. Step 6 already showed it holds a substitution across 266 re-evaluations.

## A limitation stated before it becomes convenient

**A real mid-run contradiction cannot be produced by the frozen mechanism, because the mechanism
is deterministic**: given one map, every resolution of the mapped path is answered the same way.
That is a property of the mechanism, and recording it is part of this result.

So the arms are built as follows, and the split is declared now:

    R-A  uniform replacement      REAL RUN    real mechanism, fixture re-requires the target 5x
    R-E  uniform subject/bypass   REAL RUN    no map; all five evaluations load the original
    R-B  middle contradiction     CONSTRUCTED M M SUBJECT M M
    R-C  terminal contradiction   CONSTRUCTED M M M M SUBJECT
    R-D  early contradiction      CONSTRUCTED SUBJECT M M M M

The constructed arms are made by editing **only the identity sequence** of R-A's real evidence
bundle, leaving every other field — record shape, pids, served records, ordering — as the real
run produced it. They are therefore evidence of the same shape a real run produces, and nothing
else about them is invented.

**Bridge control (must pass or the whole experiment is void):** the classifier's verdict on
R-A's real bundle must equal its verdict on a CONSTRUCTED-uniform bundle built by the same
editing path. If construction changes the verdict on an unchanged sequence, the construction is
not faithful and no constructed arm may be read.

## Preregistered expectations

| arm | identity sequence | the classifier MUST NOT say |
|---|---|---|
| R-A | M M M M M | — (VALID_INTERVENTION is correct here) |
| R-B | M M **SUBJECT** M M | VALID_INTERVENTION |
| R-C | M M M M **SUBJECT** | VALID_INTERVENTION |
| R-D | **SUBJECT** M M M M | VALID_INTERVENTION |
| R-E | SUBJECT ×5 | anything but SUBSTITUTION_UNOBSERVED |

## Predictions

**C1.** R-B is classified `VALID_INTERVENTION`. A contradictory execution in the middle of the
sequence is erased, because only the last observation is consumed. This is the claim of actual
information destruction — not an ugly internal representation, but an authority-bearing
conclusion reached from evidence that contradicts it.
FALSIFIER: R-B is not `VALID_INTERVENTION`. Then something already protects the sequence and
the scalar is safer than it looks.

**C2.** R-C is NOT classified `VALID_INTERVENTION` — a last-wins implementation catches a
terminal contradiction.
FALSIFIER: R-C is also `VALID_INTERVENTION`.

**C1 and C2 together are the point.** The same contradiction, moved from position 3 to position
5, changing the verdict, isolates **positional dependence** cleanly. Neither prediction alone
establishes it.

**C3.** R-D behaves as R-B (`VALID_INTERVENTION`), since last-wins is blind to every position
but the last.

## No repair inside this experiment

If C1 fires, the experiment **stops**. That is the result. No multiplicity-aware classifier is
written here, no `uniform` field is added, no state is invented. The raw evidence already
records the full sequence and the distinct-identity set; the finding is that the classifier
discards them, and any redesign is a separate preregistration that must state in advance what
it would be allowed to conclude.

## What each outcome would mean

- **C1 fires:** scalar intervention identity destroys authority-relevant information. The
  Intervention abstraction stays closed, now for a demonstrated reason rather than an unexercised
  one — and the next version must represent an execution *set* with a uniformity fact, because
  evidence showed the scalar lost something, not because a diagram looked better.
- **C1 falsified:** the scalar survives a direct attack and the representation is stronger than
  step 6's raw data suggested. Recorded as such; the abstraction question then rests on process
  composition alone.
- **Bridge control fails:** the experiment is void, the construction path is the defect, and
  nothing is concluded about the classifier.

## Scope

One fixture, one target, five evaluations, one classifier. This says nothing about process
composition (step 8), about the foreign engine, or about BIND's interpretation rules, which are
untouched.
