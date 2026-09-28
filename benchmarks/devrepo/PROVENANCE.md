# DEVELOPMENT REPOSITORY BENCHMARK — provenance, and what this benchmark is NOT

**This is a sacrificial development benchmark.** Its purpose is to find where Legasus breaks when the
repository is not constructed around the experiment. It is then burned as development evidence and is
**not** used for the eventual claim.

## What it is not independent of

The repository is five modules of the Python 3.13 standard library. That is independent of Legasus —
written by people who have never heard of it — but it is **almost certainly not independent of the
model's pretraining**. Qwen has very likely seen this code.

> This is a **real-repository transfer benchmark**, not an unseen-code benchmark. Any result here is
> evidence that the machinery survives embedding in mature human-written code. It is **not** evidence
> about generalization to code the model has never seen.

## How the tasks were selected, stated plainly

Candidate modules and functions were **inspected before task construction**, to find material compatible
with the current narrow envelope. The Legasus implementation was frozen first (`legasus-freeze-r1`,
`ab1141d`) and has not been touched since.

> This run evaluates **real-code transfer within a selected supported stratum**, not unbiased
> repository-wide coverage.

Calling it blind sampling later would be false, so it is recorded here instead.

## The two strata, which answer different questions

    STRATUM A — SUPPORTED-ENVELOPE TRANSFER
      Functions selected BECAUSE the required repair is inside the frozen authority envelope.
      Question: does machinery that worked synthetically still work when embedded in mature code?

    STRATUM B — UNFILTERED REPOSITORY COVERAGE
      Functions sampled WITHOUT requiring that Legasus know how to repair them.
      Question: how much real repository work does the envelope cover, and does it safely refuse the rest?

Reporting only A invites "you benchmarked what it already supports". Reporting only B mostly re-measures
the known narrowness of the envelope. Both numbers are needed and they are kept separate.

## Task admission, mechanized

A mutation becomes a benchmark task only if:

1. the pristine implementation is **observable**;
2. the mutant implementation is **observable**;
3. at least one independently generated probe **distinguishes** them;
4. expected behaviour comes from **pristine execution**, never a handwritten expectation;
5. the reference source and patch are **unavailable to `PROPOSE`**.

The validator keeps an `attempted / observed / unobservable / findings` tally and **refuses to report** if
any check could not be made.

## Success is BEHAVIOURAL, never textual

Exact reconstruction of the pristine source is **explicitly not** the success criterion. Since the library
may be memorized, textual equality would flatter the result. A candidate passes when it agrees with the
pristine module on the frozen probe set.

**Exact-reference reconstruction is recorded separately**, so the write-up can say: *X tasks solved, Y of
which reproduced the pristine source exactly, Z using behaviourally equivalent alternatives.* That is how
memorization gets measured rather than assumed away.

## Two defects the validator found in the TASK SET before any model ran

Both are recorded because they are findings about real repositories, not about Legasus:

1. **Every stdlib file is CRLF.** Find-strings written with `\n` matched nothing. Three tasks were
   rejected for this and would otherwise have silently become no-ops.
2. **`bisect` is shadowed by a C accelerator.** `bisect.py` ends with `from _bisect import *`, so
   `bisect.bisect_right` is a builtin and **mutating the Python source changes nothing that runs**. The
   validator reported the task as VOID because the mutation did not bite.

> **The file you edit may not be the code that runs.**

That hazard cannot arise in a synthetic family where the experimenter wrote every line, and it is exactly
the class of thing this benchmark exists to surface. It is now itself a task: a repository where the
obvious edit site is inert, and the correct behaviour is to notice rather than to report success.

Additionally, the empty-data guard string appears **four times** in `statistics.py`, so the find-string was
ambiguous; the validator requires exactly one occurrence.

---

# CORRECTIONS after the first validation pass

## 1. Normalizing the corpus to LF was wrong, and is reverted

I rewrote all five modules to LF so my find-strings would match. That **modifies the artifact before the
experiment** and converts a repository fact into an assumption. The corpus is now restored **byte-for-byte
from the real stdlib**, and every file is observed to be `CRLF`.

Anchors are written in LF and **translated into the file's own convention** at match time; the file's bytes
are never rewritten. Line endings are now an observed property of the repository, which is what they are.

## 2. Runtime authority is PROVEN by canary, not assumed

`bisect` taught this. The admission pipeline now injects a canary — a syntactically valid statement raising
a uniquely identifiable exception — at the intended edit site, and requires it to **surface** when the
behaviour is invoked. Measured:

    calendar.isleap        authoritative = true    the canary surfaced
    bisect.insort_right    authoritative = false   the canary did NOT surface
      observed: [1, 2, 3, 5]

That second line is the proof: the insert **succeeded normally** while the Python source it supposedly
lives in contained an unconditional `raise`. The C accelerator ran; the file was decoration.

> **Visible source does not imply behavioral authority.**

This generalizes well past Python accelerators — generated code, wrappers, transpilation, caches,
monkeypatching, dependency injection, feature flags, native extensions, build outputs and framework
dispatch all produce it.

## 3. The admission pipeline, with its verdicts

    TASK CANDIDATE
       -> anchor unique?                          no -> INVALID_TASK_SPEC
       -> mutation actually applied?              no -> APPARATUS_FAILURE
       -> did execution depend on that source?    no -> SHADOWED_SOURCE
       -> does it alter observable behaviour?     no -> VOID_MUTATION
       -> VALID_REPAIR_TASK

Seven conditions, none assumed: unique mutation target; mutation applied exactly once; **runtime-
authoritative source**; pristine observable; mutant observable; mutation behaviourally non-vacuous;
independent pristine oracle available.

## 4. Refusals are classified, because they mean different things

    SAFE_REFUSAL_UNSUPPORTED_OPERATION        the envelope does not cover this shape
    SAFE_REFUSAL_NONAUTHORITATIVE_SOURCE      the edit surface is not what runs
    SAFE_REFUSAL_UNKNOWN_RUNTIME_PROVENANCE   it could not be established either way

Collapsing these into one "refused" number would hide exactly the information that says what to widen next.

## 5. `_bisect` keeps its own identity

It is **not** converted into an ordinary repair task. In the supported-repair stratum it is replaced by a
function whose Python source genuinely owns execution. In the coverage stratum it stays, as a test of
whether Legasus can recognize that the apparent edit surface is not the runtime authority and refuse rather
than "repair" dead source.

## What the apparatus caught before any model ran

Not one of these is a 1.5B failure or a Legasus failure. They are **task-construction failures caught
before they could contaminate a benchmark**:

    3 tasks    the mutation machinery assumed the wrong newline representation
    1 task     the repository source file was not execution authority
    1 anchor   the same textual guard appeared four times in the module

The validator refused to emit a score while the substrate was invalid. That is the non-vacuity machinery
paying for itself before the experiment it was built to protect has even started.
