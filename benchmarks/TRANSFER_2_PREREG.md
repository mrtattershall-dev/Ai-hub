# PREREGISTRATION — TRANSFER-2. The hub run, after TRANSFER-1 failed on subject lifecycle.

Frozen before the run. Mechanism digest: **see `BACKWARD_2_FROZEN.txt`** (written at freeze time,
after the Legasus regression passes). `TRANSFER_1_PREREG.md` and `RESULT.transfer-1.md` stand
unamended.

## ANCESTRY — what TRANSFER-1 established, kept permanently visible

    TRANSFER-1   MECHANISM_FAILURE
                 the runner began; the subject terminated the process; 2 of 90 entries executed;
                 the remaining entries were never observed; NO repository-level result was produced.

The 23 lines it produced are **apparatus evidence, not hub evidence.** A future reader of a
successful transfer must be able to see that the first frozen architecture could not survive ordinary
subject lifecycle behaviour. That is why this is TRANSFER-2 and not a re-run of TRANSFER-1.

## THE DEMONSTRATED ASSUMPTION, AND THE REPAIR

TRANSFER-1 falsified, prospectively, on a repository I had not looked at for this:

> the frozen observer assumed multiple subject entries could safely share observer process lifetime.

That statement is deliberately narrow. It is **not** being generalised into H-LOSS, H-DISTINCTION,
representation leakage, or process authority, even though several of those descriptions would fit.
The raw prospective statement is stronger than any frame it could be filed under.

The repair is the abstraction boundary, not the line ordering: **the observer must not share a
failure or lifetime domain with the thing it observes.** One child per entry; the protocol record is
registered before the subject is touched; the child then **lets the subject drain naturally**.

### A second defect, found while repairing the first

The first version of the repair called `process.exit(0)` as soon as `await import()` returned. But
`await import()` returns when a module has been EVALUATED - for a test file, when its tests are
REGISTERED, not run. Legasus fell from 4132 witnessed effects to 2295, and from 717 process
executions to 10, **while every lifecycle control still passed.** A repair for a silent failure that
introduced a quieter one. Recorded here because it was found before freezing, not after.

## LIFECYCLE CONTROLS, ALL PASSING BEFORE THE FREEZE

`legasus/legascreen/lifecycle.test.mjs` forces each outcome the observer must tell apart:

    NORMAL_RETURN            a returns           -> COMPLETE
    EXPLICIT_EXIT_0          b exits 0           -> SUBJECT_TERMINATED
    EXPLICIT_EXIT_NONZERO    c exits 1           -> SUBJECT_TERMINATED
    LOAD-TIME THROW          d throws            -> REFUSED
    EXIT BEFORE ANY EFFECT   e exits first       -> SUBJECT_TERMINATED, EFFECTS UNESTABLISHED
    NEVER RETURNS            f holds the loop    -> TIMED_OUT

**The invariant:** a subject's control over its own lifetime must not control whether the observer
records that observation's epistemic state, nor whether subsequent observations occur.

And the guarded variant, because it is the same family as the unparsed frame and the silent child:

> `process.exit(0)` before any effect must NOT become a successful empty observation.

An entry that exits, hangs or crashes contributes to `EFFECTS ARE UNESTABLISHED` and **may never
support a claim that it caused nothing.**

*One control could not fire at first:* the hang fixture used a bare unsettled top-level `await`, and
Node exits code 13 when the loop drains with a pending promise - so the subject terminated itself and
TIMED_OUT stayed at 0. Repaired with a live interval, which is what a subject starting a server
actually does.

## PREDICTIONS

Reported as six independent coordinates. **None is averaged into the others, and no percentage is
reported whose denominator excludes the unobservable region.**

**U-1. Effects are witnessed.** > 0 EFFECT_WITNESSED from the hub's own tests.

**U-2. Ancestry crosses PRIVATE production code.** > 0 private functions on PRODUCTION_REACHED paths.
Reported as PARTICIPATION, not relevance.

**U-3. The structural backdoor detector fires on its first natural specimen.** It has only ever fired
on a constructed fixture. *Falsified if* it finds none, or flags things that are not aggregates of
module-private bindings.

**U-4. Backward recovers territory forward cannot.** Forward is predicted to find ~nothing; the
intersection is predicted ~0. **Neither is a success or a failure. Intersection is NOT the metric.**

**U-5. Subject lifecycle no longer controls the observer.** Every entry ends in exactly one of
COMPLETE / REFUSED / SUBJECT_TERMINATED / TIMED_OUT / NO_RECORD, and `NO_RECORD` is 0.
*Falsified if* the run produces no report, or any entry is silently absent.

**U-6. The CommonJS region appears in the denominator.** The hub is mixed; Legasus was 100% ESM, so
this coordinate has never fired on a real subject.
*Falsified if* any coverage figure hides it.

**U-7 (THE DANGEROUS NULL, PREREGISTERED AS FAILURE).** If witnessing requires entering through the
hub's test-only exports, naming any hub function, or configuring the run with knowledge of the hub's
intended architecture, **THE TRANSFER FAILS** and is reported as failed.

**U-8 (PREDICTION OF NO DETECTION).** No hub defect is found or reported.

## CONDITIONS

- **Clean room.** A copy outside the hub repository, discarded after. The hub repository is never
  executed, never written to, and never has a process started inside it.
- **Environmental vs mechanism failure**, fixed again: a missing module or a busy port is
  environmental and may be retried. An instrument that produces no data in a working environment is
  the result.
- **A third run.** Any edit to a frozen file makes the next attempt TRANSFER-3, with this result
  standing as recorded. The hub has already stopped being unspoiled; it has not stopped being
  informative.

## WHAT THIS SLICE DOES NOT ESTABLISH

- Not SUPPORT_CHARACTERIZED, not JUSTIFICATION_ESTABLISHED, not SCREENED.
- Nothing about the hub's correctness or defects.
- L-3's `String(v)` and DX-1's `semantic()` remain unrepaired; neither is on the backward path.
- The bridge-mutation gap from Entry 30 remains open.
