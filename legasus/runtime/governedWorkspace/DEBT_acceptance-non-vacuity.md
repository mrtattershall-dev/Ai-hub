# DEBT — acceptance non-vacuity is currently UNESTABLISHED

**Recorded 2026-09-29 08:40 CDT. Not a CHAIN-1 finding. Not fixed here, deliberately.**

## The classification, and it is complete

`server/acceptance.test.mjs` run to completion (20.2 min) in **both** arms of the CHAIN-1 differential:

| arm | result |
|---|---|
| treatment (`agent.js` with the CHAIN-1 wiring) | same 8 positive-control failure labels |
| baseline (`agent.js` at `5d3b2a2a`) | **12 passed, 15 failed** |

A label-by-label diff of the positive-control failures is **IDENTICAL** in both arms. So this is
**PRE-EXISTING and not attributable to CHAIN-1**, which is what licensed committing `afa3ff5e`.

It is evidence against Legasus even though it is not evidence against CHAIN-1. Those are different facts.

## Why it matters more than an ordinary failing test

The two failing cases are the suite's **POSITIVE CONTROLS**, and the file says why they exist:

> *A policy that rejected everything would pass the t5 case and destroy these two.*

They exist specifically to establish that the acceptance mechanism can **ADMIT LEGITIMATE STATES**, not
merely reject prohibited ones. While they cannot report, the suite cannot distinguish a working policy
from one that refuses everything — sensitivity and specificity are orthogonal, and only the rejection
half is currently observable.

    t2-repair-python-parse: the candidate passes both checks      EVALUATION_ERROR
    t2-repair-python-parse: RETAINED                              (HELD)
    t2-repair-python-parse: counts as a verified completion        FAIL
    t2-repair-python-parse: the SURVIVING workspace still passes   EVALUATION_ERROR
    t3-add-node-median:     (the same four)

And the suite's own closing line is:

    acceptance policy: 12 passed, 15 failed -> DETECTED DAMAGE CAN STILL SURVIVE

## A partial-greenness trap worth naming

**Section 4, "an evaluation error promotes nothing", passes 5/5** — because it is the one section that
*expects* an `EVALUATION_ERROR`. So the evaluator being broken makes that section pass while making every
section that needs a real verdict fail. A reader counting green sections would draw the wrong conclusion
about the suite's health. Same family as a `[].every()` branch that cannot report a problem, and as a
reproduction blocked by a different guard.

## What is ruled out, and what is not

- **RULED OUT: missing python.** `python --version` -> **Python 3.13.14**, present on this machine. The
  obvious environmental explanation for `t2-repair-python-parse` does not hold.
- **RULED OUT: an arm difference.** Reproduced identically in both arms.
- **NOT ESTABLISHED: the root cause.** `EVALUATION_ERROR` means the instrument failed, not that the code
  under test failed — the suite is explicit about that distinction and Section 4 relies on it. Which
  dependency of the evaluator is unmet, and since when, is **unknown**. No bisect was run.

## Status, stated as a status and not as a plan

    acceptance non-vacuity ......................... UNESTABLISHED
    root cause of EVALUATION_ERROR ................. UNKNOWN (not bisected)
    attributable to CHAIN-1 ........................ NO (reproduced on baseline)
    blocks committing CHAIN-1 ...................... NO
    blocks any later claim that treats `acceptance`
      as trustworthy verification .................. YES, until the root cause is
                                                     established and the positive
                                                     controls can report

Not fixed in this branch. The instruction was to preserve it, not to launch an expedition — and a clean
CHAIN-1 differential must not be allowed to turn a pre-existing Legasus defect into "not our problem".
