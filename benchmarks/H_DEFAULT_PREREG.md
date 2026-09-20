# PREREGISTRATION — H-DEFAULT. Omission has no meaning until you know what role the object is playing.

Frozen before the mechanism exists and **before any historical defect has been classified**. Nothing
else is in this commit. Builds on `2c55371`.

## The hypothesis, in the owner's words

> **H-DEFAULT:** historically distinct authority defects can be reproduced as incorrect
> role-specific completion of an omitted semantic coordinate.

The claim underneath it is that `{}` has no single correct reading. As a query it means "I am not
asking"; as a delta, "preserve"; as evidence, "not established"; as a state, "incomplete". And `ANY`
is none of those - it is an explicit value.

## THE TABLE IS FROZEN HERE. GROWING IT IS THE FAILURE CONDITION.

Six roles, six completion laws, taken verbatim and **not extended for any defect**:

    ROLE        an omitted coordinate completes to
    STATE       UNKNOWN            (an incomplete description of what is)
    DELTA       PRESERVE           (what is not mentioned does not change)
    QUERY       DONT_CARE          (the question does not range over it)
    EVIDENCE    NOT_ESTABLISHED    (nothing was observed about it)
    GRANT       EXPLICIT_REQUIRED  (a permission may not be inferred from silence)
    REQUEST     INHERIT            (an unstated restriction is the grantor's)

Values, also frozen, and distinct from omission:

    EXACT(x)   ANY   ABSENT   UNKNOWN   UNADMITTED(x)   OPAQUE(identity)   STALE

**HARD FAILURE CONDITION, STATED BEFORE THE DATA:** if the taxonomy needs a new role, or a new
completion law, or a per-defect special case, then H-DEFAULT is just another explanation machine and
I will report it as refuted. Six roles in, six roles out.

## The corpus, selected by a rule fixed in advance

Every defect named in ledger Entries 15-30 that is stated as a DEFECT (in this project's own
vocabulary: a wrong behaviour that was found and repaired), **whether or not it looks like an
omission problem**. Defects are enumerated first, classified second. The denominator includes the
ones the hypothesis cannot touch, and those are reported.

For each: the operand's role is assigned from the table, mechanically where the call site makes it
mechanical and by stated reading otherwise - and **the reading is recorded so it can be disputed**.

## PREDICTIONS

**D-1 (THE MEASUREMENT). A high fraction of historically distinct defects are one defect.** Each is
a semantic operation that read an omitted coordinate under the completion law of a DIFFERENT role
than the operand was playing.
*Refuted if* the fraction is low, or if reaching a high fraction requires roles or laws beyond the
six frozen above.

**D-2. The six roles suffice, and at least two DIFFERENT confusions occur.** If every defect is the
same pair (say EVIDENCE read as QUERY), the taxonomy is one observation wearing a table.

**D-3 (THE PROSPECTIVE TEST - STATED BEFORE ANY CLASSIFICATION). The table predicts a distinction
nobody encoded, in `calculus.delegate`.**

`delegate({from, grant, to, context})` receives `context` in the REQUEST role, whose completion law
is INHERIT. The current implementation:

    const ctx = context || from.context;                       // whole-object omission: INHERITs
    const widened = Object.entries(from.context)
      .filter(([d, v]) => ctx[d] !== v).map(([d]) => d);        // per-dimension omission: REFUSES

So an omitted *object* inherits and an omitted *dimension* is refused. **Under the frozen table both
are REQUEST-role omissions and both should INHERIT.** I predict this inconsistency is real and was
not encoded deliberately.

I predict further that it is **not a safety defect** - refusing never grants more than inheriting -
but an **expressiveness** one: a grantee cannot narrow one dimension without restating every other.
*Stated now so it cannot be adjusted later:* if the difference turns out to be deliberate and
documented, D-3 is refuted.

**D-4. C2's repair is retrodicted, not assumed.** The historical C2 defect - `derive` filtering out
absent dimensions before intersecting, so `{}` joined with `{repository: S1}` concluded at S1 - is
EVIDENCE read as QUERY. The repair the project reached independently ("a dimension goes into the
output only when EVERY premise establishes it") is exactly NOT_ESTABLISHED. This is a retrodiction
and is worth less than D-3; it is recorded as such.

**D-5 (PREDICTION OF NO REPAIR).** This slice CHANGES NO PRODUCTION CODE. It is a classification
experiment over history plus one prospective check. If it succeeds, the repair is a separate slice
with its own preregistration.

## WHAT THIS SLICE DOES NOT ESTABLISH

- No canonical world model, no semantic algebra, no completion layer in production. The owner's
  instruction was explicit: do not implement a giant new layer yet.
- Nothing about the coding-delta consequence (`SemanticDiff(S,S') = AuthorizedDelta`). That is
  downstream of this surviving.
- The bridge-mutation gap from BRIDGE-1 remains open and is not addressed here.
- The calculus is still not wired into production.
