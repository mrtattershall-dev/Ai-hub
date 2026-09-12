# Set J, 14B arm — in-flight analysis

**Run state when I looked:** 5 run records exist. Goals 1–4 finished (`done`, `done`, `stopped`, `done` in
goal order 1,2,3,4); goal 5 (`s5_expr.js`, run `382c6ce9`) was still `running` with 5 steps. So this covers
**4 of 20 goals**. Everything below is a 4-goal sample and must not be read as a score.

Served build confirmed as the one under test: `ai-coding-hub-indent @ 3d7a080`,
`server/agent.js` md5 `d53b1f230cb0` — matches the log header byte for byte.

---

## A. DID THE FIXES FIRE? — No. Neither one.

Scanned every `type:'tool'` step result across all 5 runs:

| pattern | hits |
|---|---|
| `/ALREADY HAVE LANDED/i` | **0** |
| `/^NO CHANGE/` | **2** (run `14153c9e`, steps 8 and 9) |
| `/would have REMOVED/` | **0** |
| `/would have DUPLICATED/` | **0** |
| `/matched ignoring indentation/` | **0** |

Fix 1 (`reindentTo`/`regionAnchor`) never fired because no tolerant match ever happened — the only
successful `edit_file` in the sample took the exact path (`OK: edited s3_matrix.js; now 39 lines (+11).`,
with no "matched ignoring indentation" suffix).

Fix 2 (`noChangeAt`) never fired **even though the exact situation it was written for occurred twice.**
Both refusals carried the OLD wording:

> `NO CHANGE: your REPLACE is identical to what it would replace, so s2_logs.py is exactly as it was - nothing was edited, and whatever you were fixing is still there. An edit has to CHANGE the lines that are wrong.`

### Why — `noChangeAt()` is unreachable for the case that produced these refusals

`server/agent.js:714`, which sits **above** both the `exact === 1` path and the whole tolerant block:

```js
if (find === replace) return `NO CHANGE: your REPLACE is identical to what it would replace, so ${path} is exactly as it was - nothing was edited, and whatever you were fixing is still there. An edit has to CHANGE the lines that are wrong.`;
```

`noChangeAt()` is defined at `:812` and called only at `:825` and `:832`, inside the tolerant paths. Those
paths compute `out` by splicing and compare `out === content` — i.e. they catch a no-op that arises
*after* whitespace-tolerant matching. But when the model sends **FIND byte-identical to REPLACE**, the
`find === replace` guard at `:714` returns first and control never reaches `:825`/`:832`.

The comment above `noChangeAt` at `:806` describes exactly the run it was built from:

> `// told "NO CHANGE: your REPLACE is identical to what it would replace" each time. The hub was RIGHT every time -`

That set I case was also a literal identical-text resend, so on this reading the fix was installed on a path
that the motivating failure does not traverse. There are two more old-wording `NO CHANGE` returns still
live at `:663` (the `LINES:` path) and `:707` (the OCCURRENCE path), neither of which shows the region either.

This is the single most important finding: **any score movement in this arm cannot be attributed to
`noChangeAt`, because the model was never shown it.**

---

## B. WHAT THE MODEL DOES WHEN REFUSED — it re-sends the identical edit. 2 of 2.

The model was **never** shown "ALREADY HAVE LANDED" (0 occurrences), so the fix's intended mechanism has
zero observations. What we can measure is its behaviour against the OLD refusal, which is the baseline the
fix was meant to break:

| refusal shown | model's very next reply | classification |
|---|---|---|
| step 8, old `NO CHANGE` | byte-identical `edit_file` resend | **(b) re-sent the same edit** |
| step 9, old `NO CHANGE` + duplicate-call warning | byte-identical `edit_file` resend | **(b) re-sent the same edit** |

Counts: **(a) moved on 0, (b) re-sent identical 2, (c) switched to `LINES: a-b` 0, (d) other 0.**

Transcript replies n=3, n=4 and n=5 are all 390 characters and byte-identical to each other. The third one
never became a tool call — the loop guard ended the run first.

### Example 1 — reply n=3 (produced step 8), then step 8's result

Model reply (full, 390 chars):

```
THOUGHT: The `parse_line(line)` function is not working as expected. I need to debug it by checking the regex pattern and the test case.
ACTION: edit_file
PATH: s2_logs.py
FIND:
```python
pattern = r'(\S+) - - \[(.*?)\] "(GET|POST|PUT|DELETE) (\S+)" (\d+) (\d+|-) (\d+\.\d+)'
```
REPLACE:
```python
pattern = r'(\S+) - - \[(.*?)\] "(GET|POST|PUT|DELETE) (\S+)" (\d+) (\d+|-) (\d+\.\d+)'
```
```

Result it was shown:

> `NO CHANGE: your REPLACE is identical to what it would replace, so s2_logs.py is exactly as it was - nothing was edited, and whatever you were fixing is still there. An edit has to CHANGE the lines that are wrong.`

### Example 2 — reply n=4 (produced step 9), then step 9's result

The reply is **character-for-character the same 390 chars as n=3** (same THOUGHT, same FIND, same REPLACE).
What it was shown in return:

> `NO CHANGE: your REPLACE is identical to what it would replace, so s2_logs.py is exactly as it was - nothing was edited, and whatever you were fixing is still there. An edit has to CHANGE the lines that are wrong.`
>
> `⚠️ You already ran this exact edit_file in this run and got exactly this answer. Nothing changed, so repeating it cannot help - do something different: a different file or range, a different action, or fix the problem the answer describes.`

Reply n=5 was then identical again, and the run died:

> `Stopped: the model produced the same response 3 times in the last 5 steps without making progress.`

Note what this shows about the *existing* duplicate-call notice: it fired correctly, named the problem, and
told the model to do something different — and the model repeated itself anyway on the very next turn. The
refusal wording is not the only thing failing here; an explicit "repeating it cannot help" was also ignored.

One nuance worth flagging for interpretation: the underlying bug is real (the regex needs `[\d-]+` handling
/ the test line genuinely fails), so the model was right to want to edit that line. Its failure is that it
emitted FIND == REPLACE, i.e. it never actually formed a change. `noChangeAt`'s line numbers would not
obviously have fixed *that* — it would have told the model the region is unchanged, which it already knew.

---

## C. HOW EACH RUN IS ENDING

Classified from each run's `type:'error'` steps:

| run | goal | status | class |
|---|---|---|---|
| `b708926d` | 1 `s1_library.js` | done | clean |
| `14153c9e` | 2 `s2_logs.py` | stopped | **loop guard** |
| `4972679a` | 3 `s3_matrix.js` | done | clean |
| `26bfb85d` | 4 `s4_markdown.py` | done | clean |
| `382c6ce9` | 5 `s5_expr.js` | running | (in flight) |

**Tally over the 4 finished goals: 0 budget / 1 loop guard / 3 clean / 0 other.**

Baseline was 0 budget / 13 loop guard over 20 goals. At 1-in-4 versus 13-in-20 the rate is lower, but with
n=4 this is nowhere near a signal — and per section A the loop-guard death that *did* happen was not
prevented by either fix, because neither fix fired. I would not read anything into this number yet.

---

## D. REPEATED IDENTICAL TOOL CALLS

Only one repeat in the whole sample:

- run `14153c9e`, `edit_file` on `s2_logs.py` with identical args, **×2** (steps 8, 9) — both answered with
  the same old-wording `NO CHANGE` refusal. The run's own `repeatCalls` field is `1`.

All other runs: no repeated `(tool + args)` pairs at all. This is a genuine improvement over the previously
recorded pattern of many-times-repeated refused calls, but the sample is 4 goals of short, "create one
file" work (4–6 model calls each), so there has been little opportunity to loop.

---

## E. THINGS THAT LOOK LIKE HUB / RIG DEFECTS

**E1 — `noChangeAt()` is unreachable for identical-text resends (hub, `server/agent.js:714`).** Detailed in
section A. The fix under measurement cannot fire on the failure it was written for. This is the
"fix the deciding path, not the advisory one" pattern again: the new message was installed on the tolerant
paths at `:825`/`:832`, while the branch that actually decides this case returns at `:714`. Two further
old-wording returns remain at `:663` and `:707`.

**E2 — the measurement rig reports `err 0 grd 0` for a run that was refused twice and then killed (rig,
`tools/trialJ.mjs:159-162`).**

```js
const toolErrs = (run?.steps || []).filter((x) => x.type === 'tool' && /^ERROR:/.test(String(x.result || '')));
const grd = toolErrs.filter((x) => /boundary marker and/.test(String(x.result || ''))).length;
const err = toolErrs.length - grd;
```

`toolErrs` only matches results starting `ERROR:`. A `NO CHANGE:` refusal matches neither it nor `grd`, so
goal 2's row prints `err 0 grd 0` even though it took two refusals and died on the loop guard:

> `   2  stopped       10     5   0   0    45  s2_logs.py:runs FN-MISSING(time,status,bytes,seconds)`

The only visible trace that anything went wrong is the word `stopped`. Reading the summary table alone,
this run looks uneventful. Given that the whole point of set J is to count refusals, a refusal class that is
invisible to the counters is worth fixing before the run is scored.

**E3 — `task_done` let the model close another goal's task, and said so only after doing it (hub).** Run
`26bfb85d` (goal 4, markdown) called `task_done` with `which: "1"` and got:

> `OK: "Create ``s1_library.js`` with the ``Library`` class." done - that task was LEFT OVER from earlier work in this workspace, not part of this goal. This goal has no tasks of its own on the ledger - before you finish, check its deliverables yourself: every file the goal or your plan names exists and does what was asked.`

It correctly detected and explained the mismatch, but marked the unrelated task done anyway (`OK:`) rather
than refusing. Low severity, but it is a ledger write on another goal's work.

**E4 — worth watching, not yet a defect: every finished goal is marked `FN-MISSING` by the checker**
(`good: false` for goals 1–3 in `coder14b-setj-rows.json`), including goal 1, whose own mocha suite printed
`7 passing`, and goal 3, whose `node test_s3_matrix.js` printed `All tests passed`. Both exported a class
via `module.exports = Library` / `Matrix`. I did not verify the checker's detection logic, so I cannot say
whether this is a real miss by the model or a checker that does not see these export shapes — but if it is
the latter, the whole arm scores 0 regardless of model behaviour. **This should be resolved before the
score is trusted.** It is the one thing here that could invalidate the run's headline number.

---

## Bottom line

With 4 of 20 goals done: neither fix has fired even once; the one loop-guard death in the sample went
through a code path (`agent.js:714`) that the new refusal cannot reach; and two counters that were supposed
to make refusals visible (`err`/`grd`) read zero for exactly the run that was refused twice. Whatever this
arm finally scores, on the evidence so far it will not be measuring `noChangeAt`.
