---
name: human-language-gap-finding
description: "User's live-play finding (2026-07-16) — engine speaks only code language; no human verbs/nouns; crops not named for human understanding; NL layer is THE editor gap"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
---

2026-07-16, from the user's own live play session (M1 server, terminal + first visual editor attempt): the system "doesn't understand verbs and descriptive nouns, only code language — doesn't name crops, doesn't properly name things with human understanding."

**What this means concretely:** every authoring surface so far requires the human to speak engine JSON (`setfield`, `crop_growth`, rule grammar). Spawned/reseeded entities get code-y names. There is no layer that maps human language (verbs like "water the corn", nouns like "the dry one in the corner") to transactions/rules, and no layer that makes the world's own output human-readable.

**Why:** the AI-propose loop (editor.js propose→repair, proven in RD-B5/B8) exists but was never wired to any user-facing surface — users only ever touched raw JSON. The thesis proved AI→engine safety; nobody built human→AI→engine.

**How to apply:** the AI-native editor's core feature is the natural-language pane: user types intent in plain English → model proposes rule/tx → gate validates → user sees a human-readable explanation of what will happen before it's live. Also: human-readable naming for spawned entities (reseed should name crops like "corn #4", not uuids), and feed messages in sentences, not symbols. This finding closed the user's live session; it is the mandate for the editor build. Related: [[user-visual-expectations]], [[multiplayer-spine-m0-m6]].

**Round-2 play findings (2026-07-16, after editor v2 shipped):** (1) the intent parser "has a hard time knowing the difference between nouns, verbs, and adjectives" — the farm domain has brutal role collisions (water/plant/harvest are all verb AND noun; dry/ripe are selecting adjectives); regex-first parsing isn't enough, needs lexicon + grammar-position disambiguation. (2) "when I run a prompt through propose there's no accept/reject functions" — every AI output needs explicit ✓ accept / ✗ reject, INCLUDING refusals (show the AI's last draft + why the gate refused + retry), and NL commands need confirm-before-execute (this is RD-UI1 intent confirmation from the user's own roadmap). (3) UX complaints were unrecoverable because nothing captured what the user typed — uxlog + decision capture added; keep artifact capture ahead of user sessions, always.
