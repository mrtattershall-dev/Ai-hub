# PRESENTATION-1 — does instruction representation change what this packaged 1.5B can build?

**Status: FROZEN. Nothing run.** $0, local `qwen2.5-coder:1.5b`, digest `d7372fd828518a4d`, Q4_K_M.

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
| **H vs S** | the effect of relocating intent from inline comment to this front-loaded section — **the diagnostic one** |
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

- **S < N** — consistent with the published warning; an untrained arrangement is out of distribution,
  and/or 202 tokens of distance hurts
- **S > N** — composing two *native* formats survives where a novel delimiter did not
- **S = N** — instruction location is not the binding variable for this package on this task
- **H ≈ N** — the wrapper alone does nothing, and any N-vs-S difference belongs to relocation
- **H ≠ N** — the wrapper itself matters, and N vs S was never attributable

## Scope

Feature **construction**, not feature completion. No AST/function-body condition appears here: turning
`#clear-filter` into an empty-body task would reduce the work and measure something else. Structural
alignment belongs to a separate study on task families where a real missing unit exists independently
of the experiment.
