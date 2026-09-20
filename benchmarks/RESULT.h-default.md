# r4 — H-DEFAULT. RESULT: the taxonomy did not grow, D-3 held prospectively, and D-1 did NOT.

Predictions frozen in `c188ac3`, before any defect was classified. Table:
`legasus/legascreen/roles.mjs`. Corpus: `benchmarks/h-default-corpus.json`.
Run: `node benchmarks/run-h-default.mjs`.

## The hard failure condition was NOT triggered

    THE TAXONOMY DID NOT GROW: 31 defects, every one validated against the six frozen roles and the
    six frozen laws. classify() throws on a seventh, and did not throw.

That is mechanically checked, not asserted: a test feeds it a seventh role and a new law and requires
both to be refused. The table went in with six and came out with six.

## D-1 DID NOT HOLD AS STATED

    EXPLAINED by wrong-role completion    13   42%
    VALUE_CONFUSION (ANY / STALE / OPAQUE) 3   the VALUE set covers these, the COMPLETION table does not
    NOT_AN_OMISSION                       15   forgery, naming, ordering, identity, kind

    EXPLAINED excluding every disputable reading:  9  (29%)

D-1 predicted "a high fraction". **42% is not a high fraction, and 29% on the strict reading is
less.** Fifteen of thirty-one defects have nothing to do with omission at all: a readable Symbol
brand, a name-keyed admission, ordering dependence, a referent moved by identity, a wrapper elided
from a DAG. The default problem is a real class. It is not the class.

The four disputable readings are named in the data (`C6`, `W3-d`, `SLICE1-c`, `AUTOCF-b`) so the
strict number can be recomputed by anyone who disagrees with a reading.

## D-2 held, but weakly, and HALF THE TABLE NEVER FIRES

    9  EVIDENCE read as QUERY
    2  REQUEST read as QUERY
    1  STATE read as EVIDENCE
    1  STATE read as DELTA
       distinct confusions: 4

Four distinct confusions, so this is not one observation wearing a table. But **nine of thirteen are
the single pair EVIDENCE-read-as-QUERY**, and the required role is only ever EVIDENCE, REQUEST or
STATE.

**QUERY, GRANT and DELTA are never the required role in this corpus.** Three of six roles do no work
here. By this project's own standard - a detector never shown to fire has not been shown to work -
half the table is unexercised, and a test records that so it cannot be quietly forgotten.

## D-3 HELD, AND IT IS THE RESULT WORTH HAVING

Stated before any classification, and confirmed by running the real `calculus.delegate`:

    context argument OMITTED      PERMITTED  ctx={"repository":"S1","criterion":"K"}
    context: {}                   REFUSED    drops or changes repository, criterion
    context omits ONE dimension   REFUSED    drops or changes criterion
    context restates everything   PERMITTED
    context ADDS a dimension      PERMITTED

**The same semantic request - "I add no further restriction" - gets opposite answers depending on
whether the caller omits the argument or passes `{}`.** The divergence is produced by
`const ctx = context || from.context`: a JavaScript falsiness test decides a question about
authority.

Precisely what is and is not deliberate:

- The per-dimension refusal **is** deliberate and documented; it was the repair for composition
  attack W3-c.
- The **divergence between the two forms of omission is not documented anywhere**, and falls out of
  `||`.
- The documented reasoning reads `{}` as "every world" - which is the QUERY completion applied to a
  REQUEST operand. The role confusion is visible in the prose that justifies the code.

And as predicted in advance, **this is not a safety defect**: refusing never grants more than
inheriting would. It is an expressiveness one - a grantee cannot narrow a single dimension without
restating every other. D-3 predicted the inconsistency, predicted it was undeliberate, and predicted
it was expressiveness rather than safety. All three.

## D-4 and D-5

D-4 (C2 as EVIDENCE-read-as-QUERY) is a retrodiction and was recorded as worth less than D-3 before
it was checked. It holds.

D-5 held: **no production code was changed.** `delegate` still behaves exactly as it did. The repair,
if there is to be one, is a separate slice with its own preregistration - and it is not obviously
wanted, since the current behaviour is the safe direction.

## Honest verdict

H-DEFAULT is **not refuted and not vindicated**. It survived its own hard failure condition, it
explains a real and recurring class covering about two fifths of the corpus, and it made one correct
prospective prediction about production code that nobody had encoded. It does not explain most of the
defects in this repository, and half of its vocabulary has never been needed.

That is worth keeping and not worth building a semantic substrate on yet.

Focused 6/6. Suite 678/678.
