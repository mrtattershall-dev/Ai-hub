# BIND-CJS step 9 — try to kill the ancestry hypothesis (frozen 2026-09-21 04:55, before the worlds exist)

## Position on the map

The experiments have removed, in order:

    final execution identity is enough            NO   (step 7: M M S M M certified valid)
    preserve every execution identity             NO   (step 8: the foil collapses P-B and P-D)
    uniformity across identities is enough        NO   (same)
    process ancestry establishes relevance        <- UNTESTED, and this expedition attacks it

Step 8 left a tempting relation in the evidence: P-B's escaped descendant had
`ppid = witness`, P-D's stranger had `ppid = driver`. Writing `descendantOf(witness) =>
belongs to the intervention` would separate those two worlds immediately — **and both worlds
were built by me**, which is precisely why it must be attacked before it is believed.

## The hypothesis under attack

    H-ANC: an observed execution belongs to an intervention iff the executing process is a
           descendant of the process under the mechanism.

This is not a proposal. It is the obvious candidate, stated so it can be killed.

## The worlds

**A-1 — ancestry absent, causation present.** A worker process is started BEFORE the witness,
by the driver, and waits. The witness (under the mechanism) then sends it work; the worker loads
the target. Ancestry says `ppid = driver`, so H-ANC excludes it. But the execution happened
*because* the witness asked for it.

**A-2 — ancestry present, relevance absent.** The witness spawns a background process that loads
the target for work that is not part of any of the witness's cases. H-ANC includes it. Whether
it *should* be included is exactly what nothing here can decide — and structurally it is
**indistinguishable from step 8's P-B**, the escaped descendant H-ANC is supposed to catch.

**A-3 — ancestry not computable.** The witness spawns a child detached; the child spawns a
grandchild and exits immediately. The grandchild loads the target and reports its `ppid` — which
names a process that no longer exists. The chain from grandchild back to witness cannot be
reconstructed from the recorded evidence.

## Predictions

**A1 — UNDER-INCLUSION.** In A-1 an execution caused by the witness occurs in a process that is
not its descendant. H-ANC excludes evidence that a causal account would include.
FALSIFIER: the worker turns out to be a descendant, or never executes the target.

**A2 — OVER-INCLUSION, and indistinguishability.** In A-2 a descendant executes the target for
work outside the witness's cases, and the recorded evidence is identical in kind to P-B's.
H-ANC includes both or neither; it cannot separate them.
FALSIFIER: some recorded field separates A-2 from P-B without appeal to meaning.

**A3 — NON-COMPUTABILITY.** In A-3 the grandchild's `ppid` names an exited process, so
`descendantOf(witness)` cannot be evaluated from the markers alone.
FALSIFIER: the chain is reconstructible from what is recorded.

A1 and A2 attack H-ANC's *extension* — what it includes and excludes. A3 attacks whether it can
be *evaluated at all* from this evidence. They are different failure modes and are scored
separately; killing any one is enough to deny H-ANC the status of a sufficient basis, and none
of them establishes what should replace it.

## What this expedition may not do

- It may not adopt any replacement relation. If H-ANC dies, the corpse is preserved and the
  territory underneath is the next expedition's problem.
- It may not name a concept. `membership`, `relevance` and `intervention scope` are used in this
  document as English, not as proposed fields.
- It may not modify the mechanism (`legasus/cjs-preload.mjs` @ e41c1e3) or BIND's interpretation.
- It may not treat "the evidence does not entitle a conclusion" as a defect. If the honest
  output is that no recorded relation settles membership, **that is the finding** — a boundary
  between having observations and being entitled to compose them into a claim.

## Process hygiene

This experiment deliberately creates detached and orphaned processes. Every process it spawns is
recorded by pid and swept by pid at the end, and the sweep's result is reported. No kill by
image name, ever — other sessions and this agent are node processes too.
