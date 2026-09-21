# BIND-CJS step 16 result — H1 discriminated from H0 in both directions
2026-09-21 09:05. Preregistration `legasus/BIND-CJS_DISCRIMINATE.md` (097a99e), frozen before
either world existed. Deciders frozen there and unmodified. Hygiene: 9 pids, 0 alive at sweep.

    H0  a program permitted to emit its own verdict can emit a false one
    H1  an authority path fails when the representation it consumes can vary independently of
        the event it is used to establish

| world | case | underlying truth | decider | stdout |
|---|---|---|---|---|
| BOUND | ctl-pass | true | true | `PASS <nonce> joins with a plus` |
| BOUND | ctl-fail | false | false | `FAIL <nonce> joins with a plus` |
| **BOUND** | **D1 forge** | **false** | **false** | `FAIL <nonce> …` **+ forged** `PASS joins with a plus` |
| OBSERVER | ctl-pass | true | true | `PASS joins with a plus` |
| OBSERVER | ctl-fail | false | false | `FAIL joins with a plus` |
| **OBSERVER** | **D2 lie** | **false** | **true** | `PASS joins with a plus` |

Both worlds' controls held.

## D1 — the subject reported, and the path did not fail

The witness *did* emit a forged `PASS` line; it is visible in the recorded stdout beside the
tagged `FAIL`. The decider declined anyway. **H0 predicted a vulnerability here and there was
none**: self-report was present and was not sufficient for failure.

**Honest weakness of this half.** The decider was *defined* to require the nonce, so "an
untagged line does not count" is close to definitional. What is not definitional is the
consequence for H0: the subject controlled its output, exercised that control, and the path
held. Still, D1 is the weaker of the two, and the verdict should not rest on it alone.

## D2 — the reporter was separate and faithful, and the path failed anyway

The reporter is a different process. It read the subject's state and reported exactly what it
found, adding nothing and inventing nothing. The state was a lie, and a case that did not pass
was affirmed.

**H0 predicted safety here and was wrong.** This half is not definitional: nothing about the
construction forces a faithful external reporter to produce a false verdict except the fact that
what it reads can vary independently of the event. That is H1's content.

## Verdict, by the frozen criterion

    D1 DECLINES and D2 AFFIRMS  ->  H1 discriminated from H0 in both directions

**The deeper layer is purchased** — once, by one experiment, with D2 carrying most of the weight.
What H1 has earned is standing as the better of two stated accounts on this pair of worlds. It
has not earned a name, a place in the architecture, or the status of a principle, and none was
given.

## Caveat stated before the run, repeated because it bounds the result

BOUND tested binding against a **naive** forger. The nonce lives in the witness's own
environment; an adversarial subject could read it and emit a tagged line. D1 therefore shows
*this construction resisted this attack* and **not** that representations can be bound
in-process. The adversarial variant is a separate expedition and is the obvious next attack on
H1 itself.

## What this changes about step 15

R1 remains what it was: prospective reach for the pattern, non-discriminating between H0 and H1.
Step 16 does the discriminating that step 15 could not. The ledger for the descent is now:

    R1   prospective, non-discriminating      did not purchase depth
    R2   falsified construction               did not purchase depth
    D1   discriminating, weak half            contributes
    D2   discriminating, load-bearing         purchases depth

## What was NOT done

No rename, no grouping of the five earlier attacks, no repair to BIND or any fixture, no third
hypothesis invented. H1 is not installed anywhere; it is one sentence with one discriminating
result behind it.

## Next falsification, not started

1. **Attack H1 where it is most exposed.** The adversarial BOUND: let the subject read the nonce
   and emit a tagged line. H1 predicts the path fails, because a readable nonce means the
   representation *can* vary independently after all. If it fails, H1 survives an attack on its
   own terms; if the construction somehow holds, H1 is in trouble.
2. **The grouping question, still untouched.** Whether role, identity, request provenance,
   PASS/FAIL and channel artifacts are one mechanism or several. H1 now supplies a candidate
   property to test them all against — which makes that experiment sharper than it was an hour
   ago, and no more licensed.
