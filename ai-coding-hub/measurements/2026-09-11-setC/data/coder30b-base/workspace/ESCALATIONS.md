# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-11 11:54:21 — budget
- run: `2b777a4e-5fd6-4164-a38e-eae66124bf3f`  (status: stopped)
- goal: Add unary minus to the EXISTING evaluate in s6_parser.js: -3, -(2+1), 4*-2 and 2--1 must all work. Keep everything else working. Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 11:59:23 — budget
- run: `645c752b-964d-4e0f-9472-262257d49dee`  (status: stopped)
- goal: Add priorities to the EXISTING TodoList in s7_todo.py: add(title, priority=0); pending() lists higher priority first, and items of equal priority in the order they were added. Existing add(title) calls must keep working, and save/load must keep priorities. Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.
