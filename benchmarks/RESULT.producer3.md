# r4 — producer #3 (pytest) against the evidence boundary. RESULT.

Selection rule and predictions P3-1…P3-10 were frozen in `0baca08`, committed **alone** before the
candidate table existed. This file is written after the fact and changes neither.

Apparatus: `benchmarks/producer3-selection.mjs`, `legasus/legaexternal/pytest-producer.mjs`,
`legasus/legaexternal/producer3.test.mjs` (12 tests). Suite: **456 tests, 456 pass, 0 fail.**
Frozen r3 shadow-graph numbers re-run and unchanged: **56/56, 44/44, 142/142**, subsumption **56/56** and
**51/51**.

## 1. Selection: the new ordering rule half-worked

    tool         avail  vs-doctest  vs-git  FOREIGN  eligible  why not
    trace        true        7       7        2  true
    timeit       true        7       7        2  true
    pytest       true        7       7        2  true
    difflib      true        7       7        1  true
    symtable     true        7       6        0  true
    py_compile   true        7       6        0  true
    unittest     true        7       7        0  true
    sqlite3      true        7       7        2  false   NOT a fact Legasus has reason to consume

**The improvement is real:** foreign-coordinate count spread **2 / 1 / 0**, where P2's criterion had
saturated at 7/7 for every candidate. The eligibility filter also did visible work — sqlite3 scored two
foreign coordinates and was refused for not being a fact Legasus has reason to consume.

**And it still did not finish the job.** Three candidates tied at 2, the first tiebreak (axes differing
from git) saturated at 7 among them, and **the lexicographic tiebreak decided a second time.** Recorded,
not smoothed: `P3-SELECTION-ORDERING = DISCRIMINATING BUT NOT DECISIVE`.

The honest hazard is on the record too: **the ranking is my coordinate assignment.** Two defences, neither
complete — every coordinate declares what it maps to, so a disputed call is visible rather than buried in
a score; and every *arguable* coordinate was resolved **conservatively**, assigned to one of the six rather
than counted as foreign, which biases against the hypothesis this experiment wanted to confirm.

## 2. The foreign coordinate is real, and it is demonstrated rather than asserted

    pytest test_cohort.py::test_b      test_b PASSED
    pytest test_cohort.py              test_b FAILED

A module-scoped fixture, two tests. Same nodeid, same file bytes, same interpreter, same criterion. The
only thing that changed is **which other tests were collected alongside it** — a set that test_b is not
the only member of, and that none of repository / environment / history / criterion / invocation /
implementation names.

## 3. Predictions

| | pre-repair | outcome |
|---|---|---|
| P3-1 | the selection produced a genuinely foreign coordinate | **HELD**, by execution |
| P3-2 | scope() silently drops it | **HELD** — no error, no record, no UNKNOWN |
| P3-3 | admitDimension says yes and nothing changes | **HELD**, by execution, not by import-grep |
| P3-4 | the adapter does not squeeze it into a declared dimension | **HELD** |
| P3-5 | non-vacuity control: a declared coordinate survives | **HELD** |
| P3-6 | producer failure is non-knowledge | **HELD** |
| P3-7 | doctest and git unchanged | **HELD** |

| | post-repair | outcome |
|---|---|---|
| P3-8 | a foreign coordinate can no longer silently vanish, end to end | **HELD** |
| P3-9 | an unadmitted coordinate may not defeat a comparison | **HELD** |
| P3-10 | admitting narrows authority, never widens it | **HELD** |
| P3-10b | the gate refuses with a reason, and a refusal changes nothing | **HELD** |

## 4. THE DISCOVERY — worse than what was predicted, and not predicted

The prereg predicted a **silent drop**, and that held. What was found is worse. Adapting the two pytest
records and comparing them, pre-repair:

    native results     PASSED  vs  FAILED
    scopes             IDENTICAL on all six dimensions
    joinConflicts      []            - the join gate saw NO conflict
    covers             ok: true      - each covered the other

**The closed dimension set did not merely lose information. It reported a contradiction as agreement.** A
dropped coordinate is a gap; this is a gap that manufactures consensus, and a ledger built on it would
record two incompatible verdicts as mutually supporting.

Because this was **not** predicted, it is labelled a discovery and **not counted as a confirmed
prediction**. P3-9 keeps its frozen post-repair meaning.

## 5. THREE APPARATUS FAILURES OF MY OWN, all inside the repair

1. **The first repair passed its own tests while the defect survived one layer up.** I fixed `scope()` to
   record rather than drop — and the adapter discarded pytest's collectionCohort *before scope() ever saw
   it*. The suite went green at 452/452 with the contradiction fully intact. Found by **executing the
   pipeline end to end**, not by reasoning about it. *Fix the deciding path, not the advisory one* — a
   lesson this project had already paid for, re-learned inside the fix for that same lesson.
2. **The merge threw the carried coordinates away.** My `scope()` filtered out the UNADMITTED key to avoid
   nesting, silently discarding everything the adapter had just carefully carried. The same defect wearing
   a third face.
3. **pluginSet carried a memory address.** `list_name_plugin()` names some entries `str(id(obj))`, so the
   coordinate changed every run — a distinction manufactured out of a heap pointer, which is exactly the
   accidental difference the anti-overfitting law exists to refuse. Caught only because a failing test
   printed the value.

## 6. The repair

`admissibility.mjs` had always held the gate — admitDimension, registry, comparisonDefeat,
discriminatingProjection — with the whole anti-overfitting argument behind it, and **nothing consumed any
of it.** The repair makes the gate the only door:

- `scope()`, `covers()` and `joinConflicts()` read the **active registry** instead of a module constant;
- a coordinate outside the active set is **recorded under UNADMITTED**, never dropped;
- UNADMITTED is **not read** by `covers()` or `joinConflicts()`, so recording a difference can never become
  an excuse for refusing to compare;
- `admitScopeDimension()` is the only way in. It runs the gate, it requires the entry to declare its own
  **CONTEXT/SUBJECT side** because law 5 turns on that split, and a refusal comes back **with its reason**
  and changes nothing;
- admission **promotes** a coordinate already being carried, with no re-observation and no rewriting of
  any stored record.

The payoff is the last assertion of the discovery test. Once collectionCohort is admitted through the gate
on pytest's documented fixture semantics, the two verdicts stop being a contradiction at all: they become
claims about **different subjects**, refused a comparison for a stated, independently argued reason. That
is what the architecture always claimed and had never implemented.

## 7. Scope and what is NOT established

- **Three producers is not "generic".** It is two demonstrated bends and two repairs.
- **The six still cannot explain the pytest contradiction on their own.** The repair did not add a
  dimension; it built the door. Nothing here argues that collectionCohort *should* be standing.
- **The mutable module-level registry is a real hazard**, named in the source rather than hidden: module
  state makes test order matter. It was accepted because threading a registry through every caller leaves
  the default path unwired, which is the defect being repaired. `resetScopeDimensions()` exists for
  hygiene and every test that admits anything calls it.
- **P3-SELECTION-ORDERING discriminates but does not decide**, and the coordinate assignment driving it is
  mine.
- Whether {observability, assertion} are the right two fields is still untested. Three producers now fit
  them; git fits only by being allowed to decline the second.
- win32 only. pytest 9.1.1.
- **Repo D is now further away, not closer.** This is another architecture change, and the frozen burn
  rule says r4's prospective test cannot begin while r4 is still changing.
