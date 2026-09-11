# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-11 11:03:15 — loop
- run: `9d404959-a3c7-425a-b8d6-fc65182e6d32`  (status: stopped)
- goal: Add a Clear button to the EXISTING t5_page.html, wired up in t5_page.js, that empties the list.
- what happened: Stopped: the model produced the same response 3 times in the last 6 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 11:05:11 — tunnel
- run: `645b906f-79f6-4a31-985b-de64b44b322d`  (status: interrupted)
- goal: Create t7_router.js exporting match(pattern, path) where pattern segments starting with ':' capture values, so match('/u/:id', '/u/7') returns { id: '7' } and a non-match returns null. Include asserts that all pass, then run it with node.
- what happened: Run paused at step 2 — the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
- what to do: The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.

## 2026-09-11 11:08:47 — loop
- run: `0fa63d9f-45cb-46ba-8923-22c4ea0a378a`  (status: stopped)
- goal: Create t10_debounce.js exporting debounce(fn, ms), plus a test that uses real timers to prove only the last call in a burst runs. Run it with node.
- what happened: Stopped: the model produced the same response 3 times in the last 4 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.
