# AUDIT-2 — does this connected Legasus revision help a 7B complete and preserve useful software work within a fixed budget?

**Status: FROZEN. Written before deployment. Stages 1 and 2 spend nothing and run first.**

## Authorization — recorded before anything is deployed

| | |
|---|---|
| Authorizer | **Micheal (tatte)**, this project's spend authorizer |
| Asked | "What total spending cap do you want for the full audit?" |
| Answered | **"5 dollar cap"** — 2026-09-28, directly, in his own words |
| Scope | **$5 USD total for AUDIT-2**, all five stages together |
| Not covered | anything outside this audit. Not standing. Not extendable without a new instruction. |

AUDIT-1's separate $5 is closed at **$0.336 spent**. This is a new authorization for a new audit, given
as an opt-in answer to a direct question — not inferred from silence, and not from any voice other than
the authorizer. The guidance ablation held as unauthorized under AUDIT-1 becomes **stage 5 of this
audit** and is covered by this cap.

## Maximum exposure, calculated before deployment

Derived from AUDIT-1's two runs, not from a price list:

| | run 1 | run 2 |
|---|---|---|
| cost (read from billing) | $0.22204 | $0.11375 |
| billed seconds (wall + 2 min scaledown) | 793 | 568 |
| $/second | 0.00028 | 0.00020 |

**Implied A10G rate ≈ $0.86/hour.** Nothing here is a price quote; Modal's rates move.

### Most billed time is NOT generation time

| | generation | wall | non-generation |
|---|---|---|---|
| run 1 | 108 s | 673 s | 565 s — **84% of billed time** |
| run 2 | 94 s | 448 s | 354 s — **79% of billed time** |

An earlier draft called this "idle GPU" and said four fifths of the spend "bought nothing." That
overstates what was measured. The non-generation figure is a residual: it contains container startup,
model load, HTTP round trips, ollama's own overhead, and time waiting on local verification, and this
run did not separate them. What is established is that **most billed time was not generation** — not
that all of it was waste.

`scaledown_window` drops from 2 minutes to **45 seconds** for this audit. That is a **serving change
whose effects have to be measured, not an obviously free saving**: a shorter window can cut billed idle
time, and it can equally add repeated cold starts that cost more than they save, or push a request into
a startup window and produce a timeout. Cost per verified completion and any timeout are recorded for
this configuration and compared against AUDIT-1's 2-minute runs before the change is called an
improvement. It should not change what the model generates — the prompt and decoding are untouched —
but "should not" is a prediction, so generation-side outcomes are compared too.

### Planned exposure

| stage | GPU wall (est.) | at $0.86/hr |
|---|---|---|
| 1 identify the system | 0 | $0 |
| 2 validate apparatus | 0 | $0 |
| 3 compare on fresh software | ~30 min | $0.43 |
| 4 successive additions | ~22 min | $0.32 |
| 5 ablations | ~22 min | $0.32 |
| **subtotal** | | **~$1.07** |
| ×3 contingency (retries, cold starts, longer runs) | | **~$3.20** |

### Enforcement, which cannot rest on billing

**A between-stage billing read cannot enforce a cap.** Billing lags, so a check after the fact reports
spend that has already happened and says nothing about spend in flight. Two mechanisms instead:

**1. A pre-stage admission test.** A stage starts only if

    accrued (last billing read)
  + outstanding exposure (GPU seconds since that read x rate)
  + this stage's maximum (wall-clock budget x rate)
  + shutdown allowance (scaledown window + stop latency x rate)
  <  $4.00

If the sum reaches $4.00 the stage does not start. Unknown accrued spend is treated as the largest
value consistent with what is known, never as zero.

**2. An independent wall-clock watchdog**, which is the actual enforcement. Time is the quantity this
project can meter directly and in real time; dollars are not. `campaign.mjs --max-gpu-seconds` stops the
campaign and stops the Modal app when the budget is spent, whatever billing says and whether or not
billing can be read at all. At ~$0.86/hour, $4.00 is ~4.6 hours; the watchdog is set well inside that
per stage.

Billing is still read between stages — as a *reconciliation* of the watchdog against reality, and to
detect a rate that has moved. A discrepancy stops the audit.

## The five stages

### Stage 1 — identify the actual system ($0)

Pin the commit, model, serving version, decoding settings, dependency versions, and the checks. Trace
which components the **live runner** invokes, by import and by call, not by intention. Anything not
reached by the runner is named as not-in-the-claims — in particular the **permission-boundary
machinery is a design, not code, and is outside every claim in this audit**.

### Stage 2 — validate the apparatus without spending ($0)

Plus the **operational** gate, which is the failure mode most capable of quietly invalidating stage 3:
an injected crash driven through the real launcher must produce a non-zero campaign exit, an explicit
interrupted record, and a reconciliation of expected against recorded against preserved attempts.
Tested alongside a positive control, so the gate cannot pass by failing everything.

Five candidates through the **actual runner** against a scripted backend, each of which must succeed or
fail *for its intended reason*, not merely land on the right verdict:

| candidate | must |
|---|---|
| correct | reach RETAIN, protected PASS |
| inert | be rejected for failing the addition, with carried-forward intact |
| regression | be rejected for breaking carried-forward behaviour, and be RESTORED **with byte-identity evidence against the start commit**, not a disposition label |
| wrong-language | be refused at containment as WRONG_SLOT_LANGUAGE, never spliced |
| out-of-scope edit | be refused, and not reach the page |

A verdict reached for the wrong reason is a failure of this stage.

### Stage 3 — compare on fresh software

Same 7B, two arms: **full Legasus**, and a **competent direct generation-and-repair loop**. Identical
requirements, starting files, tools, resource limits, and one independent final evaluator outside both
arms. Multiple supported application shapes, not four variations of one.

Fresh pages, generated after stages 1-2 are frozen. **The four pilot pages are development pages and
are excluded from stage 3 entirely.**

### Stage 4 — test continued building

Successive additions to the same program, each carrying every earlier requirement forward as a
preservation obligation. One isolated repair cannot establish sustained maintenance.

### Stage 5 — explain the result with targeted ablations

`--guidance full | no-renderer | none`, on **development pages only**, after the complete system has
been measured. What each switch removes is already recorded in `AUDIT-1_DEFINITION.md`, including that
`none` is not "the model without Legasus."

## Reported

Per arm, over every assigned task:

- verified completions
- regressions **produced** and regressions **surviving** — separate columns
- unsupported tasks, with the reason
- human interventions (expected 0; any is reported in the headline)
- total cost including failed attempts and verification

**Local and hosted runs stay separate comparisons.** Seeds do not reproduce across backends and the
ollama versions differ.

## What the existing 3/4 is, and is not

It is **development evidence** — the slot contract was calibrated on those four pages and then measured
on them. It is the reason to run this audit. It is **not** the headline evaluation, and those pages
cannot become one.
