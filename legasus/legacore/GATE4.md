# GATE 4 — diagnosis of the three remaining under-narrowings

No rule was proposed before reading the text. g03's residual looked structural and turned out to be
semantic intent, so this one was inspected first.

## The cause: positions inside an unclosed bracket

    provenance/e01:op3   survivors [0, 3]
    provenance/e06:op3   survivors [0, 3]
    provenance/f01:op2   survivors [0]

Every survivor sits inside a multi-line collection literal:

    0 SURV  SHAPE_KINDS = ["circle", "square", "rect"
    1 pass  ]

Inserting a module-level `def` between the opening bracket and its `]` is a syntax error. Execution
correctly rejects the position. Nothing in the deriver removes it, because `bodies()` models COMPOUND
STATEMENTS — `def`, `class`, `if`, `for`, `while`, `try`, `with` — and has no notion of an **expression
continued across lines**.

This is a **CURRENT_PROGRAM_FACT** the model does not represent: a position inside an open bracket is
not a legal insertion boundary at all.

## Artifact and class, separated

The *specific instance* is amplified by the apparatus. These sources contain intra-line operations
(`, "rect"` inserted into a list literal), and the patch reconstruction terminates every block with a
newline — so the literal, written on one line in the source, appears split across two in the text
operations are placed into.

The *class* is real regardless. Any program containing a hand-written multi-line list, dict, or call
has positions inside brackets that can never be legal boundaries. A deriver that cannot see them will
leave them standing on real code, not just on reconstructed text.

So this is fixed as a general rule rather than dismissed as an artifact — but the artifact is recorded,
because it explains why exactly these three operations surfaced it and no others did.

## Classification

**ARCHITECTURE**, supported. A missing current-program fact, not a broken rule and not semantic intent.
It narrows for a structural reason that can be witnessed by bracket depth and replayed independently.

Fix belongs in its own gate, with witnesses written first and a negative control proving the rule does
not remove positions between balanced brackets.
