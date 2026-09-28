# Positional misattachment — result. P1..P5 against `POSITIONAL-MISATTACHMENT_PREREG.md`.

    5 arms, all green.  159 -> 164 tests in this directory.

## The answer, and it is the bad one

> **Positional origin reassignment does not merely block legitimate continuity. It positively
> authorizes the wrong history.**

Two separate histories with byte-identical records, same local `ref`. One receives continuity
authorization. Reorder the journals, leave the authorization untouched, and the **unauthorized**
history is selected — `kind: CONTINUED`, reported as a **successful continuity**, with
`GOVERNING_BY_AUTHORIZED_CONTINUITY` and the `DESIGNATED` obligation attached to it. The run does
**not** refuse; `unresolvedGovernance` is empty; no continuity finding reports a problem. The system
believes it attached correctly.

**This is a safety failure and is recorded as one. It is not repaired here** — the preregistration
forbids inventing a stronger identifier and calling it ownership, and the reason that prohibition
matters is in P5.

## My prediction failed, and the hedge is what was right

I predicted **P2 would hold and P4 would record "blocks legitimate continuity"** — reasoning that
the authorized history, moved to a different origin, would stop qualifying. I also wrote that the
case I could not predict confidently was the other history matching *both* conditions, and that if
it did, the answer was "positively authorizes the wrong history" and must be reported as a safety
failure. **It matched.** The headline prediction was wrong; only the hedge survived. Recorded rather
than re-narrated as foresight.

## Why the earlier arms did not catch this

L3 appeared to show that a replacement copying every label inherits nothing. The mutation table for
that run already said what the arm actually measured: the *origin ignored* mutant was caught by
**L6 only**, never by L3, because L3's impostor was a **revision** — its content differed. This run
removes the content difference, which was the only thing L3 was sensitive to. With content equal,
the origin is the entire basis, and the origin is exactly what positional assignment moves.

**The correction in `STANDING.md` anticipated this and it should be read together with this result:**
*a replacement whose content differs from the authorized content inherits nothing* was the
demonstrated claim. The byte-identical case was never demonstrated, and it now fails.

## The apparatus that made this observable

Byte-identical records cannot be separated by content, and their occurrence digests differ **only
through the origin**, the variable under test. So the harness keeps an **independent fixture
identity** — a label in a `Map` keyed by object identity, never serialized, never reaching the
runtime — and the arms assert *which history object* was selected by resolving the runtime's answer
back through the sources.

Comparing against the resulting occurrence digest would have reported no difference and certified
the defect as absent. That would have been the eleventh wrong-referent instance and the first one to
hide a real safety failure rather than a measurement.

One construction note, preserved: building the two histories independently produced records
differing in an internal `evidence_root` drawn from the module ref counter — a difference with no
meaning here that would have let **content** separate them and quietly protected the arm. The
faithful construction is one record and a clone.

## P5 — the missing input, stated as a requirement rather than repaired

    contentOf(AUTHORIZED) === contentOf(OTHER)                 content cannot separate them
    JSON.stringify(AUTHORIZED) === JSON.stringify(OTHER)       nor can any serialization
    occurrenceOf('origin-0', AUTHORIZED) === occurrenceOf('origin-0', OTHER)
                                                               under one origin they are literally
                                                               the same occurrence

**The runtime receives no distinguishing information between the two histories beyond position.**
It therefore *cannot* recover which one the governor intended — not because its identifier is too
weak, but because **the information is not present in what it receives**. The harness can tell them
apart only because it kept a label the runtime never sees.

> **This establishes a missing input requirement: a continuity authorization needs a history
> identity that travels with the journal and is established rather than asserted.** No digest the
> runtime could compute would supply it, and inventing one would be naming a thing, not
> establishing entitlement — the same distinction the journal-lineage run started from.

## Arm by arm

| arm | outcome |
|---|---|
| **P1** baseline | **held** — with stable labels the authorized history is selected, established against the independent fixture identity |
| **P2** the decisive attack | **the safety failure**: the unauthorized history is selected and reported as a successful continuity |
| **P3** governance | attaches to the wrong history too. **Stated in advance as gated on P2** — it is not a second independent piece of evidence |
| **P4** which failure mode | **authorizes the wrong history**; it does not block. No refusal, no unattached report, no refusing finding |
| **P5** the missing input | **established** — and deliberately not repaired |

## What this does and does not change

- **The `INVALIDATE` default does not help here**, and that is the sharpest part: nothing is
  unattached. The obligation attaches — to the wrong subject. Fail-closed protects against
  *absence*, not against *confident misattachment*.
- **Occurrence keying still does what G1/G2 showed** — it converts silent misapplication into
  reported non-application **when content differs**. It gives nothing when content is equal.
- **The threat model is unchanged.** This is accidental authorization transfer under a careless
  merger: no malice is required, and no protection against a malicious governor or cryptographic
  impersonation is claimed.
- The registry is still **3 authored rules, 0/15**. `COMPLETE` unsatisfied. **S6 untouched.** F2
  untouched. H-IDENTITY-AUTHORITY stays at **NONE**.

## The next boundary this names

A journal-borne history identity that is **established, not asserted** — which returns to the
question the lineage run could not answer with a UUID, now with a demonstrated failure forcing it
rather than a hazard suggesting it. Until such an input exists, **continuity authorizations must not
be used with position-derived origins**, and nothing in the code currently prevents that pairing.
