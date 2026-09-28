# AUDIT-2 stage 3 — result

**Both arms completed 6 of 6. The manager did not earn its extra structure on this page set.**

Run against the protocol frozen in `AUDIT-2_STAGE3_PROTOCOL.md`, which was written before either arm
ran and has not been edited since.

## The comparison

| | arm A — full Legasus | arm B — direct whole-page |
|---|---|---|
| **verified completions / 6** | **6** | **6** |
| calls made | 13 | **6** |
| calls per verified | 2.2 | **1.0** |
| regressions produced | 0 | 0 |
| regressions surviving | 0 | 0 |
| MET / PARTIAL / NOTHING | 6 / 0 / 7 | 6 / 0 / 0 |
| refusals | none | none |
| prompt tokens | 4858 | 2168 |
| output tokens | 564 | 1670 |
| output tokens per verified | **94** | 278 |
| generation seconds | 86.4 | 97.5 |
| campaign wall seconds | 484 | **237** |
| pages interrupted | 0 | 0 |
| watchdog | not tripped | not tripped |
| deployment inside the clock | 11.9 s | 7.4 s |
| human interventions | 0 | 0 |

Arm B solved **every page on its first call**. Arm A needed retries on three of six (e1, e4, e7) and
matched the result at roughly twice the calls and twice the wall clock.

The one axis where arm A leads is **output tokens per verified completion — 94 against 278** — which is
what a localized edit buys over a whole-page rewrite. It did not convert into fewer calls, less time,
or more completions.

## This page set cannot discriminate

Both arms scored 100%. **A test at ceiling cannot separate two methods**, so the right reading is not
"arm B is better" but "these six pages are too easy for this model to tell the arms apart." The set was
designed for shape variety, which it has — three modalities, two addition rules, six hiding and state
mechanisms — but not for difficulty.

Whatever comes next needs harder tasks, not a different conclusion drawn from this one.

## What did not discriminate either

- **Zero regressions in both arms.** The containment gate, the restore path and the protected set all
  ran and none of them was needed. Their value on this set is unproven, not demonstrated.
- **`renderEvidence` was VACUOUS on every accepted page** — neither of its rules was exercised, so it
  supports nothing either way. The functional gate did all the work.

## Cost, and a limit on what can be said about it

| | |
|---|---|
| billing rows for AUDIT-2's two apps | **none yet — billing lags** |
| today's reported total (AUDIT-1's apps) | $0.363, itself up from $0.336 earlier today |
| watchdog measurement of AUDIT-2 | 484 s + 237 s + two 45 s scaledowns ≈ 811 s |
| estimate at the measured ~$0.86/hr | **~$0.19** |

The estimate is from the time-based enforcement, not from billing. **AUDIT-2's actual cost is not yet
readable** and is reported as such rather than rounded down. This is exactly the lag that made a
between-stage billing check unusable as a cap, and why the wall-clock watchdog is the enforcement.

All `legasus-audit` apps are confirmed **stopped**, 0 tasks. The pre-existing `coder7b-a10g` app
remains deployed with 0 tasks; it is not covered by this authorization and was not touched.

## What this result does and does not support

**Supports:** on six fresh pages across three interaction modalities, a 7B driven by either method
produced six verified, independently evaluated repairs with no surviving regressions and no human
intervention. Both methods work on this class of task.

**Does not support:** that the manager improves repair outcomes. On this evidence it costs more for the
same result. A ceiling prevents the reverse claim too — this does not establish that the direct loop is
better, only that this set cannot tell them apart.

**Still outstanding:** stage 4, successive additions carrying earlier requirements forward, which is
where preservation machinery would have something to do; and stage 5's ablations, on development pages.
