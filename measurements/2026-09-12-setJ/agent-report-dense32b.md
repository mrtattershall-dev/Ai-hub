# Dense 32B (Qwen/Qwen2.5-Coder-32B-Instruct) on set J — live read

Read-only analysis of an in-progress run. Nothing was edited, killed or restarted.

- Log: `C:/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-12-setJ/coder32b-setj-setJ.log`
- Runs: `C:/Users/tatte/AppData/Local/Temp/trial35-8XrYOc/runs`
- Workspace: `C:/Users/tatte/AppData/Local/Temp/trial35-8XrYOc/workspace`
- Hub: `ai-coding-hub-indent @ 3d7a0800fe27a052f571d21737f08bf76f33b881`, `agent.js md5 d53b1f230cb0`
- Endpoint: `{"ok":true,"engine":"vllm","model":"Qwen/Qwen2.5-Coder-32B-Instruct","gpu":"H100","max_len":16384,"lora":null}`

## State when I looked

Six of twenty goals had reached a terminal status; goal 7 was one tool call in.

| # | file | status | steps | calls | err | grd | ON DISK |
|---|------|--------|-------|-------|-----|-----|---------|
| 1 | s1_library.js | done | 11 | 4 | 0 | 0 | `s1_library.js:runs FN-MISSING(book,owns)` |
| 2 | s2_logs.py | done | 12 | 4 | 0 | 0 | `s2_logs.py:runs FN-MISSING(time,status,bytes,seconds)` |
| 3 | s3_matrix.js | done | 19 | 8 | 0 | 0 | `s3_matrix.js:runs FN-MISSING(Matrix)` |
| 4 | s4_markdown.py | done | 10 | 4 | 0 | 0 | `s4_markdown.py:runs FN-MISSING(paragraphs)` |
| 5 | s5_expr.js | **stopped** | 59 | 30 | 3 | 0 | `s5_expr.js:runs FN-MISSING(numbers)` |
| 6 | s6_graph.py | done | 19 | 8 | 0 | 0 | `s6_graph.py:runs FN-MISSING(number,of)` |
| 7 | s7_cache.js | running (1 call) | — | — | — | — | — |

Goal 5 died on budget, not on an error: step 59 is
`{"type":"error","text":"Stopped: ran out of step budget (30 model calls). Raise AGENT_MAX_STEPS / AGENT_MAX_MINUTES to go further."}`

Every row so far is `good:false`, but that is a scorer artifact — see section E.

## A. Pattern counts in tool results

Across 53 tool steps in the six runs:

| pattern | count |
|---|---|
| `/ALREADY HAVE LANDED/i` | **0** |
| `/^NO CHANGE/` | **0** |
| `/would have REMOVED/` | **0** |
| `/would have DUPLICATED/` | **0** |
| `/matched ignoring indentation/` | **18** |
| `/FIND snippet not found/` (literal) | **0** |
| `/matches [0-9]+ places/` (literal) | **0** |

Two of these need a caveat, because the hub's real wording differs from the pattern as specified:

- The literal string `FIND snippet not found` never occurs; the hub actually emits **`ERROR: the FIND snippet was not found in s5_expr.js (17 lines).`** — **3 hits**, all in the goal-5 run (tool steps 20, 25, 27).
- `matches N places` never occurs; the nearest real message is the duplicate-risk advisory **`"if (expr.includes('/0')) {" still appears 1 time in the file - your REPLACE put it back, so sending this same edit again would match it again and duplicate what you just added. Read the file before editing it again.`** — **1 hit**.

Also present and worth counting, though not on the list: the repeat advisory **`⚠️ You already ran this exact edit_file in this run and got exactly this answer.`** — **5 hits**.

**Fix 1 (reindentTo/regionAnchor) is firing and firing correctly.** All 18 `matched ignoring indentation` results are `OK:` — 4 in the s3 run, 14 in the s5 run. The s3 case is the clean proof: the model sent four edits at 2-space top-level indentation to replace method bodies nested inside `class Matrix`, each came back e.g. `OK: edited s3_matrix.js (matched ignoring indentation); now 40 lines (+21).`, and the resulting `s3_matrix.js` on disk has every method correctly indented inside the class and runs green. No `would have REMOVED` / `would have DUPLICATED` refusal was triggered by any of them, and `grd` is 0 on every row.

**Fix 2 (noChangeAt) confirmed zero hits**, as expected from the already-established finding that it sits on a path that never fires. Nothing in this data contradicts that.

## B. Known failures from the previous run

### 1. Validating without coercing — RECURS, verbatim

`s6_graph.py` (goal 6, completed) contains exactly the prior failure:

```python
def add_edge(self, a, b, weight=1):
    if weight <= 0:
        raise ValueError("Weight must be a positive number")
```

A string weight raises `TypeError: '<=' not supported between instances of 'str' and 'int'`, not `ValueError`. The model's own asserts do not catch it, because they only ever pass an int:

```python
try:
    g.add_edge(1, 3, -1)
except ValueError as e:
    assert str(e) == "Weight must be a positive number"
```

`s8_grades.py` (`max_points <= 0`) has **not been reached** — that is goal 8.

Note the contrast: on the same pattern in goal 7 the model *did* use a type-safe check — `s7_cache.js` opens `if (!Number.isInteger(capacity)`. So the failure is inconsistent rather than systematic.

### 2. s4_markdown.py paragraph wrapping — DOES NOT RECUR (so far)

`s4_markdown.py` on disk keeps its `<p>` wrapping, and the asserts that check it pass:

```python
html_paragraphs = ['<p>{}</p>'.format(' '.join(html.escape(line) for line in paragraph.split('\n'))) for paragraph in paragraphs]
return '\n'.join(html_paragraphs)
```

Goal 4 ran clean in 4 model calls: `run_python s4_markdown.py` → `STDOUT: All tests passed.  EXIT: 0`.

Caveat: the previous run destroyed the paragraph logic during goal **14** ("Add headings to to_html in the EXISTING s4_markdown.py"), which has not been reached. This is not yet a cleared item.

### 3. s9_board.js competing createElement blocks — NOT REACHED

Goals 9 and 19 are the board goals; the run is at goal 7. No `s9_board.*` file exists in the workspace.

However, the same *class* of defect — duplicated, competing code left behind by successive edits — did appear in goal 5. Mid-run `s5_expr.js` held two nested copies of the same evaluation:

```javascript
const result = new Function('return ' + expr)();
try {
    const result = new Function('return ' + expr)();
```

with lines 19-22 left unreachable after the inner block. The model noticed this itself (`THOUGHT: The error indicates that the result variable is being declared twice.`) and eventually cleared it with a full `write_file` rewrite.

## C. Repeated identical tool calls

All repeats are confined to the goal-5 run (`4adb170b`). The other five runs have **zero** repeated (tool + args) pairs.

| tool + args hash | times | succeeded | refused | tool steps |
|---|---|---|---|---|
| `run_command {"cmd":"node test_s5_expr.js"}` | 9 | 0 | 9 (all real test failures) | 2,5,7,9,11,13,15,24,29 |
| `edit_file` A | 3 | **3** | 0 | 16,18,21 |
| `edit_file` B | 2 | **2** | 0 | 17,19 |
| `edit_file` C | 2 | 0 | 2 | 20,25 |
| `edit_file` D | 2 | 1 | 1 | 26,27 |

**The damaging repeats are the ones that succeed.** Edits A and B are exact inverses of each other, and the model alternated between them, each one reported as a clean success:

- step 16 `OK: edited s5_expr.js (matched ignoring indentation); now 28 lines (+3).`
- step 17 `OK: edited s5_expr.js (matched ignoring indentation); now 25 lines (-3).`
- step 18 same as 16 → `now 28 lines (+3).`
- step 19 same as 17 → `now 25 lines (-3).`
- step 21 same as 16 → `now 28 lines (+3).`

A's FIND is B's REPLACE and vice versa (A moves the `if (/\/\s*0\b/.test(expr))` guard into the `catch`, B moves it back out). Git confirms pure oscillation rather than progress — the `s5_expr.js` blob cycles `1f988537d8 → d3ceec174c → 1f988537d8 → d3ceec174c`. Five model calls produced net-zero change, and the accompanying THOUGHT was byte-identical each time: `THOUGHT: The division by zero check is still not working correctly. I need to handle division by zero more robustly by evaluating the expression and checking for division by zero within the try block. Let's simplify the approach by using a regular expression to check for division by zero before evaluating the expression.`

The hub's loop guard did fire from the second repeat onward: `⚠️ You already ran this exact edit_file in this run and got exactly this answer. Nothing changed, so repeating it cannot help - do something different: a different file or range, a different action, or fix the problem the answer describes.` The model received it (it is in `history`) and repeated the edit anyway. When the file had since moved, the guard adapted correctly: `⚠️ You already ran this exact edit_file in this run - and it did something DIFFERENT this time, because the file is no longer what it was when you first sent it.`

So the guard is working as designed and is not the bottleneck; the oscillation consumed roughly a third of the 30-call budget that the run then died on.

## D. Self-verification

The model verifies consistently and acts on failures. Every completed goal ends with an execution step, and each is preceded by a `policy_allowed` step for the same command:

- goal 1 `run_command node test_s1_library.js` → `STDOUT: All tests passed  EXIT: 0`
- goal 2 `run_python s2_logs.py` → `EXIT: 0`
- goal 3 `run_command node test_s3_matrix.js` → `STDOUT: All tests passed!  EXIT: 0`
- goal 4 `run_python s4_markdown.py` → `STDOUT: All tests passed.  EXIT: 0`

Goal 5 ran its test 9 times and edited after each failure — it acts on failures, it just never converged.

**Code contradicting assertions in the same run.** The first `test_s5_expr.js` asserts that `evaluate` *returns* an error string, while `s5_expr.js` *throws*:

```javascript
assert.strictEqual(evaluate('10 / 0'), 'Error: Division by zero');
assert.strictEqual(evaluate('1 + 2 *'), 'Error: Cannot parse expression: 1 + 2 *');
assert.strictEqual(evaluate('abc'), 'Error: Cannot parse expression: abc');
```

against an implementation whose every failure path is `throw new Error(...)`. Those three asserts cannot pass as written. The model spent six model calls editing `s5_expr.js` — the file that was arguably right — before rewriting the test file at step 23 with the correct `assert.throws(() => evaluate('1 / 0'), /Division by zero/)` form. That is the old "edits the wrong side of a failed assert" pattern, and it cost most of the budget.

A related gap in goal 6: the asserts are too weak to expose the `weight <= 0` bug described in B, so `run_python s6_graph.py` reports `EXIT: 0` on code that mishandles a string weight. The verification is real but shallow.

## E. Hub / harness defects, as distinct from model mistakes

### E1. `FN-MISSING` is a false positive on every row — the verdict misleads

Every completed goal is scored `good:false` purely because of `FN-MISSING`, and in each case the named functions **are** present and the file runs. The cause is in the measurement harness, `C:/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-12-setJ/tools/trialJ.mjs:~211`:

```javascript
const wanted = [...new Set([...goal.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))]
```

It harvests any `word(` from the goal's **English prose**, so goal 1's "adds copies of a book (adding an isbn...)" and "the library owns (0 for an unknown isbn)" become required functions `book` and `owns`. Same for `time`, `status`, `bytes`, `seconds` (dict keys in goal 2's prose), `paragraphs` (goal 4), `numbers` (goal 5), `number`/`of` (goal 6).

Separately, the `defined()` regex does not recognise **class declarations**, so goal 3 reports `FN-MISSING(Matrix)` against a file that literally starts `class Matrix {` and exports it. Verified by running the harness's own regex against the real sources:

```
Matrix       defined()=false literalInSrc=true
addBook      defined()=true
parse_line   defined()=true
class decls: class Library,class Matrix
```

Consequence: the `good` column is unusable for this arm as it stands — four genuinely passing goals (1, 2, 3, 4) score as not-good. Any 32B-vs-MoE comparison drawn from `good` would be wrong in both arms (the 30B log shows the identical `FN-MISSING(book,owns)` etc.). Note this is the *harness*, not `agent.js`; the per-file `:runs` verdicts are correct.

### E2. Stale task carried into every later run

`TASKS.md` has held one entry since goal 1 and it is still open at goal 7:

```
- [ ] 1. HOW TO VERIFY — Run `node test_s1_library.js` and ensure all asserts pass. <!--carried--> <!--aged-->
```

Goal 1 did run that exact command successfully (`STDOUT: All tests passed  EXIT: 0`) and then finished without marking it done. Every subsequent goal is then told, in its own ledger: `TASK LEDGER (TASKS.md — 0/1 done) Remaining: (nothing open for this goal) (1 task(s) left over from earlier goals about other work are not shown - TASKS.md still has them)`. The ledger permanently reads 0/1 done. Low severity — the leftover is hidden from the model and does not block finishing — but the counter is wrong and the task will never clear.

### E3. Not defects, checked and cleared

- **Nothing silently lost.** `git log` in the workspace shows a `before <tool>` commit for every mutating action, the baseline commit is intact, no rollback or checkpoint-deletion appears, and each completed file on disk matches what the model last wrote.
- **Truncation is announced, not hidden.** The oversized test output came back as `… [179 of 1679 characters of stdout trimmed from the middle - narrow the command, or write the output to a file, if you need them] …` and the assertion message survived the trim.
- **Every refusal I found was correct.** All 3 `the FIND snippet was not found` results were genuinely stale FINDs (the file had already changed), and each showed the correct numbered region plus the actual line count — e.g. `ERROR: the FIND snippet was not found in s5_expr.js (15 lines).` when the file really was 15 lines. No wrong refusal observed; `grd` is 0 on all rows.
- **The context-trim notice is honest**: `(… 3 earlier steps trimmed to save context. The GOAL and PLAN above still stand — keep following them. Recent steps follow.)`
- **Escalation surfaced properly.** The budget stop wrote `ESCALATIONS.md` naming the run, the goal and the remedy.

## Bottom line at goal 7 of 20

The indent fix is doing exactly its job — 18 tolerant matches, all landing correctly re-indented, zero destructive-write refusals, and the s3 run is a clean before/after of the behaviour that used to break class structure. `noChangeAt` remains dead code, as established. The model's remaining losses are its own: an inverse-edit oscillation that the loop guard flagged five times and the model ignored, and editing the implementation instead of the assertions that contradicted it — together they burned the whole 30-call budget on goal 5. The old `weight <= 0` coercion bug is back verbatim in s6. The most actionable item here is E1: the harness's `good` column is false on every row so far and will understate both arms.
