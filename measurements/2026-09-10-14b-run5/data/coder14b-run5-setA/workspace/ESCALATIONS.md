# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-11 04:12:17 — loop
- run: `80f419ed-4813-41c0-986e-c9566db2c9ff`  (status: stopped)
- goal: Create t1_temp.js exporting cToF(c) and fToC(f), with asserts that all pass, then run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:12:39 — loop
- run: `30d266b0-04b1-48a2-b0dd-89e4ed32b5fe`  (status: stopped)
- goal: Add kToC(k) to the EXISTING t1_temp.js that throws on a negative Kelvin value. Keep the other functions unchanged. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:13:15 — loop
- run: `a47d07ce-cfbd-4149-97d2-aae6528fb536`  (status: stopped)
- goal: Create t3_inventory.js exporting an Inventory class with add(name, qty), remove(name, qty) that throws when stock would go negative, and count(name). Include asserts that all pass, then run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 3 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:13:55 — loop
- run: `dadc3031-55a4-4b4c-8265-dc5743027e9f`  (status: stopped)
- goal: In the EXISTING t3_inventory.js, change ONLY remove so that removing the last unit of an item deletes that item entirely. Touch nothing else. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 6 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:14:08 — loop
- run: `dd37f219-fccc-4269-bbc8-ef5461bfd3ec`  (status: stopped)
- goal: Write T_NOTES.md listing every method that really exists on the Inventory class in t3_inventory.js, with its arguments and what it throws. Read the file first; do not invent anything.
- what happened: Stopped: the model produced the same response 3 times in the last 3 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:15:19 — loop
- run: `aea3b3c9-cd95-4fef-a486-299bcde36fef`  (status: stopped)
- goal: Reason about the EXISTING t4_intervals.js: does mergeIntervals give the right answer when the input is NOT sorted by start? Write the answer and why in T_INTERVALS.md, then add an assert to t4_intervals.js that proves it, fixing the function first if it is wrong. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:15:41 — loop
- run: `eabaee19-07f2-43d4-b685-f14d87577c6a`  (status: stopped)
- goal: Create t5_page.html with a text input and a list; typing text and pressing Enter adds it to the list. Put the logic in t5_page.js loaded at the end of the body.
- what happened: Stopped: the model produced the same response 3 times in the last 3 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:15:56 — loop
- run: `d19953a0-aa47-49b7-9c3a-9eb817f6f697`  (status: stopped)
- goal: Add a Clear button to the EXISTING t5_page.html, wired up in t5_page.js, that empties the list.
- what happened: Stopped: the model produced the same response 3 times in the last 3 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:16:34 — loop
- run: `81bb6743-4f43-4367-a416-0694072d0a2b`  (status: stopped)
- goal: Create t7_router.js exporting match(pattern, path) where pattern segments starting with ':' capture values, so match('/u/:id', '/u/7') returns { id: '7' } and a non-match returns null. Include asserts that all pass, then run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 5 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:17:53 — loop
- run: `bd6e4964-2dd1-4050-93d8-512bd7c7d4eb`  (status: stopped)
- goal: Add wildcard support to the EXISTING t7_router.js: a trailing '*' in the pattern matches any remaining path. Keep the existing behaviour. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 5 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:18:44 — loop
- run: `024287d7-83be-41ef-9ef6-2a70c883d943`  (status: stopped)
- goal: Create t8_game.html: a canvas game where a ball bounces off all four walls forever. Put the logic in t8_game.js.
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 04:19:11 — loop
- run: `1f658914-6c7b-4b08-abc9-ba44b1d9fe8a`  (status: stopped)
- goal: In the EXISTING t8_game.js, add a paddle at the bottom, moved with the left and right arrow keys, that the ball bounces off.
- what happened: Stopped: the model produced the same response 3 times in the last 5 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.
