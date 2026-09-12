# Audit 01 — the scorer (`tools/checks-J.mjs`)

Read-only audit, 2026-09-12. Nothing in any live measurement directory was modified; every experiment below
ran in a private scratch workspace. Chain 9 (puppeteer) was deliberately **not** executed, to avoid launching a
browser while three paid GPU windows were running.

**Provenance confirmed.** `md5(checks-J.mjs) = e3e9aaaa5811ee7a4525c4c62e09c70e`, byte-identical to
`2026-09-12-setI/tools/checks-I.mjs` and `2026-09-12-setH/tools/checks-H.mjs`. `goals-J20.json` is also
byte-identical to `goals-I20.json` (`d804b7531123dd97a686cf61764f762e`) — set I and set J are the same 20 goals.
A defect here does invalidate F/G/H/I.

## Headline

**The checker is not broken.** A hand-written, prose-faithful solution scores full marks (section F). Its core
assertions are sound and specific. The defects are at the edges, and they are the expensive kind:

1. Two of the twenty assertions test something the goal text never asks for (goals **7** and **12**) — both proven
   with fixtures.
2. One non-CommonJS export, or one wrong line in the model's own self-test, zeroes an **entire chain** — within a
   20-goal set that is 2 goals per file, across the 100-goal sets it is 10.
3. When the scored process is killed, the recorded reason is the empty string, and 10 goals go to zero with no
   diagnostic at all.
4. "Never written" and "written then destroyed" are not distinguished in any field.

---

## A. Goal-by-goal: does the assertion match the prose?

Goal *g* maps to chain `n = ((g - 1) mod 10) + 1`, step `k = floor((g - 1) / 10) + 1` (checker: `goal = k*10 + c.n`).

| # | File / step | Verdict |
|---|---|---|
| 1 | s1 step 1, lines 86–90 | **Agrees, but under-tests.** addBook/copies/titles, "adding an existing isbn adds copies and keeps the first title", the positive-integer throw for `0,-1,1.5,'2'`, unknown isbn → 0, and "a refused add was stored" are all checked. But the goal's *"titles() returns the titles sorted alphabetically"* is never exercised: the only assertion is `same(l.titles(), ['Dune','Emma'])` (line 87) after adding `'Dune'` then `'Emma'` — insertion order **equals** alphabetical order, so an implementation that never sorts passes. False-pass risk, not a false fail. |
| 2 | s2 step 1, lines 295–302 | **Agrees.** All seven keys, `time` as the text inside the brackets, `status`/`bytes` ints, `"-" → 0`, `seconds` float, and ValueError for three differently-malformed lines. |
| 3 | s3 step 1, lines 218–221 | **Agrees.** shape/get/toArray-is-a-copy, throws outside the matrix (incl. `-1`), and the constructor rejects `[]`, `[[]]`, ragged rows, `'x'`, `NaN`, `Infinity` — exactly the goal's "no rows, empty rows, rows of different lengths or anything that is not a finite number". |
| 4 | s4 step 1, lines 370–375 | **Agrees.** Paragraphs, inner lines joined with one space, blocks joined with `\n`, `& < >` escaped. Adds `"x\n\n\n\ny"` (several blank lines) — a fair reading of "blocks separated by blank lines". |
| 5 | s5 step 1, lines 255–257 | **Agrees.** Precedence, left-to-right (`8-3-2`, `12/3/2`), decimals, surrounding spaces, division-by-zero throw, and four unparseable inputs. |
| 6 | s6 step 1, lines 429–439 | **Agrees.** Idempotent add_node, add_edge adds both nodes, repeated edge replaces the weight, nodes() sorted, neighbors() sorted `(b, weight)`, ValueError for `0`, `-1`, `'3'`. |
| 7 | s7 step 1, lines 145–149 | **DISAGREES — tests an unstated requirement.** Everything the goal states is checked correctly. But line 145 calls `c.has('b')` between `c.get('a')` and `c.set('c',3)`, and line 146 then demands that `b` was evicted. That silently requires **`has()` must not count as a use**. The goal says only *"both get and set count as a use"* and is silent on `has`. **Proven:** an otherwise identical Cache whose `has()` also promotes scores `7 fail … evicted the wrong key`. |
| 8 | s8 step 1, lines 511–524 | **Agrees.** Duplicate student/assignment ValueError, max_points `0,-1,'10'`, KeyError for unknown student *and* unknown assignment, points range, re-record replaces, `score` → None, refused record leaves the score alone. |
| 9 | s9 step 1 (webChain run 1) | **Agrees, but under-tests.** Add-clears-input, blank adds nothing, other columns empty. Not checked: that each column *holds a `<ul>`*, and that *the logic is in s9_board.js loaded at the end of the body* — both explicit in the prose. Under-test only. |
| 10 | s10 step 1, line 195 | **Agrees.** `shelfLine` joined with `', '`, `'(empty)'` when empty. Note it also requires s1_library.js to yield a `Library` (`needL`) — see D on cross-goal coupling. |
| 11 | s1 step 2, lines 91–95 | **Agrees exactly**, including "on a throw nothing changes" (line 95). |
| 12 | s2 step 2, lines 303–306 | **DISAGREES — over-specifies "blank".** The fixture LOG (line 293) contains a whitespace-only line `"   "` as line 6, and line 306 demands `bad_lines(LOG) == [3, 8]`. So "blank" is silently defined as *whitespace-only*, not *empty*. The goal says only "skipping blank … lines" / "malformed lines that are not blank". **Proven:** the identical solution using `if not line:` instead of `if not line.strip():` scores `12 fail … bad_lines [3, 6, 8]`. |
| 13 | s3 step 2, lines 222–224 | **Agrees.** add/sub, shape-mismatch throws both ways, and neither input mutated. |
| 14 | s4 step 2, lines 376–380 | **Agrees.** h1–h3, `#### four` and `#nospace` stay paragraphs, heading is its own block with no blank line around it. |
| 15 | s5 step 2, lines 258–259 | **Agrees.** Both goal examples verbatim plus nested parens; the unclosed/extra-paren throws are covered by goal 5's "anything it cannot parse". |
| 16 | s6 step 2, lines 440–444 | **Agrees.** BFS order with sorted neighbours, a second component, and KeyError for an unknown start. |
| 17 | s7 step 2, lines 150–151 | **Agrees.** delete true/false, state after delete, clear, and set-after-clear. |
| 18 | s8 step 2, lines 525–535 | **Agrees.** 15/30 → 50.0, 20/30 → 66.67 (2 dp), None with no scores, KeyError for an unknown student. |
| 19 | s9 step 2 (webChain run 2) | **Agrees.** Right/left across all three columns, no-ops at both ends, and "a moved card goes to the end". |
| 20 | s10 step 2, line 196 | **Agrees.** `'1/2'` for one of two copies on loan. |

**Score for section A: 18 of 20 agree. Goals 7 and 12 fail a correct implementation. Goals 1 and 9 under-test.**

---

## B. How candidate files are loaded and run

`runScript()` (runners section) does `existsSync` → `spawnSync`, never `import`:

- **JS:** `spawnSync(process.execPath, ['-e', JS_PRELUDE + script], { cwd: ws, timeout: 60000 })`, and the prelude's
  `load()` is `require('./' + f)` inside try/catch (prelude line 32). On failure it prints
  `RESULT {"load": …}` and exits 0 — **all ten steps of that chain then score false**.
- **Python:** `spawnSync('python', ['-c', PY_PRELUDE + script], { cwd: ws, timeout: 180000 })`. `load()` uses
  `importlib.util.spec_from_file_location(file[:-3] + "_mod", …)`, so `__name__` is `s2_logs_mod`, **not**
  `"__main__"` — the model's `if __name__ == "__main__":` asserts correctly do **not** run. Good design.
- Result protocol: the **last** line starting with `RESULT ` wins (`.split('\n').reverse().find(...)`), so a stray
  `console.log`/`print` cannot corrupt it. A module-level `print` in Python is additionally captured by
  `contextlib.redirect_stdout` during exec. **A stray print is not a false-fail source** for goals 1–20.

**The real false-fail source is module-level execution.** Every JS goal text *orders* the model to
"Include asserts that all pass, then run it with node", so the self-test runs at `require()` time.
`neutral.cjs` neutralises only `require('assert')` / `node:assert` / `assert/strict` and `console.assert`.

Fixtures (correct implementations, wrong self-tests):

| Fixture | asIs | impl | Result |
|---|---|---|---|
| s7_cache.js, correct code, wrong `assert.strictEqual(c.size(), 3)` | fail | pass | `7 CT` / `17 CT` — **handled correctly** |
| s1_library.js, correct code, wrong hand-rolled `if (…) throw new Error('self-test failed')` | fail | fail | `1 fail` / `11 fail` — **false FAIL of correct code** |

Frequency in the archive (classifying the reason each `load:`/`no result` row failed, all `*-checks.json` under
`measurements/`): **120 rows** show a module-level throw (e.g. setG 30B, all 38: `load: Member Alice already has
book 978-…`; setJ 14B goal 10: `load: Expected values to be strictly equal: + 'Book One, Book Three, Book Two'`),
against **104 rows** of genuine syntax/import failure and **15** blank `no result`. Caveat on those 120: the
`why` field records the **asIs** reason whenever asIs failed (`why: sa.why : 'impl: ' + sb.why`), so the impl-run
reason for those rows is not recorded — they are not all recoverable-by-neutral, but they are the population in
which the un-neutralisable self-test lives.

**Does it distinguish "code is wrong" from "harness could not load it"?** Partially, by text only:
`missing <file>` (never written) · `load: …` (threw or failed to parse at import) · `no result: …` (process
produced no RESULT line). There is no status field, and see E for the case where that last text is empty.

---

## C. Both languages

**Python: correct.** `__main__` guard respected, `PYTHONIOENCODING=utf-8` and `PYTHONDONTWRITEBYTECODE=1` set,
`run_cli` uses `sys.executable` so the CLI steps cannot drift to another interpreter.

**JavaScript: CommonJS only, and the failure is total.** `require()` is the sole loader; `pathToFileURL` appears
only for the hub's `browser.js`. The checker *is* flexible about CJS **shape** — `pick(M, 'Library') || M`
(prelude line 33) accepts `module.exports = Class`, `= { Class }`, or a bare function — but not about the module
system.

**Proven:** the ESM version of the *same* Library that scores PASS as CJS scores zero on every step:

```
  1 fail s1_library.js  s1  load: Unexpected token 'export'
 11 fail s1_library.js  s2  load: Unexpected token 'export'
  … 9 rows … done as asked 0/100 | implementation correct 0/100
```

Mitigating: the workspace ships `package.json` with `"type": "commonjs"`, so `export` there is a real model
error, not a harness bug. Aggravating: the goal prose says only *"exporting a Library class"*, and one wrong
export style costs 10 goals (2 in a 20-goal set) under a reason that reads like a syntax error.

**The 100/100 validation never exercised either path.** The reference solutions
(`ai-coding-hub/measurements/2026-09-11-setF/refs/`) are `module.exports` on all five .js files, and
`grep -c assert` is **0** for both `s1_library.js` and `s7_cache.js` — the refs have no module-level self-tests
at all. So neither the ESM path nor the self-test path was covered by the run that certifies this checker.

---

## D. Scoring semantics

- **`asIs`** — the step passed with the model's module executed normally (its own asserts run).
- **`impl`** — the same step with `assert`/`console.assert` neutralised via `node -r neutral.cjs` (and `python -O`).
- **`why`** — the asIs failure reason, or `'impl: ' + …` when only the impl run failed. Display: `PASS` (asIs),
  `CT` (impl only: "correct code, own test broke it"), `fail`. The headline number is `impl`.
- **Is a goal ever scored against another goal's file? Yes, structurally.** Chain 10 loads `s1_library.js` and
  `s7_cache.js`; within 1–20 that means goals **10 and 20 depend on files owned by goals 1/11 and 7/17**. Real
  example, set I goal 20: `threw: library.getBook is not a function` — s10's code called an API s1 never had.
  Goals 91 and 100 (notes/index) are scored almost entirely against other goals' files. This is defensible — the
  goals say "uses the EXISTING …" — but it is cross-goal attribution, and a single broken s1 costs goals 1, 11,
  10 and 20.
- **Final-workspace scoring.** Every step is re-run against the final file, so a later goal that breaks an earlier
  feature retroactively zeroes the earlier goal. That is intended ("the north-star behaviour").
- **Never-written vs written-then-destroyed: NOT distinguished.** There is no field for it; only the `why` text
  differs (`missing s3_matrix.js` vs an assertion message). No checkpoint or history comparison exists in the
  checker, and `compare-setJ.mjs` does not split them either. This is the split the project's own standing lesson
  demands, and the instrument does not provide it.
- **Denominator.** `checks-J.mjs` always fills 10 steps × 10 chains and prints `… X/100`, regardless of how many
  goals were actually asked. For a 20-goal set that line — which `run-setJ.sh` appends to the run log — understates
  by 5×. `compare-setJ.mjs` is correct: it filters `x.goal <= N` with `N = 20`. **Comparison numbers are sound;
  the log headline is misleading.**

---

## E. Timeouts, truncation, encoding, error swallowing

**The blank diagnostic — worst finding in this section.** `runScript` ends with
`if (!line) return { load: 'no result: ' + ((r.stderr||'') + (r.stdout||'')).trim()… }`. When `spawnSync` hits its
timeout the child is SIGTERM'd and **both streams are empty**, so the recorded reason is the empty string and ten
goals go to zero with no explanation:

```
[A] real setH s4_markdown.py : ms 8096 | status null | signal SIGTERM | error ETIMEDOUT | stdout "" stderr ""
[B] generic python sleep      : ms 4073 | status null | signal SIGTERM | error ETIMEDOUT | stdout "" stderr ""
    -> checker would report: "no result: "
```

Reproduced against the real artifact: `2026-09-12-setH/data/coder30b-sethctl/workspace/s4_markdown.py` imports
fine in 1 s but **`to_html("Hello world")` never returns** — an infinite loop in the model's code. Confirmed twice
independently: killed by `spawnSync` at 8 s (ETIMEDOUT above) and by a 20 s `timeout` (`exit 124`). Running chain 4
on a copy reproduces all ten `no result:` rows exactly as recorded in `coder30b-sethctl-checks.json`. So in this
instance the model really was broken — but note two things: the harness cannot tell that from *python missing from
PATH* or *a machine too slow*, and because piped stdout is block-buffered, **output printed before the hang is lost
too** (`IMPORTED OK` never appeared). 15 such rows exist across the archive.

Cost: the chain is run **twice** (asIs + neutral), so one hang burns 2 × 180 s of a paid window.

**Other `catch` blocks that convert a harness fault into a model failure:**

1. `webChain`'s caller: `catch (e) { a = b = { load: 'web: ' + … } }` — and `webChain` resolves puppeteer and
   `launchOptions` from `const HUB = 'C:/Users/tatte/Projects/ai-coding-hub/server/'` (line 15), the **main**
   checkout. Set J deliberately serves `ai-coding-hub-indent` and `run-setJ.sh` refuses to start otherwise, yet the
   scorer still reaches into the unpatched tree for its browser. I verified both files and `puppeteer` resolve
   today, so goals 9/19 are being scored honestly — but an npm change in an unrelated tree would silently zero
   them as model failures.
2. `S10`'s `try { require('./s1_library.js') } catch (e) {}` → `needL()` then throws
   `s1_library.js does not give a Library class`, attributing another file's breakage to goals 10/20.
3. `indexCheck`'s per-file `catch (e) { console.log('EXP []') }` — a file that cannot be required contributes no
   names, so a broken file makes the index check *easier* to pass (goal 100 only).

**Truncation:** step reasons are sliced to 140–160 chars, the printed line to 100, and `why` hides the impl-run
reason whenever asIs also failed. Diagnostic only — no effect on the score.

**Encoding: clean.** A BOM + CRLF copy of the passing files still scores `1 PASS / 2 PASS / 11 PASS / 12 PASS`.
CRLF and BOM are **not** a false-fail source.

---

## F. The hand-written-correct-solution test — **PASSED**

I wrote solutions to eight goals straight from the prose (CommonJS, with the self-tests the goals demand), in a
private scratch workspace, without consulting the assertions while writing:

`s1_library.js` (goals 1, 11) · `s2_logs.py` (goals 2, 12) · `s7_cache.js` (goals 7, 17) · `s10_desk.js` (goals 10, 20)

```
  1 PASS s1_library.js  s1      2 PASS s2_logs.py     s1
  7 PASS s7_cache.js    s1     10 PASS s10_desk.js    s1
 11 PASS s1_library.js  s2     12 PASS s2_logs.py     s2
 17 PASS s7_cache.js    s2     20 PASS s10_desk.js    s2
```

**8 of 8.** The checker is not systematically rejecting correct work. (Two caveats now known: my `s7_cache.js`
happened not to promote on `has()`, and my `s2_logs.py` happened to treat a whitespace-only line as blank — the
two coin-flips of section A. Had I guessed the other way on either, a correct solution would have failed.)

Goals 3, 4, 5, 6, 8, 9, 13, 14, 15, 16, 18, 19 were audited by reading only; twelve of twenty are not
empirically confirmed.

---

## Recommendations, in cost order

1. **Fix the two disagreeing assertions.** Either stop calling `c.has('b')` mid-sequence in s7 step 1 (or state the
   `has` rule in the goal), and either drop the whitespace-only line from the s2 fixture or say "blank" means
   whitespace-only. These are the only two assertions in the twenty that fail correct code.
2. **Never report a killed process as a model failure with an empty reason.** Record `r.error.code`/`r.signal` and
   emit `harness: ETIMEDOUT after 180s` — and score it as a distinct state, not as ten zeroes.
3. **Add a `written` / `destroyed` / `never-written` field**, from the workspace git the runner already bundles.
4. **Decide explicitly about ESM.** Either keep CJS-only and say so in the goal text, or fall back to
   `import(pathToFileURL(f))` when `require` throws `Unexpected token 'export'`.
5. **Re-validate the refs with self-tests included**, in both module systems — today's 100/100 covers neither.
6. Print the headline over the goals actually asked, not `/100`.
7. Resolve puppeteer from the tree under test, not the hardcoded main checkout.
