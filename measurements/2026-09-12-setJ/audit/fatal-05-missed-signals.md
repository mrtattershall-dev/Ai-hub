# FATAL-05 — missed signals: "ran green, still wrong"

READ-ONLY audit. Arms: setJ (coder14b/30b/32b), setI (coder32b), setH (coder30b-sethfix, coder14b-sethfix).
Sources: `<arm>-rows.json`, `<arm>-checks.json`, `runs/<arm>/runs/*.json`; hub source `ai-coding-hub-indent/server/{agent.js,verifyProject.js}`.

## VERDICT

**The thesis is not supported. 7 of 98 lost goals (7.1%) are recoverable by a
failure-despite-zero-exit detector.** The detector is cheap, correct, and worth
building — but it is a footnote, not the next big fix.

The real shape of the "ran green, still wrong" population is the opposite of the
thesis: **21 of 23 were genuinely silent**, because the model's own test *passed*
and was *weaker than the goal*. There was no signal to miss. The hub cannot
recover these by reading output harder; it can only recover them by checking the
self-test against the goal.

---

## A. The population

Definition: attempted goal scored `impl=false`, run ended `done`, zero error steps
(`rows[].err == 0`).

| arm | attempted | impl PASS | lost | lost&done | **popA (done, err=0)** | lost&stopped | lost&done&err>0 | lost&interrupted |
|---|---|---|---|---|---|---|---|---|
| coder14b-setj | 16 | 4 | 12 | 4 | **2** | 7 | 2 | 1 |
| coder30b-setj | 18 | 14 | 4 | 2 | **2** | 2 | 0 | 0 |
| coder32b-setj | 18 | 9 | 9 | 5 | **4** | 4 | 1 | 0 |
| coder32b-seti | 20 | 6 | 14 | 7 | **6** | 7 | 1 | 0 |
| coder30b-sethfix | 53 | 38 | 15 | 9 | **6** | 5 | 3 | 1 |
| coder14b-sethfix | 51 | 7 | 44 | 4 | **3** | 39 | 1 | 1 |
| **TOTAL** | **176** | **78** | **98** | **31** | **23** | **64** | **8** | **3** |

**popA = 23.** Note the denominator: 64 of the 98 lost goals are in `stopped`
runs — the budget/loop ceiling from set G, still the largest single category.

### Correction: 2 of the 23 are misattributed

The checker scores every goal against the **final** workspace, so a goal can be
correct when written and destroyed by a later goal in its chain. 18 of the 23 had
a later chain goal attempted, so this is live for most of them. Two are provable:

| case | checker `why` | the run's own finish-time evidence |
|---|---|---|
| coder14b-sethfix#1 | `load: Unexpected token '{'` | `all 2 source file(s) pass a syntax check` |
| coder14b-sethfix#4 | `load: SyntaxError: unterminated string literal (line 18)` | `all 6 source file(s) pass a syntax check` |

The file parsed at finish and does not parse at scoring time. Confirmed on disk:
`data/coder14b-sethfix/workspace/s1_library.js` now holds a `checkout/returnBook`
class with `dueDay` — goal 11/21/31's code, not goal 1's. These are
destroyed-later, not wrong-when-written.

**Genuine popA = 21.**

## B. Was there a signal? — quantified

| measure | count (of 23) |
|---|---|
| failure signal in the run's **final** command | **2** |
| failure signal in **any** command at some point | 6 |
| final command **claimed success** (`All tests passed`, `✅`, `PASS:`) | 12 |
| ran **no command at all** (s9 web goals) | 2 |
| failure-text-despite-`EXIT: 0` anywhere | **0** |

**Genuinely silent at the moment of finishing: 21 of 23.** Of those, 12 ended with
output actively asserting the opposite of the truth.

Corpus-wide the failure-despite-zero-exit pattern *does* exist — it just does not
live in popA. Across 435 command results (167 at `EXIT: 0`):

| pattern (at `EXIT: 0`) | outputs | goals |
|---|---|---|
| `Assertion failed:` (console.assert) | 9 | 6 |
| `AssertionError` | 4 | 3 |
| `Traceback (most recent call last)` | 3 | 3 |
| pytest `N failed` / `::test... FAILED` | 6 | 3 |
| bare `FAIL`/`FAILED` at line start | 6 | 3 |
| **any of the above (deduped)** | — | **11 goals** |

Of those 11 goals: **5 LOST**, 6 eventually passed.
Lost ones: `coder30b-setj#5`, `coder32b-setj#15`, `coder32b-seti#15`,
`coder30b-sethfix#5`, `coder30b-sethfix#44` — 4 `stopped`, 1 `done` with err>0.
**None are in popA.**

Confirmed as established: `console.assert` prints `Assertion failed:` to stderr and
exits 0. Verbatim, `coder30b-setj#5`, `node s5_expr.js`:

```
STDOUT:
All asserts passed!

STDERR:
Assertion failed: 2 + 3 * 4 should equal 14 (multiplication first)
Assertion failed: 1.5 + 2.5 should equal 4
Assertion failed: 7.5 / 2.5 should equal 3
Assertion failed: Should throw invalid expression error

EXIT: 0
```

`coder30b-sethfix#44` is the same class via a different route: `pytest.main([...])`
called inside `run_python` **returns** the status code instead of exiting with it,
so two `FAILED` tests with a full assertion diff land under `EXIT: 0`.

## C. The detection rule, precisely

Three rules, in descending precision. All operate on a `run_command`/`run_python`
result string whose last line is `EXIT: <n>`.

**Rule 1 — self-contradicting output (highest precision, zero observed false positives).**
> The result ends in `EXIT: 0` **and** its text contains a success claim
> (`All tests passed`, `All asserts passed`, `All tests completed`, `✅`)
> **and** contains a failure marker (below). Fire always.

**Rule 2 — failure text despite zero exit.**
> The result ends in `EXIT: 0` **and** its text contains any of:
> `Assertion failed:` · `AssertionError` · `Traceback (most recent call last)` ·
> a line matching `^\s*(FAIL|FAILED)\b` · a pytest tail matching `\b\d+ failed\b`.
> Fires on 11 goals corpus-wide (5 lost). Use `indexOf`/`includes`, not built regexes.

**Rule 3 — do not finish on a failing command.**
> Block `finish` when the most recent `run_command`/`run_python` in the run exited
> non-zero and no later successful re-run of the same command followed.
> 2 goals corpus-wide, **both lost, both ended `done`**:
> - `coder32b-seti#8` — last execution `run_python s8_grades.py` → non-zero
>   (KeyError traceback); two blind `edit_file`s follow, then finish. The model
>   never saw its code work.
> - `coder30b-sethfix#49` — last two commands both non-zero (`pytest` on a file
>   that does not exist; `node test_s9_board.js` → `ReferenceError: window is not
>   defined`); finished on `test_web` + visual check.

### Why the hub misses all three today

- `batchStepFailed` (agent.js:2840) decides failure **only** by the result *ending*
  in a non-zero `EXIT` — `/(^|\n)EXIT: (?!0\s*$)\S+\s*$/`. Every rule-1/2 case ends
  in `EXIT: 0`, so it reads them as passes.
- `withAssertEvidence` / `assertEvidence` (agent.js:1700, 1774) bails at
  `if (!/AssertionError/.test(r)) return res('')` — it never sees `Assertion
  failed:`, `FAIL:`, or a `pytest.main` summary. It is also **advisory**: called at
  agent.js:3469 and 4671 on the tool-result path, never on the finish gate.
  Per the standing lesson, Rule 3 must go on the **deciding** path (the
  `if (!run.verified)` block at agent.js ~3348), not beside it.

## D. The silent ones — what could have produced a signal

Running the model's own test file would **not** have helped in any of the 12 that
ended claiming success. The test passes. The test is the problem.

**The dominant pattern — self-test weaker than the goal (not contradicting it).**
Goal: *"throws an Error unless copies is a positive integer"*. Three arms
(`14b-setj#1`, `32b-setj#1`, `32b-seti#1` — the latter two byte-identical) wrote:

```js
if (typeof copies !== 'number' || copies <= 0) {
    throw new Error('Copies must be a positive integer');
}
```

No integrality check. Their self-tests probe `0`, `-1`, and the string `'two'` —
never a non-integer *number*. The checker probes `1.5`, which sails through. The
error message even names the property the code does not enforce.

**Cases where the test does contradict the goal text — statically detectable:**
- `30b-setj#4` — goal's first clause is *"blocks become `<p>...</p>`"*; the self-test
  asserts `to_html("Hello\nWorld") == "Hello World"`, an expected value containing
  no `<p>` at all. Rule: the goal string names a literal token (`<p>`) that appears
  in **no** assert's expected value.
- `32b-setj#10` — goal says *"exports shelfLine"*; the file defines `shelfLine`,
  asserts on it in-module, passes, and omits it from `module.exports`
  (`why: shelfLine is not exported`). Rule: goal says "exports X" ∧ file defines X
  ∧ `module.exports` lacks X. **Pure static check, no execution.**
- `32b-seti#20` — `library.getBook is not a function`: the new code calls an API the
  required module does not export. Same static shape.

**Third option, strongest and already built:** run the goal file under the
checker's own `neutral.cjs` harness (stubs `require('assert')` and
`console.assert`). A file whose behaviour is proven only by its own asserts
produces nothing once they are neutralised — which is exactly the "your test
proves nothing" signal the hub lacks.

## E. The decisive number

| | goals |
|---|---|
| lost across all arms (attempted) | **98** |
| recoverable by Rule 1 + Rule 2 (failure text at `EXIT: 0`) | **5** |
| recoverable by Rule 3 (finished on a failing command) | **2** |
| **total recoverable by failure-despite-zero-exit** | **7 (7.1%)** |
| of popA (23) specifically | **2** |
| popA silent, needs goal-vs-test checking instead | **21** |
| lost in `stopped` runs (budget/loop ceiling) | **64 (65%)** |

## F. verifyProject

**20 of the 23 popA goals passed through `verifyProject.verify()`** and every one
recorded success — 10 `node`, 10 `python`. In all 20 the entry resolved to the
goal's own file (the set-E `goalEntry` fix works). The 3 without a note are the s9
web goals (`30b-sethfix#29`, `#49`, `14b-sethfix#9`), where `run.verified` is
`undefined` — the `kind: 'web'` branch returns after an `index.html` existence
check and proves nothing about `s9_board.html`.

What it recorded, and what it threw away:
- node branch: `` `node ${cand}` ran and exited cleanly `` — **output discarded entirely**.
- python branch: keeps the first line only, ≤120 chars.

Discarding output cost nothing *directly* in popA (none of those outputs held a
failure marker — that is why Rule 2 does not fire here). The real defect is
sharper:

> **`verifyProject` reports "ran and exited cleanly" for a file that executes nothing.**

`s1_library.js` as written by `32b-setj#1` is `class Library {...}` +
`module.exports = Library;`. Running it performs zero work and exits 0. That
non-event is recorded as the finish gate's proof, in a goal whose text explicitly
said *"Include asserts that all pass, then run it with node"*. `14b-setj#1` is the
same shape with the asserts in a separate mocha file. The gate's `entry` override
(correctly pointing at the goal's file) makes this *worse* for library-style
goals than the old `runnable` heuristic, which at least preferred a file with
top-level statements.

**Fix worth more than Rule 2 here:** when the resolved entry produces empty output
and the file has no top-level executable statements, that is not evidence — record
it as `UNVERIFIED`, the way the Godot branch already does for a missing binary.

## Recommendation

1. **Rule 3 on the deciding path** — 2 goals, and it closes "finished having never
   seen its own code work". Cheapest correct change.
2. **Rules 1+2** in `batchStepFailed` and as a finish-gate check — 5 goals, and it
   kills the documented `console.assert` / `pytest.main` silence for good.
3. **The 21 silent goals need a different fix**: goal-clause-to-assert coverage,
   the static `exports X` check, and neutralised-harness execution. That, not
   output scanning, is where this category actually lives.
