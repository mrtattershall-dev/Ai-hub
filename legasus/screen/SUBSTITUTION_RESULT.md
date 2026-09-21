# Shadow substitution result — A4 FAILS. Two defects, one mine, one in the replacement.
2026-09-21. Preregistration `SUBSTITUTION_PREREG.md`, acceptance bar frozen before the run.
Raw: `legasus/out/hadmission/substitution.json`. **Not merged. Not wired. Not proposed for
production.**

## Scoring

    A1  candidate generation identical          PASS   60, detection never called
    A2  previously legitimate claims mintable   PASS   F4 still mints
    A3  old O failures still refused/narrowed   PASS
    A4  Q-5 remains live                        FAIL   reported below
    A5  evidence removal never strengthens      PASS   on the steps the measure could see
    A6  multi-gate cases keep full vectors      PASS   F3' and F5 keep two failures each
    A7  falsifier fires                         PASS
    A8  no upward reformulation                 PASS as written, and the check is INADEQUATE

## Defect 1 — mine, and it is the exact error this whole line is about

`A4` reported `E1` inert. The semantics did move:

    E1 vector      PPP  ->  FPP        the obligation gate now fails where it passed
    E1 licensed    FOR_ALL over SAMPLE  ->  FOR_ALL over FUNCTION

What did not move was **my rank function in the test harness**, which scored both `SAMPLE` and
`FUNCTION` as 1.

> **I deleted the scope rank from the model and reintroduced a scope rank in the measurement of the
> model.** Same collapse, one layer out.

This is the fourth recorded instance in this branch of a measure being blind to the distinction its
subject was built to preserve, and the first where I re-committed the error I had just finished
removing.

## Defect 2 — in the replacement model, and it is the more serious one

The compiler was asked for `FOR_ALL over SAMPLE` and emitted `FOR_ALL over FUNCTION`. Under the
model's own comparison:

    compare(requested, emitted) = INCOMPARABLE
    compare(emitted, requested) = INCOMPARABLE

That is **not a restriction**. It is a **lateral reformulation** — a different logical formulation
that the available evidence happens to satisfy. `strongest_licensed()` returns the first
exhaustively covered domain it finds, with **no requirement that the requested claim license it**.

`A8` was frozen precisely to forbid this, and my falsifier for it was written to catch only
*upward* moves. Lateral moves pass unnoticed. **A8 passes and the check is inadequate**, which is
worse than a clean failure because it looks like a pass.

> The rule the model needs is stronger than "never stronger". It is:
> **the emitted claim must be licensed by the requested claim** — `compare(requested, emitted)`
> must be `LICENSES`, never `INCOMPARABLE`.

## Neither is repaired here

Repairing after seeing the result is the retroactive repair this branch forbids, and Defect 2
changes the compiler's semantics, which needs its own frozen test. Both are recorded with
reproductions. `entitlement.py`, `obligation.py`, `reach1.py` and `hadmission.py` are all unchanged.

## What the run does establish

The substitution is **not ready**, and the shadow path found that before any production wiring —
which is the entire purpose of shadow mode, now demonstrated twice. The first shadow run found the
scalar lattice; this one found a lateral-reformulation hole in its replacement and an identical
collapse in my own measure.

Six of eight criteria hold cleanly. The two that do not are both in the direction of *looking
correct while being wrong*, which is this branch's standing subject matter.

## Status and the decision that is not mine

No merge. No integration branch. No authority-bearing consumer. The certificate remains an
application for authority and mints nothing. `legaknow` was not written to and its worktree was not
touched.

The ordering you named stands, and this result moves the first item back a step: the obligation
model must satisfy `compare(requested, emitted) = LICENSES` before it can become authority-bearing.
