# r4 — concurrency envelope of the V1 isolation. Predictions frozen before the experiment.

## Why this and not the other open ledger items

`OUTPUT_MISMATCH` naming (2/5) sits on the **replay** path, which the external-producer boundary has
largely superseded — and maintaining two independent implementations of doctest semantics would recreate
the exact problem just eliminated. It is a retirement candidate, not a repair candidate. The unresolved
attribution case is already represented honestly. **Concurrency is the only open item that threatens the
authority of NEW r4 evidence.**

## The three possible outcomes. None is inherently bad.

    PARALLEL_SAFE                two observations genuinely overlap while preserving protocol integrity,
                                 attribution and non-interference
    SERIALIZATION_REQUIRED       concurrent requests are safe only because observation is serialized
                                 around process-global state
    PROCESS_ISOLATION_REQUIRED   safe overlap requires each subject to receive its own process and
                                 descriptor namespace

The experiment determines the actual authority envelope. It does not have a preferred answer.

## NON-VACUITY, and it is strict

Overlap may **not** be inferred from `Promise.all`, timestamps, or successful completion. Both subjects
carry a barrier, and the result counts as a parallelism test only when the evidence shows:

    A entered
    B entered
    A observed B-entered before release
    B observed A-entered before release

Absent that mutual witness the outcome is **`OVERLAP_NOT_ESTABLISHED`**, which is not a pass.

## Four properties, attacked independently

    PROTOCOL INTEGRITY      subject bytes from A or B can never become observer evidence
    ATTRIBUTION             A's output and evidence cannot be attributed to B, or the reverse
    NON-INTERFERENCE        A's presence cannot change B's subject behaviour or verdict, or the reverse
    POST-FAILURE ISOLATION  a hostile or failing observation cannot contaminate the NEXT one

`NON-INTERFERENCE` is the dangerous one: perfect evidence attribution can be built around an execution
environment that has already changed the program being measured.

`POST-FAILURE ISOLATION` runs an exception, a descriptor closure, a forked child and a delayed write,
then immediately runs a known-good subject and compares it against its isolated control. Otherwise one
experiment contaminates a later experiment's history while the later record looks internally pristine.

## The attack that matters most

Subject A deliberately manipulates fd 1 **while B is alive** — `os.close(1)`, `dup2`, a fork with
inherited descriptors, and writes after the nominal observation window. If that defeats isolation the
finding is stronger than "dup2 needs a lock":

> the subject possesses causal authority over the same process-global resource the observer relies upon
> to establish evidence custody

A mutex cannot repair a trust-boundary mismatch. It can only schedule access to it.

## My prior, stated so it can be wrong

`runIsolated` spawns a separate process per observation, so I **expect** descriptor state to be per-child
and the attacks to fail. I also expect the current API to be serialized by construction, because
`execFileSync` blocks. If both hold, the honest result is that the isolation unit is already the process
while the API needlessly serialises — and the experiment must still try to break it rather than confirm
it. A prediction I believe is exactly the kind that needs the strict overlap witness.

## What is NOT being decided here

Whether to move to a worker-process architecture. **The current design must be made to fail first**, or
process isolation becomes architecture motivated by expectation rather than evidence.
