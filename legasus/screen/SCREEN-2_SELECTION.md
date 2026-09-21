# SCREEN-2 target selection — criteria frozen BEFORE any query is run (2026-09-21 12:20)

Selection happens **now**, before INV-A2/INV-B2 exist, so the target cannot be chosen to suit
detectors whose behaviour I have seen. Detector state at selection time: **SCREEN-1's detectors
only, already falsified by CONTROL-1. A2/B2 are specified (dc4d63e) but not written.**

## What may be inspected at selection, and what may not

    MAY      repository metadata: name, owner, language, size, push date, contributor count,
             top-level and second-level PATH NAMES (names only), licence, fork status
    MAY NOT  any file CONTENT, any issue, any pull request, any commit message body, any
             release note, any discussion of known bugs

No source is read at selection. That is the whole point of doing it first.

## Criteria, frozen

    C1  primary language Python
    C2  pushed within the last 90 days                        (actively maintained)
    C3  not a fork, has a licence                             (independently authored, usable)
    C4  >= 200 KB repository size                             (proxy for "many source files")
    C5  >= 10 contributors                                    (independently authored by many)
    C6  a top-level `tests/` or `test/` directory exists      (names only; has a suite)
    C7  not `pewdiepie-archdaemon/odysseus`, not any repository already present on this
        machine, not authored by tatte                        (fresh, uninspected)

**C-UNESTABLISHED, recorded rather than faked:** "nontrivial external/system interaction"
cannot be established from metadata without reading source or descriptions, so it is **not**
used as a criterion. Whether the selected target has such interaction is unknown at selection
and will be reported as unknown.

## The pool and the deterministic rule

    POOL       GitHub search: `language:python pushed:>=<90d> stars:>=500`, first 100 results
               by the API's default ordering, which I do not choose.
    FILTER     every candidate must satisfy C1-C7.
    SELECT     among survivors, take the one whose `owner/name` string has the
               **lexicographically smallest SHA-256 hex digest**.

The hash rule is deliberately unsteerable: to bias it I would have to know the digests in
advance, and the rule is committed before the query runs. Stars >= 500 is a pool boundary, not a
quality judgement — it exists so the pool is populated by repositories with contributors, not to
select interesting ones.

## What gets frozen once selected

    repository full name
    exact commit SHA at selection
    selection timestamp
    the criteria above and each candidate's values for them
    what was inspected and what was not
    detector state at selection time

## After selection, in order

1. Implement A2/B2 from the contract (dc4d63e).
2. Run CONTROL-1 as a **conformance** gate — not capability evidence, per the contract.
3. Freeze detector bytes and their SHA-256.
4. Only then expose the frozen target's source to the detectors.
5. SCREEN-2.

## The three evidence classes, kept separate

    DESIGN                CONTROL-1        does the implementation match the specification?
    EXTERNAL FALSIFICATION Odysseus        did an independent corpus expose SCREEN-1's assumptions?
    PROSPECTIVE CAPABILITY SCREEN-2 target does the frozen instrument find something it was not
                                           designed around?

**These denominators are never combined.** They answer different questions, and a later report
that adds them together would be manufacturing evidence.
