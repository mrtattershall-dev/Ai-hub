# RD-030/031 — The gate should TEACH: strict keys + degenerate intervals

**Status:** ✅ DECIDED (2026-07-16) — both checks land; measured on a live model
before and after, same A/B, same everything else.

## Origin (evidence, not intuition)

RD-029 put a live Qwen2.5-Coder-32B in front of a runtime-authored Pong vocabulary.
It produced two SAFE-but-WRONG failure classes the gate happily accepted:

1. **Inverted clamp** — `{"min":[{"max":[e,255]},0]}` is identically **0**. Written in
   BOTH arms, on multiple goals. The gate accepted it *honestly*: the provable
   interval `[0,0]` really is inside the field's range. The rule was perfectly safe
   and did nothing. `ball_move` "moved" the ball to x=0.
2. **Hallucinated structure, silently ignored** — the model knew it needed proximity
   and wrote `"of":{"near":14}` at the RULE level, where unknown keys were dropped.
   The installed rule reversed vx every tick regardless of paddles, and *looked*
   right.

Both are failures of the gate's *pedagogy*, not its safety. Nothing corrupted; the
model was simply never told.

## The changes (core/behavior.js)

- **RD-030 strict keys:** unknown keys on a rule object or on `match` are now
  localized errors with a HINT naming where the key belongs
  (`"of" is not a rule key — it belongs INSIDE a count/sum/min/max aggregation`).
  Silently ignoring an unknown key converts a fixable mistake into a plausible lie,
  and it wastes the repair loop's remaining attempts.
- **RD-031 degenerate interval:** if an effect's provable interval collapses to a
  single constant `[c,c]` while its expression READS FIELDS, that is almost always an
  inverted clamp. The gate already computed the interval — it just never said so.
  The error states the collapse and shows the correct clamp shape. A literal
  `set x to 128` is untouched (it reads nothing).

## Measured result (the bar this card is decided on)

Identical A/B rerun — same model, temperature, goals, loop, 4-attempt cap:

| run | arm B (signed+`mul`) gated | arm B **correct** | precision |
|---|---|---|---|
| before | 4/5 | 1/5 | 25% |
| after | 3/5 | **3/5** | **100%** |

**Correctness tripled while gate-passes fell.** The gate stopped emitting plausible
lies: what installs now plays. The inverted clamp is absent from the second run —
the model reads `degenerate_expr` and writes `min:[max:[e,0],255]` instead. Arm A
(unsigned) stayed 0/5, which is its own finding: no error message rescues an author
from an encoding that hides the meaning (RD-028's justification, now decisive at
3/5 vs 0/5).

Regression: all 17 suites green UNMODIFIED; controls confirm `set x to 128` and a
correct clamp still install.

## The generalizable lesson (worth more than the two checks)

**The gate's error messages are a product surface, not diagnostics.** RD-018.1
established that localized errors repair weak models; this card shows the corollary:
*every silently-tolerated mistake is a missed teaching opportunity, and the gate
usually already knows*. It computed the `[0,0]` interval. It parsed the unknown key.
Both were thrown away. Whenever the validator knows more than it says, a model (and
a human) pays for the silence.

Next candidates by the same logic, if evidence appears: an effect whose `where` can
never match; an aggregation whose pool is provably always empty; a `spawn` cap that
can never be reached.

## Honest frontier (unchanged by this card)

`paddle_bounce` and `scoring` — the two AGGREGATION goals — still fail in both arms
after 4 attempts. Arithmetic on fields is authorable by this model; assembling
`count ... of:{near}` and aggregation-inversion is not. That is the next authorability
card, and it is NOT a gate-message problem.
