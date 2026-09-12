# Audit 05 — the protective write guards

READ-ONLY audit, 2026-09-12. Nothing was edited, started, or killed.

Code under audit: `ai-coding-hub-indent/server/agent.js` (guard block 3442–3604),
`server/defNames.js`, `server/duplicateDecls.js`, `server/agentParse.js` (escape-hatch parsing).

Evidence read (not modified):
- `%TEMP%/trial35-cWxzHB/runs` — MoE, 18 runs
- `%TEMP%/trial35-Cq4RcJ/runs` — 14B, 16 runs
- `ai-coding-hub-setH/measurements/2026-09-12-setH/runs/coder14b-sethfix/runs` — 51 runs

85 runs, **43 refusal events** in total (12 destructive, 31 duplicate).

---

## Headline

1. **`append_file` bypasses both refusal guards**, confirmed and quantified. `beforeSrc` is
   captured only for `write_file`/`edit_file` (agent.js:3444), and every refusal is gated on
   `beforeSrc !== null`. Live proof: run `17cc6854` made **26 `append_file` calls to
   `s8_grades.py` and drew 0 refusals**; the file now holds **23 `def add_assignment`** in
   212 lines. The four other defs (`__init__`, `add_student`, `record`, `score`) appear once
   each, so 23 of 27 definitions in that file are the same dead duplicate.
2. **The destructive guard's central claim is never checked.** "Earlier steps depend on those"
   is a hardcoded string (agent.js:3538). No reference search exists anywhere in the block.
   In **11 of 12** destructive refusals the named symbols had **zero call sites** in the
   content the model proposed.
3. **`defNames` produces phantom definitions**, and they have already cost refusals. `it('x',
   function () {` is counted as a definition named `it`. Two setH refusals (`9b0ca9d1`,
   `f3f65610`) fired on `describe`/`it` in mocha test files — pure phantoms.
4. **Both escape hatches were used zero times in 85 runs**, while **15 of the 16 runs that hit
   a refusal ended `stopped`**. The refusals are a wall in practice, not a negotiation.
5. **Three whole executor paths have no guards at all**: the sub-task loop, the approve route,
   and every HTTP file route.

---

## E. Every code path that writes to disk, and what it passes through

The guard stack, in the order it runs inside `drive()` (agent.js 3486–3604):
`marker` → `syntax check` → `duplicateNote` (advisory) → **DESTRUCTIVE refusal** →
**DUPLICATE refusal** → `lostDefs` note (advisory) → `lostExports` note (advisory).

| # | Write path | Site | Destructive | Duplicate | Syntax | Marker | Checkpoint |
|---|---|---|---|---|---|---|---|
| 1 | `write_file` (drive loop) | 551 | yes | yes | yes | yes | yes |
| 2 | `edit_file` (drive loop, 5 write sites) | 664, 708, 721, 826, 833 | yes | yes | yes | yes | yes |
| 3 | **`append_file` (drive loop)** | 582, 611 | **NO** | **NO** | yes | yes | yes |
| 4 | **Sub-task loop** (`spawn_subtask`) | 2742 | **NO** | **NO** | **NO** | yes¹ | **NO** |
| 5 | **Approve route** `POST /:id/approve` | 4642 | **NO** | **NO** | **NO** | yes¹ | **NO** |
| 6 | **`download_file`** (arbitrary bytes to any workspace path) | 1043 | **NO** | **NO** | **NO** | **NO** | yes |
| 7 | `run_python` CODE → `_snippet.py` | 1139 | **NO** | **NO** | **NO** | **NO** | gated tool |
| 8 | `remember` → NOTES.md | 897 | n/a | n/a | n/a | **NO** | no |
| 9 | **`git_undo`** (restores whole tree) | 964 + gitUndo | **NO** | **NO** | **NO** | **NO** | pre-commit only |
| 10 | End-of-run syntax rollback | 3864, 3866 | **NO** | **NO** | yes² | **NO** | n/a |
| 11 | Guard's own restore | 3535, 3564 | n/a | n/a | n/a | n/a | n/a |
| 12 | **HTTP `POST /upload`** | 4754 | **NO** | **NO** | **NO** | **NO** | no |
| 13 | **HTTP `POST /upload-zip`** (Expand-Archive over workspace) | 4765 | **NO** | **NO** | **NO** | **NO** | no |
| 14 | HTTP `DELETE /files`, `POST /reset` | 4776, 4786 | **NO** | **NO** | **NO** | **NO** | no |

¹ marker guard lives inside the tool body, so it survives on any path that calls the tool.
² the rollback *is* the syntax repair; it reports `lostDefs`/`lostExports` as notes.

**Batch actions are safe.** `planBatch` (2781) feeds actions back through the *same*
per-action body in `drive()`, so items 1–3 keep their guards inside a batch. Verified at
3113 → guard block → 3759 `batch.completed++`.

### The two structural holes worth naming

**Sub-task loop (agent.js 2742).** `result = await tools[tool](args)` with no `beforeSrc`, no
`quickCheck`, no checkpoint. A sub-task can `write_file` a whole file away and nothing —
guard, warning, or record — fires. The parent only receives a prose summary, and the code
itself says "You did NOT see its steps". This is a strictly larger hole than `append_file`,
because it covers `write_file` and `edit_file` too.

**File-type gate.** Every refusal is gated on `/\.(py|c?js|mjs)$/i` (3444). `.html`, `.css`,
`.json`, `.ts`, `.tsx`, `.gd` get **no** destructive or duplicate protection on any path.
`s9_board.html` in the setH evidence is exactly this shape.

---

## A. What `defNames` actually detects — tested directly

Tested against a constructed file covering each form, plus real mocha/pytest shapes.

### JavaScript — found
function declarations (incl. `export`, `default`, `async`, generators), classes,
`const/let/var NAME = (…) => …` and `= function`, and indented class methods
(`static`/`async`/`get`/`set`/generator).

### JavaScript — MISSED (a guard that cannot protect)
| Form | Why |
|---|---|
| `arrowField = () => 1` (class field) | no pattern for class-field arrows |
| `#priv() {}` | `#` is not in `[A-Za-z_$]` |
| `const f = (\n a,\n b\n) => …` | params regex is `[^)\n]*` — single line only |
| `Foo.prototype.bar = function(){}` | no prototype pattern |
| `Object.assign(X, { … })`, `defineProperty` | not attempted |
| any `.ts`/`.tsx`/`.jsx` file | extension gate returns empty set |

A missed definition means **the file is silently unprotected for that symbol** — the write
that drops it is never refused and never even warned about.

### JavaScript — PHANTOMS (cause false refusals)
| Input | `defNames` says | Reality |
|---|---|---|
| `it('evicts', function () {` | `it` | a call, not a definition — **proven, cost 2 refusals** |
| `method(a) { … }` in an object literal | `method` | object property |
| indented `doThing(a) {` in any block | `doThing` | a call followed by a brace |
| a def inside a template string | counted | string content |
| Python `def x():` inside a docstring | counted | string content |

The class-method regex `^[ \t]+(…)?([A-Za-z_$][\w$]*)[ \t]*\([^)\n]*\)[ \t]*\{` matches any
indented `name(args) {`. `it('x', function () {` fits it exactly: `[^)\n]*` swallows
`'x', function (`, then `)`, then ` {`. That is the mocha false positive, mechanically.

### Python
Detects `def`, `async def`, `class` at **any** indentation. Decorators are correctly
transparent (the `def` beneath is caught). Misses lambdas bound to names.

**Structural flaw — no scope awareness.** `defCounts` is a flat tally, so:
- `def run` in class `A` and `def run` in class `B` → `run:2` (**proven**)
- a nested helper and a class method sharing a name → `helper:2` (**proven**)
- JS: `get(a)` in a class and `get(a)` in an object literal → `get:2` (**proven**)

Every one of these is a *legal* program that the duplicate guard will refuse.

---

## B. "Earlier steps depend on those" — nothing checks it

The sentence is a literal in the refusal string at agent.js:3538. The guard computes
`lostDefs`/`lostExports` on **one file** and then asserts a dependency it never looked for.

**Measured.** For each of the 12 destructive refusals I scanned the content the model actually
proposed for call sites of the names being protected (a call site = `name(` not preceded by an
identifier character, excluding the definition line itself):

| Run | File | Names | Call sites in proposed content |
|---|---|---|---|
| `c75eab5e` ×4 | s5_expr.js | getNumber, getNumberStart, getNumberEnd | **0** |
| `9b0ca9d1` | test_s7_cache.js | describe, it | **0** (phantoms) |
| `33f89f3c` ×2 | s3_matrix.js | Matrix | 0 (31-byte REPLACE) |
| `7a925499` ×2 | s6_graph.py | 7 names | 0 (**empty** REPLACE) |
| `f70d78c7` ×2 | s9_board.js | moveCard | 0 (32-byte REPLACE) |
| `57774903` | s7_cache.js | set | **1 — true positive** |

**11 of 12 refusals protected symbols the incoming code did not call.** Only one destructive
refusal had any evidence behind its claim.

**The confirmed false positive, verified end to end.** Run `c75eab5e`, goal "Create s5_expr.js
exporting evaluate(expr)". The model sent a self-consistent 3.1 KB rewrite four times (growing
to 7.8 KB) and was refused each time for dropping `getNumber`, `getNumberStart`,
`getNumberEnd`. In the surviving workspace those three names appear **exactly once each — on
their own `function` lines, with zero callers anywhere in the file or the workspace**:

```
s5_expr.js:127:function getNumber(expr, pos, left) {
s5_expr.js:153:function getNumberStart(expr, pos, left) {
s5_expr.js:172:function getNumberEnd(expr, pos, right) {
```

The guard preserved three dead private helpers, told the model earlier steps depended on them,
and the run ended `stopped`. The guard's restore is *why* the dead code is still there.

**It can be made true cheaply.** The workspaces here are ~13 files / a few thousand lines. One
`readdirSync` plus a substring scan of the sibling files for `name(` — the machinery
`search_file` already uses — would let the refusal either cite a real caller
(`s3_matrix.js:88 calls Matrix(`) or downgrade itself to a warning when there is none. That
single change converts 11 of 12 refusals in this sample from an assertion into a fact.

---

## C. `countBefore >= 1 && countAfter > countBefore` — soundness

| Case | Sound? | Evidence |
|---|---|---|
| rename (`f` → `f2`) | **yes** — `[]` | tested |
| move within a file | **yes** — `[]` | tested |
| genuinely new definition | **yes** (`countBefore` 0) | by construction |
| two classes sharing a method name | **NO** — `run 1->2` | tested; author-documented |
| Python nested helper vs class method | **NO** — `helper:2` | tested |
| JS class method vs object-literal key | **NO** — `get:2` | tested |
| def inside a template string | **NO** — `real 1->2` | tested |
| def inside a Python docstring | **NO** | tested |
| `//` and `#` comments | **yes** (anchored regex) | tested |
| JS overloads | n/a (no overloads in JS) | — |

The arithmetic is right; the **counter** is wrong. `defCounts` is scope-blind and
string-blind, so every unsoundness above is a counting error, not a logic error. Fixing the
count (skip string/comment regions, qualify class methods by their class) fixes the guard
without touching the comparison.

In this evidence the duplicate guard was mostly *correct*: 29 of 31 events were models
re-sending an existing class body as their `REPLACE` (e.g. `26c2665c` re-sending all 8
`s1_library.js` methods). Only the 2 mocha `describe`/`it` events were phantom-driven.

---

## D. The escape hatches — discoverable, parsed, and never used

**Discoverable: yes.** Both refusals end with the exact line to send —
`repeat the same action and add a line: REMOVE: <names>` / `DUPLICATE: <names>` — with the
names pre-filled. Both are documented in the system prompt (agentPrompt.js:77, 93).

**Parsed: yes,** for both tool shapes (agentParse.js:203–206 and 258–259), and correctly
hardened: the match runs against `outside`, the text *outside* fenced blocks, because a
markdown file documenting the convention once handed itself deletion rights (agentParse.js
143–144).

**Used: never.** Across 85 runs and 43 refusal events, `args.remove` and `args.duplicate` were
set **0 times**. (The `REMOVE:`/`DUPLICATE:` string counts in the transcripts — 43/35/125/182 —
are the hub's own refusal text and prompt echoed back in history, not model output.)

**Consequence — the refusal is a loop.** Of the 16 runs that hit at least one refusal,
**15 ended `stopped`**; only `8e7cf9aa` finished. Only 4 of 43 events were followed by any
successful write to the same path. The dominant pattern is verbatim resend: `c75eab5e` sent
the same refused write 4 times, `ac9bc89f` 4 times on `available`, `b483657b` 3 times on
`drop_lowest`, `26c2665c` 4 times on the same 8 names.

This is the exact failure shape recorded for every other refusal in this codebase (the
"matches 2 places" loop, the `NO CHANGE` loop): the message is correct, actionable on paper,
and does not change model behaviour. The hatch exists; nothing reaches for it.

---

## F. Records after a restore

**Correct:**
- The tool step (3755) records the **rewritten** `result` — the refusal text — so the step feed
  and the training trace are truthful about what happened.
- `run.destructiveRefused` / `run.duplicateRefused` survive to disk (`slimForDisk` only
  truncates oversized `args`).
- The rollback's `landedWrites` predicate requires `/^OK/`, so a refused write correctly does
  **not** count as this run's work when the repair computes its floor.
- The restore is ordered safely: `writeFileSync(beforeSrc)` precedes `result = ERROR`, so if
  the restore throws, the swallowing `catch` leaves the *original* OK result standing and the
  message still matches the disk.

**Inconsistent:**
1. **A checkpoint step claims a write that was rolled back.** Checkpoints are pushed *before*
   the tool runs (3172–3173). Every refusal in the evidence carries 1–7 prior `checkpoint`
   steps, at least one of which reads `before write_file: …` for a write that never landed.
2. **Run flags are set before the guards and never unwound** (3490–3510):
   `run.needsTest = true`, `run.lastPath = args.path`, and `run.touchedWeb` / `run.webPage`.
   So a run whose only write was refused is still marked as needing a test and as having
   touched web content.
3. **`lastPath` leakage is the one with teeth.** `parseAction(raw, run.lastPath)` resolves a
   `PATH`-less action against `lastPath`. A refused write sets `lastPath` to a file it never
   changed, so a subsequent `PATH`-less action silently retargets there.

---

## Recommendations, in the order they buy the most

1. **Capture `beforeSrc` for `append_file`.** One clause at 3444. Closes the largest measured
   hole (23 duplicate defs in one file, 0 refusals).
2. **Route the sub-task loop (2742) through the same guard block,** or forbid mutating tools
   inside sub-tasks. It is currently a larger hole than `append_file`.
3. **Verify the dependency claim before asserting it.** Scan sibling files for `name(`; cite a
   real caller or downgrade to a warning. Would have spared 11 of 12 destructive refusals here.
4. **Make `defNames` scope- and string-aware** — strip strings/comments, qualify class methods
   by class. Kills the `it`/`describe` phantom and the two-classes-one-method false positive.
5. **Do not set `lastPath` / `needsTest` / `touchedWeb` until the write survives the guards.**
6. Extend the guards past `.py|.js|.mjs`, and give the HTTP upload routes at least the marker
   guard.

---

## False-positive rate estimate

Counting refusal **events** (43) across 85 runs:

| Guard | Events | Provably / near-certainly false | Rate |
|---|---|---|---|
| Destructive | 12 | 5 (`c75eab5e` ×4 dead helpers, `9b0ca9d1` phantom `describe`/`it`) | **42%** |
| Duplicate | 31 | 2 (`f3f65610` phantom `describe`/`it`) | **6%** |
| **Both** | **43** | **7** | **16%** |

Counting distinct *incidents* (run + file, collapsing verbatim resends): 2 of 6 destructive
incidents false (**33%**), 1 of 17 duplicate incidents false (**6%**), **3 of 23 overall (13%)**.

Caveat on the destructive figure: "no call sites in the proposed content" is necessary but not
by itself sufficient — a sibling file could call the symbol. For the flagship case
(`c75eab5e`) I verified workspace-wide and found zero callers, so it is false beyond doubt;
the `9b0ca9d1` case is false by construction (the names are not definitions at all). The
remaining 6 destructive events were real deletions, though caused by the edit engine sending a
0–32 byte `REPLACE` over a whole class rather than by model intent.

The structural false-positive classes proven in code — two classes sharing a method name,
Python nested helper vs method, defs inside strings — did **not** occur in this sample, so the
16% is a floor, not a ceiling, for codebases with those shapes.
