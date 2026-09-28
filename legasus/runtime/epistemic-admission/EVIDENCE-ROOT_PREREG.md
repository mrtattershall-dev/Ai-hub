# Evidence roots — a witness is a REFERENCE to established authority, not evidence. Frozen 2026-09-21.

## The third version of one problem

    v1.2   "COVERAGE"                          the NAME was enough
    v1.3   "COVERAGE about P/R rooted at E"    the BINDINGS are required
    v1.4   E must itself establish             the EVIDENCE must carry the relation
           COVERAGE(P, R)

v1.3 establishes that `evidence_root` **exists**. It does not establish that the thing it names
actually establishes the relation instance. The matcher checks a non-null string.

## The rule, frozen

> **A relation witness is not evidence. It is a reference to an independently established relation
> claim.**

Two established endpoints do not establish an edge. An object *claiming* to witness the edge does not
establish it either. **The edge needs its own provenance.**

## How, and how NOT

**NOT** by having the matcher inspect an arbitrary evidence payload and judge whether it looks
convincing. That turns the registry matcher into a second epistemic oracle, which is the defect this
whole line removes.

**Instead** the root resolves, in an authority store, to a **real minted epistemic token whose claim
IS the required relation instance**:

    candidate witness { relation, subject, object, domain, evidence_root: E }
            -> resolve E in the authority store
            -> a token minted by observe() or derive()
            -> whose claim is exactly  RELATION(subject, object)
            -> and whose context covers the domain
            -> matcher satisfied

The relation claim is canonical and mechanical: `REL(subject, object)`. The matcher compares strings
it constructs from the binding context against the token's own claim. It judges nothing.

## The arms

    E1  real, valid authority establishing the exact relation instance      SATISFIES
    E2  real evidence id, authority invalid/stale                           REFUSES
    E3  real valid authority establishing an unrelated proposition          REFUSES
    E4  right relation proposition, wrong domain/context                    REFUSES
    E5  root depends circularly on the derivation it is justifying          REFUSES
    E6  relation authority legitimately DERIVED rather than OBSERVED        SATISFIES

**E6 is the anti-refusal control.** The easiest "safe" implementation accepts only primitive
observations and thereby makes composed relational knowledge impossible. A relation established by a
valid derivation is still established.

**E5** matters because a witness that points at a token derived from the very claim under derivation
would let a conclusion justify its own premise. The justification graph already refuses circular
justification; the same must hold across this reference.

## Predictions

    C-1  E1 and E6 satisfy; E2, E3, E4 and E5 refuse, each naming which check failed
    C-2  REGRESSION: every W1..W5 outcome is unchanged, and a witness whose evidence_root names
         nothing in the store now REFUSES where v1.3 accepted it
    C-3  the matcher never reads an evidence payload: it resolves a reference and compares
         canonical claim strings. Asserted on the source with comments stripped.
    C-4  legaknow remains byte-unchanged, asserted by git
    C-5  the census is untouched: still zero correspondence over the fifteen

## Rule selection stays frozen, and the fifteen are spent

The registry stays at three rules. **No applicability predicate is authored**, and the fifteen
pre-registry declarations are now **historical adversarial examples, not held-out material** — I have
inspected all of them, so they can no longer serve as clean prospective validation. They may later
answer *"does a new selector suddenly claim to understand derivations it previously could not?"* and
nothing stronger. Prospective evidence for rule selection requires derivations that did not exist
when the selection semantics were authored.

## Rules

Registry frozen at three rules. `legaknow` not modified. Census not touched. Earlier contract
versions preserved. No `delegate`, no `commit`, no merge.
