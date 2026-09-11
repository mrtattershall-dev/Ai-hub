# Set G - set F's 100 goals again, on the tool-fixed hub (DRAFT - not pre-registered, not launched)

tatte: "Yeah let's prep a g run".

**The design is an A/B with one variable.** Same 100 goals as set F (goals-G.json is a byte-identical copy of
goals-F.json), same hidden checks (checks-G.mjs is a byte-identical copy of checks-F.mjs - checksums in
prep-checksums.txt), same two models, same GPUs, same caps, same approval policy, same AGENT_BATCH_ACTIONS=0, a fresh
empty workspace. **The only difference is the hub**: set F ran on main with the seven set-E fixes; set G runs on main
with the g-fixes tool changes merged on top.

## What changed in the hub, and why (all measured, not guessed)
Set E's recordings said the models lose their calls in the TOOLS, not in the advice:
- 65 of 278 edit_file calls FAILED across 32 goal-runs (27 "matches N places", 32 "was not found", 6 malformed) -
  89% of the base 14B's tool errors and 90% of Qwen3-Coder's. Set F live: the 14B failed 14 of its first 39 edits.
- search_file answered "(no matches for template)" in a workspace holding q4_template.js, because PATH: . made a
  directory the only target and directories are skipped.
- The same tool called with the same arguments returned the same answer 155 times (14B) and 221 (Qwen3-Coder); the
  stuck-loop guard only compares replies, so a loop made of identical CALLS was invisible.

g-fixes (branch, commits 1467016, 9eb907c/4cc60ff, 727d3bb - full suite and merge pending set F's window closing):
1. `LINES: <a>-<b>` addresses an edit by the numbers read_file and outline_file already print - no FIND at all; an
   empty REPLACE deletes those lines; a range outside the file says how long the file is and changes nothing.
2. `OCCURRENCE: <n>` picks one of several matching places (the ambiguity error already lists them).
3. The parser no longer turns a LINES edit into a whole-file rewrite - the shape that dropped q4_template.js's export.
4. A directory path is a search SCOPE.
5. A repeated identical call is named in the result.
6. A dropped connection is retried after a wait that clears the measured dead window: 3 attempts, 15 s then 30 s.
   (Set F lost four goals to the same shape - a very large reply, then every following connection refused. The
   endpoint answered again after 9.6-12.8 s, while the old retries waited 2 s and 4 s, entirely inside that window.)

## Predictions (to be fixed before launch, with the checker and harness unchanged from set F)
- edit_file failure rate falls from set F's rate (the 14B's was 36% at goal 39) to under 15%, because 42% of set E's
  failures were ambiguity (OCCURRENCE settles those outright) and 49% were not-found (LINES removes the need to match).
- The base 14B's repeat-guard stops fall below set F's.
- Steps that work at the end: the 14B improves by at least 5 over its set F score; Qwen3-Coder by at least 3.
- If the scores do NOT move while the edit failure rate does, that is the answer to the real question: the tools were
  not the ceiling, the model is. Either way the run is decisive.

## Cost, and the decision still open
Same shape as set F: coder30b-setg H100 120/125 min (~$8.2) + coder14b-setg A10G 95/100 min (~$1.8), about $10.
Set F already took the running total to about $33 against the original $30 cap, so set G needs tatte's explicit go on
the spend. The laptop must be on AC with the keep-awake request held, and the offline fuzzer paused for the window.
