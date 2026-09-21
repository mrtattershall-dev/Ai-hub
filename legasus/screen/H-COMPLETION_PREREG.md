# H-COMPLETION — the completion policy predicts the error direction
Frozen 2026-09-21. Relations, policies and predicted directions all written before any witness was
sought.

## The hypothesis

> The primitive event is not a bad identity decision. It is a **partial relation being forced into
> a total one**. Refusal is not the primitive; it is the implementation behaviour that preserves
> partiality.

    f : S -> R   partial
    f(x) undefined
          ↓  completion
    f̂ : S -> R   total

**The policy used to eliminate the undefinedness determines the direction of the eventual error.**

    REFUSE              preserve undefinedness          -> NEITHER
    MAP TO EXISTING     assign x to an existing class   -> FALSE MERGE
    DROP / EXCLUDE      omit x; absence later read as non-membership -> FALSE SPLIT
    INVENT NEW CLASS    fabricate a class for x         -> FALSE DISTINCTION
    GUESS               pick by heuristic               -> EITHER

This subsumes M2, which is why M2 was the only informative row of H-INVERSE. M2's prediction did not
come from the label *coverage failure* — the superficial sign for that is SPLIT. It came from **how
the partial map was extended when it left its supported region**: unrecognised forwarding was not
dropped, it was reclassified into the existing `discharge` class. `MAP TO EXISTING -> MERGE`.

## Domain-scoping, carried over from REACH-1 and H-INVERSE

The required property is not `injective(R)` in the abstract but
`injective(R restricted to S_relevant,target)`. H-INVERSE found three of six properties holding on
one target and failing on another; that is **not** a defect in the framing, it is the same
domain-scoping the reachability work already forced. Coverage and canonicality are relational and
target-scoped. A completion policy can therefore be safe on one corpus and unsafe on another, and
nothing here claims otherwise.

## The frozen set — prospective, none yet witnessed

    id   partial relation                              completion policy    PREDICTED
    C1   enclosing(call) for a module-level call       MAP TO EXISTING      FALSE MERGE
    C2   Index.build on a file that fails ast.parse    DROP                 FALSE SPLIT
    C3   resolve_call_arg on `*args` / `**kwargs`      REFUSE               NEITHER
    C4   literal_produces on a non-FALSY predicate     REFUSE               NEITHER
    C5   screen2 SKIP_DIRS excluding test directories  DROP                 FALSE SPLIT

C1's prediction is the risky one, as M2's was: the relation is undefined because there is **no
enclosing function**, and the superficial reading of "missing" is SPLIT. The policy is MAP, because
`forwards(call, None)` returns `None` and the caller counts that as a discharge site. **MERGE is
predicted against the superficial sign.**

    calibration, already witnessed, EXCLUDED from scoring
    forwards() unsupported syntax    MAP     merge   (M2)
    is_in_domain_const               DROP    split   (#10)
    TRUSTED_TAILS                    MAP     merge   (#7)
    resolve outside its region       REFUSE  none    (#13)

## Predictions

**K-1.** Each frozen relation's observed error direction matches the one predicted from its
completion policy alone.
FALSIFIER: any relation errs in the direction opposite to its policy's prediction.

**K-2 — the control, and the row that can kill this.** The REFUSE relations (C3, C4) produce **no**
merge and **no** split witness. If preserving partiality does not prevent directional error, then
the policy does not determine direction and K-1's matches are coincidence.
FALSIFIER: a REFUSE relation produces a merge or a split witness.

**K-3.** Both directions occur among the non-REFUSE relations.
FALSIFIER: only merges, or only splits — then a one-directional account suffices.

The shallower rival is *"undefined cases just cause bugs"*, which predicts **no correlation between
policy and direction** and no protection from REFUSE. K-2 is what separates them.

## Rules

Witness-or-nothing. No relation added or dropped after measurement. Frozen detectors are imported
unmodified; sites #7 and #10 stay unrepaired. If a REFUSE row produces a witness it is reported,
not explained away — that is the result that would end this line.
