# Positional misattachment of continuity — P1..P5. Frozen 2026-09-21, before any code.

## The question, sharpened past the known hazard

A6 established that a merger assigning origins by input position can move what a label denotes.
G1 established that coordinate-keyed governance can then land on the wrong record. The unanswered
question is the dangerous half:

> Does positional origin reassignment merely **block legitimate continuity**, or can it **positively
> authorize the wrong history**?

## The construction, which deliberately removes what protected L3

L3's impostor differed in **content**, and the mutation table showed L3 was sensitive to exactly
that and not to the origin. So this run removes the content difference:

- **two separate histories** whose records are **byte-identical**, including the same local `ref`
- **only one** of them receives continuity authorization
- the journals are **reordered** while the authorization is left **unchanged**
- the question: does the other history now inherit continuity, or governance, because it occupies
  the authorized origin?

## The apparatus requirement this construction forces

Byte-identical records cannot be told apart by content, and their occurrence digests differ only
through the origin — which is the variable under test. So **the selected history must be compared
against an independently maintained fixture identity**, carried outside the merged data and outside
any digest the runtime computes: each history is tagged in the harness with a label the runtime
never sees, and the arms assert *which history object* was selected, not merely which digest came
back.

Comparing against the resulting occurrence digest alone would be the eleventh wrong-referent
instance, and it would be the one that certified the defect as absent.

## The arms

| arm | required observation |
|---|---|
| **P1** baseline | with stable origin labels, the authorized history is selected and the unauthorized one is not — established against the independent fixture identity, not a digest |
| **P2** the decisive attack | with position-derived origins and the authorization unchanged, reordering must **not** cause the unauthorized history to inherit continuity |
| **P3** governance, separately | even where continuity is somehow granted, the unauthorized history must not acquire the **obligation** — the permissions stay separate under attack |
| **P4** which failure mode | record whether P2 **blocks legitimate continuity** (the authorized history stops inheriting) or **authorizes the wrong one**. These are different results and only one of them is a safety failure |
| **P5** the missing input | if the runtime receives **no distinguishing information** between the two histories beyond position, state that as a **missing input requirement** — not as a reason to invent a stronger identifier and call it ownership |

## Predictions, committed now

- **P2 I expect to hold, and P4 to record "blocks legitimate continuity".** The authorization names
  `successorOrigin`, so after a reorder the authorized history sits under a different origin and
  simply fails to qualify — while the *other* history, now occupying the authorized origin, has
  byte-identical content and **will match both conditions**. That is the case I cannot predict
  confidently, and it is the reason this run exists: if it matches, the answer to the sharpened
  question is **positively authorizes the wrong history**, which is a safety failure and must be
  reported as one.
- **P3** I expect to follow whatever P2 does, because governance transfer is gated on the continuity
  finding. If P2 fails, P3 fails with it — they are not independent, and saying so in advance stops
  a second arm being counted as a second piece of evidence.
- **P5 I expect to be the honest outcome of the run**: two byte-identical records in two journals
  carry nothing that distinguishes them except where the merger put them. No identifier the runtime
  could compute would fix that, because the information is not present.

## Forbidden in this run

No signature or ownership scheme. No new identifier invented to make P2 pass — if the information is
absent, that is the finding. No registry rules added or changed (still **3 authored, 0/15**).
`COMPLETE` stays unsatisfied. **S6 untouched.** No freshness rule. No repair of the F2 boundary. The
`INVALIDATE` default is not weakened.
