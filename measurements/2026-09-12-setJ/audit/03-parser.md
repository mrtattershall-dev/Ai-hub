# Audit 03 — the model-reply parser

**Scope:** the parsing layer only — `C:/Users/tatte/Projects/ai-coding-hub-indent/server/agentParse.js`
(imported by `server/agent.js:34`) plus the call sites in `agent.js` that decide what the parser's output
becomes. Tools, guards and the run lifecycle are other agents' scope; where a defect's *consequence* lands
in the tool layer it is named and handed over.

**Tree audited:** `ai-coding-hub-indent`, git `3d7a080`, `server/agent.js` md5 `d53b1f230cb00bbac719ab6343be6c06`
(both verified). READ-ONLY: nothing in the hub tree or the trial trees was modified; no hub started, no
`modal` run, no process touched.

**Real data:** 520 model replies from the three live set-J trials
(`trial35-Cq4RcJ` 14B / `trial35-cWxzHB` MoE / `trial35-8XrYOc` dense 32B), replayed through the real parser
functions. Harnesses live in the session scratchpad (`t1-fidelity.mjs` … `t7-shrink.mjs`).

---

## Headline

**Yes — the parser can hand a tool something other than what the model wrote, and in eight distinct ways.**
Five of them are silent (no error, no note, nothing in the run record); three are documented transforms that
still change the model's meaning. One of the eight — the edit→write whole-file conversion — fired **14 times
in these three trials**, and in four of those the only thing that stopped a file being overwritten was a
downstream guard, not the parser.

**And the run record cannot show any of it.** `args` is the parser's *output*, recorded after the call with
the very object the tool received. Every audit that reads `args` is measuring the parser, not the model.

---

## A. Can the parser deliver something DIFFERENT from what the model wrote?

Tested by calling `parseAction` directly on constructed and real replies (`t1-fidelity.mjs`, `t3-edge.mjs`).

### A1. Line-number stripping rewrites legitimate content — SILENT

`stripLineNumberPrefixes` (`agentParse.js:38-52`) is applied to `content` on write/append
(`:203`) and to **both `find` and `replace`** on edit (`:256`). Its guard is "every non-empty line carries
the prefix, and the numbers ASCEND".

```js
43:  const READ = /^(\d+):(?: |$)/;     // read_file:       "19: code"
44:  const HINT = /^\s*(\d+)\| ?/;      // FIND-miss hint:  "      19| code"
```

Measured (`t1` section E) — input → what the tool receives:

| case | model wrote | tool receives |
|---|---|---|
| dict/object literal at col 0 | `1: "one",\n2: "two",\n3: "three",` | `"one",\n"two",\n"three",` |
| a single line | `12: value` | `value` |
| times | `10: 30 start\n11: 45 middle\n12: 00 end` | `30 start\n45 middle\n00 end` |
| markdown-ish | `1: first\n2: second\n3: third` | `first\nsecond\nthird` |

The docstring's defence ("the numbers ASCEND") **is vacuous for a one-line payload** — `nums.every((n,i)=> i===0 || …)`
is trivially true with one element. A single-line FIND or REPLACE beginning `NN: ` is always stripped.
The indentation guard does hold: `  1: "one",` (indented) is correctly left alone.

Real-data exposure: it fired on exactly **1 of 520 replies** (32B `58529db7` n=10) and there it fired
*correctly* — the model had pasted `4: html_paragraphs = []…` straight out of `read_file`. So the feature earns
its place; the finding is that its narrowest guard has a hole for single-line payloads.

Severity split: on `find` a corruption is loud (the FIND misses). On `replace` and `content` it is silent —
corrupted text goes to disk under `OK: wrote N bytes`.

### A2. FIND / REPLACE truncated at the first fence INSIDE their content — SILENT

```js
230:    const findFenced = text.match(/FIND:\s*```[^\n]*\n([\s\S]*?)```/i);
```

Non-greedy, so the payload ends at the *first* inner fence. Model wrote FIND = ``a\n```\nb``; the tool
received `a` (`t1` A4). The delivered FIND is a **prefix** of the intended one — if that prefix matches
somewhere else in the file, `edit_file` edits a region the model never named and answers `OK: edited`.
Unavoidable in a fence-delimited protocol; the defect is that nothing detects or reports the shortening.

### A3. Bare REPLACE cut at the next ALL-CAPS-looking line — SILENT

```js
233:    const replBare = text.match(/REPLACE:[ \t]*\n([\s\S]*?)(?=\n[ \t]*[A-Z][A-Z_]{2,}:|$)/i);
```

Model wrote REPLACE = `x = 1\nTODO: finish this\nNOTE: hi`; the tool received `x = 1` (`t1` A5). Any line
matching `[A-Z][A-Z_]{2,}:` — `TODO:`, `NOTE:`, `URL:`, `ERROR:`, a YAML/dict key, a doc heading — ends the
payload, **indented or not** (`[ \t]*` precedes it). The rest is discarded with no note.

Exposure in these trials: of 129 replies carrying `FIND:`, **128 fenced both fields, 1 used the bare form,
0 hit the cut**. Latent here; live for any model that stops fencing.

### A4. A truncated reply is refused on the write path and NOT on the edit path — SILENT

`replyWasTruncated` (`:126`) is consulted only inside the write/append branch:

```js
199:    if (fenced === undefined && replyWasTruncated(text)) return null;
```

The `edit_file` branch never calls it. Result (`t3` C1), for a reply cut off mid-REPLACE:

```
replace = "```js\nfunction f(){\n  // long body that never closes\n  return 2;"
```

Two defects in one value: the body is **incomplete**, and `clean()` (`:229`) only strips a *trailing* fence,
so the **literal opening fence line ` ```js ` is delivered as file content**. If FIND matches, that goes to
disk. The model is told nothing — the dedicated "cut off inside its code block" message (`agent.js:3092-3100`)
only fires when `parseAction` returns `null`, which the edit branch never does.

Real data: 1 truncated reply in 520 (14B `382c6ce9` n=3), and it was a `write_file` — correctly refused, with
the run recording *"The reply was cut off inside its code block - nothing was written; asking for the file in
smaller pieces."* The write path works. The edit path is untested by reality here, not protected.

### A5. A CRLF reply loses FIND and REPLACE entirely — SILENT, LATENT

```js
232:    const findBare = text.match(/FIND:[ \t]*\n([\s\S]*?)(?=\n[ \t]*REPLACE:)/i);
```

`[ \t]*` does not match `\r`, so `FIND:\r\n` never matches. There is **no CR normalisation anywhere in
`agent.js` before `parseAction`** (grepped). A bare-form edit sent with CRLF arrives as
`{ path, replace: '' }` — no `find` at all (`t1` A6) — and `edit_file` answers *"You sent PATH but no FIND"*
for a FIND that was right there. Fenced CRLF edits survive (`\s*` in the fenced patterns absorbs `\r`).
PATH, ACTION, SUMMARY and THOUGHT all survive CRLF.

0 CRLF replies in these trials. A latent trap that activates on any model, proxy or provider that emits CRLF.

### A6. Trailing newline always dropped — deliberate, still a difference

`fenced = fenceM[2].replace(/\n$/, '')` (`:141`) and `clean()`'s `.replace(/\n$/, '')` (`:229`). Model wrote
`line1\nline2\n\n\n`, file gets `line1\nline2\n\n` (`t1` A7); a file ending in a newline is written without
one (A8). Cosmetic on its own, but it means a FIND copied verbatim out of a file can differ from the file.

### A7. A REPLACE whose real last line is a fence loses it (`clean()`, `:229`) — `code here\n``` ` → `code here` (`t1` A9).

### A8. `ACTION: edit_file` + a lone fenced block + no FIND → rewritten as a WHOLE-FILE `write_file`

```js
249:    if (!find && fenced !== undefined && !/^[ \t]*FIND:/im.test(outside) && !/^[ \t]*LINES:/im.test(outside)) {
250:      return { tool: 'write_file', thought, args: { path: path || lastPath, content: stripLineNumberPrefixes(fenced) } };
```

Documented and defended in the source. It is also **the single most active transform in real data: 14 of 520
replies** (MoE 10, dense 32B 4, 14B 0) — `t6-classify.mjs`, `t7-shrink.mjs`. The models' own THOUGHTs say what
they meant:

- MoE `2a41c06d` n=3 — *"Now I need to **add** the main block with asserts…"* → `write_file s6_graph.py`, whole file replaced.
- MoE `6a657aa6` n=3 — *"I need to **add** the main block with asserts…"* → `write_file s2_logs.py`.
- 32B `bdde7cd3` n=2/4/6 — *"Since `parse_line` is already defined, I will **append**…"* → `write_file s2_logs.py`, and each time the answer was
  `ERROR: this write_file would have REMOVED 1 thing(s) s2_logs.py already had: parse_line.`

Four of the fourteen were stopped only by the def-loss guard in the tool layer. The parser turned "modify this
file" into "replace this file" and nothing between the two said so. (Whether the tool-layer guard is sufficient
is the tools auditor's call; from here, the parser is handing that guard a job the model never gave it.)

**One genuine reassurance:** a mid-line `ACTION:` mention does *not* hijack the action in practice. `parseAction`'s
`am = text.match(/ACTION:\s*([a-z_]+)/i)` (`:173`) is unanchored, so a THOUGHT reading *"I will use ACTION:
write_file later"* does take over (`t3` C12 — reproduced, yields `write_file` with **empty content**). But
across 520 real replies the count of true hijacks is **0** (`t6`). Reproducible, not yet real.

---

## B. Are `args` in the run record post-parse? Yes — entirely.

The chain, in `agent.js`:

```
3084:  const action = parseAction(raw, run.lastPath);
3140:  const { tool, args = {}, thought = '' } = act;
3448:  try { result = await tools[tool](args); }
3741/3755:  pushStep(run, { type: 'tool', tool, args, thought, result });
```

The **same object** that was destructured from the parser is passed to the tool and then recorded. So:

- `args` is an exact record of **what the tool received** — excellent for auditing tools.
- `args` carries **no trace whatsoever of what the model wrote**. Every transform in section A happens before
  `args` exists. An audit built on `args` cannot see A1-A8 even in principle.

Two mutations between parse and call, both worth knowing:
- `agent.js:2803` — `a.args.path = lp`, planBatch's sequential-lastPath fix. Batch mode only; `AGENT_BATCH_ACTIONS`
  is **off by default** (`agent.js:128`) and was off for these trials (no `batch` note in any run file).
- `~agent.js:3440` — `args.depth` injected for `spawn_subtask`.

On disk, `slimForDisk` (`agent.js:2157-2174`) caps any string arg at `RUN_ARG_MAX = 30_000` and appends
`… [N more characters not kept on disk]`. In-memory runs are untruncated.

**The raw model text lives only in `<runId>.transcript.jsonl`**, written by `appendTranscript`
(`agent.js:2218-2225`), one JSON object per model call: `{ ts, n, kind: 'plan'|'turn'|'subtask', sent, reply }`.
That file is the only artefact that can answer "what did the model actually write?". The loop never reads it.

---

## C. What silently drops an action?

| situation | what happens | is the model told? |
|---|---|---|
| no ACTION at all | `parseAction` → `null` | **Yes** — "did not contain a valid ACTION" + format reminder (`agent.js:3099`). 5 unparsed in the last 10 → run errors out (`:3088`) |
| unknown ACTION (`frobnicate`) | parser returns it with `args:{}` (`t3` C3); loop's `!tools[…]` check routes it | **Yes** — "Unknown tool" step + `TOOL ERROR` message (`agent.js:3377-3380`) |
| reply cut off in a code block (write) | `parseAction` → `null` (`:199`) | **Yes** — dedicated "cut off … send it in smaller pieces" message; verified live in 14B `382c6ce9` n=3 |
| reply cut off in a code block (edit) | parsed anyway, incomplete + stray fence | **No** — see A4 |
| **FIND present, REPLACE missing** | `findBare` needs a REPLACE lookahead → **`find` is discarded** | **Yes, but with a false statement** — see below |
| missing PATH on a write | falls back `lastPath → scavenged → langFile` (`:200`) | **No** — a PATH-less JS write with no `lastPath` silently becomes `script.js` (`t3` C2), despite the adjacent comment "refuse rather than invent a destination" |
| actions 2..N (flag off) | only the first runs | **Yes**, but the count can be wrong — see below |
| action after `finish` | not run | Flag off: covered by the same nudge. Flag on: reported by `closeBatch` as "came after finish"; `finish` itself is **held, never executed from a batch** (`planBatch` rule 3, `agent.js:2809-2818`) — verified in code, and `planBatch` bails to the single-action path when the split parse disagrees with the whole-text parse (`:2786`) |

**The FIND-with-no-REPLACE case is the one that misleads.** Real reply, MoE `c75eab5e` n=9, in full:

```
THOUGHT: I need to use edit_file to modify the existing file instead of trying to overwrite it completely. I'll add the asserts to the existing implementation.
ACTION: edit_file
PATH: s5_expr.js
FIND:
module.exports = { evaluate };
```

The model wrote a FIND. `findBare` requires `(?=\n[ \t]*REPLACE:)`; there is no REPLACE, so `find` is dropped and
`replace` defaults to `''` (`:235`). The recorded step (run `c75eab5e`, step n=16) is
`args={"path":"s5_expr.js","replace":""}` and the answer sent back to the model was:

> `ERROR: edit_file needs a FIND snippet — the exact text to replace. You sent PATH but no FIND.`

It *did* send a FIND; it omitted REPLACE. The tool's message is accurate about `args` and false about the reply,
because the parser is the thing that removed the FIND. That run ended `stopped`. (13 replies across the trials
reached `edit_file` with no `find`; 12 of those are legitimate `LINES:`-addressed edits, this is the one real loss.)

**The dropped-action count can also be false.** `agent.js:3110` counts with a raw regex over the *whole* reply:

```js
3110:  const extraActions = Math.max(0, (raw.match(/ACTION:\s*[a-z_]+/gi) || []).length - 1);
```

That regex reads inside fenced content, which the rest of the parser deliberately refuses to do (`outside`,
`:147`). A single `write_file` whose content contains `print("ACTION: write_file")` produces
`extraActions = 2` while `parseActions` correctly finds 1 action (`t3` C5) — the model is then told
*"You sent 3 actions… the other 2 were DISCARDED"* when it sent one. Fixed under the batch flag
(`:3118` uses `parseActions`), still live on the default path. Measured false nudges in these trials: **0**
(no model embedded an `ACTION:` line in file content). Genuine multi-action replies: **12**, 22 actions dropped,
2 of them a non-first `finish`.

---

## D. Replay against the three trials — parser output vs recorded `args`

`t2-replay.mjs`: every non-plan reply re-parsed with the real `parseAction`, `lastPath` reconstructed the way
`agent.js:3490` maintains it, then aligned in order against the run's `tool`/`finish`/`policy_*` steps.

```
replies        520      (14B 152, MoE 223, 32B 187 minus plan calls)
parsed         519
noAction         1      (the truncated write, correctly refused)
matchedSteps   509
argMismatch      0      <-- every key, every tool
toolMismatch     3
```

**Zero argument mismatches.** Across 509 aligned steps — 131 `edit_file`, 72 `write_file`, 33 `append_file`,
70 `read_file`, 70 `run_command`, 44 `run_python` and the rest — every recorded `args` value is byte-identical
to what the parser produces from the raw reply today.

The 3 `toolMismatch` entries are **alignment drift, not parser defects** (`t5-mismatch.mjs`): in each, the
reply is an `ACTION: finish` that the finish gate blocked, so it produced an `error` step instead of a
`tool`/`finish` step and the sequence slipped by one. Example: 32B `ee180f39` n=23, reply is `ACTION: finish`,
next recorded step is the preceding `edit_file`.

So the parser is deterministic and the run records faithfully reflect it. That is exactly what makes section A
invisible to `args`-based auditing.

---

## E. Line-number stripping on legitimate content

Answered in A1 with the table. Summary: **yes, it can corrupt legitimate content.** A Python/JS literal whose
keys sit at column 0 and ascend, a lone line beginning `NN: `, a time-like sequence, and `N: ` markdown are all
rewritten. Two guards do hold — indentation (`  1: "one",` survives, because `READ` is anchored at `^`) and
descending numbers (`3:/2:/1:` survives). The weak point is the single-line payload, where "ascending" cannot
fail. Real-world firing rate in these trials: 1 in 520, and that one was a correct catch.

---

## Summary: where what reached the tool differs from what the model wrote

Ordered by how much of a difference it makes, with real-data frequency:

1. **`ACTION: edit_file` + a lone fenced block → whole-file `write_file`.** 14/520 replies; models' THOUGHTs
   said "add"/"append" in every case sampled; 4 of the 14 were stopped only by the tool layer's def-loss guard
   (`would have REMOVED … parse_line`). `agentParse.js:249-251`.
2. **FIND silently discarded when REPLACE is missing**, and the model then told "you sent PATH but no FIND".
   Reproduced live: MoE `c75eab5e` n=9 → step n=16. `agentParse.js:232`.
3. **Truncated reply inside an edit's REPLACE is not refused**, and the opening ` ```js ` fence is delivered as
   file content. `agentParse.js:199` guards write/append only. 0 real hits, fully reproducible.
4. **Line-number stripping corrupts single-line and column-0 numeric content** on `content`/`find`/`replace`.
   `agentParse.js:38-52`. 1 real firing, correct.
5. **FIND/REPLACE truncated at a fence inside their own content** — delivers a prefix that may match elsewhere.
   `agentParse.js:230-231`.
6. **Bare REPLACE cut at any `TODO:`/`NOTE:`/`URL:`-shaped line.** `agentParse.js:233`. 1/129 replies used the
   bare form; 0 hits.
7. **CRLF replies lose FIND and REPLACE entirely**; no CR normalisation exists. `agentParse.js:232-233`. Latent.
8. **Trailing newlines and a final fence line trimmed** from content/FIND/REPLACE. `agentParse.js:141,229`.
9. **A false "you sent N actions" nudge** is possible because the count regex reads inside fenced content.
   `agent.js:3110`. 0 real hits; already fixed on the batch path only.
10. **A PATH-less write invents `script.js`/`main.py`/`index.html`** rather than refusing. `agentParse.js:200`.

**And the meta-finding for every other audit in this set:** `args` in a run record is the parser's output,
recorded post-call from the same object the tool received (`agent.js:3140 → 3448 → 3741`). It is ground truth
for "what did the tool get" and says nothing about "what did the model ask for". The only record of the
model's own words is `<runId>.transcript.jsonl` (`agent.js:2218`). Any claim about model intent must be read
from there.
