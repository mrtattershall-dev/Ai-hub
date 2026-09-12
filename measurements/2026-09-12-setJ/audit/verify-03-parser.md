# verify-03-parser.md — SECOND AUDITOR, model-reply parser

Scope: the code that turns a model's text into a tool call.
Serving tree: `C:/Users/tatte/Projects/ai-coding-hub-indent` @ 3d7a080.
`server/agent.js` md5 d53b1f230cb00bbac719ab6343be6c06 (4818 lines).

**Scope correction, stated up front:** in this tree the parser is NOT in `agent.js`. It was
split out into `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agentParse.js`
(348 lines, md5 0880067077b2864aa73bb74120954033), which exports `parseAction`,
`parseActions`, `replyWasTruncated`, `stripLineNumberPrefixes`. `agent.js` imports them at
line 34 and calls `parseAction` at 3084 (main loop) and 2718 (sub-tasks). Everything below
was run against that real module, imported unmodified.

---

## THE CENTRAL QUESTION

**Can the parser deliver something different from what the model wrote?**

**Yes — and I can construct 10 distinct ways. But on 570 real replies from set J it did so
exactly ONCE, and that once was the intended line-number strip. The parser is not where set
J's work was lost.**

Both halves matter. Answering only the first half would overstate; only the second would
miss that several of the constructed differences are silent, unrefused, and one line of
model text away.

---

## METHOD 1 — differential replay (the method that matters most)

Every model reply in the three transcript sets, re-parsed with the hub's own code, compared
field-by-field to the `args` recorded in the matching run JSON step.

Corpus: 52 runs / 570 turns (`coder14b-setj`, `trial35-cWxzHB`, `trial35-8XrYOc`).
Scripts: `<scratch>/diff.mjs`, `align.mjs`, `scan.mjs`, `adv.mjs`.

```
runs 52 | turns 570 | parsed 569 | aligned to a recorded tool step 522
arg mismatches (reparse vs recorded) : 0
not-verbatim (delivered text absent from the reply) : 1
multi-action replies : 14
truncated replies : 1
unparseable replies : 1
```

**Validity of the method, checked rather than assumed:**

1. *Is the transcript the parser's actual input?* Yes. `raw` is assigned once
   (`agent.js:2957`); `appendTranscript(..., reply: raw)` (2960) and `parseAction(raw, …)`
   (3084) read that same variable. Whatever `callModel` did upstream, transcript and parser
   see identical bytes.
2. *Could the recorded args have been mutated after parsing?* Only at `agent.js:2803`, and
   only under `AGENT_BATCH_ACTIONS=1`. That flag is off by default (128) and was off in all
   52 runs (no run contains a batch step).
3. *Could the 30,000-char disk cap (`RUN_ARG_MAX`) hide a difference?* No. 387 recorded
   string fields, longest 7,784 chars, zero at or over the cap.
4. *Do the 47 unaligned turns hide anything?* No: 35 are `finish` (never recorded as a tool
   step), 8 are the last action of a run that ended `stopped` before the step was written,
   4 are resyncs immediately after one of those. The verbatim check below ran on all 569
   parsed replies regardless of alignment.

**Result: the args handed to the tools are byte-identical to what `agentParse.js` produces
from the model's literal reply, in every one of 522 aligned real cases.**

## METHOD 2 — verbatim check against the raw text (alignment-independent)

For every parsed reply, assert each delivered string (`content`, `find`, `replace`, `cmd`,
`summary`, `query`, `text`, `goal`, `code`) is a literal substring of the reply. One failure
in 569:

- `trial35-8XrYOc` run `58529db7` turn 10, `edit_file` FIND (704 chars).
  The model copied `read_file` output back verbatim — `4: html_paragraphs = []`,
  `5: for paragraph in paragraphs:` … — and `stripLineNumberPrefixes` removed the `NN: `
  prefixes. Designed behaviour, and it was RIGHT here: the resulting edit landed
  (`step 17 → "OK: edited s4_markdown.py; now 23 lines (-1)"`). Without the strip the FIND
  would have missed and the model would have looped.

## METHOD 3 — shortening scan (a truncated value is still a substring, so Method 2 is blind to it)

Reconstructed the literal text after each `REPLACE:` marker and compared to the delivered
value. 6 hits, all false positives of my detector: the model literally wrote
``REPLACE:\n```\n``` `` — an EMPTY fenced block, i.e. an intended deletion
(`47f510ad` turns 6/7/8, `77d6dd56` turns 9/10/11 — three byte-identical resends each; a
loop-guard story, not a parser story). Parser faithful.

Also measured on the same corpus, all latent (0 occurrences):
`writeNoPath 0 · editNoPath 0 · writeEmptyContent 0 · multiFenceBeforeContent 0 ·
actionInsideFenceFirst 0 · replies containing CR 0 · bare edits 13 of 152 (139 fenced)`.

---

## METHOD 4 — adversarial construction (27 cases, all run through the real parser)

These are the ways the parser CAN deliver something other than the model's text. Each is
reproduced in `adv.mjs`; incidence in set J is stated for every one.

### HIGH — silent, and the delivered value is wrong

**P1. `write_file` with no PATH lands on `lastPath` even when the reply names exactly one
other file.** Precedence is `lastPath || scavenged || langFile[...]`.

```
INPUT : THOUGHT: s6_graph.py is done, now create s7_queue.py
        ACTION: write_file
        ```python
        print(1)
        ```      (lastPath = s6_graph.py)
PARSED: { path: "s6_graph.py", content: "print(1)" }   ← overwrites the FINISHED file
```
The docstring argues scavenging is a coin flip when two names are mentioned, and that is
right — but the ordering also throws away the ONE case where the model gave unambiguous
evidence (a single distinct filename), which is exactly when scavenging is safe. With no
`lastPath` the same reply correctly yields `s7_queue.py` (CASE 2). Incidence 0/570.

**P2. `write_file` with no fenced block delivers `content: ''`, and nothing refuses it.**
`CONTENT: const a = 1;` on a plain line → `{path:'a.js', content:''}`. `append_file` refuses
empty content (`agent.js:580`); `write_file` does not. On a NEW file that is a 0-byte file
and an `OK: wrote 0 bytes`. On an existing file >400 bytes the prose-overwrite guard catches
it — so the hole is exactly "creating a file the model thought it had written". Incidence 0/570.

**P3. The FIRST fenced block wins, even when it precedes the ACTION header and is obviously
output, not content.**
```
THOUGHT: first the error
```
TypeError: boom
```
ACTION: write_file
PATH: a.js
```js
const fixed = 1;
```
→ PARSED content: "TypeError: boom"
```
Incidence 0/570.

**P4. The TOOL NAME is read from `text`, not from `outside`.** The comment above `outside`
is explicit that a file containing `REMOVE:`/`LINES:`/`OCCURRENCE:`/`ACTION:` must not be
able to change what the hub does — but `am = text.match(/ACTION:\s*([a-z_]+)/i)` still reads
the fenced text, and so do `thought` and the FIND/REPLACE matchers. A markdown file
documenting the action format, pasted in a block BEFORE the real header, sets the tool:
```
```md
ACTION: run_command
```
ACTION: write_file …
→ PARSED: { tool: "run_command", args: { cmd: "ACTION: run_command" } }
```
Incidence 0/570. The mitigation that saves it in practice is ordering, not the guard.

**P5. A lone code block with NO ACTION header is a `write_file` to `lastPath`.** A model that
pastes a block to *discuss* it overwrites the file it last touched, with no header and no
PATH anywhere in the reply. Deliberate ("forgiving fallback"), and it is the same instinct
P1 relies on, but it is the most destructive default in the file. Incidence: 0 header-less
replies in this corpus.

### HIGH — REPLACE silently truncated (bare, unfenced edits)

**P6. The bare-REPLACE lookahead stops at ANY line whose first token is ALL-CAPS + colon.**
`replBare = /REPLACE:[ \t]*\n([\s\S]*?)(?=\n[ \t]*[A-Z][A-Z_]{2,}:|$)/i`
```
FIND:
const cfg = {};
REPLACE:
const cfg = {
  DEBUG: true,
  retries: 3,
};
→ PARSED replace: "const cfg = {"        ← everything from `DEBUG:` on is GONE
```
A JS/TS object key, a Python dict with a CAPS key, a `NOTE:`/`TODO:`/`MAX:` line — any of
them truncates the replacement. Nothing refuses, nothing warns: `edit_file` writes the
unbalanced fragment and reports `OK`. This is the most dangerous latent parser bug I found.
Incidence 0/570 only because 139 of 152 real edits used fences (the fenced path is immune)
and none of the 13 bare ones contained a CAPS line. One prompt change that discourages
fences, or one model that stops using them, turns this on.

**P7. `edit_file` has NO truncation guard at all.** `replyWasTruncated` is consulted in the
`write_file`/`append_file` branch and in the loop's parse-failure path — never for edits.
```
… REPLACE:
```js
const a = 2;
const b =            ← reply ends here
→ PARSED replace: "```js\nconst a = 2;\nconst b ="
```
The delivered value carries the opening fence marker itself, because `clean()` only strips a
TRAILING fence. A bare truncated edit (CASE 11) delivers the half-written replacement with no
marker and no complaint. Incidence 0/570 (the one real truncation was a write).

### MEDIUM

**P8. An unrecognised tool name is reported as "no ACTION at all".** `ACTION: delete_file`
parses to `{tool:'delete_file', args:{}}`; `ACTION: write file` (a space) parses to
`{tool:'write'}`. `agent.js:3085` rejects both because they are not in `tools`, and tells the
model *"Your last response did not contain a valid ACTION"* — which is false, and never names
the rejected word or the legal ones. Each one also counts toward the 5-failures-in-10 give-up.
**D's question "does the model learn?" — for this class, no.**

**P9. Content after `finish` is swallowed into the SUMMARY.**
`ACTION: finish / SUMMARY: built it` followed by a whole `ACTION: write_file` block yields
`summary: "built it\n\nACTION: write_file\nPATH: extra.js\n```\nconst x=1;\n```"`. Not dropped,
but delivered as prose to the finish gate, and the trailing action never runs. Incidence:
0 real finish-first replies; 2 of the 14 multi-action replies were `task_done | finish`
(finish LAST), which the `dropped` nudge does cover.

**P10. CRLF breaks bare edits completely.** `FIND:[ \t]*\n` cannot match `FIND:\r\n`.
```
CRLF bare edit → PARSED: { path:'a.js', replace:'' }   ← NO find at all
```
The tool then answers "edit_file needs a FIND snippet" for an edit the model wrote correctly
— the exact failure mode the bare-FIND support was added to kill. CRLF fenced edits deliver
`find: "const a = 1;\r"`, which will FIND-miss against an LF file; CRLF `write_file` content
keeps a trailing `\r`. Incidence 0/570 (no real reply contains CR) — but this hub runs on
Windows, and a provider or prompt change that normalises line endings switches it on silently.

**P11. `stripLineNumberPrefixes` CAN corrupt legitimate content — the single-line case is
where it is weakest.** Verified against the real function:

| input | output | changed |
|---|---|---|
| `10: 30` (a time, one line) | `30` | YES |
| `42: answer` | `answer` | YES |
| `1: 'one',\n2: 'two',` (col-0 ascending keys) | `'one',\n'two',` | YES |
| `1: return a;\n2: return b;` | `return a;\nreturn b;` | YES |
| `10\| value\n11\| other` | `value\nother` | YES |
| `7\| x` (one line) | `x` | YES |
| `3: 'c',\n2: 'b',` (descending) | unchanged | no |
| `  1: 'one',\n  2: 'two',` (indented) | unchanged | no |

The docstring's two real defences hold: the `N: ` form needs column 0 (where an indented
object key never is), and numbers must ascend. What it does not say is that **with a single
line the ascending test is vacuous**, so any one-line FIND matching `^\d+: ` or `^\s*\d+\| `
is rewritten — and the `|` form is much looser than the `:` form, since it allows leading
whitespace. Real incidence of any strip: 1 in 570, and it was correct.

**P12. Encoding otherwise clean.** BOM before `THOUGHT` parses; tab-indented `ACTION:`/`PATH:`
parse; unicode (accents, CJK, emoji) and zero-width characters pass through byte-exact.
One cosmetic flaw: PATH sanitising strips `` ` ``, `"`, `'` from anywhere in the name, so
`my"file.js` is delivered as `myfile.js` — a different file, silently.

---

## B — BATCH, and the "finish never runs in a batch" rule

`AGENT_BATCH_ACTIONS` is off by default (`agent.js:128`) and was off for all 52 runs. So
multi-action replies took the single-action path: the first action ran, the rest were
discarded — and **the model WAS told**, by the nudge appended to the tool result
(`agent.js:3701`): *"You sent N actions… ONLY THE FIRST (tool) was executed — the other N-1
were DISCARDED and did NOT happen."* 14 of 570 replies (2.5%) carried more than one action.

I tested whether that count can lie. The nudge counts raw `ACTION:` lines minus one, while
the truth (`parseActions`) absorbs a stray mid-edit `ACTION:` header into a single edit. On
all 14 real multi-action replies the two agreed (14/14, 0 overstatements) — the known
discrepancy is latent here, and `agent.js:3114` already documents that it is only corrected
when the flag is ON.

The stray-`ACTION:`-inside-an-edit case behaves as documented — `parseActions` returns ONE
edit — but note what that one edit CONTAINS:
```
find: "module.exports = { add };\nACTION: edit_file\nPATH: vec.js"
```
The stray header lines are inside the FIND and will miss. Whole-text `parseAction` produces
the identical value, so batch on/off changes nothing; the model's stray line corrupts its own
edit either way. Worth naming because "the whole-text parser gets it RIGHT" (the comment in
`parseActions`) is true only in the sense that both paths agree, not that the edit works.

`finish` in a batch: `planBatch` returns null for a LEADING finish (ordinary path, gate
applies) and HOLDS a non-leading finish (`held`, reported by `closeBatch`, never executed).
Correct as written, and dormant.

## A — TRUNCATION: what is salvaged, what is discarded, is the model told the truth?

- **Salvaged:** any COMPLETE fenced block. If the first block closes and a later one is cut
  off, the first is written (CASE 13) — deliberate and right.
- **Discarded:** only when there is NO complete fence AND `replyWasTruncated` — and only in
  the `write_file`/`append_file` branch, which returns null so the loop can explain itself.
- **Told accurately:** yes, in that one case. `agent.js:3096` sends *"Your last response was
  CUT OFF before its code block closed, so the file never arrived and NOTHING was written…
  send it in smaller pieces"* — correct and actionable. The real occurrence
  (`382c6ce9` turn 3, 21,542 chars, one unclosed fence) recorded exactly that at step 6.
  (That run then died on `Premature close` from the model, not on the parser.)
- **Not covered:** `edit_file` (P7), and the "complete first block + truncated second" case,
  where the model is told "you sent 2 actions, only the first ran" — true, but it describes a
  discarded action rather than a reply that was cut off, which is a different fix.

## D — SILENT DROPS: does the model learn?

| shape | what happens | silent? |
|---|---|---|
| no ACTION / malformed | told, counted, 5-of-last-10 → run gives up | no |
| cut off mid-fence (write) | told accurately, nothing written | no |
| unknown tool name | told "no valid ACTION"; word never named | **misleading** |
| missing PATH (write/append/edit) | lands on `lastPath`, no refusal | **silent** |
| no fenced block on a write | writes empty content | **silent** |
| extra actions after the first | nudge names the count | no |
| content after `finish` | folded into SUMMARY | **silent-ish** |
| a tool in `tools` with no parser branch | falls through to `args: {}` | **silent** — the file's own docstring names `download_file`, the ledger tools and the Google tools as three past instances. I did not mechanically diff the `tools` table against the parser's branches; the listed tools all have branches, but that cross-check is worth automating rather than trusting. |

---

## WHAT I WOULD PIN WITH A TEST, IN ORDER

1. **P6** bare-REPLACE truncated by an ALL-CAPS line — silent, writes broken code.
2. **P7** no truncation guard on `edit_file` (fenced case delivers the fence marker).
3. **P1** no-PATH write beats a single unambiguous scavenged filename.
4. **P2** `write_file` accepts empty content on a new file.
5. **P10** CRLF kills bare edits outright (Windows host).
6. **P8** unknown tool name reported as "no ACTION".
7. **P11** single-line `stripLineNumberPrefixes` (no ascending evidence exists with one line).

## VERDICT

On the evidence, the parser is **faithful in production and fragile by construction**.
522/522 aligned real calls byte-identical; 1 intended transform in 569; 0 cases where a
recorded `args` differs from what `agentParse.js` derives from the literal reply. Every
constructed failure above is latent in set J. The parser did not lose set J's work — but
seven of its failure modes are silent rather than refusing, and P6 in particular writes
broken code and reports `OK`, which is the house failure class (see MEMORY: "silent failures
are the class").

---
---

# COMPARISON WITH audit/03-parser.md

*(appended after the independent analysis above was written and saved)*
