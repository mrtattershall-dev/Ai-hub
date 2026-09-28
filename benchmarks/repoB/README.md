# PREREGISTRATION — REPO B. Does the architecture transfer, or did it only learn the stdlib?

**Committed before any task is selected, generated or observed. `legasus-freeze-r2` is frozen and will not
be touched until reality answers.**

## The question

Run 0 showed the safety mechanism survives contact with a real repository. Dev 1 showed the capability
envelope can be widened without visibly sacrificing it — but Dev 1 used the twelve tasks that *taught* the
engineering, so it demonstrates only that the changes did what they were built to do.

> **Did we learn general architecture, or did we merely learn Python stdlib?**

Repo B **tests** r2. It does not teach r2.

## The repository

`packaging` — 18 files, ~306 KB, pure Python, imports standalone, no C accelerator shadowing its public
surface. A genuinely different repository from the five stdlib modules used in development: different
authors, different domain (version parsing, specifiers, requirements, tags, markers), different idioms.

Copied byte-for-byte. Line-ending convention is observed, never normalized.

**Still not independent of pretraining.** `packaging` is widely distributed and the model has likely seen
it. This remains a **real-repository transfer benchmark**, not an unseen-code benchmark, and exact-source
reconstruction will again be recorded separately so memorization is measured rather than assumed away.

## Stratification — 40 tasks

    10   derived IN          the machine says it can represent, generate, constrain and verify this
    10   derived BOUNDARY    partial capability
    10   derived OUT         the machine says it cannot
    10   UNFILTERED          sampled without regard to what the machine thinks

The unfiltered stratum is the one that matters most. If all 40 were chosen by categories Legasus already
understands, the taxonomy would be tested on itself. Unfiltered asks the nastier question: **what does r2
think when reality chooses the work instead of us?**

**Envelopes are DERIVED BY THE MACHINE before inference. No hand labels.** Run 0's T12 proved why: a
shadowed body edit is an ordinary body edit *as a class*, and only the instance-level check — runtime
authority — makes it `OUT`.

## Four separate questions, never one score

    COVERAGE      what fraction of tasks can r2 legitimately attempt?
    CAPABILITY    of ADMITTED repair tasks, what fraction does it repair?
    SAFETY        of COMMITTED states, what fraction are correct?
    CALIBRATION   when r2 says IN / BOUNDARY / OUT, does reality agree?

Calibration is new and is the sharpest of the four, because r2 now makes **claims about its own competence
boundary** and those claims are testable:

- derived-IN tasks that turn out unverifiable ⇒ the capability contract is **overconfident**
- derived-OUT tasks that prove solvable under existing machinery ⇒ **underconfident**
- failures concentrating in BOUNDARY ⇒ the classification carries **real information**

## Also measured, not optimized

    model calls requested        model calls AVOIDED by preflight
    tokens generated             GPU seconds
    attempts                     authorized proposals
    verified proposals           commits
    correct commits

Dev 1 refused 6 of 12 tasks without waking the model. If that holds on unfiltered work, Legasus is not
only making a small model reliable — it is preventing inference from being spent where inference has no
legitimate route to success. **Recorded now, optimized later.**

## Task admission, unchanged from r2

Unique anchor; mutation applied exactly once; **runtime-authoritative source proven by canary**; pristine
observable; mutant observable; mutation behaviourally non-vacuous; independent pristine oracle available.

Oracle authority is typed: `RESTORE` and `PRESERVE` may use pristine behaviour; `ADD` and `CHANGE` require
an independently authored contract, and an `ADD` task scored against pristine alone is `UNSCORABLE` rather
than a pass.

**Apparatus-invalid tasks are VOID, not deleted.** They stay in the report with their verdict. Removing
them from denominators after seeing results would be choosing the denominator to suit the number.

## The kill rule

> **Any confirmed false Legasus commit triggers investigation before any further capability widening.**

Not because one false commit ends anything, but because commit integrity is currently the strongest
property this architecture has, and it must not be traded casually for coverage.

## Predictions

Recorded so they can be wrong:

- **Coverage** on the unfiltered stratum is **low** — I expect most real tasks to fall outside a box whose
  only operation classes are guard insertion, bounded body edit and preservation check.
- **Capability** inside the admitted envelope stays **high**, comparable to Dev 1.
- **Safety** stays at **zero false commits**. This is the prediction I most want tested.
- **Calibration** is imperfect: I expect some derived-IN tasks to fail at `PROVE` or `CONSTRAIN`, because
  "can represent" is not "will succeed".

## What would count as transfer

Not a particular score. A pattern:

    substantial legitimate coverage
      + high repair rate inside the admitted envelope
      + meaningful pre-inference refusals outside it
      + wrong proposals caught by PROVE
      + 0 false commits

No target is set. Repo B tells us what the number is.
