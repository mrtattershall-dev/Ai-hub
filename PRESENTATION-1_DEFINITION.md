# PRESENTATION-1 — does instruction representation change what this packaged 1.5B can build?

**Status: FROZEN, AMENDED once before any run. Nothing run.**

> **Amendment 1.** Two interpretations in the first draft were too strong and are corrected below:
> `H ≈ N` was written as "the wrapper alone does nothing", which the design cannot support; and
> `H vs S` was named as isolating relocation, which it does not. Nothing was run between the freeze
> and this amendment. $0, local `qwen2.5-coder:1.5b`, digest `d7372fd828518a4d`, Q4_K_M.

## The question

This is **presentation research**. It does not ask whether this 1.5B "can code".

> Given the same feature-construction task, how does this deployed package **distribute its
> failures** when intent is represented in three different ways?

That is answerable whichever condition wins, and it is why the three outcome categories below
matter more than the acceptance count.

## What this is, named precisely

Not a test of a "separate instruction channel". Three representations:

| | condition |
|---|---|
| **N** | native-FIM / **inline-comment** intent |
| **H** | **front-loaded** hybrid system-wrapper / **inline-comment** intent |
| **S** | **front-loaded** hybrid system-wrapper / **separated** intent |

**"Front-loaded" is load-bearing.** The strongest published instruction-aware FIM format places the
instruction *immediately before the middle*, and reports that position matters. A system wrapper sits at
the front. Measured on this task:

| condition | instruction → middle |
|---|---|
| N | **18 tokens** |
| H | **18 tokens** |
| S | **202 tokens** |

So S separates the instruction **and moves it 11x further away**. In proximity terms it is nearer to the
opposite of the best published arrangement than to it. Any S result is about *this* layout.

## What each contrast can establish

| contrast | establishes |
|---|---|
| N vs H | the effect of adding this hybrid wrapper, inline comment held |
| **H vs S** | the effect of moving intent **from an inline comment near the hole to a front-loaded hybrid system section 202 tokens away** — the diagnostic contrast, and it does **not** isolate *separation* from *distance*: those move together by design |
| N vs S | the effect of the full prompt package, not one cause |
| **any result** | the behaviour of **this Q4 local package under these representations** — **never** IFIM training efficacy |

Neither H nor S gets a free prediction from published results: the same work that reports separated
intent winning *after training* also reports an instruction-aware layout **collapsing** without it.

## Three outcomes, scored separately

Reducing this to accepted/failed would discard the finding. Every attempt is scored on all three:

1. **Local-logic recovery** — did it reference the page's real variables and functions correctly
   (`field`, `rows`, the page's own render function)?
2. **Feature construction** — did it **create** `#clear-filter` *and* wire it?
3. **Verified acceptance** — did the final page pass the full gate, no regressions, no errors?

The feasibility probe already produced (1) without (2): it bound a handler to `#clear-filter` and never
created the element. **A model that repeatedly reaches 1 and misses 2 is telling us it can interpret
local code but cannot yet coordinate the parts of a new feature through that representation.** That is
a concrete, reportable finding and it is invisible to a pass/fail count.

## Held identical, asserted byte for byte before the run

Code prefix (651 bytes), suffix, hole location, decoding (`temperature 0.2, num_predict 400`), token
cap, task, model, evaluator, acceptance path. Verified by `server/presentationAudit.mjs`, which also
asserts the intent text is present in **all three** — *"no comment" never means "no instruction"*.

## Pre-registered

| observed | what it supports |
|---|---|
| **H ≈ N, S > H** | this distant separated hybrid representation helped on these tasks |
| **H > N, S ≈ H** | the wrapper/prompt regime helped; relocation added no detected benefit |
| **H > N and S > H** | both changes matter, possibly interacting |
| **S < H** | moving intent far away hurt, **or** this hybrid representation is simply poor |
| **all similar** | no difference detected under this model, task and budget — **not** proof the representations are equivalent |

**`H ≈ N` does not prove the wrapper does nothing.** It means no wrapper effect was detected *while
intent remained an inline comment*. The wrapper may still interact with instruction location — the
system section could help only when the instruction is in it. A flat N-vs-H result cannot rule that
out, and the first draft of this file wrongly said it could.

## Scope

Feature **construction**, not feature completion. No AST/function-body condition appears here: turning
`#clear-filter` into an empty-body task would reduce the work and measure something else. Structural
alignment belongs to a separate study on task families where a real missing unit exists independently
of the experiment.
