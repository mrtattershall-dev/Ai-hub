# Repo C — selection rule, frozen BEFORE the candidate list is enumerated

Committed before running any enumeration. The rule is mechanical so that I cannot pick a target that
looks likely to flatter r3.

## Eligibility (boring properties only)

A candidate is eligible iff **all** hold. None of these requires inspecting semantics, failure modes, or
anything Legasus would be tested on.

1. Python, importable in this environment.
2. NOT `packaging` and NOT any module of the Python standard library used in `benchmarks/devrepo`.
   Both are burned development material.
3. Carries **externally authored evidence**: at least 20 doctest examples discoverable by CPython's own
   `doctest.DocTestFinder`, so the target supplies truth Legasus does not produce.
4. Size between 500 and 20000 call-time traceable lines, so the run is neither trivial nor unfinishable.
5. Pure-Python source available on disk (no compiled-only distribution).

## Selection, applied mechanically

Among eligible candidates, take the one with the **largest number of discoverable doctest examples**.
Ties broken by **lexicographically smallest distribution name**.

Rationale, stated in advance: more externally authored evidence gives the calibration measurement more to
be right or wrong about, and calibration is the measurement that makes the other three honest. This rule
is chosen for measurement power, not for expected performance — and it is fixed before the list is seen
precisely so that distinction is checkable.

## What is recorded at selection time

    distribution name and version
    absolute path of the pristine copy
    sha256 of every .py file, and a manifest digest over the sorted set
    discoverable doctest example count
    call-time traceable line count
    the enumeration output, verbatim

No candidate failure, no semantic property, and no Legasus result is inspected before this record is
committed.

## Known unresolved before Repo C, preserved verbatim

Recorded here so hindsight cannot turn a known limitation into either a surprising failure or a
conveniently newly discovered caveat:

> Known unresolved before Repo C: OWNER axiom; Law 7 half-reduction; shared authorship of internal
> equivalence results; 86% partial external probe; five specification mutations.

## Outcome vocabulary

Every run terminates in exactly one of:

    PASS / FAIL by the four frozen measurements
    APPARATUS INVALID    the result is uninterpretable; it is NOT pass, fail, or zero

`APPARATUS INVALID` has been earned several times in this project and remains available.

## Burn rule, restated

Any architecture change after exposure creates r4, and r4 requires Repo D for its prospective test.
