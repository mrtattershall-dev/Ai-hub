# ACCEPTANCE POLICY — the verdict now decides what survives

Qualified 2026-09-23 on **PILOT-2's real preserved candidates**. No new model calls: the
candidates are exactly what the 7B produced. `server/acceptance.test.mjs`, **27/27**.

## The gap this closes

PILOT-2 **detected** a behavioural regression and **let it survive**. t5 broke `cartTotal` and
the broken workspace remained the workspace. Detection without disposition is the practical gap
before unattended operation can be extended.

## The policy

| protected | requested | disposition | completion? | promotable? |
|---|---|---|---|---|
| PASS | PASS | RETAIN | yes | yes |
| PASS | FAIL | PRESERVE_INCOMPLETE | **no** | **no** |
| FAIL | either | capture → restore verified start → **recheck** | no | no |
| EVALUATION_ERROR | unknown | HELD, preserved separately, nothing promoted | no | no |

`PASS`/`FAIL` is preserved but **not promoted**: passing a limited preservation suite does not
establish that a partial change is fit to build upon.

**This is ordinary check-and-rollback.** It is not credited to Legasus, and no additional benefit
is claimed — that would need a comparison, which this is not.

## t5, on the real candidate

    candidate   protected=FAIL   (cartTotal(items) returns NaN - the 7B's own output)
    captured    the broken cart.js is retained and auditable
    restored    the workspace re-verified: cartTotal(items) === 25
    surviving   protected=PASS
    counted     NOT a completion, NOT promotable

**The two verdicts are reported separately, always.** After the rollback the workspace is clean —
and the record still shows `candidateVerdict.protected = FAIL`. Collapsing them would let a
successful restore read as though the model never broke it, laundering the regression out of the
history.

The restore is judged on **behaviour**, not on a git exit code: `cartTotal(items)` is 25 again.

## Controls — the point of the exercise

t2 and t3, the two genuine successes, both **RETAIN** under the same policy, both still pass
afterwards, both count as verified completions. A policy that rejected everything would have
"passed" the t5 case while destroying the only useful work the run produced.

## d2: enforcement with no targets now REFUSES STARTUP

    enforce, NO targets  -> REFUSED: "Enforcement with no targets is not enforcement..."
    enforce, 2 targets   -> starts
    no enforcement       -> starts

Both pilots ran the first configuration and described themselves as "enforced". Asking for
enforcement and silently getting observation of nothing is the worst available outcome: the run
looks protected and is not. `d2Effective()` now reports the **effective target set and the check
performed**, not merely which environment flag was set.

## Two qualifications kept in the result

1. **The evaluator demonstrated DETECTION of t5, not PREVENTION.** In PILOT-2 the regression was
   found after the fact and survived. The policy qualified here is what would have rejected it —
   but it has not yet run inside a live batch. "Complementary" describes the *scopes* of the two
   checks; it does not describe a protection pipeline that ran.

2. **A fresh Modal deployment working does not explain why the previous one failed.** Recovery is
   recorded; the earlier cause (`Tasks 0`, zero log bytes, `modal-http: invalid function call`)
   remains **unresolved**.

## Not established

- Nothing about PROTOCOL-1.
- Nothing about d2's benefit: it was inert in both pilots, and this work did not exercise it.
- The policy is qualified as a unit. Wiring it into `batch.js` so it runs live is the next step,
  and until then a live batch can still let damage survive.
