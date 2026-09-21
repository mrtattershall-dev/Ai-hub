# BIND-CJS step 8 — process composition (frozen 2026-09-21 04:25, before the fixture exists)

Conducted under the discovery charter: *what proposition did Legasus just claim, what evidence
entitled that claim, and can we construct a world where that entitlement becomes invalid?*
This is an expedition into a region the current concept of an intervention has never met. It is
**not** a test of conformance to any known model of multiprocess intervention.

## The frontier, stated honestly

Step 7 established what an intervention **cannot** be: representable solely by the final
observed execution identity. It did not establish what an intervention **is**. That remains
unknown, and this experiment is not required to settle it.

## The minimum frozen expectation — the ONLY thing asserted in advance

    An intervention may not be certified as uniformly successful when a causally included
    execution used the original implementation.

"Causally included" is deliberately left undefined. The experiment constructs cases where
inclusion is obvious, cases where it is obviously absent, and at least one where the evidence
does not settle it — and records what the current representation does with each. **No name is
invented here for whatever distinction turns out to be missing.**

## The worlds constructed

    P-A  parent alone, under the mechanism                 [parent: M]
    P-B  parent + DESCENDANT child without the mechanism   [parent: M, child(ppid=parent): S]
    P-C  parent + DESCENDANT child WITH the mechanism      [parent: M, child(ppid=parent): M]
    P-D  parent + an INDEPENDENT process, not a descendant [parent: M, stranger(ppid=driver): S]

P-B is the predicted failure: `--import` is not inherited, so a descendant loads the original
while the parent runs the replacement. P-C shows the mixture is not inevitable. **P-D is the
nasty one**: it produces a SUBJECT execution in the same evidence stream as P-B, from a process
that is not a descendant of the witness at all.

## Predictions

**X1.** In P-B, the step-5 scalar classifier certifies `VALID_INTERVENTION` while a descendant
process executed the original — violating the minimum frozen expectation.
FALSIFIER: it does not.

**X2 — the risky one.** P-B and P-D receive the SAME verdict from the current representation,
**and** would receive the same verdict from the obvious repair (collect every observed execution
identity and require uniformity). The current representation collapses them by ignoring every
execution but the last; the obvious repair collapses them by ignoring lineage. **Neither the
representation nor its natural fix distinguishes a descendant that escaped the intervention from
a stranger that was never part of it.**
FALSIFIER: either rule assigns P-B and P-D different verdicts.

This is the prediction worth making, because if it holds, the missing distinction is not
multiplicity. Multiplicity is what step 7 found. Something else is needed here, and this
experiment is designed to show that the obvious answer to step 7 does not reach it.

**X3 is deliberately unpredicted.** What the raw evidence *does* contain that could separate
P-B from P-D — pid, ppid, argv, spawn lineage, the mechanism's own log — is recorded in full.
Whether any of it constitutes a legitimate basis for a membership judgement is **not** decided
here, and no state, field, or concept is created for it. If the answer is "the evidence does not
entitle either conclusion", that is a result, not a gap to be filled.

## What is under test, and what is not

Under test: the step-5 scalar classifier (verbatim) and, as a second column, a NAIVE UNIFORMITY
rule — *every observed execution identity must equal the requested one* — included solely to
test X2. The naive rule is a **foil**, not a proposal, and is not adopted by anything.

Not under test: `legasus/cjs-preload.mjs` (frozen at e41c1e3). That `--import` is not inherited
is a property of Node, not a defect of the mechanism, and the mechanism is not asked to fix it.

## Rules

No repair inside this experiment. No abstraction extracted regardless of outcome. Raw evidence
recorded at full cardinality with its units named (processes ≠ evaluations ≠ resolutions ≠
records), per the audit. If X2 holds, the finding is preserved and the next expedition is a
separate preregistration.

## Amendment P-1 (2026-09-21 04:35, after run 1, before any result record)

Run 1 falsified X1: in P-B the scalar said `TRANSPORT_CONTRADICTION`, not `VALID_INTERVENTION`.
Inspecting the construction rather than celebrating: **the child runs AFTER the witness's own
load, so P-B's contradiction is TERMINAL** — the very position step 7 showed a last-wins rule
catches. X1 was falsified by my fixture's ordering, not by the representation being sound.

Left as it stands, "the scalar survived process composition" would be false comfort.

Added, expectation stated before running:

  P-E  the witness loads the target, spawns a plain child (which loads the ORIGINAL), and then
       RE-LOADS the target itself after the child returns -> identity sequence M, S, M.
       Expected: the scalar reports `VALID_INTERVENTION` despite a descendant having executed
       the original, because the contradiction is no longer last.

This can only make the verdict worse, never better. X1 is rescored over both P-B and P-E, and
run 1's falsification is superseded rather than kept alongside.
