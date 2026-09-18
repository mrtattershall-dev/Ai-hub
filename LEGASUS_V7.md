# LEGASUS v7 — SEMANTIC INTENT

**Milestone specification. Written before any v7 code and before the family that tests it.**
Preceding milestone in [`LEGASUS_V6.md`](LEGASUS_V6.md); supported universe in
[`legasus/SUPPORTED.md`](legasus/SUPPORTED.md).

---

## The claim, deliberately narrow

> **Given two individually valid behaviours whose applicability overlaps, Legasus can derive a minimal
> precedence constraint from the task specification and preserved behaviour, without encoding the
> reference implementation or relying on source position.**

Not *"understand intent"*. The narrow claim is the testable one, and a failure will name which half
failed.

## What may and may not answer a precedence question

    MAY ANSWER
      REQUESTED DELTA          the new behaviour the task asks to introduce
      PRESERVATION CONTRACT    existing behaviour the task explicitly requires to remain true
      OBSERVED EXISTING        behavioural mappings verified independently by execution
      DOMAIN RELATION          relations the task states - "except", "unless", "for all other..."

    MAY NOT ANSWER
      the reference patch                the reference site
      the reference order                the reference branch shape
      canonical realization / style      current source order BY ITSELF
      a hand-written sentence that merely restates the patch

The last exclusion is the one that needs guarding hardest. Handing the model prose that paraphrases the
reference is smuggling the solution through the specification, and it would look exactly like success.

## The output is a semantic contract, not an insertion hint

    intent:
      new_domain:        n < 10
      new_result:        "small"
    preserved_behavior:
      condition:         n == 0
      result:            "zero"
    overlap:
      satisfiable:       true
      witness_input:     0
    precedence:
      preserved_behavior > new_behavior
    reason:
      existing verified behaviour is explicitly preserved, and both predicates apply to input 0

What is deliberately absent: *"put this branch after line 4"*, *"use elif"*, *"insert after the zero
check"*. Those are implementation leakage. The contract states semantics; the implementation is free.

## Three outcomes, and abstention is not free

    PRECEDENCE(A > B)        the contract settles which behaviour owns the overlap
    NO_PRECEDENCE_NEEDED     the domains cannot both apply - precedence is not a question
    AMBIGUOUS_INTENT         they overlap and the contract does not say which wins

`AMBIGUOUS_INTENT` is the honest answer when a task says *"add small handling for n < 10"* with no
statement about whether zero keeps its special meaning. It is also the obvious way to cheat, so
coverage is a first-class metric: a system that declares everything ambiguous fails.

## The must-distinguish pair

Identical program, identical new predicate, identical candidate sites, identical dependencies. Only the
contract differs.

    def classify(n):
        if n < 0:    return "negative"
        if n == 0:   return "zero"
        return "positive"

    CASE A   "Preserve the existing special handling of zero. For other values below 10, return small."
             EXPECTED  zero > small

    CASE B   "Values below 10 should now return small, including values that previously returned zero."
             EXPECTED  small > zero

**If the system emits the same precedence for both, semantic intent has failed.** No structural fact
distinguishes them; nothing but meaning does.

## Success criterion — a conjunction

    correct overlap detection
    correct NO-overlap detection
    correct precedence on the must-distinguish pairs
    correct ambiguity declaration
    zero reference-patch leakage
    same structural input + opposite intent  =>  opposite precedence
    the generated contract admits MORE THAN ONE implementation

The last is the anti-oracle test. Given only *"preserved zero behaviour outranks new small-number
behaviour"*, a human may write

    if n == 0: ...        or        if n < 10 and n != 0: ...

or restructure entirely. A contract that admits exactly one implementation has encoded the patch.

## Gate structure

Small gates, as before. Semantic intent is not one implementation.

    12A  extract behavioural predicates from existing code and from the requested delta
    12B  compute overlap, and produce a witness input when it exists
    12C  derive precedence from the permitted evidence only
    12D  emit the minimal intent contract
    12E  hand only that contract downstream

Each gate: witnesses first, positives and negatives, prove the witness can fire, one general change,
run, classify, commit.

## Carried forward

Every apparatus rule still binds: authored blind and sealed before implementation, denominator frozen
before scoring, per-case reporting before any aggregate, path sensitivity proven in advance for every
negative and abstention control, one canonical reconstruction, and no frozen historical result
rewritten. Narrowability V2 applies to any family authored from here.
