# THE SUPPORTED UNIVERSE

**This is a contract, not a roadmap.** It states what Legasus claims to reason about correctly, and —
equally load-bearing — what it declares itself unable to resolve.

The finish line is deliberately not *"handles every Python program"*, which is not a sensible target.
It is:

> **Within the semantic classes declared supported here, every authority decision is justified, every
> missing fact is declared, every constraint is replayable, and no known unsupported condition
> silently masquerades as success.**

The last clause is why an unsupported form is safe to leave unsupported. Before requirement resolution
became explicit, an unresolvable provider produced the same output as no requirement at all, so
breadth had to be chased to avoid being quietly wrong. It no longer does:

    requires_immediate:    ["math"]
    resolved:              []
    unresolved:            [{ symbol: "math", reason: "no supported provider representation" }]
    requirement_complete:  false

*I know I need something. I cannot resolve where it comes from. Therefore my account is incomplete.*
That sentence is what lets unsupported forms sit at the edge of the world without corrupting the core.

---

## SUPPORTED

### Current program facts — LegaParse
- module-level and class-level definitions (`def`, `class`, assignment bindings)
- class and method structure, and the difference between them
- ownership: which construct's body a position falls inside
- control flow: terminators, reachability within a block
- **immediate vs deferred evaluation** — module body, class body, default arguments and decorators
  execute at definition time; function and method bodies do not

### Transaction facts — LegaCore
- planned providers (a symbol that exists only because another operation creates it)
- bare consumers (an operation that provides nothing and still imposes ordering)
- multiple requirements in one operation
- provider → consumer edges, and legal topological orders over them
- **declaration of incomplete resolution** when a requirement cannot be traced to a provider

### Authority properties — these are invariants, not features
- every narrowing carries a witness
- every witness is independently replayable
- zero manufactured narrowing: a removed boundary must genuinely fail
- style contributes zero semantic authority
- unresolved facts stay visible

---

## DECLARED UNSUPPORTED

Each of these must surface as `requirement_complete: false` when an operation depends on it. Being
listed here is a commitment that the system will *say so*, not that it will cope.

| Form | Why it is out |
|---|---|
| `import` / `from … import` providers | a provider representation LegaCore does not model |
| aliases and re-exports | the provider is one indirection away |
| inheritance-provided names | resolution runs through the MRO |
| dynamic provision (`setattr`, `globals()`, star-import) | no static provider at all |
| comprehension and walrus scoping | binding forms the extractor does not track |
| **guard precedence between overlapping conditions** | not a placement or dependency fact at all — see below |

Guard precedence is a different kind of absence from the rest. The others are provider forms that
could be added. This one is **local semantic intent**: when two valid behaviours overlap, which owns
the ambiguous input. `classify(0)` matching both `n == 0` and `n < 10` is legal, correctly ordered,
legally placed, and wrong. No provider resolver reaches it.

---

## Sequence, and why breadth comes last

    1  leave unsupported forms explicitly UNSUPPORTED        requirement_complete = false
    2  perfect the supported structural/transaction model    no silent loss, no over-constraint,
                                                             full witnessability, prospective
                                                             generalization, honest information
    3  attack semantic intent                                "what should win?"
    4  assemble the pipeline                                 request -> concern -> participants ->
                                                             topology -> intent -> bounded generation
                                                             -> verification
    5  THEN expand provider and language coverage            imports, aliases, decorators, inheritance

Chasing breadth first produces forty syntactic forms at eighty percent reliability. The goal is one
architecture that is fundamentally right, after which an import is simply *"here is another way Python
can provide a symbol"* rather than another chance to redesign.

---

## Ground truth is relative to the observable contract

The executable sweep is not ground truth simpliciter. It is **ground truth relative to the observable
contract**, and when that contract is incomplete, execution gives a false reading of legality.

`j01:op3` proved it: inserting a class-level `def` there ends `resolve` early and re-parents its
remaining statements, and the sealed probes never call the damaged path. Narrowability V1 therefore
recorded the position as passing, and a correct structural rule scored as an over-constraint.

    NARROWABILITY V1    parse/load + executable probes                     historical, frozen
    NARROWABILITY V2    + independent structural-preservation channel      families authored after it

Both channels must agree for a position to be legal. The structural channel is deliberately built from
observed parent chains and reachability, with no arithmetic borrowed from `ownership_boundary` — a rule
that defines its own oracle proves nothing.

This is why LegaVerify eventually needs both kinds of preservation:

    BEHAVIOURAL   what externally happens
    STRUCTURAL    what existing program structure was not authorized to change

Neither substitutes for the other.

## Conformance

`legasus/legalabs/conformance.mjs` checks these properties mechanically across every sealed family. A
standard that is only written down is a reminder; this ledger has four occurrences proving reminders
fail.
