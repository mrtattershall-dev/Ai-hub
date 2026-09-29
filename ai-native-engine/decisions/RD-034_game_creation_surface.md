# RD-034 — The game-CREATION surface (de-farming the product)

**Status:** ✅ DECIDED (2026-07-17) except one in-flight piece (generic NL, below).
**Origin:** the user, playing the live Pong world: *"this is a general purpose game
creation engine. its still acting like a farming simulation engine. not a game
engine. its for building games with ai, not just using ai to make little games."*
Their screenshots were the spec: the command bar rejected "move left paddle down"
with farm verbs; the feed said "you joined the farm"; the header labeled entities
"crops"; the AI pane suggested "dry crops slowly wilt"; and the feed was spammed by
a real rule bug. The ENGINE was general (RD-024→033); the SURFACE was the farm.

## Shipped and measured

1. **The `empty` world + `deftype` over the wire** — schema authoring is the THIRD
   sanctioned gate (submit / installRule / defineType), routed exactly like 'rule'.
   `m4_creation_test.js` 9/9: an empty world (no types/entities/rules/farm keys) →
   `tower` defined through the gate → duplicate REFUSED world-untouched → the new
   vocabulary reaches every client in the next tick broadcast → a root entity
   created by gated tx → a behavior rule over the runtime-born type installs and
   RUNS → unsafe=0. `START_EDITOR.cmd [farm|pong|shooter|empty]`.
2. **Farm assumption #5: the transport required a PARENT on every createChild** —
   because farm crops always grew under a zone. The engine always allowed roots;
   only `sanitizeOps` forbade them. An empty world's first entity has no parent to
   have. Fixed; m1 15/15 unmodified.
3. **The user's Pong bug (feed spam, score 44)** — a BRANCHLESS conditional write is
   still an UNCONDITIONAL write: at the goal mouth `bounce_paddle_left` wrote
   vx=-3 (a no-op value) against `reset_from_left_goal`'s vx=+3, RD-005 correctly
   deferred BOTH, and the ball never turned around while the right player farmed a
   point per round-trip. Fix: scope contested-field writers apart (x-gates on the
   bounce rules, symmetric with ball_move_x). Regression: ball turns, ZERO deferrals
   across a full rally. Standing lesson for rule authors AND the future NL/propose
   layer: `v + cond*delta` writes every tick; scope it.
4. **De-farmed surface, schema-derived everywhere**: join line ("you joined a world
   of paddle, ball"), header ("entities"), card header, command-bar and AI-pane
   placeholders localized from the schema (farm examples ONLY when the world has
   crops), "real farm" → "real world", deferral lines name the actual writers (sys
   rules are not "players"), and the feed DEDUPES repeating lines into one ×N
   counter (the user's session had hundreds of identical lines).
5. **Create-a-type UI** — name + fields JSON + spatial checkbox → `{t:'deftype'}` →
   gate verdict inline; a defined type immediately appears in the world line,
   placeholders, and (when spatial) the canvas.

## In flight

**Generic NL (intent2.js)** — a schema-driven command parser ("move left paddle
down", "create a tower at 40,60", "who has the most hp") with the farm parser
demoted to a specialization consulted only in crop worlds. Being built by a
workflow agent against a pinned contract; the editor routing (`parseNL`: generic
first, farm fallback) is already wired and degrades gracefully until it lands.

## The standing rule this card leaves behind

The engine being general is invisible; the SURFACE is the product. Before calling
any milestone done, re-read every user-facing string in a NON-farm world.
