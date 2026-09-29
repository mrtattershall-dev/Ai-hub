---
name: tool-bugs-not-nudges-2026-09-11
description: "tatte was right - the long-run blocker is the TOOLS, not the advice: 65 of 278 edit_file calls failed in set E, search_file returned \"(no matches)\" for a directory path, and 155/221 identical calls repeated silently; all fixed mechanically on branch g-fixes"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-11T22:29:26.841Z
---

tatte, 2026-09-11, on the set-E fixes: "Remember last time the nudges didn't work because the hard code was edit file
nor read file, what if it's the same issue" and "Make sure you check all spots. It may be secret" and "Also look at
the tools files. Make sure it's not a bad code in the tools." Measured from set E's recordings, he was right.

- **edit_file is where long runs lose their calls.** 65 of 278 edit_file calls FAILED across 32 goal-runs: 27
  "matches N places", 32 "was not found", 6 malformed. That is 89% of the 14B's and 90% of Qwen3-Coder's tool errors.
  Both models cannot reproduce file text verbatim; the workaround (rewrite the whole file) is what dropped
  q4_template.js's export. Set F live: the 14B failed 14 of its first 39 edits (36%).
- **search_file had a real bug**: PATH: . (a directory) became the only target and directories are skipped, so it
  answered "(no matches for template)" in a workspace holding q4_template.js. A confident empty answer.
- **Silent repetition**: the same tool with the same arguments returning the same answer 155 times (14B) and 221
  (Qwen3-Coder). The stuck-loop guard only compares identical REPLIES, so call-level loops were invisible.

Fixed on branch g-fixes (worktree ~/Projects/ai-coding-hub-gfix, commits 1467016 and 4cc60ff; NOT merged while set F
runs on the pre-registered hub): LINES: a-b addresses an edit by the numbers read_file prints (empty REPLACE deletes);
OCCURRENCE: n picks among matches; the parser no longer turns a LINES edit into a whole-file rewrite; a directory is a
search scope; a repeated identical call is named. editAddress.test 9/9 and repeatCall.test 6/6, every part mutation-proven.

**Why:** advisory sentences cannot make an edit land - they explain damage after it happens. These are mechanical.
**How to apply:** when a model "ignores the nudges", measure the TOOL results first: count failures per tool, and
count identical repeated calls. See [[setE-findings-2026-09-11]], [[advisory-vs-mechanical-recovery]],
[[hub-fixes-fired-model-ignored-2026-09-10]].
