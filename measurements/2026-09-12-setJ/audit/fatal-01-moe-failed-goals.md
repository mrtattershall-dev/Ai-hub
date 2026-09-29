# fatal-01 — forensics on the four goals the MoE failed in set J

Subject: `Qwen3-Coder-30B-A3B-Instruct` ("coder3"), run `coder30b-setj`, 14/18 in set J.
Scope: goals 4, 5, 14, 15 (the four attempted-and-failed). Read-only audit.

**Headline: three of the four are the MODEL, one is MIXED. No goal was lost to a hub defect
alone.** The most valuable recoverable pair (4 + 14) is a model comprehension failure that a
finish gate could have caught; the biggest hub defect (the destructive-write guard refusing a
model's own dead helpers) wasted 5 of 30 calls but is not provably the reason goal 5 failed.

Two facts that kill the most attractive hub hypotheses before they start:

* **The goal text was never truncated or dropped.** `agent.js:4081` puts the full goal in
  `history[1]`; `pruneHistory` (`agent.js:2230-2240`) preserves it *by marker*, not index:
  `const goal = h.find(m => m.role === 'user' && /GOAL:/.test(m.content || ''))`. Both goal-4
  and goal-14 runs had `ctxSquashes: 0`. The transcript's `sent` field looks like the goal
  vanishes after turn 1 — it does not: `agent.js:2816` logs
  `sent: run.transcribed ? msgs.slice(lastSaid + 1) : msgs`, i.e. **deltas** after the first
  turn. The model saw `<p>...</p>` and "always a block of its own" on every single call.
* **No correct version of either file ever existed on disk.** `workspace.bundle` in
  `runs/coder30b-setj/` is from an *earlier, longer* set (271 commits, mentioning `topo_order`,
  `drop_lowest`, `dueDay` — goals 21+); none of this run's checkpoint hashes (`92d39dd`,
  `9670f0d`, `2c412b8`, `4ba4a93`, `8f0b897`, `660f12b`, `d07ad8e`, …) resolve in it, and the
  final workspace has no `.git`. The per-step `write_file`/`edit_file` args in the run JSONs are
  therefore the authoritative history, and they show a monotone path — see E under each goal.

---

## Goal 4 — `s4_markdown.py`, paragraphs. **MODEL.**

Run `e7e990f0-481e-4e8f-a1eb-0ca621cc9462`, 8 of 30 calls used, `status: done`,
`finishKind: verified`. Budget was never a constraint.

**A. Checker vs. file.** `tools/checks-J.mjs` S4 `s1()`:

```python
if h("Hello world") != "<p>Hello world</p>": return "one paragraph " + repr(h("Hello world"))
```

Run against the final file, `to_html("Hello world")` returns `'Hello world'`. No `<p>` anywhere
in the file. `s4_markdown.py:29` is the whole defect:

```python
processed_blocks.append(escaped_line)     # want: f'<p>{escaped_line}</p>'
```

The goal stated it verbatim: *"blocks separated by blank lines become `<p>...</p>` paragraphs"*.

**B. Where it went wrong — call 1 of 8.** The plan (step 1) even says
`"Converts markdown text to HTML with paragraph wrapping and HTML escaping"` and
`"Implement block splitting and paragraph wrapping"`. Then the single `edit_file` at step 5 wrote
the body with no wrapping *and* wrote asserts that encode the wrong contract:

```python
assert to_html("Hello\nWorld") == "Hello World"          # should be "<p>Hello World</p>"
assert to_html("Hello\n\nWorld") == "Hello\nWorld"
```

Everything after step 5 (run, task_done, list_dir, re-read, finish) merely confirms the model's
own wrong asserts. It never went wrong at a *later* call; it went wrong at the only one.

**C. Model or hub.** Model. No refusal, no lost edit, no truncation, no missing context. The one
tool answer that is genuinely misleading — step 9's `task_done` returning
`OK: "HOW TO VERIFY: Run \`node s1_library.js\` and check that all asserts pass" done - that task
was LEFT OVER from earlier work in this workspace` — is noise from a shared TASKS.md, and it
arrived *after* the code was already written.

**D. What would have had to be different.** Nothing in the hub *blocked* this. But the hub
actively *blessed* it: `agent.js:3199-3211` is the finish gate's "everything else has to actually
RUN" branch —

```js
const goalEntry = ledger.namedFiles(run.goal || '').find((f) => /\.(py|c?js|mjs)$/i.test(f) && existsSync(join(WORKSPACE, f)));
const v = await verifier.verify(WORKSPACE, { entry: goalEntry });
...
pushStep(run, { type: 'note', text: `Verified (${v.kind}): ${v.evidence.join('; ')}` });
```

which produced `Verified (python): all 5 source file(s) pass a syntax check; \`python
s4_markdown.py\` ran and exited cleanly — output: All tests passed!` and set
`finishKind: "verified"`. The gate proves *the model's own asserts pass*. When the model wrote
both the code and the test, that is worth nothing — this is the known
model-self-verification gap, now observed inside the gate rather than in a tool result.
The change that recovers it is at **agent.js:3199-3211**: before accepting `v.ok`, extract the
literal tokens the goal quotes (`<p>...</p>`, `<h1>`, `&amp;`) and require that they appear in
the produced *output*, refusing to finish with "the goal says the output contains `<p>...</p>`;
your file never emits it". That is a goal-vs-artifact check, not a goal-vs-model-opinion one.

**E. Had it right, then lost it?** No. Steps 2→5 go TODO-stub → final body in one edit; the
stub had no `<p>` either. Nothing was lost.

---

## Goal 14 — `s4_markdown.py`, headings. **MODEL. Double-failure; inherits goal 4.**

Run `480ec4e6-8372-4ec1-a061-db5327ef423b`, 8 of 30 calls, `finishKind: verified`.

**A. Checker vs. file.** S4 `s2()`:

```python
got = h("# Title" + NL + "text under it" + NL + "## Sub" + NL + NL + "### Small")
if got != NL.join(["<h1>Title</h1>", "<p>text under it</p>", "<h2>Sub</h2>", "<h3>Small</h3>"]): ...
```

Actual, from the final file:

```
'# Title text under it ## Sub\n<h3>Small</h3>'
```

Two independent defects in one line, `s4_markdown.py:13`:

```python
if len(lines) == 1 and re.match(r'^#{1,3} .+', lines[0]):
```

`len(lines) == 1` means a heading is only recognised when it is *already* alone in a
blank-line-delimited block — the exact opposite of the goal's *"it is always a block of its own,
**even with no blank line around it**"*. And the `else` branch still emits no `<p>`, so even a
perfect heading split would have failed this step on `<p>text under it</p>`.

**B. Where it went wrong — call 2 of 8** (the `edit_file` at step 5). The model read the file
first (steps 2-3, correctly), then chose the `len(lines) == 1` guard. At step 9 it added five
heading asserts, and every one of them tests a heading *that is already alone in its own block*:

```python
assert to_html("# Hello") == "<h1>Hello</h1>"
assert to_html("# Heading\n\nNormal text") == "<h1>Heading</h1>\nNormal text"
```

It never tested the one case the goal is actually about. The remaining calls re-ran and re-read.

**C. Model or hub.** Model. The only hub message in the run is a *correct* one — step 12:
`⚠️ You already ran this exact run_python in this run and got exactly this answer.`

**D. What would have had to be different.** Same single change as goal 4, **agent.js:3199-3211**.
A literal-token check on the goal ("`<h1>`, `<h2>`, `<h3>`") would fire here too, and a
"the goal says *even with no blank line around it* — show me that input" prompt is the same
mechanism. Note the coupling: **fixing the `<p>` bug alone does not recover goal 14** (it also
needs the mid-block split), and fixing the split alone does not either (it needs `<p>`). One gate
that forces the model to test the goal's own stated edge case is the only single change that
plausibly recovers **both 4 and 14** — the double-weight item in this audit.

**E. Had it right, then lost it?** No. One monotone edit; the `len(lines) == 1` guard was present
from the first version of the heading code and never removed.

---

## Goal 5 — `s5_expr.js`, evaluator. **MIXED — model lost it, hub burned 7 of 30 calls.**

Run `c75eab5e-76c5-41f7-ae7c-0d621a11c76f`, **30/30 calls, `status: stopped`,
`finishKind: not_finished`**, `destructiveRefused` ×4, `repeatCalls: 3`.

**A. Checker vs. file.** S5 `step 1` — I executed the final file against every case in it. **It
passes all seven arithmetic cases and three of the four throw-cases. Exactly one assertion
fails:**

```js
for (const bad of ['1 +', '', '2 3', '1 * * 2']) if (!throws(() => ev(bad))) return JSON.stringify(bad) + ' did not throw';
```

| case | want | got |
|---|---|---|
| `1 + 2 * 3` … `  7  ` (7 cases) | 7, 2.5, 3, 26, 3, 2, 7 | all correct |
| `1 / 0` | throws | throws "Division by zero" |
| `1 +` / `""` / `1 * * 2` | throw | throw |
| **`"2 3"`** | **throws** | **returns `23`** |

Cause: `s5_expr.js:10` `expr = expr.replace(/\s/g, '')` turns `"2 3"` into `"23"`, and nothing
downstream objects. The goal said *"throws an Error … for anything it cannot parse"*.

**B. Where it went wrong.** The model never went wrong on this case — **it never considered it.**
Its own 18 asserts (appended at step 18) cover precedence, decimals, left-to-right, spaces,
div-by-zero, `"invalid"`, `""` — no two-operands-no-operator case. Calls 20-50 were spent on real
bugs it *had* found (a token-splice bug giving `2 + 3 * 4 === 142`, fixed by step 43) and it ran
out of budget at step 50 mid-fix.

**C. Model or hub. Hub contribution is real and measurable, but not decisive.**
The hub's destructive-write guard refused four whole-file rewrites:

```
ERROR: this write_file would have REMOVED 3 thing(s) s5_expr.js already had:
getNumber, getNumberEnd, getNumberStart. s5_expr.js is UNCHANGED - nothing was written.
```

`getNumber`, `getNumberStart`, `getNumberEnd` are **helper functions the model itself wrote
minutes earlier in the same run** (step 7), never exported (`module.exports = { evaluate }`), and
its rewrite deleted their callers along with them — the replacement was self-consistent. I read
the refused content at step 10: it is a complete, coherent evaluator with `module.exports =
{ evaluate }`. The guard was protecting the model's own scaffolding from the model's own cleanup.

Cost, itemised:

| steps | what | calls |
|---|---|---|
| 10, 12, 15, 26 | four identical `write_file` refusals | 4 |
| 16 | `edit_file` with no FIND — the flailing response to the refusal | 1 |
| 20-21, 32-33 | `run_python` on a `.js` file → Python `SyntaxError` | 2 |
| | **total wasted** | **7 of 30** |

Consequence beyond the call count: forced off `write_file`, the model used `append_file` at
step 18, which put `runAsserts()` **after** `module.exports` (`s5_expr.js:184`) and left ~60
lines of dead `getNumber*` helpers in the file permanently — which then cluttered every
`outline_file` and `read_file` in goal 15.

**D. What would have had to be different.** Two named sites:

1. **`agent.js:3380-3392`** (the `if (all.length)` refusal built from
   `lostDefs`/`lostExports`, `server/defNames.js:35` and `:73`). The guard has exactly one
   exemption today — an explicit `REMOVE:` line. It needs a second: **do not refuse when every
   lost name is (a) not in `exportNames(before)`, (b) absent from the new content's references,
   and (c) not referenced by any other workspace file.** All three hold for `getNumber*`. The
   guard exists because of set F goal 81, where a rewrite dropped eight *exported, cross-file*
   names — that case still trips clause (a) and stays refused. This is the fix with the broadest
   reach in this audit (it is the same guard that produced 4 of this run's 5 recorded errors).
2. **`agent.js:1041-1051`** (`run_python`). After
   `if (!target) return res('ERROR: provide CODE ... or PATH to a .py file.')`, add
   `if (!/\.py$/i.test(target)) return res('ERROR: run_python runs Python. For ' + target + ' use run_command: node ' + target + '.')`.
   Costs nothing, saves 2 calls here and 1 in goal 15, and prevents the `_snippet.py` damage
   described under goal 15.

**Honest ranking: neither change is traceable to this lost goal.** Seven more calls would have
gone to the `142` bug the model was actually chasing; nothing in the transcript suggests it was
about to discover `"2 3"`. Goal 5 is **model** on the deciding path, **hub** on the budget.

**E. Had it right, then lost it?** No. The `"2 3"` hole is present in the first implementation
(step 7) and in every version after it, including the four refused rewrites — `replace(/\s/g,'')`
is line 10 of all of them.

---

## Goal 15 — `s5_expr.js`, parentheses + unary minus. **MODEL. One case, wrong line, 30 calls.**

Run `66fb8638-d9c3-4ee6-ad9e-7dd057eba7af`, **30/30 calls, `status: stopped`,
`finishKind: not_finished`**, `repeatCalls: 4`.

**A. Checker vs. file.** S5 `step 2`. Executed against the final file — **again exactly one
failure**:

| case | want | got |
|---|---|---|
| `-(2+3)*2` | -10 | **-10** |
| **`2*-3`** | **-6** | **throws "Invalid expression"** |
| `(1 + 2) * (3 + 4)` | 21 | 21 |
| `-3` | -3 | -3 |
| `2 * (3 + (4 - 1))` | 12 | 12 |
| `(1 + 2` / `1 + 2)` | throw | throw |

The goal named both cases explicitly: *"'-(2+3)*2' is -10 and '2\*-3' is -6"*. It got one.

**B. Where it went wrong — and this is the interesting part: the model debugged the wrong line
for eleven calls.** Its edit at step 17 fixed `-(2+3)*2`; from step 20 onward every test printed
the same two lines:

```
Testing '-(2+3)*2':  Result: -10
Testing '2*-3':      Error: Invalid expression
```

`2*-3` never reaches the unary-minus code. It is rejected ~40 lines earlier by
**`s5_expr.js:22-25`**, written back in goal 5:

```js
// Check for invalid patterns
if (expr.match(/[\+\-\*\/]{2,}/) || expr.match(/[+\-*/]$/)) {
    throw new Error("Invalid expression");
}
```

`*-` is two operators in a row. I verified this directly: `2*-3` → `InvalidPattern (EARLY
GUARD)`, while `-(2+3)*2` and `-3` reach the unary code. Every one of the model's four edits
(steps 17, 21, 31, 39) touched the *unreachable* unary block. Its own step-38 debug even proved
its regex worked — `After line 66: 2*0-3` — and it still concluded the regex was the problem.
The one-line fix it never made: exempt a `-` that follows an operator from that guard.

**C. Model or hub.** Model on the deciding path. The hub's diagnostics were *correct* throughout
(4 repeat-notices, and step 31's duplicate warning `"// Handle unary minus..." still appears 1
time in the file - your REPLACE put it back`). But the budget it ran out of was partly spent on
hub-side avoidable waste:

| steps | what | calls |
|---|---|---|
| 4-6 | `node test_simple.js` → **Cache class tests**, then reading it to find out why | 3 |
| 23-24, 26-27, 33-34 | identical re-runs of `test_evaluate.js` (`repeatCalls: 4`) | ~3 |
| 46-47 | `node test_simple.js` again → Cache tests again | 1 |
| 48-49 | `run_python` with **JavaScript** in `CODE` → wrote `_snippet.py`, Python `SyntaxError` | 1 |

`test_simple.js` is a shared scratch filename clobbered across chains — written by goal 7 (Cache
tests, 2756 bytes), edited by goal 12, overwritten by goal 5 (597 bytes of s5 debug), and by the
time goal 15 ran it held the Cache tests again. The model asked the workspace a reasonable
question and got another project's answer.

The `run_python` call at step 48 also created `_snippet.py`, which is why the run ends with:

```
_snippet.py does not parse and no version this run produced parses either, so it was left as the
run left it rather than reaching back past this goal. This run did not finish cleanly.
```

The end-of-run repair was defeated by a junk file the hub itself created from a mis-routed call.
(`s5_expr.js` itself was not rolled back — the step-50 edit is on disk — so this did not change
the score.)

**D. What would have had to be different.** The `run_python` extension guard
(**agent.js:1041-1051**, above) covers step 48 and the `_snippet.py` damage. Nothing in the hub
would have found the early guard for the model. The honest answer is that this goal needed the
model to read its own error path, and it had 30 calls and the whole file in front of it (it read
`s5_expr.js` in full at steps 16, 29 and 45).

**E. Had it right, then lost it?** **No — verified, and this is worth recording because it looks
like a loss and is not.** At step 31 the model added a third rule
(`expr.replace(/(?<=\d)(-)(?=\d)/g, '+0$1')`) and at step 39 removed it again (`-2 lines`). That
looks like "had it, lost it". It is not: `2*-3` never reached that line either, so the step-31
version failed the same case in the same way. The step-39 revert cost nothing. No correct version
of `2*-3` ever existed in this run.

---

## Ranking, by goals recoverable

**1. HIGH — a finish gate that checks the artifact against the goal's own literals.**
`agent.js:3199-3211`. **Recovers goals 4 and 14 (double-weight: same file, both steps of chain
4).** Both runs finished in 8 of 30 calls, were told `Verified (python): ... All tests passed!`,
and `finishKind: "verified"` — on the strength of asserts the model wrote to match its own
misreading. The goal strings contain the literal answers (`<p>...</p>`, `<h1>`, *"even with no
blank line around it"*) and the gate never compares them to anything. This is the only change in
this audit that maps to two lost goals, and both were lost with 22 calls of budget unspent.

**2. MEDIUM — the destructive-write guard must exempt a run's own unexported scaffolding.**
`agent.js:3380-3392` + `server/defNames.js:35,73`. **Recovers 0 goals directly; returns 5 of 30
calls in goal 5 and removes the `append_file`-after-`module.exports` deformation that polluted
goal 15's file.** Ranked MEDIUM not HIGH precisely because I cannot trace it to the lost
assertion: goal 5 died on `"2 3"`, which the model never tested. Per the brief's bar, the
goal-costing claim is **not** proven — this is a budget finding. It is ranked second because it
is the defect with the clearest mechanism and it fired 4 times in one run.

**3. LOW — `run_python` accepts a non-`.py` target.** `agent.js:1041-1051`. Three wasted calls
across the two runs, and it manufactured the `_snippet.py` that defeated goal 15's end-of-run
repair. A two-line fix with no downside, but no goal traces to it.

**4. LOW — shared scratch filenames across chains.** `test_simple.js` was written by goal 7,
edited by goal 12, overwritten by goal 5, and served Cache tests to goal 15 twice (~4 calls).
Worth a per-goal scratch namespace, but no goal traces to it.

### What this says about the ceiling

Both goal 5 and goal 15 failed **one assertion each** out of twelve and seven respectively, and
both ran out of budget at exactly 30 calls. Both goal 4 and goal 14 failed with **22 of 30 calls
unspent** and a green "verified" from the hub. Those are two different ceilings, and the second
is the cheaper one to raise: the MoE does not need more calls on chain 4, it needs to be told
that "it ran and printed All tests passed" is not the same as "it does what the goal said".
