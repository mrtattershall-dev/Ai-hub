# Closing the governance decision — D1..D6. Frozen 2026-09-21, before the change.

## The decision, taken

> **History-specific continuity refuses when its intended history cannot be distinguished from a
> replacement.** Content-based authorization is preserved as a **separately and explicitly chosen**
> contract.

## What "cannot be distinguished" amounts to today, stated before implementing it

X1 and the audit establish that a presented record carries **nothing** that separates it from a
byte-identical replacement. There is no input in which "this is the original, not a substitute"
could be false-but-detectable. **So under today's inputs the condition is always satisfied, and
history-specific transfer refuses unconditionally.**

That is not a theorem that such transfers are unsafe in general. It is what follows from *these*
inputs, and it changes the moment an independent binding exists.

## The two contracts, named so one cannot be substituted for the other

    HISTORY_SPECIFIC   default. "this particular history continues." REFUSES today, because the
                       inputs cannot distinguish the intended history from a replacement.
    CONTENT_MATCH      "whichever record carries exactly this content may continue." A DIFFERENT
                       claim, satisfied by a byte-identical replacement BY DESIGN. Must be chosen
                       explicitly by the governor, and is recorded in the outcome as chosen.

`CONTENT_MATCH` is not a weaker version of the first. It asserts something else, and a governor
choosing it is asserting that a byte-identical record **is** an acceptable subject — which X1 shows
it will get.

## The cost must be measured, not asserted as solved

Every transfer that previously succeeded under `HISTORY_SPECIFIC` now refuses. **D4 counts them
across the existing suites** rather than describing them, and the count goes in the result. The cost
is real and is not presented as solved by naming the other contract: a governor who switches to
`CONTENT_MATCH` to keep working has accepted X1, not avoided it.

## The arms

| arm | required observation |
|---|---|
| **D1** the default refuses | with no contract named, a history-specific transfer refuses, naming that the intended history cannot be distinguished from a replacement |
| **D2** the replacement gains nothing | X1's exact construction under the default: B does **not** inherit |
| **D3** `CONTENT_MATCH` is explicitly chosen and recorded | it transfers, and the outcome says the contract was chosen, never that it is how things work |
| **D4** the measured cost | the number of previously-succeeding transfers now refused, counted from the arms themselves |
| **D5** the contract is governed, not requested | a requested contract is recorded and never decides — the A1 separation applies here too |
| **D6** co-presence still refuses under both | choosing `CONTENT_MATCH` does not re-open the ambiguity the containment closed |

## Predictions

- **D1, D2, D3, D5, D6** I expect to hold; the rule is mechanical.
- **D4**: I expect **every** continuity-transfer arm in the suite to move — L2, L4, L8, C3, X1, X3 and
  the P-suite. If fewer move, the default is not reaching them and I have mis-wired it.
- The P-suite measures the **specimen**, so it should be unaffected; if it moves, the specimen is
  no longer isolated.

## Forbidden

No new identifier or binding — that is the external milestone's successor, not this change. No
registry rules (still **3 authored, 0/15**). **S6 untouched. F2 untouched.** `INVALIDATE` unchanged.
The specimen is not repaired.
