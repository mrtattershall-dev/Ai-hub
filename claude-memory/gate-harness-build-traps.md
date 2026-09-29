---
name: gate-harness-build-traps
description: "building the per-gate harness - AGENT_WORKSPACE binds at import time, proofs need a positive control, and heredocs cannot carry JS with backticks"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-13T23:52:36.084Z
---

2026-09-13, building the per-gate edit harness (tatte: "we are completely abandoning the monolithic idea").
Three apparatus bugs each produced a confident wrong number before any model was at fault.

**1. `AGENT_WORKSPACE` is resolved ONCE, at import time.** `agent.js` computes its workspace root when the
module loads, so setting `process.env.AGENT_WORKSPACE` per iteration does nothing. A runner that created a
fresh temp dir per attempt got `ERROR: file not found: expr.js` on every call and scored **0/6** — while the
model's very first reply was a byte-perfect FIND plus a REPLACE containing all three required functions and
the correct `module.exports` line. Use ONE workspace dir, set before the import, and rewrite the start file
each iteration.

**2. A proof needs BOTH controls.** `require(process.argv[1])` loads the proof script itself, not the file
under test (the target is `argv[2]`). Every run failed with `exit 1` and looked like a real 0/12 result — and
the negative control ALSO failed for that same wrong reason, so it read as confirmation. Validate every proof
two ways: it must FAIL on the unedited file (with the EXPECTED exit code, not just any failure) and PASS on a
hand-written correct file. See [[lenient-proof-easy-input]].

**3. Shell heredocs cannot carry JS containing backticks or `\s`.** Three attempts failed: quoted heredocs
collapse `\\s` to `\s`, then JS parses `'\s'` to `s`, silently producing `split(/s+/)` instead of a whitespace
regex. Escaped backticks for template literals broke the heredoc outright. **Use the Write tool for any
script over a few lines**, and build literal backslashes with `String.fromCharCode(92)` when a search string
needs one. See [[windows-bash-edit-gotchas]].

**Measured once the apparatus was right** (qwen2.5:1.5b, temp 0.2, local Ollama, real `parseAction` and real
`edit_file`): single-contract gate (add one method) **12/12 on an executed proof**; three-contract gate (add
two functions AND update the export line) **3/6**, with the edit LANDING 6/6 (5 exact, 1 whitespace-tolerant,
zero refusals). `toRPN` and `compile` were present or absent TOGETHER, never one of two — so the failure is
holding a whole multi-part contract, not partial coding ability.

**Why:** the model was competent in every one of these cases; the harness was not. An apparatus fault reads
exactly like a capability ceiling, and both of the first two bugs produced a clean-looking 0/N.

**How to apply:** track HOW an edit landed (exact / tolerant / refused / no-change) separately from whether
the proof passed — that gap measures what the harness supplies rather than the model. And before believing any
gate score, confirm the tool actually saw the file.
