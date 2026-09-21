# SCREEN-2 predictions — frozen with the detector bytes, before the target is opened
2026-09-21 13:00. Detector hashes: `DETECTOR-FREEZE.json`. Target sealed at 65da312:
`harry0703/MoneyPrinterTurbo @ 919170b05831`. **No source from it has been read.**

## CONTROL-1 as a conformance gate — what it did and did not establish

PASSED 6/6: five preregistered positives flagged, both negatives absent, cardinality held,
observability held. Per the contract, this establishes **that the implementation matches the
specification**. It is not capability evidence: the cases are mine and A2/B2 were designed with
them in view.

Verdict distribution on the corpus, which shows the three states carrying weight rather than
collapsing to two:

    INV-A2  VIOLATION 6   DISTINGUISHABLE 2
    INV-B2  PROVEN_FAILURE_UNREACHABLE 4   UNKNOWN 2

`is_ready_host` (computed return) → UNKNOWN, and `token_missing` (inverted polarity) →
DISTINGUISHABLE. Both were false positives under SCREEN-1 and neither is reported now — without
a single name-based polarity rule.

## Predictions about SCREEN-2, made blind

**S1.** INV-A2 produces **at least one VIOLATION** somewhere in the target. Rationale: the
`try/except: return <same literal>` shape is common in Python written under time pressure, and
the target is 537 MB with >=10 contributors.
FALSIFIER: zero VIOLATIONs.

**S2.** UNKNOWN outnumbers every reportable verdict, for both invariants combined. Rationale:
the supported equivalence relation is deliberately narrow, and real code returns computed
expressions far more often than bare literals.
FALSIFIER: reportable verdicts >= UNKNOWN verdicts.

**S3.** INV-B2 produces **fewer** PROVEN_FAILURE_UNREACHABLE findings than INV-A2 produces
VIOLATIONs. Rationale: a check-named function that can only ever return truthy is a stranger
shape than an error path returning the success value.
FALSIFIER: INV-B2 >= INV-A2.

**S4 (the one I expect to be wrong).** Every reportable candidate will survive manual reading as
a genuine instance of its invariant — precision 100%. Rationale: A2/B2 report only what they can
establish structurally. FALSIFIER: any candidate is a false positive on reading. **I expect this
to fail**, because SCREEN-1's precision was 0/3 and no detector has yet survived contact with
code it was not designed around.

## Rules for the run

The detector is **not modified** during SCREEN-2. If it misbehaves, the run is reported as it
stands and any fix is a new frozen version with its own predictions. Candidates are read in
file-path order, not by how interesting they look. Raw hits are counted separately from logical
locations. Nothing is published or filed anywhere.
