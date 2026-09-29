---
name: game-creation-mandate
description: "User reminder 2026-07-17 — this is a general-purpose game CREATION engine; the product surface must never speak farm in non-farm worlds; \"building games WITH ai, not using ai to make little games\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
---

2026-07-17, user, while playing the live Pong world in the browser: "this is a
general purpose game creation engine. its still acting like a farming simulation
engine. not a game engine. its for building games with ai, not just using ai to
make little games."

**What they were looking at (the evidence):** in a PONG world the command bar
rejected "move left paddle down" with farm verbs (water/plant/harvest...), the feed
said "you joined the farm", the header labeled entities "crops", and the AI pane's
placeholder suggested "dry crops slowly wilt". The ENGINE was general (RD-024/025/
028/032/033); the SURFACE was still the farm.

**Why:** every generalization card so far targeted engine layers; the product
strings and the NL command vocabulary were farm-specialized and nobody re-audited
them per-world. The user experiences the surface, not the engine.

**How to apply:**
1. NO farm language in a non-farm world, ever — strings, placeholders, examples and
   NL verbs must derive from the world's schema, with farm vocabulary as a
   specialization loaded only when the schema has farm types.
2. The product's job is CREATING games (define types + author rules from an empty
   world through the gates), not only viewing prebuilt ones. defineType (RD-024) had
   no UI/wire surface until this reminder — the editor must expose world-building,
   not just world-watching.
3. When shipping a milestone, re-read the surface in a NON-farm world before calling
   it done. Related: [[human-language-gap-finding]], [[user-visual-expectations]],
   [[capability-vs-proof-artifact]].
