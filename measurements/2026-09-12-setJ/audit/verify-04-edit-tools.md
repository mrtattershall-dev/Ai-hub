# verify-04-edit-tools — second auditor, independent re-derivation

Scope: `edit_file`, `write_file`, `append_file` in
`C:/Users/tatte/Projects/ai-coding-hub-indent/server/agent.js` @ git `3d7a080`.
Method: functions lifted verbatim into a private temp dir and driven as pure functions and
end-to-end against real files; then cross-checked against recorded runs. Nothing in the
serving tree was modified.

Map of the code under test: `changed()` 639; LINES path 656-673; OCCURRENCE path 700-710;
`findLines` 729; `regionAnchor` 762; `reindentTo` 764-777; `scanTolerant` 778-791;
`noChangeAt` 812; tolerant write paths 818-838. Post-write guards 3443-3605.

---

## Verdict on the two one-day-old functions

**Both run and both do real work. Neither repeats the earlier silent defect.** I tried hard
to find it and could not.

`regionAnchor` (762) is genuinely fixed. The old bug read indentation from a blank line
because `scanTolerant` anchors a region at the loop index `i` while skipping blanks, so
`start` frequently lands on a blank. `.find((l) => l.trim())` skips those. Verified
end-to-end on two fixtures whose region *does* start on a blank line:

| fixture | region | anchor returned |
|---|---|---|
| `class C {` / blank / `    shape() {` | 2-5 | `"    shape() {"` (not `""`) |
| `class Gradebook:` … blank … `    def percent` | 3-5 | `"    def percent(self, a, b):"` |

It also cannot return `undefined` on the real path: `findLines` is non-empty (guarded at
730), so every match contains at least one non-blank line.

`reindentTo` (764) is not a no-op and does not corrupt. I ran 17 adversarial inputs with a
skeleton invariant — strip leading `[ \t]` from every line before and after; the function is
only permitted to change that. **The invariant held in all 17 cases: no character was lost
or added** in tabs, spaces, mixed tabs+spaces, empty REPLACE, min-indent-line-not-first,
interior blanks, CRLF, single line, whitespace-only content, or blank anchor.

Disproven hypothesis, stated for the record: I predicted that splicing a tab-indented
REPLACE into a space-indented Python file would produce mixed indentation that fails to
parse. It does produce `"    \tif b == 0:"`, but Python 3 accepts that when consistent
within the block — `py_compile` passed on the before file, the REPLACE alone, and the
result. **No parse break. I was wrong.**

---

## A. reindentTo — result table (abridged; CORRUPT = skeleton invariant broken)

| case | anchor | out | CORRUPT |
|---|---|---|---|
| spaces, own=0 | `"    x"` | `"    foo\n      bar"` | no |
| tabs target | `"\t\tx"` | `"\t\tfoo\n\t\t  bar"` | no |
| REPLACE tab-indented → space target | `"    x"` | `"    foo\n    \tbar"` | no |
| **own by LENGTH: tab line + 8-space line** | `"    x"` | `"    foo\n           bar"` | no |
| empty REPLACE | `"    x"` | `""` | no |
| min-indent line NOT first | `"    x"` | relative structure preserved | no |
| blank lines inside | `"    x"` | blanks stay blank | no |
| CRLF | `"    x"` | `\r` preserved | no |
| whitespace-only content | `"    x"` | returned untouched | no |
| **anchor BLANK / undefined** | `""` / — | `"a\nb"` — **de-indented to column 0** | no |
| **NBSP / formfeed / vtab-led line** | `"    x"` | target prepended to existing indent | no |

Two real but low-severity defects, neither reachable today:

- **Baseline is chosen by character COUNT, sliced positionally.** `own` is the shortest
  whitespace prefix by `.length`, but a tab (1 char) and 8 spaces (8 chars) occupy the same
  column. Measured: a line at visual column 8 moved to column 12 while its sibling stayed at
  8 — relative nesting changed. Cosmetic in JS; in Python the mixes that trigger it are
  usually already a `TabError` in the model's own text.
- **A blank anchor makes it actively destructive, not inert.** If a caller ever passes a
  blank or `undefined` anchor, `target` is `""` and every line is flattened to column 0.
  Unreachable via `regionAnchor` today, but it is one line away from being worse than the
  no-op it replaced.
- `^[ \t]*` does not match NBSP, full-width space, formfeed or vtab, but `trim()` does treat
  them as whitespace. A REPLACE line led by any of them sets `own = ""`, so `target` is
  prepended on top of every line's existing indentation.

## B. scanTolerant — bounds cover MORE lines than FIND described

Because matching skips blank lines but the region is anchored at the loop index, the region
swallows every contiguous blank line **above** the match.

| hay | needles | region | lines covered | needles | extra | after splice |
|---|---|---|---|---|---|---|
| `a,"",b,c` | `b` | 1..2 | 2 | 1 | **+1** | `a,REPLACE,c` |
| `a,"","","",b,c` | `b` | 1..4 | 4 | 1 | **+3** | `a,REPLACE,c` |
| `"",b,c` | `b` | 0..1 | 2 | 1 | **+1** | `REPLACE,c` |
| `keep,"",x,"",y,tail` | `x,y` | 1..4 | 4 | 2 | **+2** | `keep,REPLACE,tail` |

End-to-end: `header(); / blank / function t() { / blank / body(); / blank / }` with a 3-line
FIND reported `region 2-7 … now 6 lines (-3)` — three blank lines gone, including the one
separating two methods in the Python fixture.

**I could not construct a case that destroys an adjacent NON-blank line, and I believe none
exists.** For `start` to sit above the first matched line, every line between must be blank;
every non-blank line inside a region must equal a needle. So this is formatting damage, not
code loss. `end = fi - 1` is exactly the last matched line — no trailing over-run — and
`i = fi - 1` correctly resumes after a match.

Note the reporter cannot always reveal this: `changed()` reports only a line-count delta, so
a tolerant edit that swallows 3 blanks and adds 3 lines answers "same count".

**Real data:** 6 edits whose actual line delta ≠ `replaceLines - findLines`
(5 in trial35 — `s8_grades.py`, `s3_matrix.js` ×4; 1 in coder14b-setj — `s4_markdown.py`).

## C. findLines trims every line — what becomes wrongly equal

`find.split('\n').map(l => l.replace(/^\s*\d+:\s?/, '').trim()).filter(Boolean)`

Wrongly equal: trailing whitespace; tabs vs spaces (intended); `\r` from a CRLF file
(this is *why* CRLF works); a leading NBSP or full-width space (`trim()` strips both, so
`\u00a0foo` ≡ `foo`). A line containing **only** an NBSP or full-width space counts as
blank — dropped from FIND by `filter(Boolean)` and skipped by the matcher.

The sharper defect is the gutter strip, which is applied to **every** FIND line
unconditionally and eats real code:

| raw FIND line | becomes |
|---|---|
| `  12: foo` (read_file gutter — intended) | `foo` |
| `    1: "one",` (Python dict entry) | `"one",` |
| `  42: value` (JS numeric key / label) | `value` |

The surviving fragment can then match a **different** line elsewhere in the file. Latent:
**0 occurrences** across both recorded datasets.

## D. LINES: a-b path

Numbering is correct — `read_file` prints `${start + i + 1}` (1-based) and the splice is
`slice(0, a-1)` + `slice(b)`, so no off-by-one. Confirmed: `LINES 2-3` on `L1..L4` yields
`L1/X/L4`.

Two real issues:

- **A whole-file wipe is unguarded on non-code extensions.** `LINES: 1-<N>` with an empty
  REPLACE empties the file. `beforeSrc` — the input to all four post-write guards — is only
  captured when the path matches `/\.(py|c?js|mjs)$/i`:

  | path | guarded |
  |---|---|
  | a.py / a.js / a.cjs / a.mjs | GUARDED |
  | **index.html / style.css / data.json / notes.txt** | **NOT GUARDED** |

  Reproduced: a 7-line `index.html` → `""`, 66 non-whitespace characters lost, answered
  `OK: edited lines 1-7 (7 line(s) deleted); now 1 lines (-6).` `write_file` refuses a
  prose-over-code overwrite; this path has no equivalent.
- `b > srcLines.length` is rejected, but `b == srcLines.length` addresses the phantom empty
  element after a trailing newline, so `LINES: 2-3` on `"const a=1;\nconst b=2;\n"` silently
  drops the trailing newline.
- Staleness is unchecked by design: nothing validates that the model's line numbers still
  describe the same text. The mitigation is `changed()`, which now echoes the text that
  actually went — real, but advisory.

## E. OCCURRENCE — the count and the selection disagree

```js
const exact = content.split(find).length - 1;            // NON-overlapping count
for (let k = 0; k < occurrence; k++) at = content.indexOf(find, at + 1);  // OVERLAPPING walk
```

`split` counts non-overlapping matches; the `indexOf(find, at + 1)` walk advances by one
character, so it finds overlapping ones. The Nth occurrence the tool picks is not the Nth a
human means.

| content | find | count | hub picks | human means | |
|---|---|---|---|---|---|
| `aaaa` | `aa` | 2 | `[0,1]` | `[0,2]` | **DIVERGES** |
| `}\n}\n}\n}` | `}\n}` | 2 | `[0,2]` | `[0,4]` | **DIVERGES** |
| `x\n\n\n\ny` | `\n\n` | 2 | `[1,2]` | `[1,3]` | **DIVERGES** |
| `a-b-a-b` | `a` | 2 | `[0,4]` | `[0,4]` | ok |

Reproduced end-to-end: `OCCURRENCE: 2` of `"}\n}"` spliced at index 2 — **inside**
occurrence 1 — producing `}\n}\n/*EDITED*/\n}\n}`. Latent: 0 self-overlapping FINDs with an
OCCURRENCE in either dataset.

## F. append_file — what it skips

`beforeSrc` is captured **only** for `write_file` and `edit_file` (3443-3446):

```js
if ((tool === 'write_file' || tool === 'edit_file') && args.path && /\.(py|c?js|mjs)$/i.test(args.path)) {
  try { beforeSrc = readFileSync(safePath(args.path), 'utf8'); } catch { }
}
```

All four post-write guards are gated on `beforeSrc !== null`, so for `append_file` **none of
them can fire**:

| guard | line | kind | append_file |
|---|---|---|---|
| `lostDefs`/`lostExports` removal **refusal** (restores the file) | 3527 | deciding | **BYPASSED** |
| `defCounts` duplicate-definition **refusal** (restores the file) | 3557 | deciding | **BYPASSED** |
| `lostDefs` removed-definitions warning | 3580 | advisory | BYPASSED |
| `lostExports` dropped-export warning | 3593 | advisory | BYPASSED |
| `duplicateNote` | 3519 | advisory | fires |
| `quickCheck` syntax verdict | 3512 | advisory | fires |

This is the "fix the deciding path, not the advisory one" shape exactly: append keeps the
advisory that *mentions* duplicates and loses the refusal that *prevents* them.

**Confirmed on real data — coder14b-setj run `17cc6854`, `s8_grades.py`:**

- 26 `append_file` calls, 0 `edit_file`, 1 initial `write_file`.
- The **identical 284-byte `def add_assignment` block appended 21 consecutive times**
  (steps 7-29), file 541 → 8,973 bytes.
- Every call answered `OK: appended 284 bytes … The existing content was not touched.`
- `duplicateRefused` is `undefined` on the run — the refusal never fired once.
- Run `status: stopped`.

This is the set-G `33a9d81d` corruption pattern (one definition multiplied until the file is
meaningless, every call answering OK, no syntax check failing) reproduced through the one
write path that still has no deciding guard. trial35 shows the milder form: 2 defining
appends of `def percent` to the same file.

Other things `append_file` skips: the `write_file` prose-over-code shrink guard (not
applicable — append cannot shrink); and for a file that already exists there is no
tool-level parse check at all, only the post-write advisory.

**Dating caveat:** in both recorded datasets the append results carry no `✅ passed a syntax
check` / `❌ SYNTAX CHECK FAILED` line, although `syntaxNote` is concatenated into the model's
feedback at 3694 and 3489 includes `appended`. The recorded runs therefore predate the
current tree (the comment at 3483 says append "used to skip this whole block"). The guard
gap in finding F is read from the **current** `3d7a080` source; the run data shows the
failure mode that gap permits, not a replay of today's binary.

**Secondary:** `append_file`'s answer embeds a running byte total, so two identical appends
never produce identical answers. `changedAnswer` is therefore always true, and the repeat
notice takes the "it did something DIFFERENT this time, because the file is no longer what
it was" branch, advising `LINES: <a>-<b>`. For an append that is misleading — the file
changed because the append itself changed it.

---

## Summary — inputs that corrupt a file

| # | input | outcome | severity | seen live |
|---|---|---|---|---|
| 1 | `append_file` whose content re-defines an existing function | unbounded duplicate definitions, every call "OK"; last definition silently wins | **HIGH** | **yes — 21× in `17cc6854`** |
| 2 | `edit_file LINES: 1-<N>` + empty REPLACE on `.html/.css/.json/.txt` | file emptied, no guard, answered "OK" | **HIGH** | no |
| 3 | tolerant FIND whose match is preceded by blank lines | those blank lines deleted; masked when deltas cancel | MEDIUM | yes — 6 delta mismatches |
| 4 | `OCCURRENCE: n` with a self-overlapping FIND | splice lands inside occurrence n-1 | MEDIUM | no |
| 5 | FIND line shaped like `  1: "one",` | gutter regex strips the key; fragment may match elsewhere | MEDIUM | no |
| 6 | REPLACE mixing tabs and spaces, or led by NBSP/formfeed | relative nesting shifts | LOW | no |

`reindentTo` and `regionAnchor` are **cleared**: they run on both code paths, they change
the output, and no input I found makes either lose or add a character.
