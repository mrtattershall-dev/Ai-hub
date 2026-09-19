# r4 — concurrency envelope of the V1 isolation

Predictions frozen in `c570437` before the run, including my own prior.

## Overlap was established, not assumed

    A saw B entered : true
    B saw A entered : true
    distinct pids   : true

The mutual witness is what licenses anything below. Without it the result would have been
`OVERLAP_NOT_ESTABLISHED`, which is not a pass.

## The four properties

    PROTOCOL INTEGRITY      HELD   both subjects forging the other's protocol WHILE overlapping
    ATTRIBUTION             HELD   A's bytes never appear in B's record, or the reverse
    NON-INTERFERENCE        HELD   hostile A cannot change B's verdict (solo 42, concurrent 42)
    POST-FAILURE ISOLATION  HELD   a crashing subject that closed fd 1 did not contaminate the next run

## Verdict: PARALLEL_SAFE, and the reason matters more than the verdict

Each observation receives **its own process**, so descriptor state is per-child and the subject's causal
authority over fd 1 never reaches another observation.

> **The isolation unit is the PROCESS, not the call.**

That is the answer to the question the ledger actually asked: the current unit of isolation *does* match
the unit of authority, because the OS boundary and the evidence boundary coincide. No mutex is needed,
and a mutex would not have helped if they had not coincided — it can only schedule access to a shared
resource, never repair a trust-boundary mismatch.

## ONE ATTACK WAS VACUOUS AND IS RECORDED AS UNTESTED

The fork-with-inherited-descriptors attack was guarded by `hasattr(os, "fork")`, which is **False on
win32**. It silently skipped. That attack therefore proves nothing and the envelope **excludes** it:

    fork / inherited-descriptor attack   NOT TESTED on this platform

Everything that did run: protocol forgery during overlap, `os.close(1)`, `dup2` to devnull, a late write,
and a crashing subject followed immediately by a known-good one compared against its isolated control.

## Scope of the claim

    platform      win32, CPython 3.13
    threat model  cooperative-but-noisy code, as declared for V1
    unit          one OS process per observation
    untested      POSIX fork and descriptor inheritance; concurrent observation from multiple host
                  processes; descriptor exhaustion

## A note on the synchronous API

`runIsolated` uses `execFileSync` and therefore **cannot overlap from a single caller**. An async runner
was added for this experiment, because *"cannot be tested" must never be recorded as "is safe"*. The
serialization in the existing API is incidental, not the source of the safety — the safety comes from
process isolation, which holds under genuine overlap.

## My prior was correct, and that is the least interesting part

I predicted the attacks would fail because each observation already gets its own process. The value here
is not that the prediction held; it is that the overlap witness was strict enough to make a false
prediction visible, three of the four attacks genuinely executed, and the fourth was caught as vacuous
rather than counted.
