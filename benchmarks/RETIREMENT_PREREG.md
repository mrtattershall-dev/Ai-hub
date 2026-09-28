# r4 — retirement of the replay path. Predictions frozen before analysis.

## The question, stated so "grep found no callers" cannot answer it

> Can the replay path be removed without reducing any currently authorized capability, evidence
> production, verification, or auditability?

That distinguishes **unused code** from **obsolete authority**.

## Predictions

    R1  no live authority-bearing consumer requires replay-produced evidence
    R2  removing replay cannot reduce currently supported producer/adapter evidence
    R3  historical replay evidence remains interpretable and auditable AFTER the implementation is gone
    R4  no fallback silently routes external-producer failure back through replay
    R5  unsupported producer cases become explicit inability / UNKNOWN, never implicit replay
    R6  the retirement analysis can DETECT a genuine live dependency

**R6 is the control.** A dependency scanner that always reports "unused" produces a beautiful retirement
result and establishes nothing.

**R4 is the one to attack hardest.** The dangerous architecture is:

    producer succeeds  -> authoritative external evidence
    producer FAILS     -> "helpfully" replay it ourselves

which grants the least trustworthy implementation authority *precisely when* the stronger producer
becomes unavailable. That is a textbook violation of monotonicity: losing information would increase
entitlement. The correct shape is

    producer succeeds            -> scoped external evidence
    producer unavailable/fails   -> explicit non-knowledge

never *producer unavailable -> Legasus impersonates producer*.

## Retiring a mechanism is NOT deleting its history

Evidence produced by replay stays stamped with the semantics that produced it:

    producer = LEGASUS_DOCTEST_REPLAY

It does not retroactively become CPython-doctest evidence because the newer architecture is better. The
migration test follows directly: **delete the implementation, reload the historical record, and prove old
evidence retains its original provenance and remains representable.** If historical evidence becomes
unreadable when its implementation disappears, the ledger was never preserving evidence independently of
machinery.

## Why this matters beyond tidiness

Every prior step added a component because missing capability demanded one. This is the opposite
operation, and autonomy needs it or the architecture only ever grows:

> when authority migrates to a better-founded boundary, redundant machinery loses its justification and
> may be removed — and **verified subtraction is progress when it reduces duplicated authority while
> preserving the evidence-backed capability frontier.**

Deletion is not automatically progress. It is progress only under that condition, which is what R1–R5
test.

## If a live consumer is found

It is **not** ported reflexively. The consumer becomes the finding: what information does it actually
require, and does that information belong to the external-producer boundary, to historical raw evidence,
or somewhere else entirely?

## Carried forward, unerased

    POSIX_FORK_INHERITANCE = UNTESTED

The broader `PARALLEL_SAFE` label does not absorb it.
