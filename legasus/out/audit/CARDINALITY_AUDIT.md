# Ledger cardinality audit — what unit does each artifact-derived number actually name?
2026-09-21 03:40. Instrument: `legasus/transfer/cardinality-audit.mjs`. Raw:
`cardinality-audit.json`. Ten checks, run against stored artifacts, not against prose.

## Why this audit exists

Three claims in this ledger asserted a unit the artifact never established, by three different
mechanisms:

    272 records         was not 272 independent findings     (corrected 2026-09-21)
    23 spawn-calling    was not 23 spawning executions       (corrected at step 1, by running)
    266 coverage files  was not 266 processes                (corrected at step 6, by pid)

The narrow question here is not "are the numbers right" — they were. It is: **what is the
cardinality of the thing each claim names?**

## Results

| # | Claim | Artifact counted | Unit asserted | Verdict |
|---|---|---|---|---|
| 1 | "34 mutants, all valid" | 34 mutant files | distinct perturbations | **VERIFIED** |
| 2 | "93 cases" / "3162 records" | 3162 case records | witness cases × mutants | **VERIFIED** |
| 3 | "87 calls, 57 distinct inputs" | 87 call records | distinct argument values | **VERIFIED** |
| 4 | "568 licensed edges" | 568 edge records | (case, class) pairs | **VERIFIED** |
| 5 | "272 UNASSERTED" | 276 joined records | classes exhibiting the signal | **CORRECTED** → 17 classes |
| 6 | "266 coverage processes" | 298 coverage files | processes | **CORRECTED** → 33 processes |
| 7 | "776 uniquely identified cases" | 776 PASS/FAIL lines | uniquely identified cases | **UNVERIFIABLE** |
| 8 | "95–99 executed scripts" | coverage script entries | distinct executed modules | **VERIFIED** |
| 9 | "held across 266 re-evaluations" | 266 snapshots/markers | re-evaluations in ONE run | **VERIFIED** |
| 10 | field name `totalProcessesWithCoverage` | file count | processes | **MISMATCH** |

Tally: 6 VERIFIED, 2 CORRECTED, 1 UNVERIFIABLE, 1 MISMATCH.

## What each non-clean row means

**#5 and #6** are the two already-known corrections, re-established here from raw data rather
than from the earlier write-ups, so the audit does not inherit its own conclusions.

**#7 UNVERIFIABLE, and the distinction matters.** Within-file uniqueness of case ids IS
established (0 duplicates across 33 files). Cross-file uniqueness of the id *string* is not, and
cannot be from stored evidence: step 1 recorded counts, not id strings. **No claim made anywhere
is endangered by this**, because witness identity is the `(file, id)` PAIR everywhere it is
used. But a claim of globally unique ids would be unsupported, and is now marked so rather than
quietly assumed.

**#10 MISMATCH, and it is mine, from tonight.** The step-6 runner's field is named
`totalProcessesWithCoverage` while holding a count of coverage files. The stored artifact is left
as written — renaming it retroactively would erase the evidence that the error was made in the
instrument built to measure that exact error, one layer down, hours after finding it upstream.

**#1 needed explaining rather than accepting.** 34 mutant files have 34 distinct byte-contents
but only **31** distinct `(family, site)` pairs. That is not a collision: one family can yield
several mutants at one site (BOUNDARY gives both `+1` and `-1` on a numeric literal). `(family,
site)` is not a unique key; distinct byte-content is. Had the audit reported "31 perturbations"
it would have manufactured a smaller number by choosing the wrong key.

## The audit's own defect, recorded

On its first run, check #3 reported MISMATCH because it read `distinctInputs` from
`inputs.json`, where that field does not exist — `undefined` compared unequal to 57 and the
check failed for a reason that had nothing to do with the claim. Fixed and re-run. A checker of
checkers needs checking too, and this one needed it within a single run.

## Scope, honestly

This audit covers the **quantitative claims derived from artifacts in this branch's records**.
It does not cover: claims in prose that were never computed from an artifact; the hub's own test
counts; or 0d's and Session 75's ledgers, which are theirs. It is not a general law about
counting — three occurrences and one audit justify the audit, not a canon.

## Standing check, cheap to repeat

For a number derived from artifacts, before it is written down: name the artifact, name the
unit, and state the mapping between them. Where the mapping is many-to-one (records → findings,
files → processes, calls → inputs, edges → classes, snapshots → replications), report **both**
cardinalities or the smaller one. Tonight that rule would have caught all three corrections at
the moment of writing rather than one, two and six hours later.

## Named future experiment (recorded 2026-09-21, not started, not architecture)

**Can changing only the grouping key change an authority-bearing conclusion?**

Check #1 showed that "distinct count" is not meaningful without stating the equivalence
relation: 34 byte-distinct mutants, 31 distinct (family, site) pairs. Neither number is more
truthful — they answer different questions. The same shape sits behind every correction in this
ledger:

    276 records        vs  17 behavioural classes
     87 calls          vs  57 inputs
    298 coverage files vs  33 processes
    568 edges          vs  21 classes
     10 resolutions    vs   5 evaluations        (found at step 7)

The experiment is NOT "count more carefully". It is: take a conclusion this project actually
relied on, recompute it under a different but defensible equivalence relation, and see whether
the conclusion flips. If one does, the primitive that earns its existence is roughly *every
cardinality claim carries its unit AND its equivalence relation* — and it would be earned by a
demonstrated flip, not by the elegance of the sentence.

Deliberately not started, and deliberately not mechanised: the standing check at the end of this
document is prose discipline, and check #10 proved prose discipline is not sufficient. That is
an argument for an experiment, not yet for a mechanism.
