# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-12 11:24:56 — budget
- run: `4adb170b-350b-4855-883b-ef63ca1be413`  (status: stopped)
- goal: Create s5_expr.js exporting evaluate(expr) that computes + - * / on numbers (integers and decimals) with the usual precedence and left-to-right order, allowing spaces; it throws an Error for division by zero and for anything it cannot parse. Include asserts that all pass, then run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-12 11:29:59 — budget
- run: `ee180f39-c328-48ed-814d-58424f2aff75`  (status: stopped)
- goal: Create s8_grades.py with a Gradebook class: add_student(name) (ValueError if it exists), add_assignment(name, max_points) (ValueError for a duplicate name or a max_points that is not a positive number), record(student, assignment, points) (KeyError for an unknown student or assignment, ValueError un
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-12 11:57:44 — budget
- run: `153f5c99-066d-46b9-baaf-c3e8d0a1ba6f`  (status: stopped)
- goal: Make evaluate() in the EXISTING s5_expr.js handle parentheses and unary minus: '-(2+3)*2' is -10 and '2*-3' is -6. Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-12 12:01:48 — error
- run: `77d6dd56-0a57-4db5-9307-48379da24c98`  (status: stopped)
- goal: Add delete(key) and clear() to the EXISTING Cache in s7_cache.js: delete returns true when it removed an entry and false otherwise. Run it with node.
- what happened: test_s7_cache.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.

## 2026-09-12 12:08:12 — error
- run: `ba1cc927-d661-4393-b954-e1712dff92da`  (status: stopped)
- goal: Add percent(student) to the EXISTING Gradebook in s8_grades.py returning the student's total points divided by the total max_points of the assignments they have a score for, as a percentage rounded to 2 decimals, or None when they have no scores; an unknown student raises KeyError. Run it with pytho
- what happened: test_s7_cache.js does not parse and no version this run produced parses either, so it was left as the run left it rather than reaching back past this goal. This run did not finish cleanly.
- what to do: The run failed with an error. Check the last step for the message.
