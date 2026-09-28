# Substitution without coexistence — X1..X5. Frozen 2026-09-21, before the attack is run.

*(X, not S: `SUBSTITUTION_PREREG.md` on the producer side and the S-arms of the multiplicity run
already use S. Different subject, different letters.)*

## The claim being withdrawn before it is tested

`CONTAINMENT_RESULT.md` ended with *"continuity transfer is refused **wherever** the inputs cannot
distinguish the intended history"*. **That is not what was built.** The rule detects **multiple
claimants in the current merged set**. It cannot detect an **absent** intended history.

The defensible statement, replacing it:

> **Transfer is refused when multiple presented claimants carry the authorized content.
> Substitution by a sole byte-identical claimant is untested.**

This run tests it.

## The attack

1. authorize history **A** (origin `S`, `contentOf(A)`)
2. **remove A entirely**
3. supply byte-identical history **B** in A's former position
4. leave the authorization unchanged

There is now **exactly one** claimant carrying the authorized content — the shape C3 permits.

## Predictions, committed now

- **X1: I expect B to inherit A's governance, and I expect that to be an unauthorized transfer.**
  Nothing in the inputs distinguishes B from A, and the containment's trigger — co-presence — never
  fires. If it succeeds, the containment's scope is **co-presence only**, and C3 is shown to
  demonstrate *retained transfer capability* and **not** correct historical attachment.
- **X2**: with content that differs, the sole claimant is refused as `UNAUTHORIZED` — the
  content-change protection is unaffected by any of this.
- **X3**: I expect **no containment to be possible here without the missing input.** Uniqueness
  among presented claimants cannot establish that the sole claimant is the intended history, because
  the intended one is absent and unrepresented. If I find myself able to "fix" X1, I should suspect
  I have invented the identifier the previous run forbade.

## Two separate corrections carried in this run

**L6's changed result is not evidence for the origin check.** The containment now refuses before
execution reaches the origin comparison, so L6 can no longer be cited as demonstrating that the
origin is load-bearing. Its evidence for *that* mechanism is superseded; its observation that a
byte-identical copy inherits nothing still stands, by a different mechanism. **The two mechanisms'
evidence is kept separate**, and the origin check's own evidence now rests on the mutation record
from the lineage run, not on L6's current behaviour.

**The specimen bypass leaves the production options surface.** `__specimenUncontainedContinuity` is a
callable bypass on the public options object: C4 established that the tested live path avoids it, and
**not** that an ordinary caller cannot select it. The preserved specimen moves to a test-only module,
and `replayMerged` gains an ordinary dependency-injection parameter instead of a flag naming the
defect. **Stated limit: in JavaScript a bypass that exists is callable by anyone who imports it.**
This reduces accidental selection; it does not make selection impossible, and it is not reported as
if it did.

## The arms

| arm | required observation |
|---|---|
| **X1** the substitution attack | record whether the sole byte-identical claimant inherits the absent history's governance |
| **X2** content control | a sole claimant whose content differs is still refused as `UNAUTHORIZED` |
| **X3** scope, stated | whatever X1 shows, the containment's scope is stated as measured, not as intended |
| **X4** the specimen survives relocation | the preserved body still exhibits P2's failure from its new home, and the P-suite still measures it end to end |
| **X5** the flag is gone from the options surface | passing the old option name to `replayMerged` has **no effect** |

## Forbidden in this run

No new identifier, label, nonce or signature. If X1 succeeds, it is recorded as an open failure with
its scope named — **not** repaired by inventing the missing input. No registry rules added or changed
(still **3 authored, 0/15**). `COMPLETE` stays unsatisfied. **S6 untouched.** `INVALIDATE` is not
weakened. The specimen is not repaired.
