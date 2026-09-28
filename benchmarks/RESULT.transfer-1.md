# r4 — TRANSFER-1, RUN 1. RESULT: THE TRANSFER FAILED. The mechanism never reported.

Preregistered in `TRANSFER_1_PREREG.md`. Mechanism frozen at COMBINED `76f35914abd5b737`, **verified
immediately before the run**. Clean room built as required; the hub repository was never executed,
never written to, and never had a process started inside it.

## What happened

    exit = 0
    log  = 23 lines
    BACKWARD-1 report: ABSENT

Two of the hub's 90 test files ran. Then the process ended, and **the report was never printed.**

## The cause, diagnosed before being called anything

    all 90 hub test files call process.exit
    run-backward.mjs:48   await import(each test file)
    run-backward.mjs:51   process.on('exit', ...)     <- registered AFTER the imports

The second test file called `process.exit(0)` while the runner was still importing. The exit handler
did not yet exist, so nothing reported.

**This is a MECHANISM failure, not an environmental one**, by the rule fixed before the run: a
missing module or a busy port is environmental and may be retried; an instrument that produced no
data while the environment worked is the result. The environment worked - hub tests ran and passed.

The unstated assumption was: **a subject does not terminate the process.** True of Legasus, whose
tests are `node:test`. False of the hub, whose 90 test files are bespoke runners that exit when they
finish. Written into the harness by a subject that never violated it.

## The coordinates

    T-1  can frozen sink discovery witness effects there?      NOT ESTABLISHED
    T-2  can ancestry cross private production code?           NOT ESTABLISHED
    T-3  does the structural detector find natural backdoors?  NOT ESTABLISHED
    T-4  does backward recover territory forward cannot?       NOT ESTABLISHED
    T-5  does it survive mixed module architecture?            NOT ESTABLISHED
    T-6  does the CJS region appear in the denominator?        NOT ESTABLISHED
    T-7  the dangerous null - did it need names or backdoors?  NOT TRIGGERED
    T-8  no hub defect found or reported                       held

**Zero is not the finding. There is no finding.** The run reported nothing, which is a different
fact from reporting nothing happened - and distinguishing those two is the thing this instrument
exists to do. It failed to do it about itself, at the harness level, for the fourth time in this
line of work.

The hardening added in `c408f0b` covers a hole INSIDE a report. It does not cover the absence OF a
report. `exit = 0` with no output is the same silent shape as the loader defect in BACKWARD-1, one
layer further out.

## Cost

**The hub is no longer an unspoiled subject.** The preregistration is explicit: a repair and a re-run
are a SECOND run, this first result stands as recorded, and that is how it will be reported.

What was NOT spent: no information about the hub's effects, ancestry, backdoors or observability was
obtained, because nothing was measured. What was spent is the one-shot status.

## What this says about the transfer question

The question was whether the discipline survives contact with software not built around this
ontology. The first contact found an assumption the instrument did not know it had - and found it in
the harness rather than in the analysis. That is a real answer to the transfer question, and it is
not the one I wanted.
