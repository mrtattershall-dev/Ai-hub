---
name: baseline-consumers-before-changing-shared-code
description: "Run the tests that consume a behaviour BEFORE changing it - on 2026-09-12 that caught two wrong versions of the rollback bound that my own fixture reported green"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-12T06:19:46.256Z
---

Before touching the hub's end-of-run repair I ran the two tests that read its output - `rollbackCarryover` (3/3) and
`runLifecycle` (9/9) - and wrote the numbers down. That baseline caught **two** wrong versions of the fix, each of
which made my own new fixture pass:

1. Bounding by the first RECORDED checkpoint. A checkpoint commits the state BEFORE the write it precedes, so when the
   tree is clean at a run's first write, `commitAll` commits nothing, **no checkpoint step is recorded at all**, and the
   first recorded checkpoint contains the run's OWN first write. Excluding it refused a legitimate repair:
   `rollbackCarryover` 3/3 -> 0/3, its good file living at the floor commit itself.
2. Refusing whenever the bounded candidate set was empty. Wrong for a run that wrote nothing: the breakage predates it,
   so restoring takes nothing from it, and refusing leaves the next goal to fail on the same file.
   `runLifecycle` 9/9 -> 6/3 - its fixture commits six broken versions before the run starts and its run writes nothing.

Final rule: bound only when the run landed a mutating write, using the checkpoint's PARENT; otherwise repair unbounded.
Six mutants, six caught, one of them proving the no-writes carve-out is load-bearing.

**Why:** a new test proves the new behaviour; it says nothing about the behaviour you removed. Only the existing
consumers can tell you that, and only if you know what they said beforehand - "it was probably already failing" is
exactly the excuse that lets a real regression through.

**How to apply:** identify consumers by grepping for the *strings and fields* the behaviour emits, not just imports -
`grep` for the note wording found four consumers here. Record their pass counts before the change. Afterwards, a
consumer failing is a hypothesis about the contract, not proof the consumer is stale: `runLifecycle`'s failure was a
genuine contract conflict that revealed a missing case, not a fixture to update. Also reuse an existing predicate
rather than restating it - the repair borrows the repeat guard's own `landed` filter verbatim so the two cannot drift.

Related: [[fixture-blocked-by-another-guard]], [[honest-answer-can-disable-its-guard]],
[[silent-failures-are-the-class]], [[advisory-vs-mechanical-recovery]].
