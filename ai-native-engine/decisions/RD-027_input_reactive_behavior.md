# RD-027 — Input-reactive behavior: is `on:` needed, or is input just state?

**Status:** ✅ DECIDED (2026-07-16, same day) — **H1 CONFIRMED with H2 caveats: `on:`
triggers are NOT needed.** Pong's complete behavior — input-driven paddles, ball
motion, wall bounce, paddle bounce, scoring, reset — is expressible in today's
grammar. `experiments/042_pong/` 13/13: 16 rules ALL through the RD-B6 gate, zero
core edits, bounce lands at x=14 (proximity, not luck), speed preserved, no
double-reversal, the left player scores by aggregation inversion (the ball never
writes the paddle), ball resets, unsafe=0, deterministic across replays.

**The finding that made it work — aggregation-as-conditional.** The grammar has no
conditional expression, and `where` cannot reference an aggregation, so "reverse only
if a paddle is near" looked unwritable. But **an aggregation over an EMPTY pool
returns 0, and 0 is the identity for `+`/`-`**. So `vx + (delta harvested from nearby
paddles)` is a no-op when nothing is near and a reversal when something is. The
conditional was already in the language, hiding in the empty-pool convention.

**H2 evidence (real, and now the next card's spec):** four unnatural encodings were
forced on the author — (1) **unsigned ranges** ⇒ offset-encoded velocity (vx=128 is
zero; negation is `sub:[256,vx]`); (2) aggregations take a FIELD not an expression ⇒
the reversal delta must be **materialized** into ball fields first; (3) that
materialization costs a **2-tick lag** (contact→reversal); (4) a **direction gate**
(`where vx<128`) is load-bearing to stop the stale delta double-firing. A human found
these; an AI author plausibly would not. **The fix is signed fields + authoring sugar,
NOT `on:`** — exactly as the card's H2 branch pre-registered.

A bonus real-conflict finding: `ball_move_x` and the reset rules both write `x`, so
RD-005 DEFERS both and freezes the ball — the grammar forces the author to resolve
ownership by construction (`where` gates motion away from the goal mouths).
**Origin:** the review's revised ladder rung 1 ("input-reactive rules — `on:` triggers")
— reframed as a falsification before it is built.

## Why this is a question and not a task

The reflex is to add `on:` (fire a rule when an event occurs). But RD-B1's safety
proof rests on rules being **pure functions of a frozen pre-tick view**: no hidden
state, no memory. That is *why* loops/RNG are unrepresentable and why the gate proves
ranges statically. An EDGE trigger ("when water FIRST hits 0") requires remembering
the previous tick — i.e. it smuggles state-over-time back into the one layer whose
statelessness is load-bearing. Adding `on:` could cost the property the whole project
is built on.

Meanwhile three existing mechanisms may already cover input-reactivity:
- **input-as-state** — RD-M0 already decided player input enters through the full
  gated pipeline as a tx; a client can `setfield(paddle.input_dir, 1)` and a rule
  reads it with `where`. No new grammar.
- **`near`** (RD-025) — collision-as-proximity, already gated and accelerated.
- **aggregation inversion** — effects only write the MATCHED entity, but "when X
  happens, update Y" inverts to *match Y, aggregate over X* (the HOMESTEAD `score`
  rule is exactly this shape).

## Hypotheses

- **H1 (no new grammar):** Pong's complete behavior — paddle responds to held input,
  ball moves, bounces off walls and paddles, scores, resets — is expressible TODAY
  with schema + `where` + `near` + aggregation inversion + input-as-state. `on:` is
  unnecessary; the ladder rung is already climbed.
- **H2 (expressible but unauthorable):** it works only via encodings so unnatural
  that a human or AI author cannot reasonably produce them (prime suspect: **signed
  values**. `defineType` ranges are unsigned by construction, so a leftward velocity
  needs offset encoding — `vx=128` meaning zero — and every read becomes
  `sub:[vx,128]`). That is a USABILITY failure at the authoring layer, and the fix is
  signed fields or sugar, NOT `on:`.
- **H3 (genuinely unexpressible):** some construct cannot be written at all. The
  deliverable is then a PRECISE list (with the Pong rule that fails), which becomes
  the spec for the next grammar card — an evidence-backed spec instead of a guess.

## Bars (pre-registered)

1. **Zero core edits.** Any engine change fails H1 by definition and is reported.
2. **Every rule through the real RD-B6 gate** (`installRule`), range proofs intact.
3. **It actually plays.** A headless deterministic rally: ball launches, crosses the
   field, bounces off a wall, bounces off a paddle that MOVED because input state
   said so, and a score increments when it passes a paddle — each asserted against a
   hand-computed oracle, not against the implementation's own output.
4. **The artifact is honest.** Report every unnatural encoding required (H2 evidence)
   and every construct that could not be written (H3 evidence), whether or not the
   game runs.

## Decision rule

- Bars 1-3 pass with no unnatural encodings → **H1: `on:` is not needed.** Rung 1 of
  the ladder is already built; the roadmap skips to transforms.
- Bars 1-3 pass but authoring required encodings a reasonable author would not find
  → **H2:** open a card for **signed fields / authoring sugar**, NOT for `on:`.
- Some behavior cannot be expressed → **H3:** the failing rule IS the spec for the
  next grammar card.

## Note on status (capability vs artifact — the house rule)

Pong here is a **probe**, not a shipped artifact: headless rules only. It becomes the
integration artifact when a renderer exists. Its passing does not mean "the engine is
general-purpose"; it means "this specific behavior class is expressible today."

## Out of scope

Rendering; multiplayer Pong (RD-M2 already carries dynamic types over the wire);
AI-authored Pong rules (that is the NL layer's card, and a natural follow-up once the
rule set is known-good).
