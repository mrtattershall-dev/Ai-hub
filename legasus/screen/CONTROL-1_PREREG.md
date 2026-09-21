# CONTROL-1 — known-bad control for SCREEN-1's detectors (frozen 2026-09-21 11:15)

Run against the **current, unrevised** detectors (`legasus/screen/screen1.py` as committed at
d581e14). No detector change is made before or during this control. Revising first would hide
whether the control was designed knowing the answer.

## What this control can and cannot establish

It can establish a **minimum demonstrated detection capability**: that these detectors, through
the exact production entrypoint, flag preregistered positives and reject preregistered
negatives. It **cannot** establish sensitivity — that would need a labelled corpus
representative of the relevant Python distribution. The defensible sentence afterwards is
*"demonstrated end-to-end detection of preregistered positive controls and rejection of
specified negative controls"*, never *"sensitivity is known"*.

## The corpus travels the production path

The corpus lives outside any target tree, and is scanned by **the same script, same entrypoint,
same parser, same directory filter, same deduplication and same reporting path** used against
Odysseus. A detector that works in isolation while the integration drops its result would
otherwise produce a false "capability established".

## Three levels, per the frozen design

    C0  syntactic     the plumbing runs and reports at all
    C1  variants      more than one surface form of each invariant
    C2  negatives     legitimate inverted predicates and computed booleans are NOT condemned

## The corpus, and what each case is for

| id | invariant | shape | must |
|---|---|---|---|
| A1 | INV-A | `except: return True`, success path also returns `True`, **no literal failure return** | FLAG |
| A2 | INV-A | `except: return 1` (truthy non-bool), `return False` elsewhere | FLAG |
| A-NEG | INV-A | `token_missing()`: `except: return True` where True means *the problem is present*, `return False` elsewhere | **NOT flag** |
| B1 | INV-B | `is_ready()` returning only `True` | FLAG |
| B2 | INV-B | `has_access()` truthy in two branches, no falsey return, no raise | FLAG |
| B-NEG | INV-B | `is_ready(host)`: `if not host: return True` then `return host in READY_HOSTS` | **NOT flag** |

## Acceptance criteria, all six required

    CONTROL-A     A1 and A2 each appear exactly once, correct function, invariant and line
    CONTROL-B     B1 and B2 each appear exactly once, correct function, invariant and line
    NEGATIVE-A    A-NEG absent
    NEGATIVE-B    B-NEG absent
    CARDINALITY   a duplicated copy of the corpus does not inflate the logical-unit count
    OBSERVABILITY a file that cannot be parsed is REPORTED as unparseable and cannot be
                  silently absorbed into "zero findings"

## Predictions about the CURRENT detectors — made before running

I expect this control to **fail**, and specifically:

- **A1 will be MISSED.** INV-A requires a literal failure return elsewhere in the function. The
  purest instance of *the error path reports success* has no such return, so the canonical case
  is invisible to the detector that was written for it.
- **A2 flagged**, **B1 flagged**, **B2 flagged**.
- **A-NEG will be FALSELY FLAGGED** — the polarity blindness Odysseus exposed.
- **B-NEG will be FALSELY FLAGGED** — the computed-return blindness Odysseus exposed.
- CARDINALITY and OBSERVABILITY: genuinely unknown, and the reason this control exists beyond
  confirming what Odysseus already showed.

If any of these lands differently, my model of my own detectors is wrong and that is the result.

## Scope discipline carried forward, recorded here so it is not lost

Odysseus is now a **detector-development corpus**, not a prospective evaluation target. Any
revised INV-A2/INV-B2 will have been shaped by what Odysseus revealed — inverted predicates,
computed booleans, its structural duplication — so a later Odysseus run cannot be called a blind
prospective test. SCREEN-2 goes to a **fresh external Python target**, chosen and frozen after
the revised detectors are frozen. Odysseus may be revisited afterwards, labelled as the corpus
that falsified SCREEN-1.
