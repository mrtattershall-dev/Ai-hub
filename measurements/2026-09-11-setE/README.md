# Set E - 100 new interleaved goals (DRAFT - checker validated, NOT yet pre-registered)

tatte: "After d has results, analyze the deep seated bugs and fix them so run E can have another 100 prompts."
Same format as set D, so the two compare: 10 new projects x 10 steps, interleaved by round
(goal = (step - 1) * 10 + project), all in one workspace. The q prefix makes trial35 see every file (checked: 100/100).

Projects: q1 warehouse with reservations (JS; step 10 = Q1_NOTES.md), q2 CSV table toolkit (Python; CLI),
q3 calendar with conflicts and free slots (JS), q4 template engine (JS; escaping, filters, sections, partials,
compile), q5 rate limiters with an injected clock (Python), q6 JSON paths (Python; wildcards, diff, merge),
q7 text buffer with undo/redo and edit groups (JS), q8 units and recipes (Python; CLI), q9 browser shopping cart
(HTML+JS), q10 integration report rendering q1 data through q4 (JS; step 10 = Q_INDEX.md).

Checker (tools/checks-E.mjs), validated before any model saw the goals:
- refs/ 100/100 both ways; empty workspace 0/100;
- tools/mutate-E.mjs: 41 planted bugs, 41 caught exactly. That includes cross-project bugs (a template bug that also
  breaks q10's report; a discount bug seen from four steps), invented names in the notes and the index, a missing
  index file, and wrong own asserts in JS and Python (CT on all 10 steps).

Still to decide before pre-registering, so it is left open here: the hub version (after the set-D fixes merge),
AGENT_BATCH_ACTIONS (tatte's call), the unattended approval policy, the models, and caps.
