# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-11 02:38:28 — loop
- run: `0f087de3-12cc-4a66-9e19-64ce7d2d5116`  (status: stopped)
- goal: Write T_NOTES.md listing every method that really exists on the Inventory class in t3_inventory.js, with its arguments and what it throws. Read the file first; do not invent anything.
- what happened: Stopped: the model produced the same response 3 times in the last 7 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 02:41:49 — loop
- run: `a957c1de-20a1-4ede-a3fd-15af2348c3fd`  (status: stopped)
- goal: In the EXISTING t8_game.js, add a paddle at the bottom, moved with the left and right arrow keys, that the ball bounces off.
- what happened: Stopped: the model produced the same response 3 times in the last 8 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 02:42:22 — loop
- run: `d043ce6f-34cd-49b5-9cc7-8187fc121104`  (status: stopped)
- goal: Create t9_csvsum.py with sum_column(text, name) that returns the sum of a named numeric column from CSV text and raises KeyError for an unknown column, plus asserts at the bottom. Run it with python.
- what happened: Stopped: the model produced the same response 3 times in the last 8 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 02:42:49 — loop
- run: `06197050-5849-4b14-b82e-2fe0ac02dad6`  (status: stopped)
- goal: Create t11_check.js with asserts that test t1_temp.js and t4_intervals.js, requiring them from the workspace. Read them first so you use their real exports. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 6 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 02:44:01 — budget
- run: `c45d35e6-47cc-4227-8c5e-448015a9a382`  (status: stopped)
- goal: Write T_INDEX.md listing every t-file that really exists in the workspace, with one line on what each does. Read them first.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.
