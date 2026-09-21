# BIND-CJS step 8 result — X1 and X2 both CONFIRMED; the obvious repair does not reach the problem
2026-09-21 04:40. Preregistration `legasus/BIND-CJS_PROCESS.md` (ac47a21) + amendment P-1
(added after run 1, before any result record). Mechanism `legasus/cjs-preload.mjs` @ e41c1e3,
unchanged. Classifier: step-5 scalar, verbatim. Foil: naive uniformity, **not a proposal**.

## The five worlds

| world | processes (pid ← ppid, role) | identities | scalar | foil |
|---|---|---|---|---|
| P-A parent alone | witness | M | VALID_INTERVENTION | VALID_INTERVENTION |
| P-B parent + escaped descendant | witness: M; descendant: S | M, S | TRANSPORT_CONTRADICTION | NOT_UNIFORM |
| P-C parent + descendant with mechanism | witness: M; descendant: M | M | VALID_INTERVENTION | VALID_INTERVENTION |
| P-D parent + **stranger** (ppid = driver) | witness: M; stranger: S | M, S | TRANSPORT_CONTRADICTION | NOT_UNIFORM |
| **P-E** escaped descendant, then witness re-loads | witness: **M, M**; descendant: S | M, S | **VALID_INTERVENTION** | NOT_UNIFORM |

## X1 CONFIRMED — but only after amendment P-1, and that matters

Run 1 falsified X1: P-B reported `TRANSPORT_CONTRADICTION`. Inspecting the construction instead
of accepting the result: **P-B's contradiction is terminal by construction** — the child runs
after the witness's own load, and step 7 already showed a last-wins rule catches a contradiction
in exactly that position. X1 had been falsified by my fixture's ordering, not by the
representation being sound.

P-E moves the contradiction off the end by having the witness re-load after the child returns.
The scalar then certifies **`VALID_INTERVENTION`** while a descendant process executed the
original implementation — a direct violation of the minimum frozen expectation, the only thing
this experiment asserted in advance.

Had I stopped at run 1, the recorded finding would have been "the scalar survived process
composition". It does not. It survived one ordering.

## X2 CONFIRMED — and this is the finding

P-B (a **descendant that escaped** the intervention) and P-D (a **stranger that was never part
of it**) receive:

    the same verdict from the current representation   TRANSPORT_CONTRADICTION
    the same verdict from the obvious repair           NOT_UNIFORM

The two rules collapse the distinction for *opposite* reasons. The scalar ignores every
execution but the last; the uniformity foil ignores lineage entirely. **Neither the
representation nor its natural fix can tell an escaped descendant from an unrelated process.**

So the missing distinction is **not multiplicity**. Multiplicity is what step 7 found, and the
uniformity rule is the obvious answer to it — and the obvious answer does not reach this. That
was the point of predicting X2 rather than merely running the worlds.

## X3 — deliberately unpredicted, and left open

The raw evidence does contain lineage: every marker carries `pid`, `ppid`, `role` and `argv`,
and P-B's descendant is observably `ppid = witness pid` while P-D's stranger is
`ppid = driver pid`. So the *evidence* distinguishes them even though neither *rule* does.

Whether ppid-descent is a legitimate basis for a membership judgement is **not decided here**.
It is one observable relation among several, it is trivially defeatable (a re-parented process,
a detached grandchild, a process pool started before the intervention), and adopting it because
it happens to separate two constructed worlds would be inventing the distinction from the
fixture rather than discovering it. **No state, field, or concept was created.**

If the honest answer turns out to be *the evidence does not entitle either conclusion*, that is
a result and not a gap to be filled.

## Cardinality, per the audit

P-E's witness process shows `loads = [M, M]` — two evaluations in one process — alongside a
descendant's single load. Processes ≠ evaluations ≠ resolutions ≠ marker records, and all four
counts are recorded separately in `proc.json`.

## What this changes

The Intervention abstraction stays closed. Before step 7 it was closed because properties were
unexercised; after step 7, because the representation destroys verdict-determining information;
now, additionally, because **the obvious repair to step 7 is demonstrably insufficient**. An
interface extracted at any of those three moments would have standardised a defect.

## What is NOT done

No repair. No membership concept. No adoption of the uniformity foil, which exists only to be
shown inadequate. The mechanism is untouched and is not accused of anything: that `--import` is
not inherited is a property of Node, and P-C shows the mixture is avoidable when the mechanism
is deliberately propagated.

## Next falsification, not started

Construct a world where **ppid-descent gives the wrong answer** — a pool process started before
the intervention and reused by the witness, or a re-parented grandchild. If lineage-by-ppid
fails there too, then no observable relation currently recorded suffices, and the honest
representation may have to carry *membership: UNKNOWN* rather than a verdict. That would be a
discovery about what the evidence entitles, and it needs its own preregistration.
