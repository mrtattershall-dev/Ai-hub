# Transaction substrate family — STATUS: INCOMPLETE, NOT SEALED

**Do not run anything against this family.** Rule 15 requires the entire family authored, validated and
sealed before the model or the applicability detector sees any of it. Four tasks remain.

    ops   analogy_specified          no_supported_analogy
     2    a01 weighted tallies  ok   b01 undo via snapshot  ok
     3    a02 (not authored)         b02 (not authored)
     4    a03 (not authored)         b03 (not authored)

Authored so far, with every witness proven by execution rather than asserted:

    a01  analogy_specified     ops 2  noop fails delta, both omissions fail delta, reference preserves + passes
    b01  no_supported_analogy  ops 2  noop fails delta, both omissions fail delta, reference preserves + passes

Rule 13 currently holds trivially (one task per class, both at 2 operations). It becomes a real check once
the 3- and 4-operation pairs exist.

No `MANIFEST.sealed.json` exists, deliberately. Sealing a partial family would assert `pre_generation`
over a set that is still growing, which is exactly the claim the seal is supposed to make checkable.
