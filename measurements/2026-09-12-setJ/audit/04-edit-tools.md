# Audit 04 — the file-mutation tools (`edit_file`, `write_file`, `append_file`)

Target: `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js`
git `3d7a080` ("A no-op refusal shows the region, and says the edit may already have landed"), md5 `d53b1f230cb00bbac719ab6343be6c06`, 4818 lines. Verified at audit time.

Landmarks as found (the brief's approximations were all correct within a line):
`write_file` 517-553 · `append_file` 575-613 · `edit_file` 618-881 · LINES path 654-671 · exact + OCCURRENCE 700-723 · `find === replace` 714 · `findLines` 729 · `regionAnchor` 762 · `reindentTo` 764-776 · `scanTolerant` 778-790 · `preview` 794 · `noChangeAt` 812-816 · tolerant splice sites 824 / 831.

Method: rather than retype the logic, the harness slices the three functions' source text straight out of `agent.js` and `new Function`s them, and builds a live `edit_file`/`write_file`/`append_file` bound to a throwaway workspace. Every claim below is output from running the shipped code, not from reading it. Scripts live in the session scratchpad (`edittools/harness.mjs`, `t_abc.mjs`, `t_defg.mjs`, `t_real.mjs`). Nothing in either serving tree or either evidence tree was modified.

---

## Severity summary

| # | Finding | Sev | Proven by |
|---|---------|-----|-----------|
| 1 | Tolerant edit silently deletes the blank line(s) above the matched region | **HIGH** | real run `ed679f69` + reproduction |
| 2 | Blank-swallow also defeats the no-op refusal → `OK: edited` for a no-op | **HIGH** | fixture B2 |
| 3 | `append_file` skips both destructive REFUSALS (not just the duplicate one) | **HIGH** | real run `17cc6854`, 22 identical appends |
| 4 | `LINES: 1-N` + empty REPLACE empties any non-`.py/.js` file, answered `OK` | **HIGH** | fixture D2 |
| 5 | LINES accepts a phantom last line (`b = len+1`), eating the trailing newline | MED | fixture D1 |
| 6 | `findLines`' gutter-stripper eats real numeric-key code lines | MED | fixture C1 |
| 7 | OCCURRENCE counts non-overlapping, indexes overlapping | MED | fixture E1 |
| 8 | `reindentTo` flattens mixed tab/space nesting (min by length, not width) | MED | fixture A3 |
| 9 | Tolerant delete leaves a stray blank line (LINES delete does not) | MED | fixture B4 |
| 10 | REPLACE with a trailing newline inserts a blank line, accumulating | LOW | fixture D3 |
| 11 | CRLF: no normalisation anywhere; edits and appends mix endings | LOW | fixtures A8 / F |
| 12 | OCCURRENCE silently ignored when the exact match is unique | LOW | fixture E2 |

---

## A. `reindentTo` + `regionAnchor` — one day old

**They cannot corrupt characters.** Brute force over every combination of `{'', ' ', '  ', '\t', '\t\t', ' \t', '\t '}` for three lines × four anchor indents — **1372 cases, zero non-whitespace loss**. The reason is structural and worth recording so a later change does not break it: `own` is the *minimum-length* leading-whitespace run across REPLACE's non-blank lines, so for every line it rewrites, `l.slice(own.length)` can only ever remove whitespace. Blank lines are returned untouched, and an empty REPLACE returns `''` unchanged.

The specific cases the brief asked for:

| case | in | out | verdict |
|---|---|---|---|
| spaces → deeper spaces | `function f() {\n  return 1;\n}` | correctly shifted, internal structure kept | OK |
| tab target | anchor `\t\t` | `\t\tfunction f() {` … | OK |
| empty REPLACE (deletion) | `''` | `''` | OK (but see B/finding 9) |
| first line NOT least-indented | `        deep_first\n  shallow\n        deep` | relative depths preserved | OK — anchoring on the min, not the first line, is doing real work here |
| blank lines inside REPLACE | `  a\n\n  b\n   \n  c` | blanks passed through verbatim, incl. the whitespace-only `   ` | OK |
| CRLF text | `  a\r\n    b\r` | `\r` preserved as content | OK |
| single-line region | `x = 1` | `\tx = 1` | OK |
| already at target indent | — | returned identical (`own === target` fast path) | OK |

**Finding 8 (MED) — mixed tabs and spaces flatten nesting.** `own` is the minimum by `.length`, i.e. a *character count*, not a visual width, and the slice removes that many characters:

```
in : "  outer\n\t\tinner_two_tabs\n\t\t\tinner_three_tabs"
out: "    outer\n    inner_two_tabs\n    \tinner_three_tabs"
```

`own` is `"  "` (length 2, from `outer`), so two *tabs* are sliced off the nested lines. `inner_two_tabs` ends up at the *same* indent as `outer`. In Python this is an `IndentationError` or, worse, a silent change of which block a statement belongs to. It needs REPLACE to mix tabs and spaces, which a model does when it copies part of a file and hand-types the rest. The characters survive; the *structure* does not.

**`regionAnchor` is correct and the comment above it is accurate.** `regionAnchor(['zero','','    two','  three'], 1, 3)` returns `"    two"` — it skips the blank that `scanTolerant` put at `start`. The degenerate case (`undefined`, an all-blank region) would make `target` `''` and flatten the block to column 0, but it is **unreachable**: needles are non-blank by construction (`.filter(Boolean)` at :729), so a matched region always contains a non-blank line.

One reachable variant of that flattening: a region whose first non-blank line is indented with **non-breaking spaces**. `/^[ \t]*/` reads NBSP indentation as length 0, while `.trim()` happily removes it — so the region matches, the anchor reads as column 0, and REPLACE is flattened. Verified: `'\u00a0\u00a0x'.match(/^[ \t]*/)[0] === ''`.

---

## B. `scanTolerant` bounds — the biggest finding

`scanTolerant` skips blank lines *while matching* but anchors the region at the loop index `i` (:787 `at.push({ start: i, end: fi - 1 })`). Because the outer loop tries every `i` in ascending order and blank lines are skipped for free, **the first `i` that matches is the first line of the contiguous blank run immediately above the real match** — not the first code line.

```
file:    ["class A {", "", "", "    shape() {", "        return 1;", "    }", "}"]
needles: ["shape() {", "return 1;", "}"]
matches: [{"start":1,"end":5}]      <- start 1 is the first blank, not 3
```

The splice at :824/:831 is `[...fileLines.slice(0, m.start), <replace>, ...fileLines.slice(m.end + 1)]`, so **every blank line in `[start, end]` is deleted**. Two consequences, both confirmed end to end:

### Finding 1 (HIGH) — blank lines belonging to the surrounding code are destroyed

This is not a rare path. It fires on essentially every tolerant edit into idiomatic code, because idiomatic code puts a blank line between methods.

**Reproduced from the real run.** `trial35-8XrYOc` run `ed679f69` (dense 32B, goal "Create s3_matrix.js exporting a Matrix class"). Four tolerant edits; the arithmetic on the answers is the tell — for two of them the model sent a 3-non-blank-line FIND and a 3-non-blank-line REPLACE, so the expected delta is `+0`:

```
FIND "shape() {\n  // Shape logic will go here\n}"  REPLACE 3 lines  ->  "now 39 lines (-1)"
FIND "toArray() {\n  // ToArray logic..."           REPLACE 3 lines  ->  "now 40 lines (-1)"
```

Rebuilding that skeleton and replaying those exact two edits through the shipped code reproduces it exactly:

```
  4|   }
  5|                     <- blank between constructor and shape
  6|   shape() {
...
=== edit shape: FIND 3 non-blank -> REPLACE 3 non-blank (expected +0)
ANSWER: OK: edited s3_matrix.js (matched ignoring indentation); now 19 lines (-1).
blank lines in file: 5 -> 4   (-1)
```

Final file: `}` on line 4 is followed *immediately* by `shape() {` on line 5, and `}` on line 11 by `toArray() {` on line 12. The model asked to fill in two method bodies and also, without being told, had two blank separators deleted. Interior blanks go the same way — needles `["FOO","BAR"]` against `a / FOO / '' / '' / BAR / b` match as region 1-4 and the two blank lines are spliced out.

### Finding 2 (HIGH) — the blank-swallow defeats the no-op refusal added today

`noChangeAt` (:812) fires only on `out === content`. When a blank line was swallowed, `out !== content` *even if REPLACE reproduces the matched region byte for byte* — so the brand-new "THE EDIT HAS ALREADY LANDED" refusal cannot fire in exactly the situation it was built for:

```
BEFORE  "class A {\n\n    shape() {\n        return 1;\n    }\n}\n"
FIND    shape()/return 1/}        REPLACE  the same three lines, correctly indented
ANSWER  OK: edited b2.js (matched ignoring indentation); now 6 lines (-1); "shape() {" still appears 1 time...
AFTER   "class A {\n    shape() {\n        return 1;\n    }\n}\n"
NO CHANGE refusal fired? false
```

The only thing that changed on disk is a deleted blank line, and the tool reported `OK: edited`. This is the silent-failure shape from MEMORY: the answer says the edit landed, the model moves on, and what actually happened is not what it asked for. Note the interaction with :714's `find === replace` guard — that one compares the *request* to itself and is untouched by this; the region-level check is the one that is defeated.

The no-op refusal *does* work when there is no blank above the region (verified: resending the landed `shape()` edit returned the full `NO CHANGE … THE EDIT HAS ALREADY LANDED` text with correct line numbers). So today's fix is real, just holed.

One more consequence: `noChangeAt` and the ambiguous-match `preview()` both report `m.start + 1`, which on a swallowed match is **the blank line's number**, one or more lines above the code the model is looking at. The advice "use `LINES: start-end`" therefore hands the model a range that begins on the wrong line.

### Finding 9 (MED) — a tolerant delete leaves a stray blank line

`reindentTo('', anchor)` returns `''` (documented, and pinned by `emptyReplace.test.mjs`), but the splice inserts that `''` as an **array element**, i.e. one empty line:

```
BEFORE  "a();\nkeep1();\nkill1();\nkill2();\nkeep2();\n"
FIND    "kill1();\nkill2();"   REPLACE ""
ANSWER  OK: edited b4.js; now 5 lines (-1).
AFTER   "a();\nkeep1();\n\nkeep2();\n"
```

Two lines were named for deletion and the net change is −1, because a blank replaced them. `LINES: a-b` with an empty REPLACE removes the lines outright, so the two deletion paths disagree.

---

## C. `findLines` trims every line — what else does that equate?

`find.split('\n').map(l => l.replace(/^\s*\d+:\s?/, '').trim()).filter(Boolean)` (:729).

Verified equivalences — all of these produce the identical needle `"const x = 1"`:

| input | needle |
|---|---|
| `const x = 1   ` (trailing spaces) | `const x = 1` |
| `\t\tconst x = 1` (tabs) | `const x = 1` |
| `\u00a0\u00a0const x = 1` (NBSP indent) | `const x = 1` |
| `\ufeffconst x = 1` (BOM / ZWNBSP) | `const x = 1` |
| `const x = 1\r` (CRLF file line) | `const x = 1` |
| `  12: const x = 1` (read_file gutter) | `const x = 1` |

Trailing whitespace, tabs, NBSP and BOM are all equated, on **both** sides — the file's lines go through the same `.trim()` inside `scanTolerant`. Mostly this is the intended tolerance. Two consequences worth naming: a file line with trailing whitespace matches a clean FIND and the replacement silently drops that whitespace (verified: `const x = 1;   ` → `const x = 99;   ` actually *keeps* it here only because the exact path won; on the tolerant path it is rewritten), and a BOM sitting on the first line is deleted if line 1 is ever part of a tolerant region.

### Finding 6 (MED) — the gutter-stripper eats real code

`/^\s*\d+:\s?/` is meant to forgive a model that pasted `read_file`'s `12: ` gutter. It cannot tell that apart from a **numeric key**:

| input | needle | intended? |
|---|---|---|
| `    1: 'one',` (Python dict) | `'one',` | **no** |
| `  404: notFound,` (JS object) | `notFound,` | **no** |
| `  7: ` (a line that is only a number) | *(dropped entirely)* | **no** |

A FIND drawn from a dict or object literal is silently rewritten into a different, much weaker needle before matching. `'one',` may match a different line entirely, and in the third case the needle vanishes from the list — if it was the only line, `findLines` is empty and the tool answers "the FIND snippet was not found", which is false. In the end-to-end fixture C1 the edit still landed correctly, but only because the **exact** path matched first; the mangled needle is what the tolerant fallback would have used.

---

## D. The `LINES: a-b` path

Bounds check at :658 is `a >= 1 && b >= a && b <= srcLines.length`.

### Finding 4 (HIGH) — `LINES: 1-N` with an empty REPLACE empties the file, and says `OK`

```
BEFORE  a 4-line Phaser page (d2.html)
CALL    edit_file({ path: 'd2.html', lines: [1, 5], replace: '' })
ANSWER  OK: edited d2.html lines 1-5 (5 line(s) deleted); removed: "<html><body>..." ; now 1 lines (-4).
AFTER   ""
```

The file is gone and the answer begins with `OK`. Nothing downstream catches it either: `beforeSrc` at :3443 is captured only when `/\.(py|c?js|mjs)$/i.test(args.path)`, so **every guard that could have refused this — the removal refusal (:3527), the duplicate refusal (:3557), and the two `lostDefs`/`lostExports` warnings (:3580, :3593) — is skipped for `.html`, `.css`, `.json`, `.ts`, `.md`.** For a workspace whose deliverable is a canvas game in `index.html`, `edit_file` is an unguarded whole-file eraser. (`write_file`'s own shrink guard at :530 does cover `.html`, but `edit_file` has no equivalent.)

### Finding 5 (MED) — the phantom last line

`src.split('\n')` on a file ending in a newline yields a trailing `''`. A 5-line file therefore has `srcLines.length === 6`, and `LINES: 5-6` is accepted:

```
BEFORE  "l1\nl2\nl3\nl4\nl5\n"
CALL    lines: [5, 6], replace: ''
ANSWER  OK: edited d1.js lines 5-6 (2 line(s) deleted); removed: "l5"; now 4 lines (-2).
AFTER   "l1\nl2\nl3\nl4"          <- trailing newline gone
```

The answer claims *2 lines deleted* when only one line of text existed. This is not purely theoretical: `read_file` numbers over the same `all = ...split('\n')` array (:390, :414), so it will itself print a final empty line `6: `, and a model reading the file can legitimately believe line 6 exists. The count in the answer is `b - a + 1`, arithmetic on the request — the same request-shaped-answer pattern the surrounding comment (:623-634) was written to kill, surviving in the line count.

### Finding 10 (LOW) — a trailing newline in REPLACE inserts a blank line

`repl = String(replace).split('\n')`, so `'B\n'` becomes `['B', '']`:

```
BEFORE "a\nb\nc\n" ; lines: [2,2], replace: "B\n"
ANSWER OK: edited d3.js lines 2-2 (1 line(s) replaced by 2); now 5 lines (+1).
AFTER  "a\nB\n\nc\n"
```

Models routinely end a fenced block with a newline. The answer does say "replaced by 2", which is honest, but repeated edits to the same region accumulate blank lines.

**Stale line numbers.** Nothing ties a `LINES` request to the file version the model read — no hash, no length check beyond the bound. The comment at :665 shows this was measured (run `071d5478` deleted nine different pairs with the same request). Confirmed live: sending `LINES: [2,2]` twice against `one/two/three/four` deletes `two`, then deletes `three`, each time answering `OK` with the correct removed text. The answer is truthful; the addressing is still unanchored.

---

## E. OCCURRENCE indexing

### Finding 7 (MED) — the count and the walk disagree about overlap

```js
const exact = content.split(find).length - 1;          // :701  NON-overlapping
for (let k = 0; k < occurrence; k++) at = content.indexOf(find, at + 1);   // :705  OVERLAPPING
```

`String.split` consumes each match, so `exact` counts non-overlapping occurrences. The `indexOf(at + 1)` walk advances by one character and finds overlapping ones. For a self-overlapping FIND the two disagree:

```
content "aa\naa\naa\naa\n" , find "aa\naa"
exact (split)            = 2
indexOf walk offsets     = [0, 3, 6]
occurrence 2  ->  offset 3, which OVERLAPS occurrence 1 (offset 0)
result: "aa\nZZ\naa\n"
```

The model asking for "the second one" gets a region straddling the first and second. The base-1 indexing itself is **correct** (`occurrence: 1` → first match; the loop runs once and `indexOf(find, 0)` is the first). Only the overlap semantics are wrong, and the bounds message (`appears ${exact} times`) quotes the non-overlapping count while the walk can reach further. Self-overlapping FINDs are realistic: `}\n}`, `\n\n`, a repeated two-line boilerplate.

### Finding 12 (LOW) — OCCURRENCE ignored when the match is unique

The OCCURRENCE branch is gated on `exact > 1 && occurrence` (:702). With a unique match and `occurrence: 7`, control falls through to the `exact === 1` branch, the edit is applied, and the answer is a plain `OK: edited e2.js` that never mentions the impossible occurrence. A model that mis-numbered its target is told nothing.

---

## F. `write_file` and `append_file`

**Content transformation.**

- `write_file` writes `content` **verbatim** — no trailing newline added, no CRLF conversion, `utf8` in and out. A file can be left with no final newline, which then changes how `append_file` behaves.
- `append_file` transforms in two ways (:609-611): it inserts a joining `\n` when the existing file does not end in one, and it **forces a trailing newline** onto the appended body. Verified: appending `const c = 3;` to a file ending `const b = 2;` yields `"const b = 2;\nconst c = 3;\n"`.
- **No CRLF handling anywhere.** Appending to a CRLF file produces `"const a = 1;\r\nconst b = 2;\r\nconst c = 3;\n"` — an LF line in a CRLF file. `edit_file`'s splices join with `'\n'` for the same reason. Combined with `findLines` trimming `\r` (section C), a CRLF file is fully matchable and progressively converted to mixed endings.

**What `append_file` still skips.** The brief's memory ("append_file escapes the duplicate guard") is correct and the scope is wider than one guard, but it is also **narrower than it looks** — the block at :3483-3488 was fixed: `const appended = tool === 'append_file' && !/^ERROR/.test(result)` puts append back into `needsTest`, `touchedWeb`, the `quickCheck` syntax verdict and `duplicateNote`. What it does **not** get is `beforeSrc`:

```js
:3443  let beforeSrc = null;
:3444  if ((tool === 'write_file' || tool === 'edit_file') && args.path && /\.(py|c?js|mjs)$/i.test(args.path)) {
```

All four downstream blocks gate on `beforeSrc !== null`, so `append_file` skips:

1. the destructive-removal **REFUSAL** (:3527),
2. the duplicate-definition **REFUSAL** (:3557),
3. the `lostDefs` warning (:3580),
4. the `lostExports` warning (:3593).

### Finding 3 (HIGH) — proven in the wild, and it cost a run

`trial35-Cq4RcJ` run `17cc6854` (14B, goal "Create s8_grades.py with a Gradebook class"). 29 `append_file` calls; **all 29 to an existing file, 28 of them appending definitions**. Steps 8 through 30 append the byte-identical 284-byte `add_assignment` method **22 times**, growing the file 826 → **8973 bytes**:

```
step  8 append_file s8_grades.py | warn: REPEAT-NOTICE | dup: no | OK: appended 284 bytes (now 3009 bytes)
...
step 30 append_file s8_grades.py | warn: REPEAT-NOTICE | dup: no | OK: appended 284 bytes (now 8973 bytes)
run status: stopped   repeatCalls: 23   duplicateRefused: undefined
```

Every one of those 22 writes landed. The repeat notice fired 23 times and is advisory only — it decorates the answer and the write has already happened. This is the "detects everything, corrects nothing" pattern from MEMORY, and the `MUTATING_REPEAT` set (:1626) *does* include `append_file`, so detection was working; it simply has no teeth.

The duplicate refusal would have stopped it at the first repeat. Running the real `defCounts` on a reconstruction:

```
defCounts BEFORE: [["Gradebook",1],["__init__",1],["add_assignment",1]]
defCounts AFTER : [["Gradebook",1],["__init__",1],["add_assignment",22]]
duplicate-refusal would fire on: [["add_assignment",22]]
lostDefs sees: []                                  <- Set comparison, blind to additions
duplicateNote says: ""                             <- column-0 only, class methods exempt
```

So the three cheap detectors line up exactly as the `defNames.js` docstring predicts: `lostDefs` is blind to additions, `duplicateNote` exempts indented class methods by design, and `defCounts` — the one built for precisely this — is never consulted because `beforeSrc` was not captured. The one-line condition at :3444 is the whole gap.

Note also that the extension filter excludes `.html`/`.css`/`.json`, so even for `write_file` and `edit_file` those file types have no removal or duplicate refusal at all (this is what makes finding 4 unguarded).

---

## G. Does `changed()` tell the truth?

`changed(was, now, snippet, left)` (:639-648) reports a line-count delta computed from the two strings, and appends a "still appears N times" clause. The `left` argument is computed **from the result**, correctly, on all three paths:

- exact: `out.split(find).length - 1`
- tolerant unique: `scanTolerant(out.split('\n'), findLines).length`
- tolerant OCCURRENCE: same

Verified honest in every fixture. The self-duplicating case works as designed:

```
FIND "function a() {}"  REPLACE "function a() {}\nfunction b() {}"
-> OK: edited g1.js; now 3 lines (+1); "function a() {}" still appears 1 time in the file -
   your REPLACE put it back, so sending this same edit again would match it again and duplicate...
```

and it fires on the tolerant path too (`"m() {" still appears 1 time`), which is the shape-B loop the comment at :636 describes. The line delta was arithmetically correct in all 14 fixtures.

**The one thing it does not say is the thing the model most needs.** `changed()` reports *how many* lines the file gained or lost; it never reports *which kind*. In the `ed679f69` reproduction the entire signal that two blank separators had been deleted was the token `(-1)` inside an answer beginning `OK: edited`. A model reading "now 19 lines (-1)" after sending a 3-line-for-3-line replacement has, in principle, enough information to notice — and in practice, none of the four real tolerant edits in that run prompted the model to re-read. `changed()` is truthful but not sufficient: it describes the size of the change, not its shape, so an unintended deletion and an intended one read identically.

Minor: the LINES path calls `changed(src, out)` with no snippet, so it never gets the "still appears" clause even when REPLACE reintroduces its own text.

---

## Summary — inputs for which these tools produce a file the model did not intend

Ordered by how likely a real run is to hit them.

1. **Any tolerant edit whose region is preceded by a blank line** — i.e. the normal case for a method in a class or a function in a module. The blank separator(s) above the match are deleted. Confirmed in the wild (`ed679f69`: 2 of 4 tolerant edits, each `-1` when `+0` was correct) and reproduced. *Cause: `scanTolerant` pushes `start: i` where `i` has walked onto the blank run (:787); the splice at :824/:831 drops `[start, end]` wholesale.*
2. **A tolerant edit that is genuinely already applied, when a blank line sits above it** — answered `OK: edited` instead of the new `NO CHANGE … ALREADY LANDED`, because the swallowed blank makes `out !== content`. The refusal added in `3d7a080` cannot fire in the case it was written for.
3. **`append_file` of a definition that already exists** — written, every time, with `OK`. 22 identical copies of one method in run `17cc6854`; `defCounts` would have refused the first repeat but `beforeSrc` is never captured for append (:3444). Same one-line cause blocks the removal refusal and both loss warnings.
4. **`LINES: 1-N` with an empty REPLACE on `.html`/`.css`/`.json`** — the file is emptied and the answer starts with `OK`. No guard covers those extensions on the `edit_file` path.
5. **`LINES: a-b` where `b` is the file's line count** on a newline-terminated file — deletes the trailing newline and over-reports by one line.
6. **A FIND copied from a dict or object literal with numeric keys** — `1: 'one',` is silently rewritten to `'one',` by the gutter-stripper before matching, so the tolerant path searches for something the model did not send.
7. **OCCURRENCE ≥ 2 on a self-overlapping FIND** (`}\n}`, `\n\n`, repeated boilerplate) — selects a region straddling the previous match.
8. **REPLACE mixing tabs and spaces** — `reindentTo` slices a character count, so tab-indented nested lines collapse to the anchor's depth. Python: `IndentationError`, or silently the wrong block.
9. **A tolerant delete (empty REPLACE)** — leaves one blank line where the region was; `LINES` deletion does not. The two deletion paths disagree.
10. **REPLACE ending in a newline on the `LINES` path** — inserts a blank line per edit.

Characters are safe: `reindentTo` provably never removes non-whitespace (1372/1372). Every finding above is a change to *structure* — blank lines, indentation depth, region bounds — which is exactly the class that passes a syntax check and survives to the hidden checks at the end of a run.

Findings 1, 2 and 3 share a single shape worth stating plainly: **the tool writes, then describes what it wrote in terms of the request rather than the diff.** `(-1)` is not "I deleted a blank line you did not mention", and `OK: appended 284 bytes` is not "this is the 22nd copy of `add_assignment`". Both were detected somewhere in the system — the repeat notice fired 23 times — and neither stopped a write.
