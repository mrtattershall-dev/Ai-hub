---
name: unstated-env-fact-looks-like-model-quality
description: "A single unstated environment fact can masquerade as a large model-quality gap; measure what lands on disk, not run status"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-10T17:28:36.098Z
---

2026-09-10, ai-coding-hub. The int4 7B scored 1/6 goals and the bf16 7B scored 5/6 on
identical goals — a clean-looking "quantization costs you 5x quality" result. It was wrong.

The hub's workspace `package.json` says `"type": "commonjs"` and the system prompt never
said so, so which module system the model wrote was a coin flip. bf16 guessed
`function add(...)` (runs); int4 guessed `export function add(...)` (cannot run there).
One paragraph added to `agentPrompt.js` took int4 from 1/6 to 5/6, matching bf16 exactly.

**Why:** the failure cascaded in a way that looked like incompetence — model writes valid
ESM, `node --check` answers "set type: module", model correctly tries to edit package.json,
`edit_file` refuses on a FIND mismatch, model then edits the JS blind 5x, corrupts the file,
trips the repetition guard. Every step is reasonable given bad information.

**How to apply:** when an eval shows a big quality gap between two models/configs, check
what is DIFFERENT about the environment each one happened to land in before believing it.
Score "did the work land on disk and run" separately from run status — completion rate alone
would have hidden this, and would also have understated the 7B badly elsewhere (`stopped`
routinely means "work done, never called finish"). See [[gpu-cost-per-token]].
