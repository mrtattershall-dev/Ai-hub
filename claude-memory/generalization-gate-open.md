---
name: generalization-gate-open
description: "RD-024 DECIDED 2026-07-16 — schema authoring landed; vocabulary is instance data (farm = default schema); Pong types born at runtime, 26/26; RD-023 also decided same day (layering, no rewrite)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
---

2026-07-16, autonomous session: the two moves that convert "farm-shaped research
engine" into "engine" both landed and were measured the same day.

**RD-024 schema authoring (DECIDED, all 3 pre-registered bars):** engine.js's six
hardcoded vocabulary sites → instance schema registry, farm = default schema,
byte-identical compat (12 suites unmodified), per-TYPE field namespace,
`Engine.defineType()` gate with localized errors, schema persists in snapshots.
Generality bar: `experiments/039_schema_authoring/pong_vocab.js` 26/26 — paddle/ball
at runtime through spawn/submit/RD-005/RD-B6-with-range-proof/wire/save-load, unsafe 0.

**RD-023 continuous motion (DECIDED, branch 1 — layering, no rewrite):**
`experiments/038_continuous_motion/` — ungated 60fps motion + gated discrete events
= ~2.5% of frame budget at N=5000; even naive all-gated motion holds 60fps to N≈2000.
Boundary rule: fired-once ⇒ gated; re-derived-every-frame ⇒ may live ungated
(impulse LWW measured as the Crop-#142 class at 60fps).

**How to apply:** the next critical-path moves are SPACE (x/y now = one defineType
call + spatial queries in the rule grammar), input-reactive triggers (`on:` clause —
the grammar only has `every N`), renderer contract, then the second-genre-zero-core-
edits test (Pong is the natural pick — its vocabulary already ships in 039). The
transport gap closed same-day as RD-M2 (DECIDED, user-framed hypothesis/criteria,
m2_schema_transport_test.js 9/9 + m1 15/15 unmodified): sanitizeOps consults the
world's schema, schemaDefs ride in the view. Remaining known gap: the editor UI
renders only crop cards — renderer work, deliberately out of RD-M2's scope.
Also pinned: [[capability-vs-proof-artifact]] — decide RDs on capability bars,
ship demos (Pong) as separate artifacts. Related: [[multiplayer-spine-m0-m6]], [[human-language-gap-finding]],
[[user-visual-expectations]].
