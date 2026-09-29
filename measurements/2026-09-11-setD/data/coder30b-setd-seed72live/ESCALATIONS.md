# Escalations

Runs that stopped and need a person. Newest at the bottom.

## 2026-09-11 12:46:25 — budget
- run: `b6b704b6-8789-4fb9-b059-64d22b299b0a`  (status: stopped)
- goal: Add top_words(text, n, stopwords=()) to the EXISTING r2_text.py returning the n most common words as (word, count) tuples, most common first, ties in alphabetical order, leaving out any word in stopwords (compared in lower case). Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 12:49:17 — budget
- run: `d92468f1-4d1d-4abe-a540-9e894c65ba45`  (status: stopped)
- goal: Make transactions in the EXISTING r5_store.py nest: begin() inside a transaction opens an inner one, rollback() undoes only the innermost, and commit() of an inner one hands its changes to the outer one (a later outer rollback still undoes them). Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 12:52:23 — loop
- run: `72dbabcb-ef0b-49d7-88ba-59ff9f225403`  (status: stopped)
- goal: Add an element with id "r9-count" to the EXISTING r9_app.html that always shows how many items are not done, as "3 items left" ("1 item left" for one, "0 items left" for none). Wire it up in r9_app.js.
- what happened: Stopped: the model produced the same response 3 times in the last 7 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 12:54:18 — budget
- run: `a3521ee7-396a-4896-86f3-27a8e58b73cc`  (status: stopped)
- goal: Add history(name) to the EXISTING Ledger in r1_ledger.js returning that account's entries in order as {type, amount} objects, type one of 'deposit', 'withdraw', 'transfer-in', 'transfer-out'. Failed operations must not appear. Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 12:58:32 — budget
- run: `19a58e9a-6767-4269-92a4-dfeda6b815bc`  (status: stopped)
- goal: Add expiry to the EXISTING Store in r5_store.py: Store(now=time.time) takes a clock function, and set(key, value, ttl=None) with ttl seconds makes the key disappear once now() >= the time it was set + ttl (get returns the default and keys() leaves it out). Existing calls must keep working. Run it wi
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 12:59:35 — parse
- run: `9acbc1e8-dcf9-4328-8fff-1a2dbbf0a4a7`  (status: error)
- goal: Give add_business_days in the EXISTING r6_days.py an optional holidays argument (a collection of 'YYYY-MM-DD' strings) whose dates are skipped like weekends. Existing calls must keep working. Run it with python.
- what happened: Gave up: 5 of the last 10 responses could not be parsed.
- what to do: The model could not produce a valid action repeatedly — usually a model/prompt mismatch.

## 2026-09-11 13:02:41 — tunnel
- run: `0aec8b6f-dc3e-402c-abe4-a5254ad7d832`  (status: interrupted)
- goal: In the EXISTING r9 app (r9_app.html, r9_app.js), clicking an item's text toggles it between done and not done; a done item's <li> has the class "done", and the count updates.
- what happened: Run paused at step 2 — the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
- what to do: The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.

## 2026-09-11 13:04:30 — tunnel
- run: `69f87a39-6c23-44a7-9cee-0c4dc43a29ea`  (status: interrupted)
- goal: Add freeze(name) and unfreeze(name) to the EXISTING Ledger in r1_ledger.js (both throw for an unknown account). While an account is frozen, deposit, withdraw and transfer (in either direction) throw an Error without changing anything; balance and history still work. Run it with node.
- what happened: Run paused at step 4 — the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
- what to do: The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.

## 2026-09-11 13:08:04 — parse
- run: `dca88813-f611-4361-a7d6-ce8f26f56c79`  (status: error)
- goal: Add earliestStart(id) to the EXISTING TaskGraph in r3_tasks.js: 0 for a task with no dependencies, otherwise the latest finish time (earliest start + duration) of the tasks it depends on. It throws an Error for an unknown id. Run it with node.
- what happened: Gave up: 5 of the last 10 responses could not be parsed.
- what to do: The model could not produce a valid action repeatedly — usually a model/prompt mismatch.

## 2026-09-11 13:11:58 — budget
- run: `6c2cf913-ba7a-4f0c-bc36-775fd1159f0c`  (status: stopped)
- goal: Add business_days_between(a, b, holidays=()) to the EXISTING r6_days.py: the number of working days d with a < d <= b, skipping weekends and holidays, and 0 when b <= a. Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:15:30 — tunnel
- run: `88f9e2c6-a284-4059-b407-0531dc24da7f`  (status: interrupted)
- goal: In the EXISTING r9 app (r9_app.html, r9_app.js), give every <li> a delete button with the class "r9-del" that removes that item (the count updates).
- what happened: Run paused at step 2 — the model is unreachable. Check Ollama is running, or re-point the tunnel in Settings, then Resume. (Model stream failed before any content: Premature close)
- what to do: The model endpoint was unreachable. Re-point the Ollama tunnel, then Resume.

## 2026-09-11 13:16:33 — budget
- run: `68bdba5f-e49a-4dc5-96f5-5814beeb5ff1`  (status: stopped)
- goal: Add historyReport(ledger, name) to the EXISTING r10_report.js and export it: one line per history entry of that account - the entry's type, a space and its formatted amount, e.g. 'deposit $10.00'. Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:18:24 — budget
- run: `c41bfe67-588e-47e8-a76d-cc3601a85e2f`  (status: stopped)
- goal: Add undo() to the EXISTING Ledger in r1_ledger.js: it reverses the most recent successful deposit, withdraw or transfer - the balances AND the history go back to how they were before it. Calling undo() again reverses the one before that. It throws an Error when there is nothing left to undo. Run it 
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:21:16 — budget
- run: `7626285c-0f46-4282-aaf6-32f11399be31`  (status: stopped)
- goal: Add totalTime() to the EXISTING TaskGraph in r3_tasks.js: how long it takes to finish every task if any number of tasks can run at once (0 for an empty graph). Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:24:53 — budget
- run: `7c46ed1b-4d34-495d-8dc0-11ec01748d98`  (status: stopped)
- goal: Add month_end(s) and add_months(s, n) to the EXISTING r6_days.py: month_end gives the last day of s's month; add_months keeps the day of the month but clamps it to the end of the target month, so '2026-01-31' plus 1 month is '2026-02-28'. n may be negative. Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:27:31 — loop
- run: `4e57f5f5-150d-4ab0-a26a-a2d36d769261`  (status: stopped)
- goal: Add three filter buttons with ids "r9-all", "r9-active" and "r9-done" to the EXISTING r9 app (r9_app.html, r9_app.js) that show all items, only items not done, or only done items. Hidden items must not be visible, and switching back shows them again.
- what happened: Stopped: the model produced the same response 3 times in the last 5 steps without making progress.
- what to do: The model repeated itself. It usually needs a clearer goal or a stronger model.

## 2026-09-11 13:28:24 — budget
- run: `0bcc573d-49ef-4a20-88a7-40e2b9abcfd9`  (status: stopped)
- goal: Add taxReport(ledger, names, ratePct) to the EXISTING r10_report.js and export it: one line per name, 'name: net $X tax $Y gross $Z', using taxMoney on the balance in cents and formatMoney for the three amounts. Run it with node.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:29:30 — budget
- run: `6debb135-ca7b-4ae7-a25d-468e2f4b62d8`  (status: stopped)
- goal: Add applyInterest(ratePct) to the EXISTING Ledger in r1_ledger.js: every account that is not frozen and has a positive balance gets balance * ratePct / 100, rounded to cents (Math.round(x * 100) / 100), added to its balance and recorded in its history as type 'interest'. It returns the total interes
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:34:17 — budget
- run: `e0fe8ebc-51c5-4aa7-b8a6-90beba4972e0`  (status: stopped)
- goal: Add incr(key, by=1) to the EXISTING Store in r5_store.py: a missing key counts as 0, a value that is not an int raises TypeError, it returns the new value, and inside a transaction rollback() undoes it. Run it with python.
- what happened: Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further.
- what to do: Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES, or split the goal into smaller runs.

## 2026-09-11 13:39:46 — approval
- run: `b65726da-2ca9-4200-9da5-d869df9583c5`  (status: awaiting_approval)
- goal: Add a --json option to the EXISTING r2_text.py command line: python r2_text.py FILE N --json prints only a JSON object {"top": [[word, count], ...], "sentences": number_of_sentences}. Without --json the output stays as before. Run it with python.
- what happened: git_undo:  — git_undo always needs a human
- what to do: A command needs your decision. Open the run and approve or deny it.
