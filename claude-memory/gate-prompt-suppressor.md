---
name: gate-prompt-suppressor
description: "one well-meant sentence took a JS gate from 4/4 to 0/4 output on qwen2.5:1.5b - gates must SHOW the goal and the shape, and every extra sentence is a suspect until a control clears it"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-14T05:20:36.707Z
---

2026-09-13, building the per-gate harness. I added this line to a write gate to prevent truncation:

    "Keep it short and complete - a long answer risks being cut off before the end."

**Measured A/B, 4 samples per cell, same goal, same file, same fence tag, temp 0.2:**

    goal 5  s5_expr.js  (js)   without the line   content 4/4   [7138, 1058, 1084, 1572] chars
    goal 5  s5_expr.js  (js)   WITH  the line     content 0/4   [35, 35, 35, 35] chars
    goal 6  s6_graph.py (py)   without the line   content 4/4
    goal 6  s6_graph.py (py)   WITH  the line     content 4/4

The 35-character replies are `ACTION: write_file` + `PATH: s5_expr.js` and nothing else - the model
emits the header and STOPS.

**WITHDRAWN THE SAME NIGHT - the attribution to that sentence does NOT hold.** A later run with the
sentence REMOVED produced the identical failure on 5 of 5 JavaScript goals (37-38 char
header-and-stop). So the A/B above was N=4 per cell on a BIMODAL phenomenon, and 4/4-vs-0/4 was
sampling, not a treatment effect - the exact small-N trap measured elsewhere that night, where a
manipulation-invariant metric swung 0/8 to 3/8. Re-testing at N=8 per cell.

**What the failure ACTUALLY is, from the raw reply:** on goal 5 the model emitted 7,900 characters
of `ACTION: write_file\nPATH: s5_expr.js\n\nACTION: write_file\nPATH: s5_expr_test.js\n\n` repeating
- **repetition collapse in the PROTOCOL layer**, the same mode as the 71k-char `assert(...)`
collapse but applied to the action header instead of to code. The short 37-char replies are likely
the same collapse terminating early. That is a model failure mode, not a prompt-wording effect.

**Why:** this is the same shape as the recorded prohibition that scored 0/5 while a shown closing
line worked, and the 32-of-254 prompt lines that exist only to talk the model out of what other
text provoked ([[protocol-not-capability-ceiling]]). Prose that competes with the shape can lose to
NOTHING AT ALL on a 1.5B, not merely to a worse answer.

**How to apply:** a gate shows the GOAL and the SHAPE. Every additional sentence is a suspect until
an A/B clears it - including sentences that look purely helpful, and including ones I add to fix a
different bug. Move facts out of the prompt and into deterministic feedback where possible: the
CommonJS rule is better taught by a load check answering "Cannot use import statement outside a
module" than by a line of prose the model may or may not weight.

**Other instrument defects traced the same night, all of which produced believable numbers:**

  * `write_file` answered `OK: wrote 0 bytes` for an empty write. The destructive guard only runs
    when the file already EXISTS and needs `before.length > 400`, so creating an empty file or
    emptying a small one both sailed through. Three files in one run landed at 0 bytes with the tool
    reporting success. Fixed + pinned by `emptyWrite.test.mjs` (8/8 incl. 3 controls) with an
    `EMPTY: yes` escape hatch.
  * `num_predict` too small truncates a whole-file write, leaving an ODD fence count, so
    `parseAction` returns `tool: null` - which my gate mislabelled "you used a forbidden tool".
    The hub already exports `replyWasTruncated()` from `agentParse.js`; CALL IT.
  * The local Ollama 1.5B runs on **CPU at ~3-4 tok/s** (`vram=0MB`), so `num_predict 4096` can
    exceed a 900s request timeout and a repetition collapse surfaces as a fetch error. Size the
    budget to observed need (working files were 850-2900 bytes) rather than to a GPU's speed.

**Two gate scores were published and withdrawn before this was understood: 6/10 then 4/10, moving in
OPPOSITE directions from the same underlying reality.** No gate number is trustworthy without a
byte-level dump of the resulting file and the raw reply. Preserve raw replies from the first run,
not the third.
