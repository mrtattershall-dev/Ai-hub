# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-12 11:16:35 — budget
- run: `c75eab5e-76c5-41f7-ae7c-0d621a11c76f`  (status: stopped)
- goal: Create s5_expr.js exporting evaluate(expr) that computes + - * / on numbers (integers and decimals) with the usual precedence and left-to-right order, allowing spaces; it throws an Error for division by zero and for anything it cannot parse. Include asserts that all pass, then run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-12 11:48:08 — error
- run: `66fb8638-d9c3-4ee6-ad9e-7dd057eba7af`  (status: stopped)
- goal: Make evaluate() in the EXISTING s5_expr.js handle parentheses and unary minus: '-(2+3)*2' is -10 and '2*-3' is -6. Run it with node.
- what happened: _snippet.py does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 11:53:14 — approval
- run: `4ae15551-de13-4b5e-97f1-7bb1f706e7f6`  (status: awaiting_approval)
- goal: Add bfs(start) to the EXISTING Graph in s6_graph.py returning the nodes reachable from start in breadth-first order, visiting neighbors in sorted order; an unknown start raises KeyError. Run it with python.
- what happened: run_command: rm _snippet.py — "rm" is not on any allowlist
- what to do: A command needs your decision. Open the run and approve or deny it.
