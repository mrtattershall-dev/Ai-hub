# BIND-CJS step 6 — intervention identity across a process topology (frozen 2026-09-21 03:15, before the run)

## The question

**Can BIND truthfully represent intervention identity when one logical witness spans multiple
processes, and can the current evidence representation distinguish PARTIAL intervention from
COMPLETE intervention?**

Not "does `--import` inherit" — inheritance is merely the mechanism by which the challenge is
created. Not "make multiprocessing work" — nothing here is required to succeed.

## Why this witness

`experiments/025_behavior_corpus/harness_test.js` is the **only** witness step 1 measured
producing more than one coverage process: 266 of them, 10.7s, 48 per-case lines, 0 duplicated
ids, exit 0. It was selected for that measured property alone, before any of its results were
seen, and it is the sole multiprocess candidate — not a search for a convenient target.

Correction to an assumption of mine, recorded before the run: the static shape says this file
contains **no** spawn call (`spawnsProcesses: false`). The 266 processes therefore originate in
a dependency, not in the witness. Per-file static shape does not compose; the measured 266 is
what stands.

## Eligibility, by the step-5 rule

Of the three local modules the witness requires, `corpus.js` and `harness.js` have relative
requires and are ineligible (a mutant lives outside the foreign tree and could not resolve
them). **`adapters.js`** — 2 exported names, zero relative requires — is eligible and is the
subject.

## Primary probe is the IDENTITY COPY, not a mutant

The object of study is *which implementation executed where*, not *whether behaviour changed*.
An identity copy is always constructible, needs no mutable function, and keeps the witness's
own behaviour fixed, so any difference observed is about topology alone. If the frozen family
also yields a valid mutant for an exported function, a second condition adds it; if it does not,
that is noted and the experiment proceeds on the identity copy. Mutability of this subject is
not a precondition.

## Declared apparatus change (the mechanism stays frozen)

`legasus/cjs-preload.mjs` remains **unchanged at e41c1e3**. The RECORDER's marker gains
`pid` and `ppid`, because per-process identity is the object of study. Coverage files are
already one-per-process and carry the pid in their filename, giving a second, independent
per-process channel. This is a declared instrument change made before the run, not a repair
derived from an outcome.

## Evidence

    per process   marker records (pid, ppid, which Legasus file loaded)
    per process   coverage file -> did the ORIGINAL subject execute? did a replacement?
    process set   every coverage file written under the run
    causally relevant = a process whose coverage shows the subject OR a replacement executing

The answer to "which implementation executed?" is recorded as a **SET over processes**, never
reduced to a scalar before it is recorded.

## Predictions

**M1.** At least one causally relevant descendant process will execute the ORIGINAL subject
while the parent executes the requested replacement.
FALSIFIER: every process that loads the subject loads the replacement, or no descendant loads
the subject at all. Either falsifier is a real result: the first would mean intervention
propagates further than expected, the second that this witness's children never touch the
subject and the challenge must be built elsewhere.

**M2.** The step-5 evidence representation — `executed` = the last marker identity — **cannot**
distinguish partial from complete intervention: in a mixed execution set it reports the parent's
identity, which is locally true and globally false.
TEST: both classifiers run over the same evidence. The step-5 scalar classifier is applied
UNCHANGED; the topology-aware denial rule below is applied alongside it. Their disagreement, or
agreement, is the measurement.
FALSIFIER: the two agree in a mixed execution set.

**M3 is deliberately NOT predicted.** Whether the existing frozen states can represent this
outcome is left to the evidence. The run records the legacy state, the denial, and the raw
execution set as three separate fields. **No new state name is invented in advance**, and a
mixed execution set is explicitly **not** called `SCOPE_VIOLATION` — that would name the
ontology from the prediction rather than from what is observed.

## Frozen denial rule

    If any causally relevant process executes the ORIGINAL target while another executes the
    requested replacement, the intervention is NOT VALID_INTERVENTION for the transaction,
    even though the parent satisfies requested == served == executed.

Recorded as `VALID_INTERVENTION_DENIED` with the observed topology as its reason. This is a
denial, not a new classification: whether the situation deserves its own state is an open
question this run is meant to inform, not settle.

## Conditions

    T-A  identity copy requested        primary probe
    T-B  mutant requested               only if the frozen family yields a valid mutant
    T-C  no request                     baseline topology: how many processes, and does the
                                        original execute in all of them

## Constraints

Foreign tree not modified (checked by mtime, as in step 5). BIND's interpretation rules
untouched. No repair derived from this run's outcome; if the representation proves inadequate,
that inadequacy is the result and any redesign is a new preregistration. R4 remains
UNESTABLISHED regardless of anything observed here.

## What each outcome would mean

- M1 confirmed and M2 confirmed: the current representation is demonstrably inadequate for
  multiprocess witnesses, and Legasus has found the next thing it must represent. The
  Intervention abstraction stays closed until it can represent an execution set.
- M1 falsified: the challenge does not exist on this witness; the abstraction is neither closer
  nor further, and the next attempt must build the topology deliberately.
- Anything else: reality chose something neither of us predicted, which is the most useful
  outcome available.
