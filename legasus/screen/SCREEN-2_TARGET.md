# SCREEN-2 target — SEALED (2026-09-21 12:35)

Selected by the rule frozen at f364471, executed by `legasus/screen/select_target.py`. Raw
record: `legasus/out/screen2/selection.json`.

    repository        harry0703/MoneyPrinterTurbo
    commit SHA        919170b05831...  (full SHA in selection.json)
    commit date       2026-09-20T13:57:24Z
    selected at       2026-09-21, before INV-A2/INV-B2 were written
    detector state    SCREEN-1's detectors only, already falsified by CONTROL-1

## How it was chosen

    pool          100 repositories, GitHub search `language:python pushed:>=<90d> stars:>=500`,
                  the API's default ordering, which I did not choose
    filtered      C1-C7; 15 rejected on metadata, 12 survived
    rule          lexicographically smallest SHA-256 of `owner/name`
    digest        016460081a9c... - the smallest of the twelve

The twelve survivors, with digests, are recorded in `selection.json`. The rule was committed
before the query ran; steering it would have required knowing the digests in advance.

## What was inspected — the complete list

    name, owner, primary language, repository size (537571 KB), push date, contributor count
    (>= 10), licence and fork status, top-level directory NAMES
    (.github, app, docs, resource, test, webui), and the head commit SHA and date.

## What was NOT inspected

**No file content. No issues. No pull requests. No commit message bodies. No releases. No
discussion of known bugs.** Nothing about this repository's behaviour, quality, or defects is
known to me at sealing time.

## Recorded as unestablished

"Nontrivial external/system interaction" could not be determined from metadata and was
deliberately not used as a criterion. Whether this target has such interaction is **unknown**
and must not be asserted later from the fact that it was selected.

## The sealed order that follows

    1  implement INV-A2 / INV-B2 from the contract (dc4d63e)
    2  run CONTROL-1 as a CONFORMANCE gate - not capability evidence
    3  freeze detector bytes and their SHA-256
    4  only then expose this target's source
    5  SCREEN-2

Exposing the source before step 3 would forfeit the independence this sealing exists to create.
