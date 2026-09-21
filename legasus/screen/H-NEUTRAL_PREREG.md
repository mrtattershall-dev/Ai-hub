# H-NEUTRAL — is the dangerous coercion the NEUTRAL one? (frozen 2026-09-21, before construction)

## Three nested hypotheses, stated so they can disagree

    H-INFO     relevant distinctions were erased
    H-TOTAL    they were erased when an unestablished state was forced into the ordinary
               value domain:  ⊥ -> v0
    H-NEUTRAL  the chosen v0 is specifically one that makes the failure INERT under the
               immediate consumer's composition:  x ⊗ v0 = x

H-INFO and H-TOTAL are **indifferent** to which `v0` is chosen: `error -> []` and
`error -> ["__ERROR__"]` both totalize, both erase the same distinction. **Only H-NEUTRAL
predicts an asymmetry between them.** That asymmetry is the experiment.

## The tautology guard

Neutrality is defined **algebraically and in advance**, as a property of the consumer's
operation:

    v0 is neutral for ⊗   iff   x ⊗ v0 = x   for all x in the tested domain

It is *not* defined as "produces no disturbance". The **measured** quantity is something else
entirely: **detection distance** — the index of the first pipeline stage whose output differs
from the failure-free baseline, or ∞ if no stage ever differs.

Algebraic property frozen up front; empirical quantity measured afterwards. If these were the
same thing the experiment would be circular, and they are not.

## The pipelines, drawn from instances already collected in this branch

    list      stage1 out.extend(v)   stage2 len(out)     stage3 bool(out)
    numeric   stage1 total += v      stage2 total        stage3 total > threshold
    conj      stage1 checks.append(v) stage2 all(checks) stage3 warn if not all
    string    stage1 s += v          stage2 len(s)       stage3 s.strip() != ""

Per pipeline, two coercions of the SAME type:

    neutral        []        0        True      ""
    non-neutral    ["ERR"]   999999   False     "ERR"

## Predictions

**N1.** Every **neutral** coercion has detection distance **∞** — no stage differs from the
failure-free baseline.
FALSIFIER: any neutral coercion produces an intermediate difference.

**N2.** Every **non-neutral** coercion has detection distance **1** — the immediate consumer's
output already differs.
FALSIFIER: any non-neutral coercion travels past stage 1 undetected.

**N3 — the discriminator, and the reason this is not "some values are just safer".** The
**identical value `[]`** is fed to two different consumers:

    consumer A   out.extend(v)   -> [] is neutral      predict detection distance ∞
    consumer B   v[0]            -> [] is NOT neutral  predict detection distance 1

Same value, same type, same coercion, same erased distinction. If detection distance differs by
consumer, danger is a property of the **(value, consumer) relation** — H-NEUTRAL's actual claim —
and not of the value, the type, or the amount of information lost.
FALSIFIER: the two consumers give the same detection distance.

**Competing accounts, evaluated on the same runs:** H-TOTAL and H-INFO predict **no difference**
across N1/N2/N3, because every arm totalizes and every arm erases the same distinction. If the
measurements come out flat, they are the better accounts and H-NEUTRAL is wrong.

## Disposition

    N1, N2 and N3 all hold          H-NEUTRAL discriminated from H-TOTAL and H-INFO on this
                                    construction - Stage A standing only, same author
    N3 fails                        danger is not consumer-relative; H-NEUTRAL's core claim is
                                    false regardless of N1/N2
    measurements flat               H-TOTAL / H-INFO are the better accounts

## Rules

Stage A. Author-built pipelines, so a pass is **weak** evidence and may not be reported as
survival. H-CONTINUE — that software systematically encodes failure as whatever preserves
forward execution — is **not** tested here and is not adopted; it would need a corpus study, not
a construction. Nothing is installed. If the harness evaluates a weaker proposition than the one
frozen, that is an apparatus failure and is scored as such — this has now happened six times.
