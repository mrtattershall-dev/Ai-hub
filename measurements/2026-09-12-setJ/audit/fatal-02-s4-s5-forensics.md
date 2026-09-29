# FATAL-02 — s4_markdown.py and s5_expr.js forensics

Read-only audit. Sets G, H, I, J; 10 arm-runs. Scope: the two projects that account for most of the
MoE's losses in every set.

**Headline.** Across sets G–J, over the goals each arm actually reached, chain 4 (s4_markdown.py)
scored **3/43** and chain 5 (s5_expr.js) scored **4/41** — **77 goals lost**. The single most
expensive mechanism is not the goals and not the checker: it is that **the model writes the
implementation and its own asserts from one reading of the goal, so a wrong reading produces asserts
that agree with it, and the hub's verification — "file parses, script exits 0" — cannot tell the
difference.** The wrong contract is then frozen into the workspace and the hidden checker scores
every later step of that chain against a contract the workspace abandoned at step 1.

Two genuine goal-wording defects exist and cost about 5 goals. The checker costs zero.

---

## A. What goals 4 and 14 actually require

### Goal 4 (chain 4, step 1) — `goals-J20.json[3]`, byte-identical in `goals-I20.json` and `goals-H.json`

> "Create s4_markdown.py with to_html(text): blocks separated by blank lines become `<p>...</p>`
> paragraphs (the lines inside a block are joined with one space, and the blocks are joined with
> `"\n"`), and the characters &, < and > are escaped as `&amp;`, `&lt;` and `&gt;`. Put the asserts
> under `if __name__ == "__main__":` and run it with python."

Checker, `tools/checks-J.mjs` const `S4`, function `s1()`:

```python
if h("Hello world") != "<p>Hello world</p>": return "one paragraph " + repr(...)
got = h("line one" + NL + "line two" + NL + NL + "next")
if got != "<p>line one line two</p>" + NL + "<p>next</p>": return "two paragraphs " + repr(got)
if h("a < b & c > d") != "<p>a &lt; b &amp; c &gt; d</p>": return "escaping " + repr(...)
if h("x" + NL + NL + NL + NL + "y") != "<p>x</p>" + NL + "<p>y</p>": return "several blank lines " + repr(...)
```

Three of the four assertions restate the goal. The fourth — `x\n\n\n\ny` yields two paragraphs and
**no empty `<p></p>`** — is not in the goal text.

### Goal 14 (chain 4, step 2)

> "Add headings to to_html in the EXISTING s4_markdown.py: a line that starts with 1 to 3 #
> characters and a space becomes `<h1>`, `<h2>` or `<h3>` with the rest of the line as its text, and
> it is always a block of its own, even with no blank line around it. Run it with python."

Checker, `S4` function `s2()`:

```python
got = h("# Title" + NL + "text under it" + NL + "## Sub" + NL + NL + "### Small")
if got != NL.join(["<h1>Title</h1>", "<p>text under it</p>", "<h2>Sub</h2>", "<h3>Small</h3>"]): ...
if h("#### four") != "<p>#### four</p>": return "four # is not a heading " + ...
if h("#nospace")  != "<p>#nospace</p>":  return "# without a space " + ...
```

**The checker blocks are byte-identical across all five sets.** md5 of the `S4` block =
`c3762a4ca2a9` in checks-F/G/H/I/J.mjs; `S5` = `c41a307e4957`. Nothing about the instrument changed
between sets, so cross-set comparison of these chains is sound.

---

## B. What each arm produced, and why it was wrong

77 losses, classified by the checker's own `why` string (attempted goals only):

| bucket | count | what it means |
|---|---|---|
| A. file does not parse at final state | 16 | `IndentationError` / `SyntaxError` / unterminated string — all 14B arms |
| B. undefined symbol at final state | 11 | `NameError: _escape_html`, `no result`, `evaluate is not defined` |
| C. did not reject an input the goal never named | 5 | `"2 3" did not throw` ×3, `"1 +" did not throw` ×2 |
| D. paragraph contract wrong (goal 4) | 4 | `<p>` missing, or one `<p>` per line |
| E. headings wrong or unwrapped (goal 14) | 5 | every arm that reached goal 14 and had a loadable file |
| F. other wrong output (mostly s5 parser incapacity) | 36 | `Invalid expression`, `2^3 gave 2`, `-(2+3)*2 gave NaN` |

These are **not one misunderstanding**. For s4 there are three distinct ones, and they are not equally
excusable:

**B1 — the `<p>` wrapper is simply dropped.** setJ-30b's final `to_html` returns
`'\n'.join(processed_blocks)` with no wrapping at all, and its own asserts encode that:

```python
assert to_html("Hello\nWorld") == "Hello World"          # setJ coder30b, s4_markdown.py
assert to_html("Hello\n\nWorld") == "Hello\nWorld"
```

The goal says "become `<p>...</p>` paragraphs". There is no reading of that sentence that yields
`"Hello World"`. **Model failure.**

**B2 — the heading test is applied to the BLOCK, not the LINE.** Two variants:

```python
# setJ coder30b — heading only when the block happens to be one line
if len(lines) == 1 and re.match(r'^#{1,3} .+', lines[0]):
```
```python
# setH coder30b-sethfix — the whole block is tested, so the block becomes one <h1>
if block.startswith('# ') or block.startswith('## ') or block.startswith('### '):
```

setH-sethfix therefore produced `'<h1>Title\ntext under it\n## Sub</h1>\n<h3>Small</h3>'`. The goal
says a heading "is always a block of its own, **even with no blank line around it**" — the exact
case both arms got wrong is the one the sentence was written to cover. **Model failure.**

**B3 — the heading is nested inside a paragraph.** setJ-14b:
`'<p><h1>Title</h1></p>\n<p>text under it</p>...'`. It appends heading blocks to the same list it
later wraps in `<p>`. **Model failure.**

For s5 the dominant failure (bucket F, 36) is plain parser incapacity, unrelated to wording:
`"1 + 2 * 3" gave 33` (setH-14b concatenated instead of computing), `"2^3" gave 2`,
`"-(2+3)*2" gave NaN`.

---

## C. Is the goal text itself ambiguous? Mostly no — with two real exceptions

**Goal 4: not ambiguous on the point that killed it.** The `<p>` requirement is explicit and quoted
verbatim in the goal. Zero of the 4 bucket-D losses can be blamed on wording.

One genuine under-specification exists: `h("x\n\n\n\ny")` must not emit `<p></p>`. Splitting on
`'\n\n'` — the obvious implementation of "blocks separated by blank lines" — produces an empty middle
block, and emitting `<p></p>` for it is a defensible reading. The reference solution avoids it only
because it flushes a paragraph buffer rather than splitting:

```python
def flush():
    if para:                       # refs/s4_markdown.py — empty blocks never reach blocks[]
        blocks.append("<p>" + _inline(" ".join(l.strip() for l in para)) + "</p>")
```

**Decisive cost of this defect: 1 goal** (setI-32b goal 4 — its `to_html` satisfied the other three
assertions and would have emitted `<p></p>` here). Contributory in 1 more (setG-30b).

**Goal 14: not ambiguous.** The unstated cases (`#### four`, `#nospace`) are implied by "1 to 3 #
characters and a space", and **no arm failed on those two lines** — every goal-14 failure was on the
first assertion, which the goal states in full. Cost of wording: 0.

---

## D. Goals 5 and 15 — here the wording *is* at fault

### Goal 5

> "Create s5_expr.js exporting evaluate(expr) that computes + - * / on numbers (integers and
> decimals) with the usual precedence and left-to-right order, **allowing spaces**; it throws an
> Error for division by zero and for anything it cannot parse."

Checker `S5` step 1 ends with:

```js
for (const bad of ['1 +', '', '2 3', '1 * * 2']) if (!throws(() => ev(bad))) return JSON.stringify(bad) + ' did not throw';
```

**`"2 3"` is a trap manufactured by the goal's own phrasing.** "Allowing spaces" cues exactly one
implementation, and every single arm wrote it:

```js
expr = expr.replace(/\s+/g, '');   // setJ 30b, setJ 32b, setJ 14b, setI 32b, setH 30b-sethfix …
```

After that line `"2 3"` **is** `"23"` — a valid number that must not throw. The reference never
strips; it skips whitespace during tokenization, so `"2 3"` is two `num` tokens and the trailing
token fails `if (i < toks.length) fail()`. Both are faithful readings of "allowing spaces"; only one
survives the hidden assertion, and the goal never says a space *between two numbers* is an error.

The decisive evidence: **setH coder30b-sethfix passed goals 15, 25, 35 and 45** — parentheses, unary
minus, the `^` operator, and variables — and still lost goal 5, on nothing but `"2 3" did not throw`.
An arm with a demonstrably working evaluator lost the goal to an unstated rejection case.

- **Goal 5 was never passed by any arm in sets G–J** (9 arm-attempts, 0 passes).
- 3 of those losses are decisively the `"2 3"` trap (setH-30b-sethfix, setJ-30b, setJ-32b).
- 2 more are `"1 +" did not throw`, which is *not* ambiguous — that is weak validation, a model failure.

### Goal 15

> "Make evaluate() in the EXISTING s5_expr.js handle parentheses and unary minus: `'-(2+3)*2'` is
> -10 and `'2*-3'` is -6. Run it with node."

Checker `S5` step 2 additionally demands `'(1 + 2) * (3 + 4)' = 21`, `'-3' = -3`,
`'2 * (3 + (4 - 1))' = 12`, and throws for `'(1 + 2'` and `'1 + 2)'`.

setJ-32b implemented **both named examples correctly** and failed on
`Cannot parse expression: (1+2)*(3+4)` — its `parseExpression` special-cases a *leading* `(`, then
requires `)`, which is sufficient for `-(2+3)*2` and `2*-3` and nothing else. The two worked examples
anchor a model to the narrowest implementation that satisfies them. "Handle parentheses" is generic
enough that this is arguably on the model, but the examples actively invite the narrow fix.
**Decisive cost: 1 goal.**

---

## E. The coupling: when goal 4 fails, is goal 14 winnable?

**No — proven from the assertion, not assumed.** Goal 14's first assertion is

```python
if got != NL.join(["<h1>Title</h1>", "<p>text under it</p>", "<h2>Sub</h2>", "<h3>Small</h3>"])
```

The string `"<p>text under it</p>"` is goal 4's paragraph contract applied to a one-line block.
Goal 14's requirement set is therefore a **strict superset** of goal 4's: any workspace whose
`to_html` does not wrap a plain line in `<p>` cannot pass goal 14 however perfect its heading code.

The clean empirical proof is setI-32b. Its final `to_html` emits **all three headings correctly**:

```
'<h1>Title</h1>\ntext under it\n<h2>Sub</h2>\n<h3>Small</h3>'
```

Every heading is right. The goal is lost solely on the missing `<p>` around "text under it".

Worse, setI shows the coupling running *backwards in time*. Its goal-4 run (`43017776`, done/verified)
left a file that returned `'<p>' + '</p>\n<p>'.join(...) + '</p>'` — correctly wrapped. Its goal-14
run (`de950b2d`) then replaced that very line at step n8:

```
edit_file  find: "return '<p>' + '</p>\n<p>'.join(escaped_paragraphs) + '</p>'"
           replace: "    return '\n'.join(escaped_paragraphs)"
```

Because the checker scores the **final** workspace, goal 14's run destroyed goal 4 as well. Both were
recorded as failures.

setH-30b-sethfix is the same class at larger scale. Goals 4 and 14 were both marked `done/verified`
when they ran. Then the **goal-44 run** ("Add links…", `460c3a73`) deleted the definition of
`_escape_html` at step n38, replaced only *one* of its call sites at n46, hit the 30-call budget at
n51 and stopped with the file broken. Final-state result: `NameError: name '_escape_html' is not
defined` on goals **4, 24, 34 and 44**. One late edit retroactively erased four goals that had
already been earned. That is the "set H s4 defect cost five goals" pattern — it is actually two
defects: this NameError (4 goals) plus the block-level heading misreading (goal 14).

---

## F. The existence proof: goal 14 *is* winnable

**setJ coder32b passed goal 4 and goal 14.** (The reference solution also passes 100/100 in sets F
and G, so the goals are satisfiable as written.) Within the s4 project family, coder32b-setj is the
only model arm to do it.

What it did differently is not better heading code — it is **better asserts at goal 4**:

```python
# setJ coder32b s4_markdown.py, written during goal 4
assert to_html("Hello World") == "<p>Hello World</p>"
assert to_html("Hello\nWorld") == "<p>Hello World</p>"
assert to_html("Hello\n\nWorld") == "<p>Hello</p>\n<p>World</p>"
```

Those asserts stayed in the file. During goal 14 (`58529db7`, 17 calls) the model made the same
mistake everyone else made — it changed `text.split('\n\n')` to `text.split('\n')` at step n4 — and
its own retained assert caught it, twice, in the run's own output:

```
n20 run_python: assert to_html("Hello\nWorld") == "<p>Hello World</p>"
                LEFT  to_html("Hello\nWorld")  ->  '<p>Hello</p>\n<p>World</p>'
n24 run_python: (same failure again)
```

It kept working — n25 append, n27 rewrite — until both paragraphs and headings passed. 17 model calls.

Contrast setJ-30b on the identical goal (`480ec4e6`, 8 calls, `done/verified`). Its goal-4 asserts
encoded the *wrong* contract, so at goal 14 they passed:

```
n8  run_python  ->  STDOUT: All tests passed!  EXIT: 0
n12 note: Verified (python): all 15 source file(s) pass a syntax check; `python s4_markdown.py` ran
          and exited cleanly — output: All tests passed!
n15 finish
```

The run was recorded as a success. It had produced `'# Title text under it ## Sub\n<h3>Small</h3>'`.

**That is the mechanism of the most expensive repeated failure in this project.** The model authors
the code and the test from one reading; a wrong reading makes the test agree with the code; the hub
verifies only that the file parses and the script exits 0; the run is marked verified; the wrong
contract becomes the workspace's ground truth and every later step of the chain inherits it. Correct
asserts at step 1 are what saved the only arm that won — and nothing in the hub produces or checks
them.

---

## Budget dimension

s4 + s5 consume a large and mostly wasted share of each arm's call budget:

| arm | total calls | s4 calls | s5 calls | s4+s5 share |
|---|---|---|---|---|
| setJ coder32b | 217 | 21 | 60 | **37.3%** |
| setJ coder30b | 216 | 16 | 60 | **35.2%** |
| setI coder32b | 265 | 35 | 34 | 26.0% |
| setH 30b-sethfix | 1051 | 108 | 134 | 23.0% |
| setJ coder14b | 134 | 12 | 8 | 14.9% |

In set J **all four s5 runs across the 30B and 32B arms hit the 30-call ceiling and were stopped**
(`Stopped: ran out of step budget (30 model calls)`) — 120 calls, zero goals. setJ-32b's goal-5 run
shows the shape of the waste: 18 `run_command` and 17 `edit_file` calls, with the identical
`Error: Cannot parse expression: 10/0` returned at n7, n13, n17, n21, n25 and n29.

One separate harness loss: **setJ coder14b never attempted goal 5.** Its log row reads
`5  interrupted  10  4  0  0  395  s5_expr.js:runs FN-MISSING(numbers)` and no run appears in
`index.jsonl`. The 395-second interrupt cost the goal outright, and the later goal-15 run inherited
a file whose `evaluate` calls itself recursively before definition (`evaluate is not defined`),
losing goal 15 too.

---

## Verdict — whose fault is it?

Over the 77 chain-4 / chain-5 goals lost across sets G–J (attempted-goal denominators: s4 **3/43**,
s5 **4/41**):

**Checker failures: 0 (0%).** The S4 and S5 check blocks are byte-identical across sets F–J, and the
reference solution passes 100/100 in both setF and setG. Where the checker asserts more than the goal
says, that is a goal-text defect, not an instrument defect.

**Goal-wording failures: ~5 (6%).**
- 3 — `"2 3" did not throw`, manufactured by "allowing spaces" cueing `replace(/\s+/g,'')`. Includes
  one arm (setH-30b-sethfix) that passed the next four steps of the same chain.
- 1 — setJ-32b goal 15, whose two named examples are satisfiable without general parentheses.
- 1 — setI-32b goal 4, the unstated "no empty `<p></p>`" rule.

**Model failures: ~72 (94%)** — but they split into two very different kinds, and only one is about
reading comprehension:

- **~45 are capability**: s5 parsers that compute `1 + 2 * 3 = 33`, headings tested per-block when
  the goal says per-line, `<p>` omitted when the goal quotes `<p>...</p>`. The goal text is not at
  fault for any of these.
- **~27 are workspace destruction** (buckets A and B): the file was unparseable or missing a symbol
  at final state. These are model edits, but the hub permitted every one of them to end a run and be
  recorded as complete, and in setH four already-earned goals were erased retroactively by a fifth
  run that stopped on budget with the file broken.

**The root cause, stated plainly.** The expensive failure is not that models cannot write a markdown
paragraph splitter. It is that **nothing in the loop ever checks the contract.** The model writes the
test, so the test inherits the misreading; the hub verifies syntax and exit code, so it certifies the
misreading; the workspace carries the misreading forward; and the hidden checker — which only runs at
the end, against the final state — bills the whole chain for a step-1 decision that was confirmed
"verified" ten goals earlier. The one arm that broke the pattern did so because its own step-1 asserts
happened to be right and were still in the file to fail loudly at step 2.

Two concrete, cheap corrections follow from the evidence:
1. **State the rejection cases in the goal text.** Goal 5 should say a space between two numbers is
   an error (or drop the `"2 3"` assertion); goal 4 should say empty blocks produce nothing; goal 15
   should name a second, non-leading parenthesis case. Cost of not doing so: ~5 goals so far.
2. **Do not let a run be marked `verified` on "parses + exit 0" alone**, and do not let a run that
   stops on budget leave the workspace in a state that fails goals already earned. The `_escape_html`
   incident alone was worth four goals in one arm.

---

### Evidence index (absolute paths)

- Goals: `C:/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-12-setJ/goals-J20.json`
  (indices 3, 4, 13, 14); identical text in `.../2026-09-12-setI/goals-I20.json` and
  `.../2026-09-12-setH/goals-H.json`
- Checker: `.../2026-09-12-setJ/tools/checks-J.mjs`, const `S4` (md5 `c3762a4ca2a9`) and const `S5`
  (md5 `c41a307e4957`); identical in checks-F/G/H/I.mjs
- Reference solution: `.../2026-09-11-setG/refs/s4_markdown.py`, `.../2026-09-11-setG/refs/s5_expr.js`
- Passing arm: `.../2026-09-12-setJ/data/coder32b-setj/workspace/s4_markdown.py`;
  runs `.../runs/coder32b-setj/runs/afb0e731-….json` (goal 4) and `58529db7-….json` (goal 14)
- Wrong-contract arm: `.../2026-09-12-setJ/data/coder30b-setj/workspace/s4_markdown.py`;
  runs `e7e990f0-….json` (goal 4), `480ec4e6-….json` (goal 14)
- Backwards coupling: `.../2026-09-12-setI/runs/coder32b-seti/runs/de950b2d-….json` step n8
- Retroactive erasure: `.../2026-09-12-setH/runs/coder30b-sethfix/runs/460c3a73-….json` steps n38, n46, n51
- Skipped goal: `.../2026-09-12-setJ/coder14b-setj-setJ.log` line 20
