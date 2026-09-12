# 08 — Execution and inspection tools: can a verification tool report success on failure?

Audit date 2026-09-12. Read-only. Target: `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js`
at git `3d7a080` (4,818 lines), plus `approvalPolicy.js` and `verifyProject.js`.

Evidence trees (read, not modified):

| arm | path | runs |
|---|---|---|
| MoE (console.assert-heavy) | `C:/Users/tatte/AppData/Local/Temp/trial35-cWxzHB/runs` | 18 |
| dense | `C:/Users/tatte/AppData/Local/Temp/trial35-8XrYOc/runs` | 18 |
| 14B | `C:/Users/tatte/AppData/Local/Temp/trial35-Cq4RcJ/runs` | 16 |

Probe files were run only under this session's own scratchpad. The hub was not started, `modal`
was not run, no process was touched.

---

## 0. The confirmed finding, verified and quantified

`console.assert` does not set an exit code. Probe (`node v24.15.0`):

```
$ node a.js            # two failing console.assert calls, then console.log("all tests passed")
Assertion failed: one is not two
Assertion failed: second failure
all tests passed
EXIT: 0
```

The failures go to **stderr**; the exit code stays 0. `run_command` faithfully reports all three
facts, and the hub's own failure classifier reads only the third.

Measured in the runs — an exec call is `run_command` or `run_python`:

| arm | exec calls | EXIT 0 | EXIT non-zero | **EXIT 0 while carrying `Assertion failed`** | failing assertions so hidden |
|---|---|---|---|---|---|
| MoE | 46 | 26 | 20 | **4** | **10** |
| dense | 36 | 11 | 25 | **1** | **3** |
| 14B | 29 | 10 | 19 | 0 | 0 |

`console.assert` in the surviving deliverables: MoE **72** across 4 files (`s3_matrix.js` 30,
`test_library.js` 21, `s5_expr.js` 19, `s10_desk.js` 2); dense **26** across 2 files; 14B **0**.
Counting every write through tool arguments during the runs rather than the end state: MoE **121**,
dense **26**, 14B **0**.

The canonical instance, verbatim from `trial35-cWxzHB` (`node s5_expr.js`):

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

The model's own program printed "All asserts passed!" while four assertions failed, and the hub
classified the call as a success. "I ran my tests and they passed" was structurally incapable of
being false.

---

## A. What each execution tool shows the model, and how a failure can be invisible

### run_command (`agent.js:1055`) and run_python (`agent.js:1135`)

Both compose, identically:

```js
const out = [
  stdout && `STDOUT:\n${trimMid(stdout, 6_000)}`,
  stderr && `STDERR:\n${trimMid(stderr, 1_500)}`,
  err && err.killed && `(timed out after ${CMD_TIMEOUT_MS / 1000}s)`,
  `EXIT: ${err ? (err.code ?? 1) : 0}`,
].filter(Boolean).join('\n');
```

What is **good** here, and worth not regressing: stderr is *not* dropped; the exit code is always
present and always last; truncation takes the middle and never the ends; a timeout is named
explicitly (`CMD_TIMEOUT_MS = 60_000`). The commentary at :1104 records that this shape was itself
a fix for a front-slice that used to cut the exit line away.

The single decision that matters is `batchStepFailed` (`agent.js:2826`, the classifier at :2829):

```js
if ((tool === 'run_command' || tool === 'run_python') && /(^|\n)EXIT: (?!0\s*$)\S+\s*$/.test(r)) return 'exited non-zero';
```

Failure is defined as *the exit code, and nothing else*. Everything below follows from that.

### Measured exit-code behaviour of the shapes the question asks about

All probed on this machine (Python 3.13, pytest 9.1.1, node v24.15.0):

| shape | exit | visible to the hub? |
|---|---|---|
| `console.assert` fails | **0** | **no** — the whole finding |
| Python `assert` inside `try/except AssertionError` | **0** | **no** |
| `unittest.TestCase` defined, never run (no `unittest.main()`) | **0** | **no** — prints "tests defined, all good" |
| `pytest.main([__file__])` called inside the script, test fails | **0** | **no** — stdout says `1 failed` |
| test function defined but never called | **0** | **no** |
| `console.error("FAIL: expected 3 got 2")` | **0** | **no** |
| `assert.strictEqual` wrapped in `try/catch` | **0** | **no** |
| `__main__` guard that never matches | **0** | **no** |
| bare Python `assert` at module level | 1 | yes |
| `unittest.main()` with a failing test | 1 | yes |
| `python -m pytest` with a failing test | 1 | yes |
| `python -m pytest` with nothing collected | 5 | yes (as a failure) |
| unhandled promise rejection | 1 | yes |
| `Promise.reject(...).then()` with no catch | 1 | yes |

The two most valuable rows beyond `console.assert` are **`pytest.main([__file__])` returning 0 on a
failed test** (the string `pytest.main([__file__])` appears 17 times in `trial35-luu7T9`, so models
do write it) and **a unittest class that is never run**.

### A second, independent way the exit code disappears — NEW

`batchStepFailed`'s regex is anchored to the **end** of the result. The repeat-call notice is
appended *after* the result:

```js
result = answer + `\n\n⚠️ You already ran this exact ${tool} in this run …`;   // agent.js:3479
```

and the same `result` is what reaches the classifier at :3762
(`const failed = batchStepFailed(tool, result, syntaxNote);`) and what is shown to the model
(`feedback = … ${result}`, :3694). Once the notice is appended the result no longer ends in
`EXIT: n`, so **the regex cannot match and a genuinely failing command is classified as a pass.**

Measured across the three arms:

| arm | repeat notices on exec tools | result no longer ends in EXIT | **real exit was non-zero** |
|---|---|---|---|
| MoE | 13 | 13 | **2** |
| dense | 4 | 4 | **4** |
| 14B | 6 | 6 | **4** |

**10 failing commands in 52 runs were reclassified as successes by a warning message.** Named
instances: `node test_simple.js` (EXIT 1, run `66fb8638`), `node test_s5_expr.js` (EXIT 1,
`153f5c99`), `s8_grades.py` (EXIT 1, `ba1cc927` ×4), `node s10_desk.js` (EXIT 1, `4a0b80f3` ×2),
`node test_s1_library.js` (EXIT 1, `8e7cf9aa` — that run finished `done` with `verified: true`).

This is the exact hazard the file already documents for a different insertion, at :1760:

> Inserted BEFORE the trailing "EXIT: n" line, not after it: batch mode decides a command failed by
> the result ENDING in a non-zero EXIT (batchStepFailed), and appending after it would quietly turn
> a failing assert into a "success" that lets the batch run on.

`withAssertEvidence` obeys that rule. The repeat notice, added later in the same file, does not.

### test_web (`agent.js:1235`)

Returns HTTP status, a count of controls clicked, `ERRORS:` (JS errors, console.error, HTTP ≥400),
and the visible text before and after clicking. Its failure signal is
`/\[JS ERROR\]|\[console\.error\]|\[HTTP \d/`. A page that throws nothing and draws nothing passes
clean — the code says so itself at :1391, and `see_screen` exists to cover it. The
"could not test at all" hole (`ERROR: puppeteer is not installed`, `ERROR loading the page`) was
already closed at :3705 by treating an `ERROR` result as still-needs-testing.

Still open, and documented as open in the code at :3240: three clean `test_web` calls auto-finish
the run from inside the tool handler, entering **no gate at all** — no ledger check, no plan-files
check, no visual check, no runtime verifier. It is stamped `finishKind: 'auto_clean_tests'` so it is
at least auditable.

### verify_project — the deciding path

`verifyProject.js` is what the finish gate calls to set `run.verified` (agent.js:3337-3354), and
`finishVerdict()` turns that into the recorded verdict `verified`. Its node and python branches:

```js
else if (r.ok) evidence.push(`\`node ${cand}\` ran and exited cleanly`);
...
else if (r.ok) evidence.push(`\`python ${cand}\` ran and exited cleanly${r.out ? ` — output: …` : ''}`);
```

`r.ok` is `!err`, i.e. exit 0. On success the captured stdout/stderr are **discarded** (the node
branch does not even quote them). So a workspace whose entry file prints 30 `Assertion failed:`
lines and exits 0 is stamped `Verified (node): \`node s3_matrix.js\` ran and exited cleanly`, and
the run is recorded as a verified finish. **The console.assert hole is not only in the advisory
tool the model reads — it is in the gate that decides.**

---

## B. Truncation: can `trimMid` cut out exactly the failure?

`trimMid(text, keep)` keeps `floor(keep*0.35)` of the head and the rest as tail, with a marker in
between. For stdout `keep = 6_000` → **2,100 head / 3,900 tail**; for stderr `keep = 1_500` →
525 / 975. A final guard caps the whole result at 9,000 characters, again head+tail.

Yes — demonstrated by running the shipped function on constructed output:

* A 300-case runner, 11,047 characters, one `FAIL:` line at case 150: **the failure line is
  removed**; the head is 60 lines of `passed`, the tail is 60 lines of `passed`. (In this case the
  runner's own last-line summary `299 passed, 1 failed` did survive, because it is the final line.)
* The worse shape — verdict in the middle, noise after it: 200 `passed` lines, then
  `SUMMARY: 1 FAILED`, then 200 `teardown step N complete` lines (12,614 chars). **`FAILED` does not
  survive.** Head and tail both read as a clean run.
* stderr at `keep = 1500`: a 4,660-character traceback keeps its final `AssertionError:` line (it is
  last) but loses the middle frames — the file and line that actually failed can be cut.

Mitigations that are real: the marker `… [N of M characters of stdout trimmed from the middle …]` is
always present, so truncation is never silent, and the exit code always survives — which is why this
is a second-order risk rather than a repeat of the pre-fix front-slice bug.

**Frequency in the real runs: 6 truncations in 111 exec calls (5.4%)**, all in the dense arm, all on
`node test_s5_expr.js`, all with `EXIT 1` already visible. `read_file`'s own "cut to fit" path fired
**0** times. So in these three arms truncation hid nothing; the exposure is structural, not realised.

One unverified code observation: `run_command`/`run_python` call `exec()` without a `maxBuffer`
option, so Node's 1 MB default applies; exceeding it kills the child and surfaces as a generic
failure. `verifyProject.js` sets 4 MB. Not exercised in these runs.

---

## C. The approval/allowlist environment, and whether refusals are actionable

The policy (`approvalPolicy.js`) is three-valued (allow / ask / deny), with a hard denylist that
applies in every mode, a composition denylist checked before splitting, and a quote-aware segmenter.
It is careful work and I found no bypass. The problem is not safety; it is **coherence and
actionability**.

### The incident, reconstructed

`trial35-ITTPNl/runs/d841ad44-853e-4831-9fea-e51e3542f451.json` — goal: add `parse_log`/`bad_lines`
to `s2_logs.py`. Status `stopped`, 30 model calls (the whole budget), 431 s wall time.

```
+64s  run_command "pytest test_s2_logs.py"
        STDERR: 'pytest' is not recognized as an internal or external command …   EXIT: 1
+69s  run_command "pip install pytest"
        STDOUT: Requirement already satisfied: pytest in …\LocalCache\local-packages\Python313\site-packages (9.1.1)
+71s  run_command "pytest test_s2_logs.py"        (identical, + repeat notice)
        STDERR: 'pytest' is not recognized …   EXIT: 1
+75s  approval_request  run_command
        "C:\…\PythonSoftwareFoundation.Python.3.13_…\python.exe -m pytest test_s2_logs.py"
        why: "it names a drive-absolute path"
+77s  approval_denied
+81s  run_python "test_s2_logs.py"   → worked, as it had at +21s, +34s, and did again at +98s, +106s
```

Confirmed on this machine: `pytest` is **not** on PATH (`command not found`), while
`python -m pytest` works and reports pytest 9.1.1. `pip` is right that the requirement is satisfied —
it is installed, just not on PATH. So all three messages the model received were individually true
and jointly useless.

### Is the environment coherent?

No, in one specific way: the allowlist's `BUILD` set contains `pytest`, `jest`, `vitest`, `mocha`,
`tsc`, `esbuild`, `vite`, `deno`, `bun` — commands the hub is willing to auto-run that **are not
installed or not on PATH**. The policy advertises a toolchain the environment does not provide.

### Is the refusal actionable?

No. Three separate messages had the fact the model needed and none carried it:

1. `'pytest' is not recognized` — the shell's message, passed through unchanged. It does not say
   `python -m pytest` works.
2. `Requirement already satisfied` — pip's message. It does not say "installed, but not on PATH".
3. `why: "it names a drive-absolute path"` — accurate about the rule, silent about the alternative.
   The deny wording at :3405 (`This will not be run under any approval mode. Achieve the goal another
   way.`) is the same shape.

`python -m pytest test_s2_logs.py` would have been **auto-allowed** (head `python` ∈ BUILD, build
mode), and `run_python` was working the entire time. The model was one allowlisted command from its
goal and nothing pointed at it. This is precisely the failure class the file elsewhere names — an
error that states the problem while withholding the fact needed to act on it (see the `list_assets`
commentary at :1324).

### Minor defect found in passing

`classifyCommand` initialises `worst = { decision: 'allow', reason: '' }` and only replaces it when a
segment ranks *strictly higher*. An all-allow command therefore always returns `reason: ''`, which is
why the run records read `policy_allowed … "auto-approved (build mode: )"` with an empty reason for
`pytest test_s2_logs.py` and `pip install pytest`, while `run_python` (a separate function) logs a
real sentence. Cosmetic, but it degrades the approval audit trail exactly where a human would look.

---

## D. read_file / outline_file / search_file line numbers — CORRECT

This matters most (edits are addressed by `LINES: a-b`), so I verified it two ways.

**1. The algorithms, replicated verbatim from `agent.js` and run against real files**
(`s5_expr.js` 239 lines, `s6_graph.py` 138, `s7_cache.js` 59, `approvalPolicy.js` 252):

* **1,257 numbered-line checks, 0 wrong.** Every `N: text` emitted by `read_file` and
  `outline_file` matches line N of the file exactly.
* `search_file`'s `path:line: text` numbers are **identical to independently computed ground truth**
  on all four files (11, 11, 6, 27 hits).
* Header arithmetic `[path — lines A-B of TOTAL]` is right in every window tested, including
  `OFFSET` 0 (treated as line 1) and `OFFSET` == line count (yields the single last line).
* Continuation is exact: a window ending at line 10 suggests `OFFSET: 11` and the next window begins
  at line 11 — no gap, no overlap.
* `>250` lines with no LINES/OFFSET correctly diverts to the MAP + first-30-lines path.

**2. Recorded results checked against the surviving workspaces.** A naive comparison appears to show
709 mismatches — **this is an artefact and not a bug**, and I want it on record so nobody re-derives
it as one. Per `read_file` call the deltas are 0 for the head of the window and a single constant
positive value for the tail (e.g. `s6_graph.py`: lines 1-39 delta 0, lines 43-83 delta 22), which is
the signature of content appended *below* the read point after the read. Of 66 read groups with ≥4
uniquely identifiable lines: 24 exactly right, 35 with deltas rising monotonically with line number,
7 "interleaved" only by ±1 dips caused by near-duplicate lines. No group shows the mixed small
deltas an indexing bug would produce.

Conclusion: **no off-by-one in read_file, outline_file or search_file.** Both known traps here
(the confident empty answer for a directory `PATH`, and regex-vs-literal in `search_file`) are
already fixed and the fixes are live.

---

## E. Stale answers that mislead

**1. The repeat notice destroys the failure verdict.** Covered in §A — the highest-impact staleness
bug found, because it changes a *decision*, not just wording.

**2. "Nothing changed, so repeating it cannot help" can be false about the file.** The notice keys on
`callKey = tool + JSON.stringify(args)` and, for non-mutating tools, on answer equality
(`seenBefore === answer`). Nothing consults file state. Two consequences:

* For `run_command`/`run_python`: the model edits a file, re-runs the same test, gets the identical
  failure, and is told the repetition "cannot help — do something different". The answer is indeed
  unchanged, but re-running a test after an edit is correct behaviour; the sentence discourages it.
  This is the shape visible in the §C incident.
* For `write_file` the answer is `OK: wrote N bytes to P` — a function of byte count and path only.
  Two writes of *different* content with the same length produce byte-identical answers, so
  `changedAnswer` is false and the model is told "Nothing changed" about a write that did change the
  file. `MUTATING_REPEAT` (`write_file`, `edit_file`, `append_file`) makes the notice fire on
  arguments, which is right; the *wording* is still chosen by answer equality.

Measured: 69 repeat notices across the three arms (MoE 15, dense 18, 14B 36), of which 28 carried the
"it did something DIFFERENT this time" wording (0 / 4 / 24). `run.callLog` persists for the whole
run, so a command legitimately re-run much later gets the same scolding.

**3. `run.verified` staleness is already handled** — `verifiedAt !== workspaceStamp()` re-verifies
after any change. Good, and the comment at :3350 records why.

---

## F. The cheapest mechanical fix

### F1 — the console.assert class (do all three; they are small)

**(a) At the source, in `run_command` and `run_python`.** Insert a line *before* the trailing
`EXIT:` line — the same discipline `withAssertEvidence` uses, and for the same reason:

```js
const zero = !err;
const failedAsserts = (String(stderr).match(/^Assertion failed:/gm) || []).length;
// …when composing `out`, before the EXIT entry:
zero && failedAsserts && `NOTE: this process exited 0, but its output contains ${failedAsserts} `
  + `"Assertion failed:" line(s). console.assert does NOT set an exit code — these assertions FAILED. `
  + `Use node:assert (or throw) if you want a failing test to fail the command.`,
```

**(b) At the classifier, `agent.js:2829`,** so the batch stops and the run cannot proceed on it:

```js
if ((tool === 'run_command' || tool === 'run_python') && /^Assertion failed:/m.test(r)) return 'printed failing assertions (console.assert does not set an exit code)';
```

**(c) At the deciding path, `verifyProject.js`** (node and python branches). Today success discards
the output. Change `else if (r.ok)` to check `r.err`/`r.out` for the same marker and push a
*problem*, not evidence. Without (c), the finish gate still stamps `verified` on a tree full of
failing assertions — this is the "fix the deciding path, not the advisory one" lesson, and (a)+(b)
alone would repeat it.

False-positive risk is low: the trigger is the literal Node prefix `Assertion failed:` at the start
of a stderr line *and* exit 0.

### F2 — the anchor bug (cheapest fix in the whole report, and it restores 10 real failures)

Either pass the unmodified answer to the classifier —
`batchStepFailed(tool, rawAnswer, syntaxNote)` at :3762, `rawAnswer` already exists at :3459 for
exactly this kind of reason — or insert the repeat notice before the `EXIT:` line the way
`withAssertEvidence` does. The first is a one-word change. Keep `result` as what the model sees.

### F3 — worth catching the same way, ranked by measured value

1. **`pytest.main([__file__])` inside a script** — exits 0 with `1 failed` in stdout; models write
   it (17 occurrences in `trial35-luu7T9`). Rule: exit 0 and `/^\s*\d+ failed\b/m` or
   `/^FAILED /m` in stdout → failure.
2. **`FAIL` / `FAILED` / `ERROR` printed at line start with exit 0** (the `console.error("FAIL: …")`
   shape) → at minimum a note.
3. **"no tests ran" / "NO TESTS RAN"** — already non-zero (pytest and unittest discover both exit 5),
   so it is visible today; only the wording needs surfacing.
4. **A unittest class defined but never run** — exits 0. Detectable only heuristically (source
   defines `TestCase` but output has no `Ran N tests`); lower priority, higher false-positive risk.

Not worth a rule, on measurement: unhandled promise rejections and unawaited rejected promises both
exit 1 on node v24 already; a `try/except` that swallows an assertion is indistinguishable from
correct error handling; Python warnings carry no signal about test outcome.

---

## Summary — every way a verification tool here can report success while the code is broken

**Confirmed by probe, invisible to the hub (exit 0, no other signal):**

1. `console.assert` fails — prints to stderr, exits 0. **5 calls / 13 failing assertions** in the
   evidence; 98 `console.assert` calls sit in the two arms' deliverables.
2. `pytest.main([__file__])` inside a script — prints `1 failed`, exits 0.
3. A `unittest.TestCase` that is never run; a test function defined and never called; a `__main__`
   guard that never matches.
4. A Python `assert` (or a node `assert`) swallowed by `try/except` / `try/catch`.
5. `console.error("FAIL: …")` with no thrown error.

**Reported as success by the hub's own machinery, regardless of what the code did:**

6. **The repeat-call notice appends after the `EXIT:` line, so the end-anchored classifier at
   `agent.js:2829` stops matching and a failing command is graded a pass — 23 occurrences, 10 with a
   genuinely non-zero exit, in two runs that went on to finish `verified`.**
7. `verifyProject.js` stamps `\`node X\` ran and exited cleanly` on exit 0 and **discards the output**,
   so the *finish gate* — not merely an advisory tool — converts every shape in 1-5 into a recorded
   `verified` finish.
8. Three clean `test_web` calls auto-finish the run from inside the tool handler, entering no gate
   (ledger, plan files, visual check, runtime verifier all skipped). Known and stamped
   `auto_clean_tests`.
9. `test_web` passes a page that throws nothing and draws nothing (known; `see_screen` covers it).

**Reported truthfully but uselessly, costing the run anyway:**

10. `pytest` is on the auto-allow list but not on PATH; `pip` says "already satisfied"; the absolute
    interpreter path is refused for naming a drive-absolute path — while `python -m pytest` was
    allowed and `run_python` worked throughout. One run burned its entire 30-call budget and 431 s.
11. "Nothing changed, so repeating it cannot help" is decided by answer equality and never consults
    file state; `write_file`'s answer depends only on byte count, so it can be literally false.

**Checked and found sound:** exit codes are always last and never dropped; stderr is never dropped;
truncation takes the middle, marks itself, and fired in only 6 of 111 exec calls (none hiding a
failure); and read_file / outline_file / search_file line numbers are exactly right — 1,257 checks,
0 wrong, with correct continuation offsets. The apparent 709 line-number mismatches against the
surviving workspaces are later edits shifting the files, not an off-by-one.
