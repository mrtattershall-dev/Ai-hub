---
name: user-visual-expectations
description: "User's mental model of 'editor' is VISUAL (panels, inspector, clickable world) — terminal REPLs and test output read as infrastructure, not the product"
metadata: 
  node_type: memory
  type: user
  originSessionId: 02b7215d-a995-4680-9c34-34b9f15cabd6
---

2026-07-16, during the multiplayer spine: after a week of terminal REPLs and
test harnesses the user said "i was expecting more of a visual editor." Their
stated project goal was always an AI-native engine *editor*; to them that word
means a visual authoring surface — panels, entity inspector, a world you can
see and click — not `core/editor.js`'s command-line REPL, however well-gated.
They also confirmed the long-term vision is a GENERAL-PURPOSE 2D game engine
(farming/RPG/sim first, then expand) — not a one-genre research vehicle.

**Why:** twice the renderer/UI was deprioritized by spine logic (correctly, on
risk grounds), but the deferral was never reconciled with the user's picture of
the deliverable. Terminal evidence lands as "great and everything, but…".

**How to apply:** when a milestone ships, prefer a visible artifact (browser
UI, published Artifact, screenshot) alongside the test numbers. The visual
editor v2 shipped 2026-07-16: `experiments/037_ai_native_editor/editor.html`
(NL command bar, explain-before-install, petnames, sentence feed), launched by
`START_EDITOR.cmd` at project root → http://127.0.0.1:4243/. v1's delivery
faceplant (stale old-code process holding the port, pathless run instructions,
localhost→IPv6) is why the launcher + EADDRINUSE plain-language error +
/version banner exist — never hand the user bare `node <file>` instructions
again. Weight future spine choices with "does the user get to SEE it" as a
real cost/benefit line, and flag explicitly when a plan defers everything
visible. See [[multiplayer-spine-m0-m6]], [[human-language-gap-finding]].
