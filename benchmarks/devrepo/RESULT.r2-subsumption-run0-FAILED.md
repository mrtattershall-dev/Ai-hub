# R1 run 0 — FAILED EXPERIMENT, preserved with its ancestry

Not deleted, not rewritten, and not re-scored after the cause was found. A justification-graph experiment
that edited its own history after discovering its evidence was bad would be self-refuting.

## What was claimed

> R1 The graph reproduces `legasus.committed` for all 12 recorded decisions.

## What was observed

    10/12, with two mismatches — T03 and T08 — both recorded `committed: true` with full oracle
    agreement (16/16 and 7/7), while the replayed structural gate reported PARSES = false.

## Why that was impossible, and what it actually meant

Code that r2 committed and that the differential oracle scored 16/16 necessarily parses. The
contradiction therefore could not be a disagreement about semantics; it had to be a disagreement about
BYTES. Hash before semantics.

**Lineage, checked downward:**

    RESULT.dev1.json
      -> legasus.code               431 chars? no: exactly 400
      -> run-arms.mjs:223           `code: code.slice(0, 400)`
      -> T03 tail                   `raise StatisticsError("no median for empty`   <- mid-string-literal

The artifact stores a 400-character PREFIX of the candidate, not the candidate. The replay parsed a
string that never existed in the run it claimed to be replaying. Historical r2 parsed the model's full
output.

## Verdict on run 0

**R1 is INCONCLUSIVE, not failed.** The graph was never tested on those five decisions, because the
evidence they rest on was destroyed at recording time. Of the 7 decisions whose evidence is complete
(the two short candidates and the five no-candidate refusals), the graph reproduced all 7.

## The hazard this exposes

> **An artifact that truncates its own evidence is not authoritative for that evidence.**

This qualifies the standing rule that JSON artifacts are authoritative and console output is
non-evidentiary. Authoritative for the DECISIONS it records; NOT authoritative for any field it
summarised on the way in. A recording cap is indistinguishable from complete data at read time unless
the artifact says so — which is why the fix is a digest of the FULL text alongside the stored text, so
truncation becomes detectable rather than invisible.
